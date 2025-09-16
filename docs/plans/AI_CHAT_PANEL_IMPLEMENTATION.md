# AI Chat Panel Implementation Plan

## Overview
Port the complete AI assistant panel with full persona management from the coincrew app to the calendar app. This includes all advanced features: persona switching, avatar management, state persistence, and sophisticated chat interface with markdown/code rendering.

## Current Status
- ✅ All AI components created and dependencies installed
- ✅ AI SDK packages installed: `@ai-sdk/react`, `ai`, `streamdown`, `react-markdown`, etc.
- ✅ Syntax highlighting, markdown rendering, code blocks with copy functionality
- 🔄 Ready for database schema, hooks, and UI integration

## Technical Architecture

### Components Already Created
Located in `apps/calendar/src/components/ai/`:
- `conversation.tsx` - Chat container with auto-scroll and streaming support
- `message.tsx` - Message bubbles, avatars, user/assistant styling
- `prompt-input.tsx` - Input field with Enter/Shift+Enter handling, status icons
- `response.tsx` - Full markdown rendering with custom components
- `code-block.tsx` - Syntax highlighted code with copy buttons (light/dark themes)
- `loader.tsx` - Custom spinning loader icon
- `error-alert.tsx` - Error display with dismiss functionality
- `suggestion.tsx` - Clickable suggestion buttons
- `index.ts` - Component exports

### Dependencies Installed
```json
{
  "@ai-sdk/react": "^2.0.44",
  "ai": "^5.0.44",
  "react-markdown": "^10.1.0",
  "streamdown": "^1.2.0",
  "react-syntax-highlighter": "^15.6.6",
  "@types/react-syntax-highlighter": "^15.5.13",
  "rehype-highlight": "^7.0.2",
  "rehype-katex": "^7.0.1",
  "remark-gfm": "^4.0.1",
  "remark-math": "^6.0.0",
  "katex": "^0.16.22"
}
```

## Implementation Steps

### 1. Database Schema Implementation

#### Create Migration File
`apps/calendar/supabase/migrations/YYYYMMDD_ai_personas.sql`

```sql
-- AI PERSONAS TABLE
CREATE TABLE public.ai_personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona_name TEXT NOT NULL,
    avatar_url TEXT,
    traits TEXT, -- Behavioral descriptions
    instructions TEXT, -- System instructions for AI
    greeting TEXT, -- Custom greeting message
    temperature NUMERIC(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
    is_default BOOLEAN DEFAULT FALSE,
    properties_ext JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEXES
CREATE INDEX idx_ai_personas_user_id ON public.ai_personas(user_id);
CREATE INDEX idx_ai_personas_created_at ON public.ai_personas(created_at DESC);
CREATE INDEX idx_ai_personas_is_default ON public.ai_personas(user_id, is_default) WHERE is_default = TRUE;

-- UPDATED_AT TRIGGER
CREATE TRIGGER ai_personas_updated_at
    BEFORE UPDATE ON public.ai_personas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- SINGLE DEFAULT PERSONA CONSTRAINT
CREATE OR REPLACE FUNCTION public.ensure_single_default_persona()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.ai_personas
        SET is_default = FALSE
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_persona
    BEFORE INSERT OR UPDATE OF is_default ON public.ai_personas
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION public.ensure_single_default_persona();

-- ROW LEVEL SECURITY
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
    ON public.ai_personas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own personas"
    ON public.ai_personas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas"
    ON public.ai_personas FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personas"
    ON public.ai_personas FOR DELETE
    USING (auth.uid() = user_id);

-- STORAGE BUCKET FOR AVATARS
INSERT INTO storage.buckets (id, name, public, avif_autodetection, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    false,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- STORAGE POLICIES
CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- DEFAULT PERSONA HELPER
CREATE OR REPLACE FUNCTION public.get_or_create_default_persona(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_persona_id UUID;
BEGIN
    SELECT id INTO v_persona_id
    FROM public.ai_personas
    WHERE user_id = p_user_id AND is_default = TRUE
    LIMIT 1;

    IF v_persona_id IS NULL THEN
        INSERT INTO public.ai_personas (
            user_id,
            persona_name,
            traits,
            greeting,
            is_default
        ) VALUES (
            p_user_id,
            'Calendar Assistant',
            'Professional and helpful calendar and productivity assistant with expertise in time management, scheduling, and productivity optimization.',
            'Hello! I''m here to help with your calendar, scheduling, and productivity. How can I assist you today?',
            TRUE
        )
        RETURNING id INTO v_persona_id;
    END IF;

    RETURN v_persona_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Hooks Implementation

#### AI Personas Hook
`apps/calendar/src/hooks/use-ai-personas.ts`

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import type { Json } from '@/lib/supabase/database.types'

const supabase = createClient()

export interface AIPersona {
  id: string
  user_id: string
  persona_name: string
  avatar_url?: string | null
  traits?: string | null
  instructions?: string | null
  greeting?: string | null
  temperature: number
  is_default: boolean
  properties_ext?: Json
  created_at: string
  updated_at: string
}

export interface CreateAIPersonaInput {
  persona_name: string
  avatar_url?: string | null
  traits?: string | null
  instructions?: string | null
  greeting?: string | null
  temperature?: number
  is_default?: boolean
  properties_ext?: Json
}

export interface UpdateAIPersonaInput extends Partial<CreateAIPersonaInput> {
  id: string
}

export function useAIPersonas() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Fetch all AI personas for the current user
  const { data: personas = [], isLoading, error } = useQuery({
    queryKey: ['ai-personas', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching AI personas:', error)
        throw error
      }

      return data as AIPersona[]
    },
    enabled: !!user?.id,
  })

  // Create persona mutation
  const createPersonaMutation = useMutation({
    mutationFn: async (input: CreateAIPersonaInput) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_personas')
        .insert({
          ...input,
          user_id: user.id,
          temperature: input.temperature ?? 0.7,
          is_default: input.is_default ?? false,
        })
        .select()
        .single()

      if (error) throw error
      return data as AIPersona
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
      toast.success('AI persona created successfully')
    },
    onError: (error) => {
      toast.error('Failed to create AI persona')
      console.error('Create persona error:', error)
    },
  })

  // Update persona mutation
  const updatePersonaMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAIPersonaInput) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_personas')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) throw error
      return data[0] as AIPersona
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
    },
    onError: (error) => {
      console.error('Update persona error:', error)
    },
  })

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('ai_personas')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
      toast.success('AI persona deleted successfully')
    },
    onError: (error) => {
      toast.error('Failed to delete AI persona')
      console.error('Delete persona error:', error)
    },
  })

  // Upload avatar function
  const uploadAvatar = async (file: File): Promise<{ publicUrl: string }> => {
    if (!user?.id) throw new Error('User not authenticated')

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return { publicUrl }
  }

  return {
    personas,
    isLoading,
    error,
    createPersona: createPersonaMutation.mutate,
    updatePersona: updatePersonaMutation.mutate,
    deletePersona: deletePersonaMutation.mutate,
    uploadAvatar,
    isCreating: createPersonaMutation.isPending,
    isUpdating: updatePersonaMutation.isPending,
    isDeleting: deletePersonaMutation.isPending,
  }
}
```

#### User Profiles Hook
`apps/calendar/src/hooks/use-user-profiles.ts`

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

const supabase = createClient()

export interface UserProfile {
  id: string
  display_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export function useUserProfiles() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Query for user's profile
  const {
    data: profile,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Profile query error:', error)
        if (error.code !== 'PGRST116') {
          throw error
        }
      }

      return data as UserProfile | null
    },
    enabled: !!user,
  })

  // Upload avatar function
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('User not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(fileName)

      return { publicUrl }
    },
  })

  return {
    profile,
    loading,
    error,
    uploadAvatar: uploadAvatarMutation.mutateAsync,
    isUploadingAvatar: uploadAvatarMutation.isPending,
  }
}
```

### 3. State Management Extension

Extend `apps/calendar/src/store/app.ts`:

```typescript
export interface AppState {
  // ... existing state ...

  // AI Assistant Panel state
  aiPanelOpen: boolean
  aiSelectedPersonaId: string | null
  aiSelectedModel: string

  // AI Panel actions
  setAiPanelOpen: (open: boolean) => void
  toggleAiPanel: () => void
  setAiSelectedPersonaId: (personaId: string | null) => void
  setAiSelectedModel: (model: string) => void
}

// In the store implementation:
// AI Panel state
aiPanelOpen: false,
aiSelectedPersonaId: null,
aiSelectedModel: 'gpt-5-chat-latest',

// AI Panel actions
setAiPanelOpen: (aiPanelOpen: boolean) => set({ aiPanelOpen }),
toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
setAiSelectedPersonaId: (aiSelectedPersonaId: string | null) => set({ aiSelectedPersonaId }),
setAiSelectedModel: (aiSelectedModel: string) => set({ aiSelectedModel }),

// Add to partialize for persistence:
partialize: (state) => ({
  // ... existing ...
  aiPanelOpen: state.aiPanelOpen,
  aiSelectedPersonaId: state.aiSelectedPersonaId,
  aiSelectedModel: state.aiSelectedModel,
})
```

### 4. AI Assistant Panel Component

`apps/calendar/src/components/ai-assistant-panel.tsx`

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Square, Check, ChevronsUpDown, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { useAIPersonas } from '@/hooks/use-ai-personas'
import { useUserProfiles } from '@/hooks/use-user-profiles'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Conversation,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageAvatar,
  Response,
  Loader,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  Suggestion,
  ErrorAlert,
} from '@/components/ai'

const CALENDAR_SUGGESTIONS = [
  "Help me plan my week",
  "Suggest optimal meeting times",
  "Time blocking strategies",
  "Productivity tips for busy schedules",
  "How to handle calendar conflicts",
  "Work-life balance scheduling"
]

export function AIAssistantPanel() {
  const {
    aiSelectedPersonaId: selectedPersonaId,
    setAiSelectedPersonaId: setSelectedPersonaId
  } = useAppStore()

  const { user, session } = useAuth()
  const { profile } = useUserProfiles()
  const { personas } = useAIPersonas()

  const defaultPersona = personas.find(p => p.is_default)
  const selectedPersona = selectedPersonaId ? personas.find(p => p.id === selectedPersonaId) : null

  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)

  // Refs for current values to avoid stale closures
  const currentPersonaIdRef = useRef<string | null>(selectedPersonaId)
  const personasRef = useRef(personas)

  useEffect(() => {
    currentPersonaIdRef.current = selectedPersonaId
  }, [selectedPersonaId])

  useEffect(() => {
    personasRef.current = personas
  }, [personas])

  // Create transport with persona context
  const transport = new DefaultChatTransport({
    api: '/api/ai/chat', // We'll create this API route
    headers: () => {
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      return headers
    },
    body: () => {
      const currentPersonaId = currentPersonaIdRef.current
      const currentPersona = currentPersonaId ? personasRef.current.find(p => p.id === currentPersonaId) : null
      return {
        modelId: 'gpt-5-chat-latest', // or make this configurable
        personaId: currentPersonaId,
        personaName: currentPersona?.persona_name,
        personaTraits: currentPersona?.traits,
        personaInstructions: currentPersona?.instructions,
        personaTemperature: currentPersona?.temperature,
        personaAvatar: currentPersona?.avatar_url
      }
    }
  })

  const { messages: rawMessages, sendMessage: rawSendMessage, status, stop } = useChat({
    transport,
    onError: (error) => {
      let errorMessage = 'An error occurred while processing your request.'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as {message: unknown}).message)
      }
      setChatError(errorMessage)
    },
  })

  // Track persona per message
  const [messagePersonaMap, setMessagePersonaMap] = useState<Record<string, string>>({})
  const pendingPersonaRef = useRef<string | null>(null)

  const sendMessage = (message: { text: string; metadata?: { personaId: string | null } }) => {
    pendingPersonaRef.current = selectedPersonaId
    rawSendMessage(message)
  }

  // Stamp assistant messages with persona
  useEffect(() => {
    rawMessages.forEach(msg => {
      if (msg.role === 'assistant' && !messagePersonaMap[msg.id]) {
        const personaToUse = pendingPersonaRef.current || selectedPersonaId
        if (personaToUse) {
          setMessagePersonaMap(prev => {
            if (!prev[msg.id]) {
              return { ...prev, [msg.id]: personaToUse }
            }
            return prev
          })
          if (pendingPersonaRef.current) {
            pendingPersonaRef.current = null
          }
        }
      }
    })
  }, [rawMessages, messagePersonaMap, selectedPersonaId])

  // Process messages with persona metadata
  const messages = rawMessages.map(msg => {
    if (msg.role === 'assistant' && messagePersonaMap[msg.id]) {
      return {
        ...msg,
        metadata: {
          ...(msg.metadata || {}),
          personaId: messagePersonaMap[msg.id]
        }
      }
    }
    return msg
  })

  // Set default persona on mount
  useEffect(() => {
    if (selectedPersonaId === null && defaultPersona) {
      setSelectedPersonaId(defaultPersona.id)
    }
  }, [defaultPersona, selectedPersonaId, setSelectedPersonaId])

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="h-16 min-h-16 shrink-0 flex items-center px-4 border-b border-border">
        <div className="flex items-center space-x-2 flex-1">
          <Bot className="w-5 h-5" />
          {status === 'streaming' && (
            <Loader size={14} className="text-muted-foreground" />
          )}
        </div>

        {/* Persona Selector */}
        <Popover open={personaPopoverOpen} onOpenChange={setPersonaPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={personaPopoverOpen}
              className="w-[200px] h-8 justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedPersona ? (
                  <>
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={selectedPersona.avatar_url || undefined} />
                      <AvatarFallback>
                        <Bot className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{selectedPersona.persona_name}</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">No persona</span>
                  </>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search personas..." className="h-9" />
              <CommandList>
                <CommandEmpty>No personas found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="no-persona"
                    onSelect={() => {
                      setSelectedPersonaId(null)
                      setPersonaPopoverOpen(false)
                    }}
                    className="flex items-center"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        selectedPersonaId === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <User className="w-4 h-4 mr-2" />
                    <span>No persona</span>
                  </CommandItem>

                  {personas.map((persona) => (
                    <CommandItem
                      key={persona.id}
                      value={persona.persona_name}
                      onSelect={() => {
                        setSelectedPersonaId(persona.id)
                        setPersonaPopoverOpen(false)
                      }}
                      className="flex items-center"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 flex-shrink-0",
                          selectedPersonaId === persona.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Avatar className="w-4 h-4 mr-2">
                        <AvatarImage src={persona.avatar_url || undefined} />
                        <AvatarFallback>
                          <Bot className="w-3 h-3" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1">{persona.persona_name}</span>
                      {persona.is_default && (
                        <span className="text-xs text-muted-foreground ml-2">(Default)</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {status === 'streaming' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={stop}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            <Square className="w-4 h-4 mr-1" />
            Stop
          </Button>
        )}
      </div>

      {/* Messages */}
      <Conversation
        className="flex-1"
        isStreaming={status === 'streaming'}
      >
        {messages.length === 0 ? (
          <Message from="assistant">
            <MessageAvatar
              src={selectedPersona?.avatar_url || ""}
              name={selectedPersona?.persona_name || "AI"}
            />
            <MessageContent>
              <p>{selectedPersona?.greeting || "How can I help you with your calendar today?"}</p>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-3">Try one of these prompts:</p>
                <div className="flex flex-wrap gap-2">
                  {CALENDAR_SUGGESTIONS.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      suggestion={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={status === 'streaming'}
                      size="sm"
                      className="text-xs"
                    />
                  ))}
                </div>
              </div>
            </MessageContent>
          </Message>
        ) : (
          messages.map((message) => {
            const messagePersonaId = message.role === 'assistant'
              ? ((message as {metadata?: {personaId?: string}}).metadata?.personaId)
              : null
            const messagePersona = messagePersonaId
              ? personas.find(p => p.id === messagePersonaId)
              : null

            return (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={message.role === 'assistant'
                    ? (messagePersona?.avatar_url || "")
                    : (profile?.avatar_url || "")}
                  name={message.role === 'user'
                    ? (profile?.display_name || user?.email?.split('@')[0] || 'You')
                    : (messagePersona?.persona_name || 'AI')}
                />
                <MessageContent>
                  {message.parts ? (
                    message.parts.map((part: {type: string; text?: string}, i: number) => {
                      if (part.type === 'text') {
                        return <Response key={`${message.id}-${i}`}>{part.text}</Response>
                      }
                      return null
                    })
                  ) : null}
                </MessageContent>
              </Message>
            )
          })
        )}
        <ConversationScrollButton />
      </Conversation>

      {/* Error Alert */}
      {chatError && (
        <div className="px-4 pb-0">
          <ErrorAlert
            error={chatError}
            onDismiss={() => setChatError(null)}
            className="mb-0"
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-muted/20">
        <PromptInput
          onSubmit={(e) => {
            e.preventDefault()

            if (status === 'streaming') {
              stop()
              return
            }

            const formData = new FormData(e.currentTarget)
            const message = formData.get('message') as string

            if (!message?.trim()) return

            setChatError(null)
            sendMessage({
              text: message,
              metadata: { personaId: selectedPersonaId }
            })
            setInput('')
            e.currentTarget.reset()
          }}
        >
          <PromptInputTextarea
            placeholder="Ask me anything about your calendar..."
            disabled={status === 'streaming'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-muted/60 rounded-xl px-4 py-3 border border-border/50 shadow-xs transition-colors"
          />
          <PromptInputSubmit
            disabled={!input.trim() && status !== 'streaming'}
            status={status}
            size="icon"
            className="bg-primary hover:bg-primary/80 text-primary-foreground border-0 rounded-lg w-11 h-11"
          />
        </PromptInput>
      </div>
    </div>
  )
}
```

### 5. API Route Implementation

`apps/calendar/src/app/api/ai/chat/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// This will be the AI service endpoint - update based on your setup
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json()

    // Forward to AI service with persona context
    const response = await fetch(`${AI_SERVICE_URL}/api/agents/dynamicPersonaAgent/stream/vnext/ui`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('authorization') || '',
      },
      body: JSON.stringify({
        ...body,
        userId: user.id,
        // Add calendar-specific context
        systemContext: 'calendar_assistant',
      }),
    })

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`)
    }

    // Stream the response back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
```

### 6. Layout Integration

Modify `apps/calendar/src/app/calendar/page.tsx`:

```typescript
// Add imports
import { AIAssistantPanel } from '@/components/ai-assistant-panel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from 'react-resizable-panels'

// In the component, modify the return statement:
return (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset className="flex flex-col h-screen">
      <CalendarHeader
        // ... existing props ...
      />

      {/* Main Content Area - use ResizablePanelGroup for AI panel */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={aiPanelOpen ? 70 : 100} minSize={50}>
            <CalendarWeek
              ref={api}
              // ... existing props ...
            />
          </ResizablePanel>

          {aiPanelOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <AIAssistantPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </SidebarInset>

    <SettingsModal
      open={settingsModalOpen}
      onOpenChange={setSettingsModalOpen}
    />
  </SidebarProvider>
)
```

### 7. Environment Configuration

Add to `.env.local`:
```
AI_SERVICE_URL=http://localhost:3002
# For production: https://ai.yourservice.com
```

### 8. Future: Mastra AI Service Integration

For the separate Mastra AI service project in the calendar monorepo:

```
calendar-mono/
├── apps/
│   ├── calendar/          # Calendar app
│   └── ai-service/        # New Mastra AI service
├── packages/
│   └── shared/           # Shared types, utils
└── package.json
```

The AI service will:
- Handle persona-based AI interactions
- Integrate with calendar context
- Manage AI model routing
- Handle streaming responses
- Implement calendar-specific AI capabilities

## Next Steps After Client Work

1. **Create Mastra AI service app** in calendar monorepo
2. **Implement calendar-aware AI agents** that can:
   - Analyze calendar patterns
   - Suggest optimal meeting times
   - Provide productivity insights
   - Help with scheduling conflicts
3. **Enhanced persona management** with calendar-specific traits
4. **Real-time calendar integration** for AI context

This implementation maintains all the sophisticated features of the coincrew app while adapting perfectly to the calendar use case.
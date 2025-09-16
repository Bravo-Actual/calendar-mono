import { useEffect, useState, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Square, Check, ChevronsUpDown, User, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { useAIPersonas } from '@/hooks/use-ai-personas'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useAIModels, type ModelProvider } from '@/hooks/use-ai-models'
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
  // Use Zustand store for AI settings
  const {
    aiSelectedPersonaId: selectedPersonaId,
    setAiSelectedPersonaId: setSelectedPersonaId,
    aiSelectedModelId: selectedModelId,
    setAiSelectedModelId: setSelectedModelId
  } = useAppStore()

  // Get user profile and auth
  const { user, session } = useAuth()
  const { data: profile } = useUserProfile(user?.id)

  // Get AI personas and models
  const { personas, defaultPersona } = useAIPersonas()
  const { models, getModelsByProvider } = useAIModels()
  const selectedPersona = selectedPersonaId ? personas.find(p => p.id === selectedPersonaId) : null
  const selectedModel = models.find(m => m.id === selectedModelId)

  // Local state for UI elements
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('all')
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)

  // Create refs to store current values to avoid stale closures
  const currentPersonaIdRef = useRef<string | null>(selectedPersonaId);
  const personasRef = useRef(personas);

  // Update refs whenever values change
  useEffect(() => {
    currentPersonaIdRef.current = selectedPersonaId;
  }, [selectedPersonaId]);

  useEffect(() => {
    personasRef.current = personas;
  }, [personas]);

  // Create transport with a body function that reads from refs
  const transport = new DefaultChatTransport({
    api: `${process.env.NEXT_PUBLIC_AGENT_URL}/api/agents/dynamicPersonaAgent/stream/vnext/ui`,
    headers: () => {
      const headers: Record<string, string> = {};
      // Include JWT token if user is authenticated
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      return headers;
    },
    body: () => {
      const currentPersonaId = currentPersonaIdRef.current;
      const currentPersona = currentPersonaId ? personasRef.current.find(p => p.id === currentPersonaId) : null;
      const body = {
        modelId: selectedModelId,
        personaId: currentPersonaId,
        personaName: currentPersona?.persona_name,
        personaTraits: currentPersona?.traits,
        personaTemperature: currentPersona?.temperature,
        personaAvatar: currentPersona?.avatar_url
      };
      return body;
    }
  });

  const { messages: rawMessages, sendMessage: rawSendMessage, status, stop } = useChat({
    transport,
    onError: (error) => {
      // Extract error message from the error object
      let errorMessage = 'An error occurred while processing your request.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as {message: unknown}).message);
      }
      setChatError(errorMessage);
    },
  });

  // Store personaId with each message
  const [messagePersonaMap, setMessagePersonaMap] = useState<Record<string, string>>({});
  const pendingPersonaRef = useRef<string | null>(null);

  // Wrap sendMessage to track which persona is active when sending
  const sendMessage = (message: { text: string; metadata?: { personaId: string | null } }) => {
    // Track the current persona for the assistant's response
    pendingPersonaRef.current = selectedPersonaId;
    rawSendMessage(message);
  };

  // Stamp new assistant messages with the pending personaId
  useEffect(() => {
    rawMessages.forEach(msg => {
      if (msg.role === 'assistant' && !messagePersonaMap[msg.id]) {
        // New assistant message detected
        const personaToUse = pendingPersonaRef.current || selectedPersonaId;
        if (personaToUse) {
          setMessagePersonaMap(prev => {
            if (!prev[msg.id]) {
              return { ...prev, [msg.id]: personaToUse };
            }
            return prev;
          });
          // Clear the pending persona after using it
          if (pendingPersonaRef.current) {
            pendingPersonaRef.current = null;
          }
        }
      }
    });
  }, [rawMessages, messagePersonaMap, selectedPersonaId]);

  // Process messages to include stored personaId
  const messages = rawMessages.map(msg => {
    // Add the stored personaId to assistant messages
    if (msg.role === 'assistant' && messagePersonaMap[msg.id]) {
      return {
        ...msg,
        metadata: {
          ...(msg.metadata || {}),
          personaId: messagePersonaMap[msg.id]
        }
      };
    }
    return msg;
  });

  // Set default persona on mount if user hasn't selected one
  useEffect(() => {
    if (selectedPersonaId === null && defaultPersona) {
      setSelectedPersonaId(defaultPersona.id)
    }
  }, [defaultPersona, selectedPersonaId, setSelectedPersonaId])

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="h-16 min-h-16 shrink-0 flex items-center justify-between px-4 border-b border-border">
        {/* Persona Selector */}
        <Popover open={personaPopoverOpen} onOpenChange={setPersonaPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={personaPopoverOpen}
              className="flex-1 h-8 justify-between text-xs mr-2"
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
                  {/* No Persona Option */}
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

                  {/* User's Personas */}
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

        {/* Model Selector */}
        <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={modelPopoverOpen}
              className="flex-1 h-8 justify-between text-xs"
            >
              <span className="truncate">
                {selectedModel?.name || selectedModelId}
              </span>
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput placeholder="Search models by name..." className="h-9" />

              {/* Provider Filter Buttons */}
              <div className="flex flex-wrap gap-1 p-2 border-b">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'x-ai', label: 'Grok' },
                  { id: 'openai', label: 'OpenAI' },
                  { id: 'anthropic', label: 'Anthropic' },
                  { id: 'google', label: 'Gemini' },
                ].map((provider) => (
                  <Button
                    key={provider.id}
                    variant={selectedProvider === provider.id ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSelectedProvider(provider.id as ModelProvider)}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>

              <CommandList className="max-h-[300px]">
                <CommandEmpty>No models found.</CommandEmpty>

                {/* Filtered Models */}
                <CommandGroup>
                  {getModelsByProvider(selectedProvider).map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`${model.name} ${model.id} ${model.provider}`}
                      onSelect={() => {
                        setSelectedModelId(model.id)
                        setModelPopoverOpen(false)
                      }}
                      className="flex items-center py-3"
                    >
                      <Check
                        className={cn(
                          "mr-3 h-4 w-4 flex-shrink-0",
                          selectedModelId === model.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {model.provider}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {model.id}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {model.contextLength && (
                            <span>{Math.floor(model.contextLength / 1000)}k context</span>
                          )}
                          {model.supportsTools && (
                            <span className="text-green-600">✓ Tools</span>
                          )}
                          {model.supportsTemperature && (
                            <span className="text-blue-600">✓ Temperature</span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
              <p>{selectedPersona?.greeting || (selectedPersona ? "What's on your mind?" : "What can I help you with today?")}</p>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-3">Try one of these prompts to get started:</p>
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
            // Find the persona that generated this message (if it's an assistant message)
            // Only use the personaId stored with the message, no fallbacks
            const messagePersonaId = message.role === 'assistant'
              ? ((message as {metadata?: {personaId?: string}}).metadata?.personaId)
              : null;
            const messagePersona = messagePersonaId
              ? personas.find(p => p.id === messagePersonaId)
              : null;


            return (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={message.role === 'assistant'
                    ? (messagePersona?.avatar_url || "") // No fallback, empty if no persona found
                    : (profile?.avatar_url || "")}
                  name={message.role === 'user'
                    ? (profile?.display_name || user?.email?.split('@')[0] || 'You')
                    : (messagePersona?.persona_name || 'AI')} // Generic 'AI' if no persona found
                />
              <MessageContent>
                {message.parts ? (
                  message.parts.map((part: {type: string; text?: string}, i: number) => {
                    if (part.type === 'text') {
                      return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                    }
                    return null;
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
            e.preventDefault();

            // If streaming, stop the stream
            if (status === 'streaming') {
              // Mark the last message as stopped
              stop();
              return;
            }

            const formData = new FormData(e.currentTarget);
            const message = formData.get('message') as string;

            if (!message?.trim()) return;

            // Clear any existing error when sending a new message
            setChatError(null);
            sendMessage({
              text: message,
              metadata: { personaId: selectedPersonaId }
            });
            setInput('');
            e.currentTarget.reset();
          }}
        >
          <PromptInputTextarea
            placeholder="Ask me anything..."
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
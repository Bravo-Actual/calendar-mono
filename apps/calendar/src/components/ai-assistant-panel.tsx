import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Square, Check, ChevronsUpDown, User, Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
import { useAIPersonas } from '@/hooks/use-ai-personas'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useAIModels } from '@/hooks/use-ai-models'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConversationSelector } from '@/components/conversation-selector'
import { useChatConversations, type ChatConversation } from '@/hooks/use-chat-conversations'
import { useConversationMessages } from '@/hooks/use-conversation-messages'
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
  const { models } = useAIModels()
  // Local state for UI elements
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const { aiSelectedConversation: selectedConversation, setAiSelectedConversation: setSelectedConversation } = useAppStore()

  const { conversations, refetch: refetchConversations } = useChatConversations(selectedPersonaId)
  const { data: conversationMessages = [], isLoading: messagesLoading } = useConversationMessages(selectedConversation?.id)
  const selectedPersona = selectedPersonaId ? personas.find(p => p.id === selectedPersonaId) : null
  const selectedModel = models.find(m => m.id === selectedModelId)

  // Always have a conversation ID ready - either selected existing or pre-generated UUID
  const [newConversationId, setNewConversationId] = useState(() => crypto.randomUUID())
  const activeConversationId = selectedConversation?.id || newConversationId


  // Debug conversation state changes
  useEffect(() => {
    console.log('🔍 [AI Panel] selectedConversation from Zustand changed:', selectedConversation?.id || 'null')
    console.log('🔍 [AI Panel] selectedConversation object:', selectedConversation)
  }, [selectedConversation])

  // Handle case where selected conversation is deleted - auto-switch to most recent
  useEffect(() => {
    if (selectedConversation && conversations.length > 0) {
      // Check if the selected conversation still exists in the list
      const stillExists = conversations.some(c => c.id === selectedConversation.id)

      if (!stillExists) {
        console.log('🔍 [AI Panel] Selected conversation no longer exists, switching to most recent')
        // Selected conversation was deleted, switch to most recent
        setSelectedConversation(conversations[0])
      }
    }
  }, [conversations, selectedConversation, setSelectedConversation])


  // Create refs to store current values to avoid stale closures
  const currentPersonaIdRef = useRef<string | null>(selectedPersonaId);
  const personasRef = useRef(personas);
  const conversationsRef = useRef(conversations);
  const selectedConversationRef = useRef(selectedConversation);

  // Update refs whenever values change
  useEffect(() => {
    currentPersonaIdRef.current = selectedPersonaId;
  }, [selectedPersonaId]);

  useEffect(() => {
    personasRef.current = personas;
  }, [personas]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Auto-select most recent conversation when persona changes
  useEffect(() => {
    if (!selectedPersonaId) {
      setSelectedConversation(null);
      return;
    }


    // Check if we already have a conversation selected for this persona
    const currentConversation = selectedConversationRef.current;
    if (currentConversation) {
      try {
        const metadata = typeof currentConversation.metadata === 'string'
          ? JSON.parse(currentConversation.metadata)
          : currentConversation.metadata;
        if (metadata?.personaId === selectedPersonaId) {
          return;
        }
      } catch (error) {
        console.warn('Failed to parse conversation metadata:', error);
      }
    }

    // Find the most recent conversation for this persona
    const availableConversations = conversationsRef.current;
    const personaConversations = availableConversations.filter(conv => {
      try {
        const metadata = typeof conv.metadata === 'string'
          ? JSON.parse(conv.metadata)
          : conv.metadata;
        return metadata?.personaId === selectedPersonaId;
      } catch {
        return false;
      }
    });

    if (personaConversations.length > 0) {
      const mostRecent = personaConversations[0];
      setSelectedConversation(mostRecent);
    } else {
      // No conversations exist for this persona, create a new one
      const newConversation = {
        id: newConversationId,
        resourceId: user?.id || '',
        createdAt: new Date().toISOString(),
        title: 'New conversation'
      }
      setSelectedConversation(newConversation);
      setNewConversationId(crypto.randomUUID()); // Generate next UUID
    }
  }, [selectedPersonaId]); // Only depend on persona changes to avoid infinite loops

  // Create transport with memory data included in body - recreate when selectedConversation changes
  const transport = useMemo(() => {

    return new DefaultChatTransport({
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

        console.log('🔍 [Transport Body] Building request body...');
        console.log('🔍 [Transport Body] selectedConversation:', selectedConversation);
        console.log('🔍 [Transport Body] user?.id:', user?.id);

        const body = {
          // Use model from persona instead of separate selection
          modelId: currentPersona?.model_id || selectedModelId,
          personaId: currentPersonaId,
          personaName: currentPersona?.name,
          personaTraits: currentPersona?.traits,
          personaInstructions: currentPersona?.instructions,
          personaTemperature: currentPersona?.temperature,
          personaTopP: currentPersona?.top_p,
          personaAvatar: currentPersona?.avatar_url,
          // Always include memory data in proper Mastra format
          ...(user?.id ? {
            memory: {
              resource: user.id,
              thread: {
                id: selectedConversationRef.current?.id || newConversationId,
                metadata: {
                  personaId: currentPersonaId
                }
              }
            }
          } : {})
        };

        console.log('🔍 [Transport Body] Final body:', JSON.stringify(body, null, 2));
        return body;
      }
    });
  }, [selectedConversation?.id, selectedModelId, session?.access_token, user?.id, newConversationId, conversationMessages]);

  const chatKey = selectedConversation?.id || 'new-conversation';
  console.log('🔍 [useChat] Current key:', chatKey, 'for conversation:', selectedConversation?.id);

  // Force refresh messages when switching to existing conversations
  useEffect(() => {
    if (selectedConversation && !selectedConversation.isNew) {
      console.log('🔍 [useChat] Switching to existing conversation, ensuring messages are loaded');
      // The useConversationMessages hook will automatically refetch when conversationId changes
    }
  }, [selectedConversation?.id]);

  const { messages, sendMessage, status, stop } = useChat({
    key: chatKey, // Force remount when conversation changes
    transport,
    id: chatKey, // use the provided chat ID
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
    onFinish: (message, options) => {
      console.log('🔍 [useChat] onFinish called with message:', message);
      console.log('🔍 [useChat] onFinish options/metadata:', options);

      // After message is sent, refresh conversation list to show the newly created thread
      // This ensures the conversation appears in the dropdown after the first message
      if (selectedConversation) {
        console.log('✅ [useChat] Message sent, refreshing conversation list');
        setTimeout(() => {
          // Small delay to ensure Mastra has written to database
          refetchConversations();
        }, 100);
      }
    },
  });

  // Debug message loading
  useEffect(() => {
    console.log('🔍 [Messages] conversationMessages changed:', conversationMessages.length, 'messages for conversation:', selectedConversation?.id);
    console.log('🔍 [Messages] conversationMessages data:', conversationMessages);
    if (conversationMessages.length > 0) {
      console.log('🔍 [Messages] Sample message content:', conversationMessages[0].content);
      console.log('🔍 [Messages] Mapped for useChat:', conversationMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content
      })));
    }
  }, [conversationMessages, selectedConversation?.id]);

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
      {/* Header - Assistant Info */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10">
            <AvatarImage src={selectedPersona?.avatar_url || undefined} />
            <AvatarFallback>
              <Bot className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>

          {/* Assistant Name and Dropdown */}
          <div className="flex-1">
            <Popover open={personaPopoverOpen} onOpenChange={setPersonaPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto p-0 justify-start text-left hover:bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-base">
                      {selectedPersona?.name}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search personas..." className="h-9" />
              <CommandList>
                <CommandEmpty>No personas found.</CommandEmpty>
                <CommandGroup>
                  {personas.map((persona) => (
                    <CommandItem
                      key={persona.id}
                      value={persona.name}
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
                      <span className="flex-1">{persona.name}</span>
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
          </div>
        </div>
      </div>

      {/* Conversation Selector */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <ConversationSelector
          onCreateConversation={() => {
            setNewConversationId(crypto.randomUUID()) // Generate a new UUID for the next potential conversation
          }}
        />
      </div>

      {/* Messages */}
      <Conversation
        key={chatKey} // Force reinitialize when conversation changes
        className="flex-1 min-h-0"
        isStreaming={status === 'streaming'}
      >
        {!selectedConversation || (selectedConversation?.isNew && conversationMessages.length === 0 && messages.length === 0) ? (
          <Message from="assistant">
            <MessageAvatar
              src={selectedPersona?.avatar_url || undefined}
              name={selectedPersona?.name || "AI"}
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
          // Show database messages for existing conversations, useChat messages for new conversations
          (selectedConversation?.isNew ? messages : conversationMessages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            parts: [{ type: 'text', text: msg.content }],
            createdAt: new Date(msg.createdAt)
          }))).map((message) => {
            // Use the currently selected persona for assistant messages
            // Since AI SDK doesn't preserve persona metadata in messages,
            // we use the persona that was active when the conversation was happening
            const messagePersona = message.role === 'assistant' ? selectedPersona : null;

            return (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={message.role === 'assistant'
                    ? (messagePersona?.avatar_url || undefined) // Use undefined instead of empty string
                    : (profile?.avatar_url || undefined)}
                  name={message.role === 'user'
                    ? (profile?.display_name || user?.email?.split('@')[0] || 'You')
                    : (messagePersona?.name || 'AI')} // Generic 'AI' if no persona found
                />
              <MessageContent>
                {message.parts ? (
                  message.parts.map((part: {type: string; text?: string}, i: number) => {
                    if (part.type === 'text') {
                      return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                    }
                    return null;
                  })
                ) : (
                  <Response>{message.content}</Response>
                )}
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
              stop();
              return;
            }

            if (!input?.trim()) return;

            console.log('Sending message with conversation:', selectedConversation?.id)
            console.log('User ID:', user?.id)

            // Clear any existing error when sending a new message
            setChatError(null);
            sendMessage({
              text: input,
            });
            setInput('');
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
            disabled={!input?.trim() && status !== 'streaming'}
            status={status}
            size="icon"
            className="bg-primary hover:bg-primary/80 text-primary-foreground border-0 rounded-lg w-11 h-11"
          />
        </PromptInput>
      </div>
    </div>
  )
}
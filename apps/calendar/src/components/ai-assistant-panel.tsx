import { useEffect, useState, useRef, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useConversationSelection, usePersonaSelection } from '@/store/chat'
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
  // Use new chat store for conversation/persona state
  const { selectedPersonaId, setSelectedPersonaId } = usePersonaSelection()
  const { selectedConversationId, setSelectedConversationId, wasStartedAsNew, setWasStartedAsNew } = useConversationSelection()

  // Get user profile and auth
  const { user, session } = useAuth()
  const { data: profile } = useUserProfile(user?.id)
  const queryClient = useQueryClient()

  // Get AI personas and models
  const { personas, defaultPersona } = useAIPersonas()
  const { models } = useAIModels()
  // Local state for UI elements
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  // Find the selected conversation from conversations list
  const { conversations, refetch: refetchConversations, generateNewConversationId } = useChatConversations()
  const selectedConversation = conversations.find(conv => conv.id === selectedConversationId)
  const newConversation = conversations.find(conv => conv.isNew)

  // Only fetch stored messages if:
  // 1. We have a real conversation (not "new conversation")
  // 2. It was NOT started as new in this session (prevents conflicts with live useChat messages)
  const shouldFetchMessages = selectedConversationId && selectedConversation && !selectedConversation.isNew && !wasStartedAsNew
  const { data: conversationMessages = [], isLoading: messagesLoading } = useConversationMessages(
    shouldFetchMessages ? selectedConversationId : null
  )
  const selectedPersona = selectedPersonaId ? personas.find(p => p.id === selectedPersonaId) : null
  // Model is now defined in the persona, no separate model selection needed
  const activeConversationId = selectedConversationId || newConversation?.id



  // Handle case where selected conversation is deleted - auto-switch to most recent
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      // Check if the selected conversation still exists in the list
      const stillExists = conversations.some(c => c.id === selectedConversationId)

      if (!stillExists) {
        // Selected conversation was deleted, switch to most recent
        const mostRecent = conversations.find(c => !c.isNew)
        setSelectedConversationId(mostRecent?.id || null)
      }
    }
  }, [conversations, selectedConversationId, setSelectedConversationId])


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
      setSelectedConversationId(null);
      setWasStartedAsNew(false);
      return;
    }

    // Check if we already have a conversation selected for this persona
    if (selectedConversationId && selectedConversation) {
      try {
        const metadata = typeof selectedConversation.metadata === 'string'
          ? JSON.parse(selectedConversation.metadata)
          : selectedConversation.metadata;
        if (metadata?.personaId === selectedPersonaId) {
          return; // Already have correct conversation selected
        }
      } catch (error) {
        console.warn('Failed to parse conversation metadata:', error);
      }
    }

    // Find the most recent conversation for this persona
    const personaConversations = conversations.filter(conv => {
      if (conv.isNew) return false; // Skip "new conversation" entries
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
      // Select most recent conversation for this persona
      const mostRecent = personaConversations[0];
      setSelectedConversationId(mostRecent.id);
      setWasStartedAsNew(false);
    } else {
      // No conversations exist for this persona, fall back to new conversation
      const newConversation = conversations.find(conv => conv.isNew);
      if (newConversation) {
        setSelectedConversationId(newConversation.id);
        setWasStartedAsNew(true);
      }
    }
  }, [selectedPersonaId, conversations]);

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


        const body = {
          // Model is now defined in the persona
          modelId: currentPersona?.model_id,
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
                id: activeConversationId,
                metadata: {
                  personaId: currentPersonaId
                }
              }
            }
          } : {})
        };

        return body;
      }
    });
  }, [activeConversationId, session?.access_token, user?.id, conversationMessages]);

  const chatKey = selectedConversationId || 'new-conversation';

  // Force refresh stored messages when switching to existing conversations
  useEffect(() => {
    if (selectedConversationId && selectedConversation && !selectedConversation.isNew) {
      // Manually trigger a refetch of stored messages when switching to an existing conversation
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversationId] })
    }
  }, [selectedConversationId, selectedConversation, queryClient]);

  const { messages, sendMessage, status, stop } = useChat({
    id: activeConversationId, // Conversation ID from store or new conversation
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
    onFinish: (message, options) => {
      // If we just used the "new conversation" item, we need to refresh the conversations list
      // to get the real conversation and any title that Mastra generated, BUT keep the chat stable
      if (activeConversationId === newConversation?.id) {
        setTimeout(async () => {
          // Refresh conversations in background to get the real conversation from DB
          // This will show updated title in the dropdown but won't affect the active chat
          await refetchConversations();

          // Generate a fresh "new conversation" for next time (this only affects the dropdown)
          generateNewConversationId();

          // DON'T invalidate conversation-messages for new conversations -
          // the live useChat messages are the authoritative source until user switches conversations
        }, 500); // Give Mastra time to persist and generate title
      }
    },
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
        <ConversationSelector />
      </div>

      {/* Messages */}
      <Conversation
        key={chatKey} // Force reinitialize when conversation changes
        className="flex-1 min-h-0"
        isStreaming={status === 'streaming'}
      >
        {(!selectedConversationId || (conversationMessages.length === 0 && messages.length === 0)) ? (
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
          // Combine stored messages with live useChat messages, avoid duplicates
          [...conversationMessages, ...messages.filter(msg => !conversationMessages.some(cm => cm.id === msg.id))].map((message) => {
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
                {message.parts?.map((part: {type: string; text?: string}, i: number) => {
                  if (part.type === 'text') {
                    return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                  }
                  return null;
                })}
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
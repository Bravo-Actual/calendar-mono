import { useEffect, useState, useRef, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessagePart, UIToolInvocation } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useConversationSelection, usePersonaSelection } from '@/store/chat'
import { useAIPersonas } from '@/hooks/use-ai-personas'
import { useUserProfile } from '@/lib/data/queries'
import { useAIModels } from '@/hooks/use-ai-models'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/app'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConversationSelector } from '@/components/conversation-selector'
import { useChatConversations } from '@/hooks/use-chat-conversations'
import { useConversationMessages } from '@/hooks/use-conversation-messages'
import { getAvatarUrl } from '@/lib/avatar-utils'
import { getBestConversationForPersona } from '@/lib/conversation-helpers'
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
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
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

  // Get calendar context from app store
  const { currentCalendarContext } = useAppStore()

  // Get AI personas and models
  const { personas, defaultPersona } = useAIPersonas()
  const { models } = useAIModels()

  // Local state for UI elements
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  // Track previous persona to detect changes
  const previousPersonaIdRef = useRef(selectedPersonaId);

  // Handle persona changes and conversation selection
  useEffect(() => {
    // Check if persona actually changed
    const personaChanged = previousPersonaIdRef.current !== selectedPersonaId;

    if (personaChanged) {

      // Update ref for next comparison
      previousPersonaIdRef.current = selectedPersonaId;

      // Clear selection when switching personas
      setSelectedConversationId(null);
      setWasStartedAsNew(false);
    }

    // Auto-select best conversation when we have no selection
    // This will run both when persona changes (after clearing) and when conversations load
    if (selectedPersonaId && selectedConversationId === null && conversations.length > 0) {
      const bestId = getBestConversationForPersona(conversations, selectedPersonaId);

      if (bestId) {
        // Found a real conversation to select
        setSelectedConversationId(bestId);
        setWasStartedAsNew(false);
      } else {
        // No real conversations exist - select "new conversation"
        const newConv = conversations.find(c => c.isNew);
        if (newConv) {
          setSelectedConversationId(newConv.id);
          setWasStartedAsNew(true);
        }
      }
    }
  }, [selectedPersonaId, selectedConversationId, conversations, setSelectedConversationId, setWasStartedAsNew]);

  // Create transport with memory data included in body - recreate when selectedConversation changes
  const transport = useMemo(() => {
    // Use agent_id from persona, fallback to dynamicPersonaAgent if not set
    const agentId = selectedPersona?.agent_id || 'dynamicPersonaAgent';

    return new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_AGENT_URL}/api/agents/${agentId}/stream/vnext/ui`,
      headers: () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        // Include JWT token if user is authenticated
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
      },
      body: () => {
        const body = {
          // Model is now defined in the persona
          modelId: selectedPersona?.model_id,
          personaId: selectedPersonaId,
          personaName: selectedPersona?.name,
          personaTraits: selectedPersona?.traits,
          personaInstructions: selectedPersona?.instructions,
          personaTemperature: selectedPersona?.temperature,
          personaTopP: selectedPersona?.top_p,
          personaAvatar: selectedPersona?.avatar_url,
          // Always include memory data in proper Mastra format
          ...(user?.id ? {
            memory: {
              resource: user.id,
              thread: {
                id: activeConversationId,
                metadata: {
                  personaId: selectedPersonaId
                }
              }
            }
          } : {})
        };

        return body;
      }
    });
  }, [activeConversationId, session?.access_token, user?.id, conversationMessages, selectedPersonaId, personas, selectedPersona]);


  // Force refresh stored messages when switching to existing conversations
  useEffect(() => {
    if (selectedConversationId && selectedConversation && !selectedConversation.isNew) {
      // Manually trigger a refetch of stored messages when switching to an existing conversation
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversationId] })
    }
  }, [selectedConversationId, selectedConversation, queryClient]);

  const { messages, sendMessage, status, stop, addToolResult } = useChat({
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
    onFinish: () => {
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
    onToolCall({ toolCall }) {
      // Handle AI highlighting tool calls by updating the Zustand store
      const { setAiHighlightedEvents, setAiHighlightedTimeRanges } = useAppStore.getState();

      if (toolCall.toolName === 'highlightEventsTool') {
        // Try different possible property names for the arguments
        const args = (toolCall as any).args || (toolCall as any).arguments || (toolCall as any).parameters || (toolCall as any).input;

        if (!args) {
          console.error('No arguments found in tool call:', toolCall);
          return;
        }

        const { eventIds, action } = args as { eventIds: string[]; action: 'add' | 'replace' | 'clear' };

        if (action === 'clear') {
          setAiHighlightedEvents([]);
        } else {
          setAiHighlightedEvents(eventIds);
        }

        // Send result back to AI using addToolResult
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: true, highlightedCount: action === 'clear' ? 0 : eventIds.length }
        });
      }

      if (toolCall.toolName === 'highlightTimeRangesTool') {
        // Try different possible property names for the arguments
        const args = (toolCall as any).args || (toolCall as any).arguments || (toolCall as any).parameters || (toolCall as any).input;

        if (!args) {
          console.error('No arguments found in tool call:', toolCall);
          return;
        }

        const { timeRanges, action } = args as {
          timeRanges: Array<{start: string; end: string; description?: string}>;
          action: 'add' | 'replace' | 'clear'
        };

        if (action === 'clear') {
          setAiHighlightedTimeRanges([]);
        } else {
          setAiHighlightedTimeRanges(timeRanges);
        }

        // Send result back to AI using addToolResult
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: true, highlightedRanges: action === 'clear' ? 0 : timeRanges.length }
        });
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
            <AvatarImage src={getAvatarUrl(selectedPersona?.avatar_url) || undefined} />
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
                        <AvatarImage src={getAvatarUrl(persona.avatar_url) || undefined} />
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
        className="flex-1 min-h-0"
        isStreaming={status === 'streaming'}
      >
        {(!selectedConversationId) ? (
          // Empty state when no conversation selected - no text to avoid flashing
          <div className="flex-1" />
        ) : (conversationMessages.length === 0 && messages.length === 0) ? (
          <Message from="assistant">
            <MessageAvatar
              src={getAvatarUrl(selectedPersona?.avatar_url) || ""}
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
          (() => {
            // Process stored messages to extract createdAt from metadata
            const processedStoredMessages = conversationMessages.map((msg: any) => ({
              ...msg,
              createdAt: msg.metadata?.createdAt || msg.createdAt
            }));

            // Process live messages to add current timestamp if missing
            const processedLiveMessages = messages
              .filter(msg => !conversationMessages.some(cm => cm.id === msg.id))
              .map((msg: any) => ({
                ...msg,
                createdAt: msg.createdAt || new Date().toISOString()
              }));

            const combinedMessages = [...processedStoredMessages, ...processedLiveMessages];

            // Sort messages chronologically (oldest first)
            const sortedMessages = combinedMessages.sort((a, b) => {
              const aTime = new Date(a.createdAt).getTime();
              const bTime = new Date(b.createdAt).getTime();
              return aTime - bTime;
            });

            return sortedMessages;
          })().map((message, messageIndex) => {
            // Use the currently selected persona for assistant messages
            // Since AI SDK doesn't preserve persona metadata in messages,
            // we use the persona that was active when the conversation was happening
            const messagePersona = message.role === 'assistant' ? selectedPersona : null;

            return (
              <div key={`${message.id}-${messageIndex}`}>

                {/* ONE BUBBLE WITH ALL PARTS */}
                <Message from={message.role}>
                  <MessageAvatar
                    src={message.role === 'assistant'
                      ? getAvatarUrl(messagePersona?.avatar_url) || ""
                      : getAvatarUrl(profile?.avatar_url) || ""}
                    name={message.role === 'user'
                      ? (profile?.display_name || user?.email?.split('@')[0] || 'You')
                      : (messagePersona?.name || 'AI')}
                  />
                  <MessageContent>
                    {/* Render all parts in order */}
                    {message.parts?.map((part: any, i: number) => {
                      if (part.type === 'text') {
                        return (
                          <div key={`text-${i}`} className="mt-1">
                            <Response>{part.text}</Response>
                          </div>
                        );
                      }
                      if (part.type === 'tool-call') {
                        return (
                          <div key={`tool-call-${i}`} className="mt-1">
                            <Tool>
                              <ToolHeader
                                type={part.toolName || 'Tool'}
                                state={part.state || 'input-available'}
                              />
                              <ToolContent>
                                <ToolInput input={part.args || part.input || {}} />
                              </ToolContent>
                            </Tool>
                          </div>
                        );
                      }
                      if (part.type === 'tool-result') {
                        return (
                          <div key={`tool-result-${i}`} className="mt-1">
                            <Tool>
                              <ToolHeader
                                type={part.toolName || 'Tool'}
                                state={part.errorText ? 'output-error' : 'output-available'}
                              />
                              <ToolContent>
                                {part.args && <ToolInput input={part.args} />}
                                <ToolOutput
                                  output={part.result || part.output}
                                  errorText={part.errorText}
                                />
                              </ToolContent>
                            </Tool>
                          </div>
                        );
                      }
                      if (part.type === 'tool-invocation') {
                        return (
                          <div key={`tool-invocation-${i}`} className="mt-1">
                            <Tool>
                              <ToolHeader
                                type={part.toolInvocation?.toolName || 'Tool'}
                                state={part.toolInvocation?.state || 'result'}
                              />
                              <ToolContent>
                                {part.toolInvocation?.args && <ToolInput input={part.toolInvocation.args} />}
                                {part.toolInvocation?.result && (
                                  <ToolOutput
                                    output={part.toolInvocation.result}
                                    errorText={part.toolInvocation.error}
                                  />
                                )}
                              </ToolContent>
                            </Tool>
                          </div>
                        );
                      }
                      // Skip reasoning and other internal parts
                      return null;
                    })}

                    {/* Handle toolInvocations from streaming */}
                    {message.toolInvocations?.map((toolInvocation: any, i: number) => (
                      <div key={`streaming-tool-${i}`} className="mt-1">
                        <Tool>
                          <ToolHeader
                            type={toolInvocation.toolName}
                            state={toolInvocation.state}
                          />
                          <ToolContent>
                            {toolInvocation.args && <ToolInput input={toolInvocation.args} />}
                            {toolInvocation.result && (
                              <ToolOutput
                                output={toolInvocation.result}
                                errorText={toolInvocation.error}
                              />
                            )}
                          </ToolContent>
                        </Tool>
                      </div>
                    ))}

                    {/* Fallback for legacy content */}
                    {!message.parts && message.content && (
                      <Response>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</Response>
                    )}
                  </MessageContent>
                </Message>
              </div>
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
      <div className="border-t border-border p-4 bg-muted/20 space-y-3">
        {/* Calendar Context Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-calendar-context"
            checked={includeCalendarContext}
            onCheckedChange={(checked) => setIncludeCalendarContext(checked === true)}
          />
          <Label
            htmlFor="include-calendar-context"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Include Calendar Context
          </Label>
        </div>

        <PromptInput
          onSubmit={(e) => {
            e.preventDefault();

            // If streaming, stop the stream
            if (status === 'streaming') {
              stop();
              return;
            }

            if (!input?.trim()) return;

            // Detect if this was a keyboard submission by checking the submitter
            const wasKeyboardSubmission = !(e.nativeEvent as SubmitEvent).submitter;

            // Clear any existing error when sending a new message
            setChatError(null);
            sendMessage({
              text: input,
            }, {
              // Include calendar context in the request body if checkbox is checked
              body: includeCalendarContext ? { calendarContext: currentCalendarContext } : undefined
            });
            setInput('');

            // Refocus input if submission was via keyboard
            if (wasKeyboardSubmission) {
              // Use setTimeout to ensure the form has processed the submission
              setTimeout(() => {
                inputRef.current?.focus();
              }, 0);
            }
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!selectedConversationId}
            className="flex-1 bg-muted/60 rounded-xl px-4 py-3 border border-border/50 shadow-xs transition-colors disabled:opacity-50"
          />
          <PromptInputSubmit
            disabled={!selectedConversationId || (!input?.trim() && status !== 'streaming')}
            status={status}
            size="icon"
            className="bg-primary hover:bg-primary/80 text-primary-foreground border-0 rounded-lg w-11 h-11"
          />
        </PromptInput>
      </div>
    </div>
  )
}
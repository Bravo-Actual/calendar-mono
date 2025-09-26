import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessagePart, UIToolInvocation } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Check, ChevronDown } from 'lucide-react'
import { Message, MessageContent, MessageAvatar } from './ai/message'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { usePersonaSelection, useConversationSelection } from '@/store/chat'
import { useUserProfile } from '@/lib/data'
import { useAIModels } from '@/hooks/use-ai-models'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/app'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConversationSelector } from '@/components/conversation-selector'
import { useChatConversations } from '@/hooks/use-chat-conversations'
import { useConversationMessages } from '@/hooks/use-conversation-messages'
import { usePersonaSelectionLogic } from '@/hooks/use-persona-selection-logic'
import { useNewConversationExperience } from '@/hooks/use-new-conversation-experience'
import { getAvatarUrl } from '@/lib/avatar-utils'
import { highlightEventsTool, highlightTimeRangesTool, getHighlightsTool, manageHighlightsTool } from '@/tools'
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
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  ErrorAlert,
} from '@/components/ai'
import { GreetingMessage } from '@/components/ai/greeting-message'
import { MessageRenderer } from '@/components/ai/message-renderer'


export function AIAssistantPanel() {
  // Get user profile and auth
  const { user, session } = useAuth()
  const { data: profile } = useUserProfile(user?.id)

  // Calculate user display name and avatar (same logic as nav-user.tsx)
  const firstName = profile?.first_name || ''
  const lastName = profile?.last_name || ''
  const displayNameFromProfile = profile?.display_name || ''
  const fullNameFromParts = firstName && lastName ? `${firstName} ${lastName}` : ''
  const userDisplayName = displayNameFromProfile || fullNameFromParts || user?.email?.split('@')[0] || 'User'
  const userAvatar = getAvatarUrl(profile?.avatar_url) || ''
  const queryClient = useQueryClient()

  // Get calendar context from app store
  const { currentCalendarContext } = useAppStore()

  // Get AI models
  const { models } = useAIModels()

  // Simplified state management
  const { selectedPersonaId, personas, isLoading: personasLoading } = usePersonaSelectionLogic()
  const { setSelectedPersonaId } = usePersonaSelection()
  const { selectedConversationId, setSelectedConversationId, draftConversationId, setDraftConversationId } = useConversationSelection()

  // Get conversations for dropdown
  const { conversations, isLoading: conversationsLoading } = useChatConversations()

  // Handle conversation auto-creation and cleanup
  useEffect(() => {
    if (!selectedPersonaId || conversationsLoading) return

    // Auto-create draft conversation when persona has no conversations
    if (conversations.length === 0 && selectedConversationId === null && draftConversationId === null) {
      const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      console.log('🟢 Auto-generated draft conversation ID for persona with no conversations:', newId)
      setDraftConversationId(newId)
      return
    }

    // If current selected conversation was deleted, switch to best remaining conversation or draft mode
    if (selectedConversationId && !conversations.some(c => c.id === selectedConversationId)) {
      if (conversations.length > 0) {
        // Switch to most recent remaining conversation
        const mostRecent = conversations[0] // conversations are already sorted by most recent
        console.log('🟢 Selected conversation was deleted, switching to most recent:', mostRecent.id)
        setSelectedConversationId(mostRecent.id)
        setDraftConversationId(null)
      } else {
        // No conversations left, switch to draft mode
        const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        console.log('🟢 Last conversation deleted, creating new draft:', newId)
        setSelectedConversationId(null)
        setDraftConversationId(newId)
      }
    }
  }, [selectedPersonaId, conversations, conversationsLoading, selectedConversationId, draftConversationId, setSelectedConversationId, setDraftConversationId])

  // Active conversation ID for useChat: draft ID takes priority
  const activeConversationId = draftConversationId || selectedConversationId

  // Fetch messages only if we have a real conversation (not draft)
  const shouldFetchMessages = selectedConversationId !== null && draftConversationId === null

  const { greetingMessage, handleFirstMessageSent } = useNewConversationExperience({
    selectedPersonaId,
    personas
  })

  // Local state for UI elements
  const [personaPopoverOpen, setPersonaPopoverOpen] = useState(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get conversations data for conversation selector
  const { refetch: refetchConversations } = useChatConversations()

  // Only fetch messages for existing conversations (not drafts)
  const { data: conversationMessages = [] } = useConversationMessages(
    shouldFetchMessages ? selectedConversationId : null
  )

  const selectedPersona = selectedPersonaId ? personas.find(p => p.id === selectedPersonaId) : null



  // Create transport with memory data included in body
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
              ...(activeConversationId ? {
                thread: {
                  id: activeConversationId,
                  metadata: {
                    personaId: selectedPersonaId
                  }
                }
              } : {})
            }
          } : {})
        };

        console.log('Transport body:', {
          selectedConversationId,
          memoryIncludesThread: !!selectedConversationId
        });
        return body;
      }
    });
  }, [activeConversationId, session?.access_token, user?.id, selectedPersonaId, selectedPersona]);


  // TEMPORARILY DISABLED - Force refresh stored messages when switching conversations
  /*
  useEffect(() => {
    if (selectedConversationId) {
      // Manually trigger a refetch of stored messages when switching conversations
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversationId] })
    }
  }, [selectedConversationId, queryClient]);
  */

  // Restore the working useChat hook
  const { messages, sendMessage, status, stop, addToolResult } = useChat({
    id: activeConversationId || undefined,
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
      // Refresh conversations list to pick up new conversation with title
      setTimeout(async () => {
        await refetchConversations();
      }, 2000); // Give Mastra time to persist and generate title
    },
    async onToolCall({ toolCall }) {
      // Get tool arguments from various possible property names
      const args = (toolCall as any).args || (toolCall as any).arguments || (toolCall as any).parameters || (toolCall as any).input;

      if (!args) {
        console.error('No arguments found in tool call:', toolCall);
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: false, error: 'No arguments found in tool call' }
        });
        return;
      }

      // Handle highlight tools (database-backed)
      if (['highlightEventsTool', 'highlightTimeRangesTool', 'getHighlightsTool', 'manageHighlightsTool'].includes(toolCall.toolName)) {
        try {
          let result: any = null;

          // Execute the appropriate database-backed tool
          switch (toolCall.toolName) {
            case 'highlightEventsTool':
              result = await highlightEventsTool.execute?.({ context: { ...args, userId: user?.id } });
              break;

            case 'highlightTimeRangesTool':
              result = await highlightTimeRangesTool.execute?.({ context: { ...args, userId: user?.id } });
              break;

            case 'getHighlightsTool':
              result = await getHighlightsTool.execute?.({ context: { ...args, userId: user?.id } });
              break;

            case 'manageHighlightsTool':
              result = await manageHighlightsTool.execute?.({ context: { ...args, userId: user?.id } });
              break;
          }

          // Send tool execution result back to AI
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: result
          });

        } catch (error) {
          console.error('Error executing highlight tool:', error);
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            }
          });
        }
        return;
      }

      // Handle navigation tool (Zustand-based)
      if (toolCall.toolName === 'navigateCalendar') {
        // Handle calendar navigation tool calls by updating the calendar view
        const { setConsecutiveView, toggleSelectedDate, clearSelectedDates } = useAppStore.getState();

        // Try different possible property names for the arguments
        const args = (toolCall as any).args || (toolCall as any).arguments || (toolCall as any).parameters || (toolCall as any).input;

        if (!args) {
          console.error('No arguments found in navigation tool call:', toolCall);
          return;
        }

        try {
          if (args.dates && Array.isArray(args.dates)) {
            // Non-consecutive mode
            useAppStore.setState({ viewMode: 'non-consecutive' });
            clearSelectedDates();
            args.dates.forEach((dateStr: string) => {
              toggleSelectedDate(new Date(dateStr));
            });

            addToolResult({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                success: true,
                message: `Calendar navigated to ${args.dates.length} non-consecutive dates: ${args.dates.join(', ')}`,
                navigation: { mode: 'non-consecutive', dates: args.dates }
              }
            });
          } else if (args.startDate) {
            // Consecutive mode
            const startDate = args.startDate;
            const endDate = args.endDate || startDate;

            // Calculate day count
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
            const finalDayCount = Math.min(daysDiff + 1, 14);

            // Determine consecutive view type
            let consecutiveType: 'day' | 'week' | 'workweek' | 'custom-days';
            if (finalDayCount === 1) {
              consecutiveType = 'day';
            } else if (finalDayCount === 7) {
              consecutiveType = 'week';
            } else if (finalDayCount === 5) {
              consecutiveType = 'workweek';
            } else {
              consecutiveType = 'custom-days';
            }

            setConsecutiveView(consecutiveType, startDateObj, finalDayCount);

            addToolResult({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                success: true,
                message: `Calendar navigated to consecutive range: ${startDate} to ${endDate} (${finalDayCount} days)`,
                navigation: { mode: 'consecutive', consecutiveType, startDate, endDate, dayCount: finalDayCount }
              }
            });
          } else {
            addToolResult({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: {
                success: false,
                error: 'Must provide either startDate (for consecutive mode) or dates array (for non-consecutive mode)'
              }
            });
          }
        } catch (error) {
          console.error('Error handling navigation tool call:', error);
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: {
              success: false,
              error: `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          });
        }
      }
    },
  });

  // Show greeting if we're in draft mode AND no messages sent yet
  const showGreeting = draftConversationId !== null && messages.length === 0

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, [setInput]);


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
        <ConversationSelector
          conversations={conversations}
          selectedConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setSelectedConversationId(id)
            setDraftConversationId(null) // Selecting existing conversation clears draft
          }}
          onNewConversation={() => {
            const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
            console.log('🟢 Generated new draft conversation ID on + click:', newId)
            setSelectedConversationId(null) // Clear any existing conversation
            setDraftConversationId(newId) // Set draft ID
          }}
        />
      </div>

      {/* Messages */}
      <Conversation
        className="flex-1 min-h-0"
        isStreaming={status === 'streaming'}
      >
        {showGreeting ? (
          // New conversation or draft - show greeting
          <GreetingMessage
            selectedPersona={selectedPersona}
            greetingMessage={greetingMessage}
            onSuggestionClick={handleSuggestionClick}
            status={status}
          />
        ) : (
          // Existing conversation - show messages
          <>
            {conversationMessages.map(message => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={message.role === 'user'
                    ? userAvatar
                    : getAvatarUrl(selectedPersona?.avatar_url) || ''
                  }
                  name={message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'}
                />
                <MessageContent>
                  {message.parts?.map((part, index) =>
                    part.type === 'text' ? <span key={index}>{part.text}</span> : null,
                  )}
                </MessageContent>
              </Message>
            ))}
            {messages.map(message => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={message.role === 'user'
                    ? userAvatar
                    : getAvatarUrl(selectedPersona?.avatar_url) || ''
                  }
                  name={message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'}
                />
                <MessageContent>
                  {message.parts.map((part, index) =>
                    part.type === 'text' ? <span key={index}>{part.text}</span> : null,
                  )}
                </MessageContent>
              </Message>
            ))}
          </>
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
            disabled={!selectedPersonaId}
            className="flex-1 bg-muted/60 rounded-xl px-4 py-3 border border-border/50 shadow-xs transition-colors disabled:opacity-50"
          />
          <PromptInputSubmit
            disabled={!selectedPersonaId || (!input?.trim() && status !== 'streaming')}
            status={status}
            size="icon"
            className="bg-primary hover:bg-primary/80 text-primary-foreground border-0 rounded-lg w-11 h-11"
          />
        </PromptInput>
      </div>
    </div>
  )
}
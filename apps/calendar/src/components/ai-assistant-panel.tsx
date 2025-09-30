import { useChat } from '@ai-sdk/react';
import { useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport } from 'ai';
import { Bot } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isClientSideTool } from '@/ai-client-tools';
import {
  Conversation,
  ConversationScrollButton,
  ErrorAlert,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  Response,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai';
import { AgentConversationSelector } from '@/components/agent-conversation-selector';
import { GreetingMessage } from '@/components/ai/greeting-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useChatConversations } from '@/hooks/use-chat-conversations';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { useNewConversationExperience } from '@/hooks/use-new-conversation-experience';
import { usePersonaSelectionLogic } from '@/hooks/use-persona-selection-logic';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { db } from '@/lib/data-v2/base/dexie';
import { useUserProfile } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import { useConversationSelection, usePersonaSelection } from '@/store/chat';
import { Message, MessageAvatar, MessageContent } from './ai/message';

export function AIAssistantPanel() {
  // Get user profile and auth
  const { user, session } = useAuth();
  const profile = useUserProfile(user?.id);

  // Calculate user display name and avatar (same logic as nav-user.tsx)
  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const displayNameFromProfile = profile?.display_name || '';
  const fullNameFromParts = firstName && lastName ? `${firstName} ${lastName}` : '';
  const userDisplayName =
    displayNameFromProfile || fullNameFromParts || user?.email?.split('@')[0] || 'User';
  const userAvatar = getAvatarUrl(profile?.avatar_url) || '';
  const _queryClient = useQueryClient();

  // Get calendar context from app store
  const { currentCalendarContext } = useAppStore();

  // Use persona selection logic that handles fallbacks properly
  const { selectedPersonaId, personas } = usePersonaSelectionLogic();
  const { setSelectedPersonaId } = usePersonaSelection();
  const {
    selectedConversationId,
    setSelectedConversationId,
    draftConversationId,
    setDraftConversationId,
  } = useConversationSelection();

  // Get conversations for dropdown
  const { conversations, isLoading: conversationsLoading } = useChatConversations();

  // Query existing annotations for management tools

  // Helper function to get event times from Dexie (offline-first)
  const _getEventTimes = async (eventId: string): Promise<{ start_time: Date; end_time: Date }> => {
    try {
      const event = await db.events.get(eventId);
      if (event) {
        return {
          start_time: event.start_time,
          end_time: event.end_time,
        };
      }
    } catch (error) {
      console.warn('Failed to get event from Dexie:', error);
    }

    // Fallback if event not found in cache
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      start_time: now,
      end_time: oneHourLater,
    };
  };

  // Handle conversation auto-creation and cleanup
  useEffect(() => {
    if (!selectedPersonaId || conversationsLoading) return;

    // Check if we can exit draft mode: conversation now exists with title
    if (draftConversationId && conversations.length > 0) {
      const matchingConversation = conversations.find((c) => c.id === draftConversationId);
      if (matchingConversation?.title) {
        // Conversation is now persisted with a title - safe to exit draft mode
        setSelectedConversationId(draftConversationId);
        setDraftConversationId(null);
        return;
      }
    }

    // Auto-create draft conversation when persona has no conversations
    if (
      conversations.length === 0 &&
      selectedConversationId === null &&
      draftConversationId === null
    ) {
      const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      setDraftConversationId(newId);
      return;
    }

    // If no conversation is selected but conversations exist, select most recent
    if (
      selectedConversationId === null &&
      draftConversationId === null &&
      conversations.length > 0
    ) {
      const mostRecent = conversations[0]; // conversations are already sorted by most recent
      setSelectedConversationId(mostRecent.id);
      return;
    }

    // If current selected conversation was deleted, switch to best remaining conversation or draft mode
    if (selectedConversationId && !conversations.some((c) => c.id === selectedConversationId)) {
      if (conversations.length > 0) {
        // Switch to most recent remaining conversation
        const mostRecent = conversations[0]; // conversations are already sorted by most recent
        setSelectedConversationId(mostRecent.id);
        setDraftConversationId(null);
      } else {
        // No conversations left, switch to draft mode
        const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        setSelectedConversationId(null);
        setDraftConversationId(newId);
      }
    }
  }, [
    selectedPersonaId,
    conversations,
    conversationsLoading,
    selectedConversationId,
    draftConversationId,
    setSelectedConversationId,
    setDraftConversationId,
  ]);

  // Active conversation ID for useChat: draft ID takes priority
  const activeConversationId = draftConversationId || selectedConversationId;

  const { greetingMessage } = useNewConversationExperience({
    selectedPersonaId,
    personas,
  });

  // Local state for UI elements
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get conversations data for conversation selector
  const { refetch: refetchConversations } = useChatConversations();

  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  // Create transport with memory data included in body
  const transport = useMemo(() => {
    // Use agent_id from persona, fallback to dynamicPersonaAgent if not set
    const agentId = selectedPersona?.agent_id || 'dynamicPersonaAgent';

    return new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_AGENT_URL}/api/agents/${agentId}/stream/vnext/ui`,
      headers: () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        // Include JWT token if user is authenticated
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
      },
      body: () => {
        const body = {
          // Send persona data using kebab-case keys that match agent expectations
          'model-id': selectedPersona?.model_id,
          'persona-id': selectedPersonaId,
          'persona-name': selectedPersona?.name,
          'persona-traits': selectedPersona?.traits,
          'persona-instructions': selectedPersona?.instructions,
          'persona-temperature': selectedPersona?.temperature,
          'persona-top-p': selectedPersona?.top_p,
          'persona-avatar': selectedPersona?.avatar_url,
          // Always include memory data in proper Mastra format
          ...(user?.id
            ? {
                memory: {
                  resource: user.id,
                  ...(activeConversationId
                    ? {
                        thread: {
                          id: activeConversationId,
                          metadata: {
                            personaId: selectedPersonaId,
                          },
                        },
                      }
                    : {}),
                },
              }
            : {}),
        };

        return body;
      },
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
    // Note: clientTools parameter may need to be passed differently for Mastra
    // The agent should know about these tools via the client-side tool definitions
    onError: (error) => {
      // Extract error message from the error object
      let errorMessage = 'An error occurred while processing your request.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      setChatError(errorMessage);
    },
    onFinish: () => {
      // Refresh conversations list to pick up new conversation with title
      refetchConversations();
      // Note: Draft mode transition happens in useEffect when conversation appears with title
    },
    async onToolCall({ toolCall }) {
      // Only handle client-side tools - let server tools be handled by AI SDK automatically
      if (!isClientSideTool(toolCall.toolName)) {
        return;
      }

      // Get tool arguments from various possible property names
      const toolCallWithArgs = toolCall as typeof toolCall & {
        args?: Record<string, unknown>;
        arguments?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
        input?: Record<string, unknown>;
      };
      const rawArgs =
        toolCallWithArgs.args ||
        toolCallWithArgs.arguments ||
        toolCallWithArgs.parameters ||
        toolCallWithArgs.input;

      // Type assertion for the expected tool argument structure
      const args = rawArgs as Record<string, unknown>;

      if (!args) {
        console.error('No arguments found in tool call:', toolCall);
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: false, error: 'No arguments found in tool call' },
        });
        return;
      }
    },
  });

  // Fetch messages only if we have a real conversation (not draft)
  // AND we don't already have messages loaded (to prevent duplicates when transitioning from draft)
  const shouldFetchMessages =
    selectedConversationId !== null && draftConversationId === null && messages.length === 0;

  // Only fetch messages for existing conversations (not drafts)
  const { data: conversationMessages = [] } = useConversationMessages(
    shouldFetchMessages ? selectedConversationId : null
  );

  // Show greeting if we're in draft mode AND no messages sent yet
  const showGreeting = draftConversationId !== null && messages.length === 0;

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-border">
      {/* Header - Combined Agent and Conversation Selector */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <AgentConversationSelector
          selectedPersonaId={selectedPersonaId}
          onSelectPersona={(id) => {
            setSelectedPersonaId(id);
          }}
          conversations={conversations}
          selectedConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setSelectedConversationId(id);
            setDraftConversationId(null); // Selecting existing conversation clears draft
          }}
          onNewConversation={() => {
            const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            setSelectedConversationId(null); // Clear any existing conversation
            setDraftConversationId(newId); // Set draft ID
          }}
        />
      </div>

      {/* Messages */}
      <Conversation className="flex-1 min-h-0" isStreaming={status === 'streaming'}>
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
            {conversationMessages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={
                    message.role === 'user'
                      ? userAvatar
                      : getAvatarUrl(selectedPersona?.avatar_url) || ''
                  }
                  name={message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'}
                />
                <MessageContent>
                  {message.parts?.map((part, index) =>
                    part.type === 'text' ? <Response key={index}>{part.text}</Response> : null
                  )}
                </MessageContent>
              </Message>
            ))}
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={
                    message.role === 'user'
                      ? userAvatar
                      : getAvatarUrl(selectedPersona?.avatar_url) || ''
                  }
                  name={message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'}
                />
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return <Response key={index}>{part.text}</Response>;
                    } else if (part.type.startsWith('tool-')) {
                      // Handle tool call parts
                      const toolPart = part as any; // Type assertion for tool parts
                      return (
                        <Tool key={index}>
                          <ToolHeader
                            type={toolPart.toolName || part.type}
                            state={toolPart.state || 'input-available'}
                          />
                          <ToolContent>
                            <ToolInput input={toolPart.input || toolPart.args} />
                            <ToolOutput
                              output={toolPart.output || toolPart.result}
                              errorText={toolPart.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
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
          <ErrorAlert error={chatError} onDismiss={() => setChatError(null)} className="mb-0" />
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
            sendMessage(
              {
                text: input,
                metadata: {
                  // Persona data is sent in request body using kebab-case keys - don't duplicate here
                  // personaId: selectedPersonaId,
                  // personaName: selectedPersona?.name,
                  // personaTraits: selectedPersona?.traits,
                  // personaInstructions: selectedPersona?.instructions,
                  // personaTemperature: selectedPersona?.temperature,
                  // personaTopP: selectedPersona?.top_p,
                  // personaAvatar: selectedPersona?.avatar_url,
                  // modelId: selectedPersona?.model_id,
                },
              },
              {
                // Include calendar context in the request body if checkbox is checked
                body: includeCalendarContext
                  ? { calendarContext: currentCalendarContext }
                  : undefined,
              }
            );
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
  );
}

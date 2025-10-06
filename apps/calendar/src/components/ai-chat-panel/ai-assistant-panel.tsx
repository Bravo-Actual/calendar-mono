import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeClientTool, isClientSideTool } from '@/ai-client-tools';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { usePersonaSelectionLogic } from '@/hooks/use-persona-selection-logic';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useAIThreads, useUserProfile } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import { useConversationSelection, usePersonaSelection } from '@/store/chat';
import { Message, MessageAvatar, MessageContent, MessageLoading } from '../ai/message';
import { AgentConversationSelector } from './agent-conversation-selector';

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
  const userAvatar = getAvatarUrl(profile?.avatar_url) || undefined;

  // Get calendar context from app store
  const { getCalendarContext } = useAppStore();

  // Use persona selection logic that handles fallbacks properly
  const { selectedPersonaId, personas } = usePersonaSelectionLogic();
  const { setSelectedPersonaId } = usePersonaSelection();
  const { selectedConversationId, setSelectedConversationId, threadIsNew, setThreadIsNew } =
    useConversationSelection();

  // Get threads from Dexie for conversation management
  const threadsQuery = useAIThreads(user?.id, selectedPersonaId || undefined);
  const threads = threadsQuery || [];
  const threadsLoaded = threadsQuery !== undefined;

  // Auto-select conversation for current persona
  const autoSelectConversation = useCallback(() => {
    if (!selectedPersonaId) {
      return;
    }

    // Select most recent thread for this persona, or create new
    if (threads.length > 0) {
      const mostRecent = threads[0];
      setSelectedConversationId(mostRecent.thread_id);
      setThreadIsNew(false);
    } else {
      const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      setSelectedConversationId(newId);
      setThreadIsNew(true);
    }
  }, [selectedPersonaId, threads, setSelectedConversationId, setThreadIsNew]);

  // Auto-select persona, then auto-select conversation
  const autoSelectPersona = useCallback(() => {
    // Find default persona or first available
    const defaultPersona = personas.find((p) => p.is_default) || personas[0];
    if (defaultPersona) {
      setSelectedPersonaId(defaultPersona.id);
      // Auto-select conversation will be triggered by effect after persona is set
    }
  }, [personas, setSelectedPersonaId]);

  // Effect 1: Trigger auto-select when needed
  useEffect(() => {
    if (!threadsLoaded) return;

    // Scenario 1: No persona selected - auto-select persona (which will then auto-select conversation)
    if (!selectedPersonaId) {
      autoSelectPersona();
      return;
    }

    // Scenario 2: No conversation selected - auto-select conversation for current persona
    if (selectedConversationId === null) {
      autoSelectConversation();
      return;
    }

    // Scenario 3: Selected conversation exists - ensure state is correct
    const selectedThreadExists = threads.some((t) => t.thread_id === selectedConversationId);
    if (selectedThreadExists) {
      if (threadIsNew) {
        setThreadIsNew(false);
      }
      return;
    }

    // Scenario 4: Selected conversation was deleted (doesn't exist and not marked as new)
    if (!threadIsNew) {
      autoSelectConversation();
    }
    // Scenario 5: Selected conversation is a draft (threadIsNew=true) - keep it
  }, [
    threadsLoaded,
    selectedPersonaId,
    selectedConversationId,
    threads,
    threadIsNew,
    autoSelectPersona,
    autoSelectConversation,
    setThreadIsNew,
  ]);

  // Effect 2: When a new thread gets persisted (gets a title), mark it as existing
  useEffect(() => {
    if (!selectedConversationId || !threadIsNew || !threadsLoaded) return;

    const thread = threads.find((t) => t.thread_id === selectedConversationId);
    if (thread?.title) {
      setThreadIsNew(false);
    }
  }, [selectedConversationId, threadIsNew, threadsLoaded, threads, setThreadIsNew]);

  // Get selected persona
  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  // Get greeting message from selected persona
  const greetingMessage = selectedPersona?.greeting || null;

  // Get messages for the conversation (handles both new and existing threads)
  const { data: initialMessages = [], isReady: messagesReady } = useConversationMessages(
    selectedConversationId,
    threadIsNew,
    greetingMessage
  );

  // Local state for UI elements
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track if conversation was new when first selected - captured once per conversation
  const wasNewOnMount = useRef(threadIsNew);
  const lastConversationId = useRef(selectedConversationId);
  const renderedMessageIds = useRef<Set<string>>(new Set());

  // Capture threadIsNew immediately when conversation changes (before first render)
  if (selectedConversationId !== lastConversationId.current) {
    wasNewOnMount.current = threadIsNew;
    lastConversationId.current = selectedConversationId;
    // Reset rendered messages when conversation changes
    renderedMessageIds.current = new Set();
  }

  // Create transport - use Mastra's built-in agent stream endpoint
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
          // Memory configuration (Mastra 0.20 format)
          ...(user?.id && selectedPersonaId
            ? {
                memory: {
                  resource: `${user.id}:${selectedPersonaId}`,
                  ...(selectedConversationId
                    ? {
                        thread: {
                          id: selectedConversationId,
                        },
                      }
                    : {}),
                },
              }
            : {}),

          // Agent execution options use agent defaults (maxSteps: 5 for calendar-assistant-agent)

          // Runtime context data (extracted by middleware from body.data)
          data: {
            // User and persona IDs
            'user-id': user?.id,
            'persona-id': selectedPersonaId,

            // Model settings
            'model-id': selectedPersona?.model_id,

            // Persona data
            'persona-name': selectedPersona?.name,
            'persona-traits': selectedPersona?.traits,
            'persona-instructions': selectedPersona?.instructions,
            'persona-temperature': selectedPersona?.temperature,
            'persona-top-p': selectedPersona?.top_p,
            'persona-avatar': selectedPersona?.avatar_url,

            // User timezone and datetime
            'user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            'user-current-datetime': new Date().toISOString(),
          },

          // Calendar context (optional)
          ...(includeCalendarContext ? { calendarContext: getCalendarContext() } : {}),
        };

        return body;
      },
    });
  }, [
    selectedConversationId,
    session?.access_token,
    user?.id,
    selectedPersonaId,
    selectedPersona,
    includeCalendarContext,
    getCalendarContext,
  ]);

  // Only pass valid id when messages are ready - this forces useChat to remount with correct messages
  // When not ready, use a temporary id so useChat doesn't try to seed with stale data
  const chatId = messagesReady ? selectedConversationId : `loading-${selectedConversationId}`;

  // useChat hook - will remount when chatId changes (when messagesReady becomes true)
  const { messages, sendMessage, status, stop, addToolResult } = useChat({
    id: chatId || undefined,
    messages: initialMessages,
    transport,
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
      // When we finish a message on a new thread, it's now persisted as an existing thread
      if (threadIsNew) {
        setThreadIsNew(false);
      }
    },
    async onToolCall({ toolCall }) {
      console.log('[AI Assistant] Tool call received:', toolCall.toolName, toolCall);

      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return;
      }

      // Only handle client-side tools - let server tools be handled by AI SDK automatically
      if (!isClientSideTool(toolCall.toolName)) {
        console.log('[AI Assistant] Not a client-side tool, skipping:', toolCall.toolName);
        return;
      }

      console.log('[AI Assistant] Executing client-side tool:', toolCall.toolName);

      // Get tool arguments from toolCall.input (AI SDK v5 format)
      const args = toolCall.input as Record<string, unknown>;

      console.log('[AI Assistant] Tool args:', args);

      if (!args) {
        console.error('No arguments found in tool call:', toolCall);
        // No await - avoids potential deadlocks
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: false, error: 'No arguments found in tool call' },
        });
        return;
      }

      console.log('[AI Assistant] About to call executeClientTool...');

      // Execute the client-side tool
      try {
        const result = await executeClientTool({ ...toolCall, args } as any, {
          user: user ? { id: user.id } : undefined,
          addToolResult,
        });

        console.log('[AI Assistant] Tool result:', result);

        // No await - avoids potential deadlocks
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result,
        });

        console.log('[AI Assistant] addToolResult called successfully');
      } catch (error) {
        console.error('[AI Assistant] Tool execution error:', error);
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    },
  });

  // Early return if user is not authenticated to prevent any API calls
  if (!user || !session) {
    return (
      <div className="w-full h-full flex flex-col bg-background border-l border-border">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Please sign in to use the AI Assistant</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header - Combined Agent and Conversation Selector */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <AgentConversationSelector
          selectedPersonaId={selectedPersonaId}
          onSelectPersona={(id) => {
            setSelectedPersonaId(id);
            // Clear conversation selection so useEffect picks most recent for new persona
            setSelectedConversationId(null);
          }}
          selectedConversationId={selectedConversationId}
          onSelectConversation={(id) => {
            setSelectedConversationId(id);
            setThreadIsNew(false);
          }}
          onNewConversation={() => {
            const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            setSelectedConversationId(newId);
            setThreadIsNew(true);
          }}
        />
      </div>

      {/* Messages */}
      <Conversation className="flex-1 min-h-0" isStreaming={status === 'streaming'}>
        {/* Only render messages when ready to prevent race condition */}
        {messagesReady && (
          <>
            {/* Show "New Conversation" indicator for threads that were new on mount */}
            {wasNewOnMount.current && (
              <div className="flex items-center justify-center py-4 px-4">
                <div className="flex items-center w-full max-w-md">
                  <div className="flex-1 border-t border-border" />
                  <p className="text-sm text-muted-foreground px-4">New Conversation</p>
                  <div className="flex-1 border-t border-border" />
                </div>
              </div>
            )}

            {messages.map((message, idx) => {
              // Check if this is an empty assistant message (waiting for stream)
              const isAssistantMessage = message.role === 'assistant';
              const hasNoContent =
                message.parts.length === 0 ||
                (message.parts.length === 1 &&
                  message.parts[0].type === 'text' &&
                  !message.parts[0].text);

              // Don't render empty assistant messages - show loading dots instead
              if (isAssistantMessage && hasNoContent) {
                return null;
              }

              // Check if this message should animate (haven't seen it before in this conversation)
              const shouldAnimate = !renderedMessageIds.current.has(message.id);

              return (
                <motion.div
                  key={message.id}
                  initial={shouldAnimate ? { opacity: 0, scale: 0.98 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                    delay: shouldAnimate ? idx * 0.03 : 0,
                  }}
                  onAnimationComplete={() => {
                    // Mark as rendered after animation completes
                    renderedMessageIds.current.add(message.id);
                  }}
                >
                  <Message from={message.role}>
                    <MessageAvatar
                      src={
                        message.role === 'user'
                          ? userAvatar
                          : getAvatarUrl(selectedPersona?.avatar_url) || undefined
                      }
                      name={
                        message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'
                      }
                    />
                    <MessageContent>
                      {message.parts.map((part, index) => {
                        console.log('[Message Part]', { index, type: part.type, part });

                        if (part.type === 'text') {
                          return <Response key={index}>{part.text}</Response>;
                        } else if (part.type === 'step-start') {
                          // Show step boundaries as horizontal lines (skip first step)
                          return index > 0 ? (
                            <div key={index} className="my-2">
                              <hr className="border-border" />
                            </div>
                          ) : null;
                        } else if (
                          part.type.startsWith('tool-') ||
                          part.type === 'dynamic-tool' ||
                          part.type === 'tool-invocation'
                        ) {
                          // Handle tool call parts (both typed and dynamic tools)
                          const toolPart = part as any; // Type assertion for tool parts

                          // Determine state: if has output/result, it's completed; if has error, it's error; otherwise running
                          let toolState = toolPart.state;
                          if (!toolState) {
                            if (toolPart.errorText) {
                              toolState = 'output-error';
                            } else if (toolPart.output || toolPart.result) {
                              toolState = 'output-available';
                            } else {
                              toolState = 'input-available';
                            }
                          }

                          // For dynamic tools or when toolName is available, use it; otherwise use part.type
                          const displayName =
                            toolPart.toolName || (part.type === 'dynamic-tool' ? 'Tool' : part.type);

                          return (
                            <Tool key={index}>
                              <ToolHeader type={displayName} state={toolState} />
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

                        // Unknown part type - render as JSON for debugging
                        console.warn('[Unknown Part Type]', part.type, part);
                        return (
                          <div key={index} className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                            Unknown part type: {part.type}
                          </div>
                        );
                      })}
                    </MessageContent>
                  </Message>
                </motion.div>
              );
            })}

            {/* Show loading dots when waiting for AI response */}
            {status === 'streaming' &&
              messages.length > 0 &&
              (() => {
                const lastMessage = messages[messages.length - 1];
                const isLastMessageAssistant = lastMessage.role === 'assistant';
                const hasNoContent =
                  lastMessage.parts.length === 0 ||
                  (lastMessage.parts.length === 1 &&
                    lastMessage.parts[0].type === 'text' &&
                    !lastMessage.parts[0].text);

                return isLastMessageAssistant && hasNoContent ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                    className="flex items-center gap-1.5 px-4 py-2"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-muted-foreground/40"
                        animate={{
                          y: [0, -6, 0],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </motion.div>
                ) : null;
              })()}
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
                  ? { calendarContext: getCalendarContext() }
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

'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeClientTool, isClientSideTool } from '@/ai-client-tools';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageAvatar,
  MessageContent,
  Response,
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { usePersonaSelectionLogic } from '@/hooks/use-persona-selection-logic';
import { AIAssistantError, sanitizeText } from '@/lib/ai-errors';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useAIThreads, useUserProfile } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import { useConversationSelection, usePersonaSelection } from '@/store/chat';
import { AgentConversationSelector } from './agent-conversation-selector';

export function AIAssistantPanelV2() {
  // Get user profile and auth
  const { user, session } = useAuth();
  const profile = useUserProfile(user?.id);

  // Calculate user display name and avatar
  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const displayNameFromProfile = profile?.display_name || '';
  const fullNameFromParts = firstName && lastName ? `${firstName} ${lastName}` : '';
  const userDisplayName =
    displayNameFromProfile || fullNameFromParts || user?.email?.split('@')[0] || 'User';
  const userAvatar = getAvatarUrl(profile?.avatar_url) || undefined;

  // Get calendar context and settings from app store
  const { getCalendarContext, showAllAiTools, triggerNavigationGlow } = useAppStore();

  // Use persona selection logic
  const { selectedPersonaId, personas, personasLoaded } = usePersonaSelectionLogic();
  const { setSelectedPersonaId } = usePersonaSelection();
  const { selectedConversationId, setSelectedConversationId, threadIsNew, setThreadIsNew } =
    useConversationSelection();

  // Get threads from Dexie
  const threadsQuery = useAIThreads(user?.id, selectedPersonaId || undefined);
  const threads = threadsQuery || [];
  const threadsLoaded = threadsQuery !== undefined;

  // Auto-select conversation for current persona
  const autoSelectConversation = useCallback(() => {
    if (!selectedPersonaId) return;

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

  // Auto-select persona
  const autoSelectPersona = useCallback(() => {
    const defaultPersona = personas.find((p) => p.is_default) || personas[0];
    if (defaultPersona) {
      setSelectedPersonaId(defaultPersona.id);
    }
  }, [personas, setSelectedPersonaId]);

  // Effect: Trigger auto-select when needed
  useEffect(() => {
    if (!threadsLoaded || !personasLoaded) return;

    if (!selectedPersonaId) {
      autoSelectPersona();
      return;
    }

    if (selectedConversationId === null) {
      autoSelectConversation();
      return;
    }

    const selectedThreadExists = threads.some((t) => t.thread_id === selectedConversationId);
    if (selectedThreadExists) {
      if (threadIsNew) setThreadIsNew(false);
      return;
    }

    if (!threadIsNew) {
      autoSelectConversation();
    }
  }, [
    threadsLoaded,
    selectedPersonaId,
    selectedConversationId,
    threads,
    threadIsNew,
    autoSelectPersona,
    autoSelectConversation,
    setThreadIsNew,
    personasLoaded,
  ]);

  // Effect: When thread gets title, mark as existing
  useEffect(() => {
    if (!selectedConversationId || !threadIsNew || !threadsLoaded) return;

    const thread = threads.find((t) => t.thread_id === selectedConversationId);
    if (thread?.title) {
      setThreadIsNew(false);
    }
  }, [selectedConversationId, threadIsNew, threadsLoaded, threads, setThreadIsNew]);

  // Track if conversation was new when first selected
  const wasNewOnMount = useRef(threadIsNew);
  const lastConversationId = useRef(selectedConversationId);
  const hasAnimated = useRef(false);

  if (selectedConversationId !== lastConversationId.current) {
    wasNewOnMount.current = threadIsNew;
    lastConversationId.current = selectedConversationId;
    // Reset animation flag when conversation changes
    hasAnimated.current = false;
  }

  useEffect(() => {
    if (!threadIsNew && wasNewOnMount.current) {
      wasNewOnMount.current = false;
    }
  }, [threadIsNew]);

  // Get selected persona
  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  // Get greeting message
  const greetingMessage = selectedPersona?.greeting || null;

  // Local state
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState<AIAssistantError | null>(null);
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get messages for conversation
  const { data: initialMessages = [], isReady: messagesReady } = useConversationMessages(
    selectedConversationId,
    wasNewOnMount.current,
    greetingMessage
  );

  // Create transport
  const transport = useMemo(() => {
    const agentId = selectedPersona?.agent_id || 'dynamicPersonaAgent';

    return new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_AGENT_URL}/api/agents/${agentId}/stream/vnext/ui`,
      headers: () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
      },
      body: () => {
        const body = {
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

          maxSteps: 10,

          data: {
            'user-id': user?.id,
            'persona-id': selectedPersonaId,
            'model-id': selectedPersona?.model_id,
            'persona-name': selectedPersona?.name,
            'persona-traits': selectedPersona?.traits,
            'persona-instructions': selectedPersona?.instructions,
            'persona-temperature': selectedPersona?.temperature,
            'persona-top-p': selectedPersona?.top_p,
            'persona-avatar': selectedPersona?.avatar_url,
            'user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            'user-current-datetime': new Date().toISOString(),
          },

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
    selectedPersona?.agent_id,
    selectedPersona?.model_id,
    selectedPersona?.name,
    selectedPersona?.traits,
    selectedPersona?.instructions,
    selectedPersona?.temperature,
    selectedPersona?.top_p,
    selectedPersona?.avatar_url,
    includeCalendarContext,
    getCalendarContext,
  ]);

  // Track the stable chatId - only update when conversation changes AND messages are ready
  const [stableChatId, setStableChatId] = useState<string | null>(null);

  useEffect(() => {
    // Only update chatId when we have a new conversation AND messages are ready
    if (selectedConversationId && messagesReady && stableChatId !== selectedConversationId) {
      setStableChatId(selectedConversationId);
    }
  }, [selectedConversationId, messagesReady, stableChatId]);

  // useChat hook - only reinitializes when stableChatId changes
  const { messages, sendMessage, status, stop, regenerate, addToolResult } = useChat({
    id: stableChatId || undefined,
    messages: initialMessages,
    transport,
    onError: (error) => {
      console.error('[AI Assistant V2] Stream error:', error);
      const aiError = AIAssistantError.fromError(error);
      setChatError(aiError);
    },
    onFinish: ({ message }) => {
      if (threadIsNew) {
        setThreadIsNew(false);
      }
    },
    async onToolCall({ toolCall }) {
      // Trigger navigation glow for navigation tools
      const navigationTools = ['navigateToDates', 'navigateToWorkWeek', 'navigateToWeek', 'navigateToDateRange', 'navigateToEvent'];
      if (navigationTools.includes(toolCall.toolName)) {
        triggerNavigationGlow();
      }

      if (toolCall.dynamic) return;
      if (!isClientSideTool(toolCall.toolName)) return;

      const args = toolCall.input as Record<string, unknown>;
      if (!args) {
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { success: false, error: 'No arguments found' },
        });
        return;
      }

      try {
        const result = await executeClientTool({ ...toolCall, args } as any, {
          user: user ? { id: user.id } : undefined,
          addToolResult,
        });

        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result,
        });
      } catch (error) {
        console.error('[AI Assistant V2] Tool error:', error);
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    },
  });

  console.log('[AI Assistant V2] useChat messages count:', messages.length, 'status:', status, 'stableChatId:', stableChatId, 'selectedConversationId:', selectedConversationId, 'messagesReady:', messagesReady);

  // Early return if not authenticated
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
      {/* Header */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <AgentConversationSelector
          selectedPersonaId={selectedPersonaId}
          onSelectPersona={(id) => {
            setSelectedPersonaId(id);
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
      <Conversation key={selectedConversationId} className="flex-1 min-h-0" initial="instant" resize="instant">
        <ConversationContent className="space-y-2.5 [&_.group]:py-2">
          {(() => {
            console.log('[AI Assistant V2] Rendering conversation - messagesReady:', messagesReady, 'messages.length:', messages.length, 'showAllAiTools:', showAllAiTools);
            return null;
          })()}
          {messages.length > 0 && (
            <>
              {/* New Conversation Indicator */}
              {wasNewOnMount.current && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center w-full max-w-md">
                    <div className="flex-1 border-t border-border" />
                    <p className="text-sm text-muted-foreground px-4">New Conversation</p>
                    <div className="flex-1 border-t border-border" />
                  </div>
                </div>
              )}

              {messages.map((message, idx) => {
              const isAssistantMessage = message.role === 'assistant';
              const hasNoContent =
                message.parts.length === 0 ||
                (message.parts.length === 1 &&
                  message.parts[0].type === 'text' &&
                  !message.parts[0].text);

              if (isAssistantMessage && hasNoContent) return null;

              // Determine if this message should animate
              const shouldAnimate = !hasAnimated.current;

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
                    // Mark as animated after last message completes
                    if (idx === messages.length - 1) {
                      hasAnimated.current = true;
                    }
                  }}
                >
                  <Message
                    from={message.role}
                    className="!justify-start !flex-row !items-start"
                  >
                  <MessageAvatar
                    src={
                      message.role === 'user'
                        ? userAvatar || ''
                        : getAvatarUrl(selectedPersona?.avatar_url) || ''
                    }
                    name={message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'}
                  />
                  <MessageContent variant="contained" className="!max-w-full">
                    {message.parts.map((part, index) => {
                      // Handle text parts - skip empty text
                      if (part.type === 'text') {
                        if (!part.text?.trim()) return null;
                        return <Response key={`text-${index}`}>{sanitizeText(part.text)}</Response>;
                      }

                      // Handle reasoning parts
                      if (part.type === 'reasoning') {
                        const reasoningPart = part as any;
                        const reasoningText =
                          reasoningPart.text ||
                          reasoningPart.reasoning ||
                          reasoningPart.details?.[0]?.text ||
                          '';

                        if (!reasoningText?.trim()) return null;
                        if (!showAllAiTools) return null; // Hide reasoning when showAllAiTools is off

                        return (
                          <Reasoning key={`reasoning-${index}`} defaultOpen={false}>
                            <ReasoningTrigger />
                            <ReasoningContent>{sanitizeText(reasoningText)}</ReasoningContent>
                          </Reasoning>
                        );
                      }

                      // Handle file attachments
                      if (part.type === 'file') {
                        // TODO: Add file rendering component
                        return null;
                      }

                      // Handle tool invocations
                      if (
                        part.type.startsWith('tool-') ||
                        part.type === 'dynamic-tool' ||
                        part.type === 'tool-invocation'
                      ) {
                        const toolPart = part as any;
                        const toolInv = toolPart.toolInvocation || toolPart;

                        // Determine tool state
                        let toolState = toolInv.state;
                        if (!toolState) {
                          if (toolInv.error || toolInv.errorText) {
                            toolState = 'output-error';
                          } else if (toolInv.output !== undefined || toolInv.result !== undefined) {
                            toolState = 'output-available';
                          } else {
                            toolState = 'input-available';
                          }
                        }

                        // Only show tools if:
                        // 1. showAllAiTools is enabled, OR
                        // 2. Tool has an error (output-error), OR
                        // 3. Tool needs user interaction (input-available/input-streaming with no output yet)
                        // Extract display name for title
                        let displayName = toolInv.toolName || toolInv.name || toolInv.tool?.name;
                        if (!displayName && part.type.startsWith('tool-')) {
                          displayName = part.type.substring(5);
                        }
                        if (!displayName) {
                          displayName = part.type === 'dynamic-tool' ? 'Tool' : part.type;
                        }

                        const hasOutput = toolInv.output !== undefined || toolInv.result !== undefined;
                        const needsUserInteraction =
                          (toolState === 'input-available' || toolState === 'input-streaming') && !hasOutput;

                        const shouldShowTool =
                          showAllAiTools || toolState === 'output-error' || needsUserInteraction;

                        console.log('[Tool visibility]', displayName, {
                          showAllAiTools,
                          toolState,
                          needsUserInteraction,
                          shouldShowTool,
                        });

                        if (!shouldShowTool) {
                          return null;
                        }

                        // Use stable key with toolCallId
                        const toolKey = toolInv.toolCallId || `tool-${part.type}-${index}`;
                        const toolInput = toolInv.args || toolInv.input;
                        const toolOutput = toolInv.result || toolInv.output;

                        return (
                          <Tool key={toolKey}>
                            <ToolHeader title={displayName} type={part.type as any} state={toolState} />
                            <ToolContent>
                              <ToolInput input={toolInput} />
                              <ToolOutput output={toolOutput} errorText={toolInv.errorText} />
                            </ToolContent>
                          </Tool>
                        );
                      }

                      // Handle step boundaries - only step-start exists in UIMessagePart
                      if (part.type === 'step-start') {
                        if (!showAllAiTools) return null; // Hide step separators when showAllAiTools is off
                        return index > 0 ? <Separator key={`sep-${index}`} className="my-2" /> : null;
                      }

                      // Unknown part type - return null
                      return null;
                    })}
                  </MessageContent>
                </Message>
                </motion.div>
              );
            })}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Error Display with Retry */}
      {chatError && (
        <div className="px-4 pb-2">
          <Message from="assistant">
            <MessageAvatar
              src={getAvatarUrl(selectedPersona?.avatar_url) || ''}
              name={selectedPersona?.name || 'AI'}
            />
            <MessageContent variant="flat" className="bg-destructive/10 text-destructive px-4 py-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1">{chatError.getUserMessage()}</p>
                  <button
                    onClick={() => setChatError(null)}
                    className="text-destructive/80 hover:text-destructive shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatError(null);
                    regenerate();
                  }}
                  className="text-sm underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            </MessageContent>
          </Message>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-muted/20 space-y-3">
        {/* Calendar Context Toggle and Dancing Dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-calendar-context"
              checked={includeCalendarContext}
              onCheckedChange={(checked) => setIncludeCalendarContext(checked === true)}
            />
            <Label htmlFor="include-calendar-context" className="text-sm text-muted-foreground">
              Include Calendar Context
            </Label>
          </div>

          {/* Dancing Dots Loading Indicator */}
          {status === 'streaming' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.6, 1, 0.6],
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
          )}
        </div>

        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();

            if (status === 'streaming') {
              stop();
              return;
            }

            if (!input?.trim()) return;

            const wasKeyboardSubmission = !(event.nativeEvent as SubmitEvent).submitter;

            setChatError(null);
            sendMessage(
              { text: input, metadata: {} },
              {
                body: includeCalendarContext ? { calendarContext: getCalendarContext() } : undefined,
              }
            );
            setInput('');

            if (wasKeyboardSubmission) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            placeholder="Ask me anything..."
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            disabled={!selectedPersonaId}
          />
          <PromptInputSubmit
            disabled={!selectedPersonaId || (!input?.trim() && status !== 'streaming')}
            status={status}
            size="icon-sm"
            className="mr-2 h-10 w-10"
          />
        </PromptInput>
      </div>
    </div>
  );
}

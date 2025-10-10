'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { createBrowserClient } from '@supabase/ssr';
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
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Response,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonaSelectionLogic } from '@/hooks/use-persona-selection-logic';
import { AIAssistantError, sanitizeText } from '@/lib/ai-errors';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useAIThreads, useUserProfile } from '@/lib/data-v2';
import { getMessagesForChat } from '@/lib/mastra-api';
import { useAppStore } from '@/store/app';
import { useChatStore, usePersonaSelection, useThreadSelection } from '@/store/chat';
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
  const { getCalendarContext, showAllAiTools, triggerNavigationGlow, timezone } = useAppStore();

  // Use persona selection logic
  const { selectedPersona, selectedPersonaId, setSelectedPersona } = usePersonaSelection();
  const { personas, personasLoaded } = usePersonaSelectionLogic();
  const {
    selectedThreadId,
    setSelectedThreadId: _setSelectedThreadId,
    selectedThreadIsNew,
    setSelectedThreadIsNew,
    selectedThreadIsLoaded,
    setSelectedThreadIsLoaded,
  } = useThreadSelection();

  // Get threads from Dexie
  const threadsQuery = useAIThreads(user?.id, selectedPersonaId || undefined);
  const threads = threadsQuery || [];
  const threadsLoaded = threadsQuery !== undefined;

  // Debug logging (commented out for production)
  // useEffect(() => {
  //   console.log('[Threads Debug]', {
  //     selectedPersonaId,
  //     threadsLoaded,
  //     threadsCount: threads.length,
  //     threads: threads.map(t => ({ id: t.thread_id, personaId: t.persona_id, title: t.title })),
  //   });
  // }, [selectedPersonaId, threadsLoaded, threads]);

  // Effect 1: Auto-select default persona on mount (only if none selected or invalid)
  useEffect(() => {
    if (!personasLoaded) return;

    // Check if persisted persona still exists
    const persistedPersonaExists =
      selectedPersona && personas.some((p) => p.id === selectedPersona.id);

    // If no persona selected OR persisted persona no longer exists, select default
    if (!persistedPersonaExists) {
      const defaultPersona = personas.find((p) => p.is_default) || personas[0];
      if (defaultPersona) {
        setSelectedPersona(defaultPersona);
      }
    }
  }, [personasLoaded, selectedPersona, personas, setSelectedPersona]);

  // Auto-select thread callback - query Dexie directly for fresh data
  const autoSelectThread = useCallback(async () => {
    if (!selectedPersonaId || !user?.id) return;

    // Query Dexie directly for threads matching this persona
    const { db } = await import('@/lib/data-v2/base/dexie');
    const freshThreads = await db.ai_threads
      .where('persona_id')
      .equals(selectedPersonaId)
      .toArray();

    const personaThreads = freshThreads
      .filter((t) => t.user_id === user.id)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    // console.log('[Auto-select] Auto-selecting thread', {
    //   threadsCount: personaThreads.length,
    //   selectedPersonaId,
    //   threads: personaThreads.map((t) => ({ id: t.thread_id, personaId: t.persona_id, title: t.title })),
    // });

    if (personaThreads.length > 0) {
      // console.log('[Auto-select] Selecting existing thread:', {
      //   threadId: personaThreads[0].thread_id,
      //   personaId: personaThreads[0].persona_id,
      //   title: personaThreads[0].title,
      // });
      useChatStore.setState({
        selectedThreadId: personaThreads[0].thread_id,
        selectedThreadIsNew: false,
        selectedThreadIsLoaded: false,
      });
    } else {
      const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      // console.log('[Auto-select] Creating new thread:', newId);
      useChatStore.setState({
        selectedThreadId: newId,
        selectedThreadIsNew: true,
        selectedThreadIsLoaded: false,
      });
    }
  }, [selectedPersonaId, user?.id]);

  // Effect 2: Trigger auto-select when needed
  useEffect(() => {
    if (!threadsLoaded || !personasLoaded) {
      // console.log('[Auto-select] Waiting for data', { threadsLoaded, personasLoaded });
      return;
    }

    if (!selectedPersonaId) {
      // console.log('[Auto-select] No persona selected');
      return;
    }

    if (selectedThreadId !== null) {
      // console.log('[Auto-select] Thread already selected:', selectedThreadId);
      return;
    }

    autoSelectThread();
  }, [threadsLoaded, personasLoaded, selectedPersonaId, selectedThreadId, autoSelectThread]);

  // Effect 3: When thread gets title, mark as existing
  useEffect(() => {
    if (!selectedThreadId || !selectedThreadIsNew || !threadsLoaded) return;

    const thread = threads.find((t) => t.thread_id === selectedThreadId);
    if (thread?.title) {
      setSelectedThreadIsNew(false);
    }
  }, [selectedThreadId, selectedThreadIsNew, threadsLoaded, threads, setSelectedThreadIsNew]);

  // Get greeting message from selected persona
  const greetingMessage = selectedPersona?.greeting || null;

  // Local state
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState<AIAssistantError | null>(null);
  const [includeCalendarContext, setIncludeCalendarContext] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  // Effect 4: Load messages when thread selected and not yet loaded
  useEffect(() => {
    if (!selectedThreadId || selectedThreadIsLoaded) return;

    // Load messages based on thread type
    const loadMessages = async () => {
      if (selectedThreadIsNew) {
        // New thread - show greeting
        if (greetingMessage) {
          setInitialMessages([
            {
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              role: 'assistant' as const,
              parts: [{ type: 'text' as const, text: greetingMessage }],
            },
          ]);
        } else {
          setInitialMessages([]);
        }
        setSelectedThreadIsLoaded(true);
      } else {
        // Existing thread - fetch messages
        try {
          const messages = await getMessagesForChat(selectedThreadId, 10, session?.access_token);
          setInitialMessages(messages);
          setSelectedThreadIsLoaded(true);
        } catch (error) {
          console.error('[AI Assistant V2] Failed to load messages:', error);
          setInitialMessages([]);
          setSelectedThreadIsLoaded(true);
        }
      }
    };

    loadMessages();
  }, [
    selectedThreadId,
    selectedThreadIsNew,
    selectedThreadIsLoaded,
    greetingMessage,
    session?.access_token,
    setSelectedThreadIsLoaded,
  ]);

  // Create transport
  const transport = useMemo(() => {
    const agentId = selectedPersona?.agent_id || 'dynamicPersonaAgent';
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    return new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_AGENT_URL}/api/agents/${agentId}/stream/vnext/ui`,
      headers: async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        // Get fresh session from Supabase to ensure we have the latest token
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.access_token) {
          headers.Authorization = `Bearer ${currentSession.access_token}`;
        }
        return headers;
      },
      body: () => {
        const body = {
          ...(user?.id && selectedPersonaId
            ? {
                memory: {
                  resource: `${user.id}:${selectedPersonaId}`,
                  ...(selectedThreadId
                    ? {
                        thread: {
                          id: selectedThreadId,
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
            'user-timezone': timezone,
            'user-current-datetime': new Date().toISOString(),
          },

          ...(includeCalendarContext ? { calendarContext: getCalendarContext() } : {}),
        };

        return body;
      },
    });
  }, [
    selectedThreadId,
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
    timezone,
    includeCalendarContext,
    getCalendarContext,
  ]);

  // useChat hook - only provide ID when thread is loaded
  const { messages, sendMessage, status, stop, regenerate, addToolResult } = useChat({
    id: selectedThreadIsLoaded && selectedThreadId ? selectedThreadId : undefined,
    messages: initialMessages,
    transport,
    onError: (error) => {
      console.error('[AI Assistant V2] Stream error:', error);
      const aiError = AIAssistantError.fromError(error);
      setChatError(aiError);
    },
    onFinish: ({ message: _message }) => {
      // Mark thread as saved when first message is sent
      if (selectedThreadIsNew) {
        setSelectedThreadIsNew(false);
      }
    },
    async onToolCall({ toolCall }) {
      console.log(
        '[AI Assistant V2] 🔧 onToolCall triggered:',
        toolCall.toolName,
        'dynamic:',
        toolCall.dynamic
      );

      // Trigger navigation glow for navigation tools
      const navigationTools = [
        'navigateToDates',
        'navigateToWorkWeek',
        'navigateToWeek',
        'navigateToDateRange',
        'navigateToEvent',
      ];
      if (navigationTools.includes(toolCall.toolName)) {
        triggerNavigationGlow();
      }

      // Only handle client-side navigation tools here
      // Server-side tools (with execute functions) are handled automatically by Mastra
      if (!isClientSideTool(toolCall.toolName)) {
        console.log('[AI Assistant V2] ⏭️ Skipping server-side tool:', toolCall.toolName);
        return;
      }

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
        console.log(
          '[AI Assistant V2] Executing client-side tool:',
          toolCall.toolName,
          toolCall.toolCallId
        );
        const result = await executeClientTool({ ...toolCall, args } as any, {
          user: user ? { id: user.id } : undefined,
          addToolResult,
        });

        console.log('[AI Assistant V2] Tool executed, calling addToolResult:', {
          toolName: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          result,
        });
        addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result,
        });
        console.log('[AI Assistant V2] addToolResult called successfully');
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
            const persona = personas.find((p) => p.id === id);
            if (persona) {
              setSelectedPersona(persona);
              // Persona change clears thread in store action
            }
          }}
          selectedThreadId={selectedThreadId}
          onSelectThread={(id) => {
            // Batch all state updates together
            useChatStore.setState({
              selectedThreadId: id,
              selectedThreadIsNew: false,
              selectedThreadIsLoaded: false,
            });
          }}
          onNewThread={() => {
            const newId = `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            // Batch all state updates together
            useChatStore.setState({
              selectedThreadId: newId,
              selectedThreadIsNew: true,
              selectedThreadIsLoaded: false,
            });
          }}
        />
      </div>
      {/* Messages */}
      <Conversation
        key={selectedThreadId}
        className="flex-1 min-h-0"
        initial="instant"
        resize="instant"
      >
        <ConversationContent className="space-y-2.5 [&_.group]:py-2">
          {messages.length > 0 &&
            messages.map((message, idx) => {
              const isAssistantMessage = message.role === 'assistant';
              const hasNoContent =
                message.parts.length === 0 ||
                (message.parts.length === 1 &&
                  message.parts[0].type === 'text' &&
                  !message.parts[0].text);

              if (isAssistantMessage && hasNoContent) return null;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                    delay: idx * 0.03,
                  }}
                >
                  <Message from={message.role} className="!justify-start !flex-row !items-start">
                    <MessageAvatar
                      src={
                        message.role === 'user'
                          ? userAvatar || ''
                          : getAvatarUrl(selectedPersona?.avatar_url) || ''
                      }
                      name={
                        message.role === 'user' ? userDisplayName : selectedPersona?.name || 'AI'
                      }
                    />
                    <MessageContent variant="contained" className="!max-w-full">
                      {message.parts.map((part, index) => {
                        // Handle text parts - skip empty text
                        if (part.type === 'text') {
                          if (!part.text?.trim()) return null;
                          return (
                            <Response key={`text-${index}`}>{sanitizeText(part.text)}</Response>
                          );
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
                            } else if (
                              toolInv.output !== undefined ||
                              toolInv.result !== undefined
                            ) {
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

                          const hasOutput =
                            toolInv.output !== undefined || toolInv.result !== undefined;
                          const needsUserInteraction =
                            (toolState === 'input-available' || toolState === 'input-streaming') &&
                            !hasOutput;

                          const shouldShowTool =
                            showAllAiTools || toolState === 'output-error' || needsUserInteraction;

                          if (!shouldShowTool) {
                            return null;
                          }

                          // Use stable key with toolCallId
                          const toolKey = toolInv.toolCallId || `tool-${part.type}-${index}`;
                          const toolInput = toolInv.args || toolInv.input;
                          const toolOutput = toolInv.result || toolInv.output;

                          return (
                            <Tool key={toolKey}>
                              <ToolHeader
                                title={displayName}
                                type={part.type as any}
                                state={toolState}
                              />
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
                          return index > 0 ? (
                            <Separator key={`sep-${index}`} className="my-2" />
                          ) : null;
                        }

                        // Unknown part type - return null
                        return null;
                      })}
                    </MessageContent>
                  </Message>
                </motion.div>
              );
            })}
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
                    type="button"
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
                body: includeCalendarContext
                  ? { calendarContext: getCalendarContext() }
                  : undefined,
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

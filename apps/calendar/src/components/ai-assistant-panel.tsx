import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
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
import { useCreateAnnotation, useDeleteAnnotation, useUpdateAnnotation, useUserAnnotations } from '@/lib/data'
import { db } from '@/lib/data/base/dexie'
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
  Response,
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

  // Use persona selection logic that handles fallbacks properly
  const { selectedPersonaId, personas, isLoading: personasLoading } = usePersonaSelectionLogic()
  const { setSelectedPersonaId } = usePersonaSelection()
  const { selectedConversationId, setSelectedConversationId, draftConversationId, setDraftConversationId } = useConversationSelection()

  // Get conversations for dropdown
  const { conversations, isLoading: conversationsLoading } = useChatConversations()

  // Annotation mutation hooks
  const createAnnotation = useCreateAnnotation(user?.id)
  const updateAnnotation = useUpdateAnnotation(user?.id)
  const deleteAnnotation = useDeleteAnnotation(user?.id)

  // Query existing annotations for management tools
  const { data: userAnnotations = [] } = useUserAnnotations(user?.id)

  // Helper function to get event times from Dexie (offline-first)
  const getEventTimes = async (eventId: string) => {
    try {
      const event = await db.events.get(eventId);
      if (event) {
        return {
          start_time: event.start_time,
          end_time: event.end_time
        };
      }
    } catch (error) {
      console.warn('Failed to get event from Dexie:', error);
    }

    // Fallback if event not found in cache
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      start_time: now.toISOString(),
      end_time: oneHourLater.toISOString()
    };
  };

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

        console.log('🚀 PERSONA DEBUG - Transport body (using kebab-case keys):', {
          selectedConversationId,
          activeConversationId,
          draftConversationId,
          memoryIncludesThread: !!activeConversationId,
          selectedPersonaId,
          personaDataInTransportBody: true,
          hasPersona: !!selectedPersona,
          personaName: selectedPersona?.name,
          personasCount: personas?.length || 0,
          personaIds: personas?.map(p => p.id) || []
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

      // Handle highlight management tool for all CRUD operations
      if (toolCall.toolName === 'aiCalendarHighlightsTool') {
        try {
          console.log('🔧 Executing aiCalendarHighlightsTool with args:', args);

          if (!user?.id) {
            throw new Error('User ID is required for highlight operations');
          }

          let result: any = null;

          // Handle batch operations if provided
          if (args.operations && Array.isArray(args.operations)) {
            const results = [];
            let totalCreated = 0;
            let totalUpdated = 0;
            let totalDeleted = 0;
            let totalCleared = 0;

            for (const operation of args.operations) {
              let opResult: any = null;

              switch (operation.action) {
                case 'create':
                  if (operation.type === 'events' && operation.eventIds) {
                    const promises = operation.eventIds.map(async (eventId: string) => {
                      // Get actual event times from Dexie (offline-first)
                      const eventTimes = await getEventTimes(eventId);

                      return createAnnotation.mutateAsync({
                        type: 'ai_event_highlight',
                        event_id: eventId,
                        start_time: eventTimes.start_time,
                        end_time: eventTimes.end_time,
                        message: operation.description || operation.title || null,
                        emoji_icon: operation.emoji || null,
                        title: operation.title || null,
                      });
                    });
                    const createResults = await Promise.all(promises);
                    totalCreated += createResults.length;
                    opResult = { action: 'create', type: 'events', count: createResults.length };
                  } else if (operation.type === 'time' && operation.timeRanges) {
                    const promises = operation.timeRanges.map((range: any) =>
                      createAnnotation.mutateAsync({
                        type: 'ai_time_highlight',
                        event_id: null,
                        start_time: range.start,
                        end_time: range.end,
                        message: range.description || operation.description || null,
                        emoji_icon: range.emoji || operation.emoji || null,
                        title: range.title || operation.title || null,
                      })
                    );
                    const createResults = await Promise.all(promises);
                    totalCreated += createResults.length;
                    opResult = { action: 'create', type: 'time', count: createResults.length };
                  }
                  break;

                case 'update':
                  if (operation.updates && Array.isArray(operation.updates)) {
                    const updatePromises = operation.updates.map(async (update: any) => {
                      const updateData: any = { id: update.id };
                      if (update.title !== undefined) updateData.title = update.title;
                      if (update.message !== undefined) updateData.message = update.message;
                      if (update.emoji !== undefined) updateData.emoji_icon = update.emoji;
                      if (update.visible !== undefined) updateData.visible = update.visible;
                      if (update.startTime !== undefined) updateData.start_time = update.startTime;
                      if (update.endTime !== undefined) updateData.end_time = update.endTime;
                      return updateAnnotation.mutateAsync(updateData);
                    });
                    await Promise.all(updatePromises);
                    totalUpdated += operation.updates.length;
                    opResult = { action: 'update', count: operation.updates.length };
                  }
                  break;

                case 'delete':
                  if (operation.highlightIds && Array.isArray(operation.highlightIds)) {
                    const deletePromises = operation.highlightIds.map((id: string) =>
                      deleteAnnotation.mutateAsync(id)
                    );
                    await Promise.all(deletePromises);
                    totalDeleted += operation.highlightIds.length;
                    opResult = { action: 'delete', count: operation.highlightIds.length };
                  }
                  break;

                case 'clear':
                  let targetHighlights = userAnnotations;
                  if (operation.type === 'events') {
                    targetHighlights = userAnnotations.filter(a => a.type === 'ai_event_highlight');
                  } else if (operation.type === 'time') {
                    targetHighlights = userAnnotations.filter(a => a.type === 'ai_time_highlight');
                  }
                  if (targetHighlights.length > 0) {
                    const deletePromises = targetHighlights.map(h => deleteAnnotation.mutateAsync(h.id));
                    await Promise.all(deletePromises);
                  }
                  totalCleared += targetHighlights.length;
                  opResult = { action: 'clear', type: operation.type || 'all', count: targetHighlights.length };
                  break;
              }

              if (opResult) {
                results.push(opResult);
              }
            }

            result = {
              success: true,
              batch: true,
              operations: results,
              summary: {
                created: totalCreated,
                updated: totalUpdated,
                deleted: totalDeleted,
                cleared: totalCleared,
                total: totalCreated + totalUpdated + totalDeleted + totalCleared
              },
              message: `Batch completed: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted, ${totalCleared} cleared`
            };

          } else {
            // Handle single operations (existing logic)
            switch (args.action) {
            case 'create':
              // Create highlights (both event and time highlights)
              if (args.type === 'events' && args.eventIds) {
                // Create event highlights
                const promises = args.eventIds.map(async (eventId: string) => {
                  // Get actual event times from Dexie (offline-first)
                  const eventTimes = await getEventTimes(eventId);

                  return createAnnotation.mutateAsync({
                    type: 'ai_event_highlight',
                    event_id: eventId,
                    start_time: eventTimes.start_time,
                    end_time: eventTimes.end_time,
                    message: args.description || args.title || null,
                    emoji_icon: args.emoji || null,
                    title: args.title || null,
                  });
                });

                const results = await Promise.all(promises);
                result = {
                  success: true,
                  action: 'create',
                  type: 'events',
                  createdCount: results.length,
                  highlights: results.map(r => ({ id: r.id, type: r.type })),
                  message: `Created ${results.length} event highlight${results.length === 1 ? '' : 's'}`
                };
              } else if (args.type === 'time' && args.timeRanges) {
                // Create time range highlights
                const promises = args.timeRanges.map((range: any) =>
                  createAnnotation.mutateAsync({
                    type: 'ai_time_highlight',
                    event_id: null,
                    start_time: range.start,
                    end_time: range.end,
                    message: range.description || args.description || null,
                    emoji_icon: range.emoji || args.emoji || null,
                    title: range.title || args.title || null,
                  })
                );

                const results = await Promise.all(promises);
                result = {
                  success: true,
                  action: 'create',
                  type: 'time',
                  createdCount: results.length,
                  highlights: results.map(r => ({ id: r.id, type: r.type })),
                  message: `Created ${results.length} time highlight${results.length === 1 ? '' : 's'}`
                };
              } else {
                result = {
                  success: false,
                  error: 'Invalid create parameters. For events: provide type="events" and eventIds array. For time: provide type="time" and timeRanges array.'
                };
              }
              break;

            case 'read':
              // Query existing highlights with optional filtering
              let filteredAnnotations = [...userAnnotations];

              // Filter by type if specified
              if (args.type === 'events') {
                filteredAnnotations = filteredAnnotations.filter(a => a.type === 'ai_event_highlight');
              } else if (args.type === 'time') {
                filteredAnnotations = filteredAnnotations.filter(a => a.type === 'ai_time_highlight');
              }

              // Filter by date range if specified
              if (args.startDate || args.endDate) {
                const startMs = args.startDate ? new Date(args.startDate).getTime() : 0;
                const endMs = args.endDate ? new Date(args.endDate).getTime() : Date.now() + (365 * 24 * 60 * 60 * 1000);

                filteredAnnotations = filteredAnnotations.filter(a => {
                  const annotationStart = new Date(a.start_time).getTime();
                  const annotationEnd = new Date(a.end_time).getTime();
                  return annotationEnd >= startMs && annotationStart <= endMs;
                });
              }

              // Filter by specific IDs if specified
              if (args.highlightIds && args.highlightIds.length > 0) {
                filteredAnnotations = filteredAnnotations.filter(a => args.highlightIds.includes(a.id));
              }

              const highlights = filteredAnnotations.map(annotation => ({
                id: annotation.id,
                type: annotation.type === 'ai_event_highlight' ? 'events' : 'time',
                title: annotation.title || 'Untitled',
                message: annotation.message || '',
                emoji: annotation.emoji_icon || '',
                startTime: annotation.start_time,
                endTime: annotation.end_time,
                eventId: annotation.event_id,
                visible: annotation.visible,
                createdAt: annotation.created_at
              }));

              const eventHighlights = highlights.filter(h => h.type === 'events');
              const timeHighlights = highlights.filter(h => h.type === 'time');

              result = {
                success: true,
                action: 'read',
                highlights: highlights,
                eventHighlights: eventHighlights,
                timeHighlights: timeHighlights,
                totalCount: highlights.length,
                filters: {
                  type: args.type || 'all',
                  startDate: args.startDate,
                  endDate: args.endDate,
                  specificIds: args.highlightIds?.length || 0
                },
                message: `Found ${highlights.length} highlight${highlights.length === 1 ? '' : 's'} (${eventHighlights.length} event, ${timeHighlights.length} time)`
              };
              break;

            case 'update':
              // Update specific highlights
              if (!args.updates || !Array.isArray(args.updates)) {
                result = {
                  success: false,
                  error: 'Missing or invalid updates array. Provide an array of updates with id and fields to update.'
                };
                break;
              }

              const updatePromises = args.updates.map(async (update: any) => {
                const updateData: any = { id: update.id };

                if (update.title !== undefined) updateData.title = update.title;
                if (update.message !== undefined) updateData.message = update.message;
                if (update.emoji !== undefined) updateData.emoji_icon = update.emoji;
                if (update.visible !== undefined) updateData.visible = update.visible;
                if (update.startTime !== undefined) updateData.start_time = update.startTime;
                if (update.endTime !== undefined) updateData.end_time = update.endTime;

                return updateAnnotation.mutateAsync(updateData);
              });

              await Promise.all(updatePromises);

              result = {
                success: true,
                action: 'update',
                updatedCount: args.updates.length,
                message: `Updated ${args.updates.length} highlight${args.updates.length === 1 ? '' : 's'}`
              };
              break;

            case 'delete':
              // Delete specific highlights or clear all
              if (args.highlightIds && Array.isArray(args.highlightIds)) {
                // Delete specific highlights by ID
                const deletePromises = args.highlightIds.map((id: string) =>
                  deleteAnnotation.mutateAsync(id)
                );
                await Promise.all(deletePromises);

                result = {
                  success: true,
                  action: 'delete',
                  deletedCount: args.highlightIds.length,
                  message: `Deleted ${args.highlightIds.length} highlight${args.highlightIds.length === 1 ? '' : 's'}`
                };
              } else {
                result = {
                  success: false,
                  error: 'Missing highlightIds array. Provide an array of highlight IDs to delete.'
                };
              }
              break;

            case 'clear':
              // Clear all highlights or by type
              let targetHighlights = userAnnotations;

              if (args.type === 'events') {
                targetHighlights = userAnnotations.filter(a => a.type === 'ai_event_highlight');
              } else if (args.type === 'time') {
                targetHighlights = userAnnotations.filter(a => a.type === 'ai_time_highlight');
              }

              if (targetHighlights.length > 0) {
                const deletePromises = targetHighlights.map(h => deleteAnnotation.mutateAsync(h.id));
                await Promise.all(deletePromises);
              }

              result = {
                success: true,
                action: 'clear',
                clearedType: args.type || 'all',
                clearedCount: targetHighlights.length,
                message: `Cleared ${targetHighlights.length} ${args.type ? `${args.type} ` : ''}highlight${targetHighlights.length === 1 ? '' : 's'}`
              };
              break;

            default:
              result = {
                success: false,
                error: 'Invalid action. Use: "create", "read", "update", "delete", or "clear"'
              };
            }
          }

          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: result
          });

        } catch (error) {
          console.error('Error executing highlight tool:', {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            toolCall,
            args
          });
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: {
              success: false,
              error: error instanceof Error ? error.message : `Unknown error: ${JSON.stringify(error)}`
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
                    part.type === 'text' ? <Response key={index}>{part.text}</Response> : null,
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
                    part.type === 'text' ? <Response key={index}>{part.text}</Response> : null,
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
              metadata: {
                // Send persona data in message metadata
                personaId: selectedPersonaId,
                personaName: selectedPersona?.name,
                personaTraits: selectedPersona?.traits,
                personaInstructions: selectedPersona?.instructions,
                personaTemperature: selectedPersona?.temperature,
                personaTopP: selectedPersona?.top_p,
                personaAvatar: selectedPersona?.avatar_url,
                modelId: selectedPersona?.model_id,
              }
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
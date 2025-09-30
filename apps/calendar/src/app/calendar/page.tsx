'use client';

import { Allotment } from 'allotment';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { EventResolved } from '@/lib/data-v2';
import 'allotment/dist/style.css';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { AIAssistantPanel } from '@/components/ai-chat-panel/ai-assistant-panel';
import { CalendarGrid } from '@/components/cal-grid';
import { EventCard } from '@/components/cal-extensions/EventCard';
import type {
  CalendarGridHandle,
  CalendarSelection,
  DragHandlers,
  ItemLayout,
} from '@/components/cal-grid';
import { CalendarGridActionBar } from '@/components/cal-extensions/calendar-grid-action-bar';
import { CalendarHeader } from '@/components/shell/app-header';
import { RenameEventsDialog } from '@/components/cal-extensions/rename-events-dialog';
import { Calendars } from '@/components/shell/calendars';
import { DatePicker } from '@/components/shell/date-picker';
import { NavUser } from '@/components/shell/nav-user';
import { SettingsModal } from '@/components/settings/settings-modal';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHydrated } from '@/hooks/useHydrated';
import {
  createEventResolved,
  deleteEventResolved,
  updateEventResolved,
  useEventsResolvedRange,
  useUserAnnotations,
  useUserCalendars,
  useUserCategories,
  useUserProfile,
} from '@/lib/data-v2';
import { useAppStore } from '@/store/app';

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const gridApi = useRef<CalendarGridHandle>(null);

  // State for day expansion in CalendarGrid v2
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // Track CalendarGrid selections locally for ActionBar
  const [gridSelections, setGridSelections] = useState<{
    items: Array<{ type: string; id?: string; data?: unknown }>;
    timeRanges: Array<{ type: 'timeRange'; start: Date; end: Date }>;
  }>({
    items: [],
    timeRanges: [],
  });

  // Use app store for date state and selection management
  const {
    viewMode,
    dateRangeType,
    customDayCount,
    startDate,
    selectedDates,
    weekStartDay,
    timezone,
    timeFormat,
    setDateRangeView,
    setCustomDayCount,
    setWeekStartDay,
    setTimezone,
    setTimeFormat,
    nextPeriod,
    prevPeriod,
    goToToday,
    settingsModalOpen,
    setSettingsModalOpen,
    // New selection management
    setSelectedEventIds,
    setSelectedTimeRanges,
    clearAllSelections,
    aiPanelOpen,
    sidebarTab,
    setSidebarTab,
    sidebarOpen,
    toggleSidebar,
    hiddenCalendarIds,
  } = useAppStore();

  // Get user profile to sync settings to store
  const profile = useUserProfile(user?.id);

  // Sync profile settings to app store when profile loads
  React.useEffect(() => {
    if (profile) {
      if (profile.week_start_day) {
        const profileWeekStartDay = parseInt(profile.week_start_day, 10) as
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6;
        if (profileWeekStartDay !== weekStartDay) {
          setWeekStartDay(profileWeekStartDay);
        }
      }

      if (profile.timezone && profile.timezone !== timezone) {
        setTimezone(profile.timezone);
      }

      if (profile.time_format && profile.time_format !== timeFormat) {
        setTimeFormat(profile.time_format);
      }
    }
  }, [profile, weekStartDay, timezone, timeFormat, setWeekStartDay, setTimezone, setTimeFormat]);

  // Calculate date range for the current view
  const dateRange = useMemo(() => {
    if (viewMode === 'dateArray' && selectedDates.length > 0) {
      // Date Array mode: use earliest and latest selected dates
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      return {
        startDate: startOfDay(sortedDates[0]),
        endDate: endOfDay(sortedDates[sortedDates.length - 1]),
      };
    }

    // Date Range mode: calculate based on type and startDate
    let dayCount = 1;
    let calculatedStartDate = startDate;

    switch (dateRangeType) {
      case 'day':
        dayCount = 1;
        break;
      case 'week': {
        dayCount = 7;
        // Adjust to week start based on user preference
        const dayOfWeek = startDate.getDay();
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
        break;
      }
      case 'workweek': {
        dayCount = 5;
        // Adjust to week start (Monday for work week)
        const currentDay = startDate.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
        break;
      }
      case 'custom-days':
        dayCount = customDayCount;
        break;
    }

    const endDate = addDays(calculatedStartDate, dayCount - 1);

    return {
      startDate: startOfDay(calculatedStartDate),
      endDate: endOfDay(endDate),
    };
  }, [viewMode, dateRangeType, customDayCount, startDate, selectedDates, weekStartDay]);

  // Fetch events from database for the current date range
  const events = useEventsResolvedRange(user?.id, {
    from: dateRange.startDate.getTime(),
    to: dateRange.endDate.getTime(),
  });

  // Fetch user's event categories
  const userCategories = useUserCategories(user?.id);

  // Fetch user's calendars
  const userCalendars = useUserCalendars(user?.id);

  // Fetch user's annotations (AI highlights) - reserved for future use
  const _userAnnotations = useUserAnnotations(user?.id);

  // V2 data layer uses direct function calls instead of hooks for mutations

  // Filter events based on calendar visibility
  const visibleEvents = useMemo((): EventResolved[] => {
    // If hiddenCalendarIds is not a Set yet (during hydration), show all events
    if (!(hiddenCalendarIds instanceof Set)) {
      return events;
    }

    const filtered = events.filter((event) => {
      // If no calendar, assume it belongs to the default calendar which should always be visible
      if (!event.calendar?.id) {
        return true;
      }
      // Show event if its calendar is NOT in the hidden set
      return !hiddenCalendarIds.has(event.calendar.id);
    });

    return filtered;
  }, [events, hiddenCalendarIds]);

  // Map events to CalendarGrid TimeItem format (live reactive mapping)
  const calendarItems = visibleEvents.map((event) => ({
    id: event.id,
    start_time: event.start_time,
    end_time: event.end_time,
    title: event.title,
    description: event.agenda || undefined,
    color: event.category?.color,
    // Include the full event data for operations
    eventData: event,
  }));

  // Find the selected event for details panel

  // CalendarGridActionBar handlers
  const handleCreateEventsFromGrid = useCallback(async () => {
    try {
      const createdEvents = [];
      for (const range of gridSelections.timeRanges) {
        if (user?.id) {
          const eventData = {
            title: 'New Event',
            start_time: range.start,
            end_time: range.end,
            all_day: false,
            private: false,
          };
          const createdEvent = await createEventResolved(user.id, eventData);
          createdEvents.push(createdEvent);
        }
      }

      // Use the new API to clear old selections and select new events
      if (gridApi.current) {
        // First clear all existing selections (including time ranges)
        gridApi.current.clearSelections();

        if (createdEvents.length > 0) {
          // Then select the newly created events
          gridApi.current.selectItems(createdEvents.map((e) => e.id));
        }
      }
    } catch (error) {
      console.error('Error in handleCreateEventsFromGrid:', error);
    }
  }, [gridSelections.timeRanges, user?.id]);

  const handleDeleteSelectedFromGrid = useCallback(async () => {
    const eventSelections = gridSelections.items.filter((item) => item.type === 'event' && item.id);
    for (const selection of eventSelections) {
      if (selection.id && user?.id) {
        await deleteEventResolved(user.id, selection.id);
      }
    }
    // Clear grid selections (local and app store)
    setGridSelections({ items: [], timeRanges: [] });
    clearAllSelections();
  }, [gridSelections.items, user?.id, clearAllSelections]);

  // CalendarGrid selection handler
  const handleGridSelectionsChange = useCallback((selections: CalendarSelection[]) => {
    // Update local state with grid selections (for ActionBar)
    const items = selections.filter((s) => s.type !== 'timeRange');
    const timeRanges = selections
      .filter((s) => s.type === 'timeRange')
      .map((s) => ({
        type: 'timeRange' as const,
        start: s.start_time!,
        end: s.end_time!,
      }));
    setGridSelections({ items, timeRanges });

    // Update app store with selections (for AI integration)
    const eventIds = items
      .filter((item) => item.type === 'event' && item.id)
      .map((item) => item.id!)
      .filter(Boolean);

    const timeRangesForStore = timeRanges.map((range) => ({
      start: range.start,
      end: range.end,
    }));

    setSelectedEventIds(eventIds);
    setSelectedTimeRanges(timeRangesForStore);
  }, [setSelectedEventIds, setSelectedTimeRanges]);

  // CalendarGrid operations
  const calendarOperations = useMemo(
    () => ({
      delete: async (item: { id: string }) => {
        if (!user?.id) return;
        try {
          await deleteEventResolved(user.id, item.id);
        } catch (error) {
          console.error('Failed to delete event:', error);
        }
      },
      move: async (item: { id: string }, newTimes: { start: Date; end: Date }) => {
        if (!user?.id) return;
        try {
          await updateEventResolved(user.id, item.id, {
            start_time: newTimes.start,
            end_time: newTimes.end,
          });
        } catch (error) {
          console.error('Failed to move event:', error);
        }
      },
      resize: async (item: { id: string }, newTimes: { start: Date; end: Date }) => {
        if (!user?.id) return;
        try {
          await updateEventResolved(user.id, item.id, {
            start_time: newTimes.start,
            end_time: newTimes.end,
          });
        } catch (error) {
          console.error('Failed to resize event:', error);
        }
      },
    }),
    [user?.id]
  );

  // Context menu handler functions
  const getSelectedEventState = useCallback(
    (field: string) => {
      const selectedEvents = gridSelections.items.filter(
        (item) => item.type === 'event' && item.data
      );
      if (selectedEvents.length === 0) return undefined;

      const values = selectedEvents.map((item) => {
        const itemData = item.data as { eventData?: EventResolved };
        const eventData = itemData?.eventData;
        if (field === 'online_event') return eventData?.online_event;
        if (field === 'in_person') return eventData?.in_person;
        return undefined;
      });

      // Return true if all are true, false if all are false, undefined if mixed
      const uniqueValues = [...new Set(values)];
      return uniqueValues.length === 1 ? uniqueValues[0] : undefined;
    },
    [gridSelections.items]
  );

  const _handleSelectEvent = useCallback((eventId: string, multi: boolean) => {
    if (gridApi.current) {
      if (multi) {
        // Add to existing selection
        const currentIds = gridApi.current.getSelectedItemIds();
        if (!currentIds.includes(eventId)) {
          gridApi.current.selectItems([...currentIds, eventId]);
        }
      } else {
        // Replace selection
        gridApi.current.selectItems([eventId]);
      }
    }
  }, []);

  const handleRenameEvents = useCallback(
    async (newTitle: string) => {
      const eventSelections = gridSelections.items.filter(
        (item) => item.type === 'event' && item.id
      );

      for (const selection of eventSelections) {
        if (selection.id && user?.id) {
          await updateEventResolved(user.id, selection.id, { title: newTitle });
        }
      }

      setShowRenameDialog(false);
    },
    [gridSelections.items, user?.id]
  );

  // Custom render function for events
  const renderCalendarItem = useCallback(
    (props: {
      item: {
        id: string;
        title: string;
        start_time: Date;
        end_time: Date;
        description?: string;
        color?: string;
        eventData?: EventResolved;
      };
      layout: ItemLayout;
      selected: boolean;
      onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
      drag: DragHandlers;
    }) => {
      const { item, layout, selected, onMouseDownSelect, drag } = props;

      // Map the calendar item to EventCard interface
      const eventItem = {
        id: item.id,
        title: item.title,
        start_time: item.start_time,
        end_time: item.end_time,
        description: item.description,
        color: item.eventData?.category?.color || item.color,
        online_event: item.eventData?.online_event,
        in_person: item.eventData?.in_person,
        show_time_as: item.eventData?.personal_details?.show_time_as || undefined,
        category: item.eventData?.category?.name,
        private: item.eventData?.private,
        calendar: {
          color: item.eventData?.calendar?.color,
        },
      };

      return (
        <EventCard
          item={eventItem}
          layout={layout}
          selected={selected}
          onMouseDownSelect={onMouseDownSelect}
          drag={drag}
          // Context menu props
          selectedEventCount={
            gridSelections.items.filter((item) => item.type === 'event' && item.id).length
          }
          selectedIsOnlineMeeting={getSelectedEventState('online_event')}
          selectedIsInPerson={getSelectedEventState('in_person')}
          userCategories={userCategories}
          onUpdateShowTimeAs={(showTimeAs) => {
            const eventSelections = gridSelections.items.filter(
              (item) => item.type === 'event' && item.id
            );
            eventSelections.forEach(async (selection) => {
              if (selection.id && user?.id) {
                await updateEventResolved(user.id, selection.id, { show_time_as: showTimeAs });
              }
            });
          }}
          onUpdateCategory={(categoryId) => {
            const eventSelections = gridSelections.items.filter(
              (item) => item.type === 'event' && item.id
            );
            eventSelections.forEach(async (selection) => {
              if (selection.id && user?.id) {
                await updateEventResolved(user.id, selection.id, { category_id: categoryId });
              }
            });
          }}
          onUpdateIsOnlineMeeting={(isOnlineMeeting) => {
            const eventSelections = gridSelections.items.filter(
              (item) => item.type === 'event' && item.id
            );
            eventSelections.forEach(async (selection) => {
              if (selection.id && user?.id) {
                await updateEventResolved(user.id, selection.id, { online_event: isOnlineMeeting });
              }
            });
          }}
          onUpdateIsInPerson={(isInPerson) => {
            const eventSelections = gridSelections.items.filter(
              (item) => item.type === 'event' && item.id
            );
            eventSelections.forEach(async (selection) => {
              if (selection.id && user?.id) {
                await updateEventResolved(user.id, selection.id, { in_person: isInPerson });
              }
            });
          }}
          onDeleteSelected={handleDeleteSelectedFromGrid}
          onRenameSelected={() => {
            const eventSelections = gridSelections.items.filter(
              (item) => item.type === 'event' && item.data
            );
            if (eventSelections.length > 0) {
              setShowRenameDialog(true);
            }
          }}
        />
      );
    },
    [
      gridSelections.items,
      userCategories,
      getSelectedEventState,
      handleDeleteSelectedFromGrid,
      user?.id,
    ]
  );

  // Navigation handlers using app store
  const handlePrevWeek = () => {
    prevPeriod();
  };

  const handleNextWeek = () => {
    nextPeriod();
  };

  const handleGoToToday = () => {
    goToToday();
  };

  // Redirect if not authenticated using useEffect to avoid setState during render
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show loading while redirecting
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Don't render until hydrated to prevent flashing
  if (!hydrated) {
    return null;
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar Panel */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0.0, 0.2, 1],
              opacity: { duration: 0.2 },
            }}
            className="h-full bg-sidebar text-sidebar-foreground flex flex-col border-r border-border overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="border-sidebar-border h-16 border-b flex flex-row items-center px-4">
              <NavUser />
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
              <Tabs
                value={sidebarTab}
                onValueChange={(value) => setSidebarTab(value as 'dates' | 'calendars')}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Tab Navigation - Fixed */}
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="dates" className="text-xs">
                      Dates
                    </TabsTrigger>
                    <TabsTrigger value="calendars" className="text-xs">
                      Calendars
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Content - Scrollable */}
                <TabsContent value="dates" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <DatePicker />
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="calendars" className="flex-1 min-h-0 m-0 p-0">
                  <ScrollArea className="h-full">
                    <Calendars />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Calendar and AI Area */}
      <Allotment
        onChange={(sizes) => {
          // Update AI panel state when user drags to snap
          if (sizes && sizes.length === 2) {
            const totalWidth = window.innerWidth - (sidebarOpen ? 300 : 0);
            const aiSizePercent = sizes[1];
            const aiSizePx = (aiSizePercent / 100) * totalWidth;
            const aiOpen = aiSizePx >= 200;

            if (aiOpen !== aiPanelOpen) {
              useAppStore.setState({ aiPanelOpen: aiOpen });
            }
          }
        }}
      >
        {/* Calendar Content */}
        <Allotment.Pane>
          <div className="flex flex-col h-full bg-background">
            <CalendarHeader
              viewMode={viewMode}
              selectedDates={selectedDates}
              dateRange={dateRange}
              dateRangeType={dateRangeType}
              customDayCount={customDayCount}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onGoToToday={handleGoToToday}
              onSetDateRangeView={setDateRangeView}
              onSetCustomDayCount={setCustomDayCount}
              startDate={startDate}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
            />

            {/* Calendar Content */}
            <div className="flex-1 min-h-0">
              <div className="relative h-full overflow-hidden">
                <CalendarGrid
                  ref={gridApi}
                  items={calendarItems}
                  viewMode={viewMode}
                  dateRangeType={dateRangeType}
                  startDate={startDate}
                  customDayCount={customDayCount}
                  weekStartDay={weekStartDay}
                  selectedDates={selectedDates}
                  expandedDay={expandedDay}
                  onExpandedDayChange={setExpandedDay}
                  pxPerHour={80}
                  snapMinutes={5}
                  gridMinutes={30}
                  timeZones={[
                    { label: 'Local', timeZone: timezone, hour12: timeFormat === '12_hour' },
                  ]}
                  operations={calendarOperations}
                  onSelectionsChange={handleGridSelectionsChange}
                  renderItem={renderCalendarItem}
                  renderSelection={(selection, element) => {
                    const rangeCount = gridSelections.timeRanges.length;
                    const eventText = rangeCount === 1 ? 'event' : 'events';
                    const totalMinutes = gridSelections.timeRanges.reduce((sum, range) => {
                      return sum + (range.end.getTime() - range.start.getTime()) / (1000 * 60);
                    }, 0);
                    const formatDuration = (minutes: number) => {
                      if (minutes < 60) return `${Math.round(minutes)}m`;
                      const hours = Math.floor(minutes / 60);
                      const mins = Math.round(minutes % 60);
                      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                    };

                    return (
                      <ContextMenu
                        key={`selection-${selection.start.getTime()}-${selection.end.getTime()}`}
                      >
                        <ContextMenuTrigger asChild>{element}</ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuLabel>
                            {rangeCount} time slot{rangeCount === 1 ? '' : 's'} selected (
                            {formatDuration(totalMinutes)})
                          </ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onSelect={() => handleCreateEventsFromGrid()}
                          >
                            <Plus />
                            Create {eventText}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => {
                              if (gridApi.current) {
                                gridApi.current.clearSelections();
                              }
                            }}
                          >
                            <Trash2 />
                            Clear selection
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }}
                />

                {/* CalendarGridActionBar */}
                <CalendarGridActionBar
                  timeRanges={gridSelections.timeRanges}
                  selectedItems={gridSelections.items}
                  onCreateEvents={handleCreateEventsFromGrid}
                  onDeleteSelected={handleDeleteSelectedFromGrid}
                  onClearSelection={clearAllSelections}
                  onUpdateShowTimeAs={(showTimeAs) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, {
                          show_time_as: showTimeAs,
                        });
                      }
                    });
                  }}
                  onUpdateCalendar={(calendarId) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, {
                          calendar_id: calendarId,
                        });
                      }
                    });
                  }}
                  onUpdateCategory={(categoryId) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, {
                          category_id: categoryId,
                        });
                      }
                    });
                  }}
                  onUpdateIsOnlineMeeting={(isOnlineMeeting) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, {
                          online_event: isOnlineMeeting,
                        });
                      }
                    });
                  }}
                  onUpdateIsInPerson={(isInPerson) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, { in_person: isInPerson });
                      }
                    });
                  }}
                  onUpdateIsPrivate={(isPrivate: boolean) => {
                    const eventSelections = gridSelections.items.filter(
                      (item) => item.type === 'event' && item.id
                    );
                    eventSelections.forEach(async (selection) => {
                      if (selection.id && user?.id) {
                        await updateEventResolved(user.id, selection.id, { private: isPrivate });
                      }
                    });
                  }}
                  userCalendars={userCalendars?.map((cal) => ({
                    ...cal,
                    color: cal.color || 'blue',
                  }))}
                  userCategories={userCategories?.map((cat) => ({
                    ...cat,
                    color: cat.color || 'blue',
                  }))}
                  position="bottom-center"
                />
              </div>
            </div>
          </div>
        </Allotment.Pane>

        {/* AI Assistant Panel */}
        <Allotment.Pane
          preferredSize={aiPanelOpen ? 400 : 0}
          minSize={aiPanelOpen ? 300 : 0}
          maxSize={600}
          snap
        >
          {aiPanelOpen && <AIAssistantPanel />}
        </Allotment.Pane>
      </Allotment>

      <SettingsModal open={settingsModalOpen} onOpenChange={setSettingsModalOpen} />

      <RenameEventsDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        selectedCount={
          gridSelections.items.filter((item) => item.type === 'event' && item.data).length
        }
        currentTitle={
          (
            gridSelections.items.find((item) => item.type === 'event' && item.data)?.data as {
              title?: string;
            }
          )?.title || ''
        }
        onRename={handleRenameEvents}
      />
    </div>
  );
}

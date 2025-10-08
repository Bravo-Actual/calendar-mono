'use client';

import { addDays, endOfDay, startOfDay } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AIAssistantPanelV2 } from '@/components/ai-chat-panel-v2';
import { CalendarGridActionBar } from '@/components/cal-extensions/calendar-grid-action-bar';
import { EventCard } from '@/components/cal-extensions/EventCard';
import { RenameEventsDialog } from '@/components/cal-extensions/rename-events-dialog';
import { TimeHighlight } from '@/components/cal-extensions/TimeHighlight';
import type {
  CalendarGridHandle,
  CalendarSelection,
  DragHandlers,
  ItemLayout,
} from '@/components/cal-grid';
import { CalendarGrid } from '@/components/cal-grid';
import { useCalendarOperations, useGridEventHandlers } from '@/components/cal-grid/hooks';
import { EventDetailsPanel } from '@/components/event-details/event-details-panel';
import { SimpleResizable } from '@/components/layout/simple-resizable';
import { SettingsModal } from '@/components/settings/settings-modal';
import { CalendarHeader } from '@/components/shell/app-header';
import { Calendars } from '@/components/shell/calendars';
import { DatePicker } from '@/components/shell/date-picker';
import { NavUser } from '@/components/shell/nav-user';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useHydrated } from '@/hooks/useHydrated';
import { useUserProfilesServer } from '@/hooks/use-user-profile-server';
import type { ClientAnnotation, EventResolved } from '@/lib/data-v2';
import {
  createEventResolved,
  deleteEventResolved,
  updateEventResolved,
  useAIPersona,
  useAnnotationsRange,
  useEventHighlightsMap,
  useEventResolved,
  useEventsResolvedRange,
  useUserCalendars,
  useUserCategories,
  useUserProfile,
} from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import { usePersonaSelection } from '@/store/chat';

// Type for calendar items passed to CalendarGrid
type CalendarItem = {
  id: string;
  start_time: Date;
  end_time: Date;
  title: string;
  description?: string;
  color?: string;
  owner_id?: string;
  owner_display_name?: string | null;
  role?: 'owner' | 'attendee' | 'viewer' | 'contributor' | 'delegate_full';
  eventData: EventResolved;
};

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
    items: CalendarSelection[];
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
    // Time selection mode
    timeSelectionMode,
    timeSelectionCallback,
    disableTimeSelectionMode,
    // New selection management
    setSelectedEventIds,
    setSelectedTimeRanges,
    clearAllSelections,
    aiPanelOpen,
    eventDetailsPanelOpen,
    setEventDetailsPanelOpen,
    toggleEventDetailsPanel,
    selectedEventPrimary,
    setSelectedEventPrimary,
    sidebarTab,
    setSidebarTab,
    sidebarOpen,
    toggleSidebar,
    hiddenCalendarIds,
    aiHighlightsVisible,
    showNavigationGlow,
  } = useAppStore();

  // Get selected persona for navigation toast
  const { selectedPersonaId } = usePersonaSelection();
  const selectedPersona = useAIPersona(user?.id, selectedPersonaId || undefined);

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

  // Capture calendar grid position when navigation glow triggers
  const [glowRect, setGlowRect] = React.useState<DOMRect | null>(null);

  // Show toast when navigation glow is triggered
  React.useEffect(() => {
    if (showNavigationGlow) {
      // Capture the grid position once when glow triggers
      const container = document.getElementById('calendar-grid-container');
      const rect = container?.getBoundingClientRect();
      if (rect) {
        setGlowRect(rect);
      }

      if (selectedPersona) {
        toast(`${selectedPersona.name} is navigating your calendar`, {
          duration: 3000,
        });
      }
    } else {
      setGlowRect(null);
    }
  }, [showNavigationGlow, selectedPersona]);

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

  // Fetch AI time highlights for the current date range
  const timeHighlights = useAnnotationsRange(user?.id, {
    from: dateRange.startDate.getTime(),
    to: dateRange.endDate.getTime(),
  });

  // Fetch AI event highlights as a Map
  const eventHighlightsMap = useEventHighlightsMap(user?.id, {
    from: dateRange.startDate.getTime(),
    to: dateRange.endDate.getTime(),
  });

  // Fetch selected event for event details panel
  const selectedEvent = useEventResolved(user?.id, selectedEventPrimary || undefined);

  // V2 data layer uses direct function calls instead of hooks for mutations

  // Get unique owner IDs from events (excluding current user)
  const ownerIds = useMemo(() => {
    return [...new Set(events.map(e => e.owner_id).filter(id => id && id !== user?.id))];
  }, [events, user?.id]);

  // Fetch owner profiles from server
  const { data: ownerProfilesMap } = useUserProfilesServer(ownerIds);

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
    owner_id: event.owner_id,
    owner_display_name: event.owner_id && event.owner_id !== user?.id
      ? ownerProfilesMap?.get(event.owner_id) || null
      : null,
    role: event.role,
    // Include the full event data for operations
    eventData: event,
  }));

  // Calendar grid operations hook
  const calendarOperations = useCalendarOperations<CalendarItem>({
    userId: user?.id,
    onDelete: deleteEventResolved,
    onUpdate: updateEventResolved,
  });

  // Calendar grid event handlers hook
  const {
    handleCreateEventsFromGrid,
    handleDeleteSelectedFromGrid,
    handleGridSelectionsChange,
    handleRenameEvents: handleRenameEventsFromHook,
    getSelectedEventState,
  } = useGridEventHandlers({
    userId: user?.id,
    gridSelections,
    gridApi,
    setGridSelections,
    clearAllSelections,
    setSelectedEventIds,
    setSelectedTimeRanges,
    onCreate: createEventResolved,
    onDelete: deleteEventResolved,
    onUpdate: updateEventResolved,
  });

  const handleRenameEvents = useCallback(
    async (newTitle: string) => {
      await handleRenameEventsFromHook(newTitle);
      setShowRenameDialog(false);
    },
    [handleRenameEventsFromHook]
  );

  const handleCreateEvent = useCallback(
    async (start: Date, end: Date) => {
      if (!user?.id || !gridApi.current) return;

      // Create event with default values
      const newEvent = await createEventResolved(user.id, {
        title: 'New Event',
        start_time: start,
        end_time: end,
        all_day: false,
        online_event: false,
        in_person: false,
        private: false,
        request_responses: true,
        allow_forwarding: true,
        allow_reschedule_request: true,
        hide_attendees: false,
        discovery: 'audience_only',
        join_model: 'invite_only',
      });

      // Clear all selections (including time ranges) and select the new event
      if (newEvent?.id && gridApi.current) {
        gridApi.current.clearSelections();
        gridApi.current.selectItems([newEvent.id]);
        setSelectedEventPrimary(newEvent.id);
        setEventDetailsPanelOpen(true);
      }
    },
    [user?.id, setSelectedEventPrimary, setEventDetailsPanelOpen]
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
      highlight?: {
        id: string;
        emoji_icon?: string | null;
        title?: string | null;
        message?: string | null;
      };
    }) => {
      const { item, layout, selected, onMouseDownSelect, drag, highlight } = props;

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
        owner_id: (item as any).owner_id,
        owner_display_name: (item as any).owner_display_name,
        role: (item as any).role,
      };

      return (
        <EventCard
          item={eventItem}
          layout={layout}
          selected={selected}
          onMouseDownSelect={onMouseDownSelect}
          drag={drag}
          highlight={highlight}
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
          onDoubleClick={(e) => {
            // Only open panel if it's a clean double-click (no modifiers for multi-select)
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
              setSelectedEventPrimary(item.id);
              setEventDetailsPanelOpen(true);
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
      setEventDetailsPanelOpen,
      setSelectedEventPrimary,
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
      {/* Sidebar */}
      <div
        data-state={sidebarOpen ? 'open' : 'closed'}
        className="h-full overflow-hidden flex transition-[max-width] duration-200 ease-linear data-[state=open]:max-w-[260px] data-[state=closed]:max-w-0"
      >
        {sidebarOpen && (
          <div className="h-full w-[260px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-border overflow-hidden flex-shrink-0">
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
          </div>
        )}
      </div>

      {/* Calendar - flex-1 to take remaining space */}
      <div className="flex-1 min-w-0">
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
            eventDetailsPanelOpen={eventDetailsPanelOpen}
            onToggleEventDetails={toggleEventDetailsPanel}
          />

          {/* Calendar Content */}
          <div className="flex-1 min-h-0">
            <div className="relative h-full overflow-hidden" id="calendar-grid-container">
              <CalendarGrid<CalendarItem, ClientAnnotation>
                ref={gridApi}
                items={calendarItems}
                rangeItems={aiHighlightsVisible ? timeHighlights : []}
                eventHighlights={aiHighlightsVisible ? eventHighlightsMap : undefined}
                viewMode={viewMode}
                dateRangeType={dateRangeType}
                startDate={startDate}
                customDayCount={customDayCount}
                weekStartDay={weekStartDay}
                selectedDates={selectedDates}
                expandedDay={expandedDay}
                onExpandedDayChange={setExpandedDay}
                pxPerHour={80}
                snapMinutes={15}
                gridMinutes={30}
                timeZones={[
                  { label: 'Local', timeZone: timezone, hour12: timeFormat === '12_hour' },
                ]}
                operations={calendarOperations}
                onSelectionsChange={handleGridSelectionsChange}
                timeSelectionMode={timeSelectionMode}
                onTimeSelection={timeSelectionCallback || undefined}
                onTimeSelectionDismiss={disableTimeSelectionMode}
                renderItem={renderCalendarItem}
                renderRange={({ item, layout, onMouseDown }) => (
                  <TimeHighlight annotation={item} layout={layout} onMouseDown={onMouseDown} />
                )}
                onRangeClick={(_item) => {
                  // Handle time highlight click
                }}
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
                        <ContextMenuSub>
                          <ContextMenuSubTrigger
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Plus />
                            Create {eventText}
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent>
                            {userCategories && userCategories.length > 0 ? (
                              userCategories.map((category) => (
                                <ContextMenuItem
                                  key={category.id}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onSelect={() =>
                                    handleCreateEventsFromGrid(category.id, category.name)
                                  }
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-3 h-3 rounded ${
                                        category.color === 'neutral'
                                          ? 'bg-neutral-500'
                                          : category.color === 'slate'
                                            ? 'bg-slate-500'
                                            : category.color === 'orange'
                                              ? 'bg-orange-500'
                                              : category.color === 'yellow'
                                                ? 'bg-yellow-500'
                                                : category.color === 'green'
                                                  ? 'bg-green-500'
                                                  : category.color === 'blue'
                                                    ? 'bg-blue-500'
                                                    : category.color === 'indigo'
                                                      ? 'bg-indigo-500'
                                                      : category.color === 'violet'
                                                        ? 'bg-violet-500'
                                                        : category.color === 'fuchsia'
                                                          ? 'bg-fuchsia-500'
                                                          : category.color === 'rose'
                                                            ? 'bg-rose-500'
                                                            : 'bg-neutral-500'
                                      }`}
                                    />
                                    {category.name}
                                  </div>
                                </ContextMenuItem>
                              ))
                            ) : (
                              <ContextMenuItem disabled>No categories available</ContextMenuItem>
                            )}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
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
                onCreateEvent={handleCreateEvent}
                onCreateEvents={handleCreateEventsFromGrid}
                onDeleteSelected={handleDeleteSelectedFromGrid}
                onClearSelection={clearAllSelections}
                onBestFit={() => {
                  if (!user?.id) return;

                  // Get selected events sorted chronologically
                  const eventSelections = gridSelections.items
                    .filter((item) => item.type === 'event' && item.id && item.data)
                    .sort((a, b) => {
                      const aData = a.data as any;
                      const bData = b.data as any;
                      return new Date(aData.start_time).getTime() - new Date(bData.start_time).getTime();
                    });

                  const selectedEventIds = new Set(eventSelections.map((s) => s.id));

                  // Get time ranges sorted chronologically
                  const sortedTimeRanges = [...gridSelections.timeRanges].sort(
                    (a, b) => a.start.getTime() - b.start.getTime()
                  );

                  // Helper to align time to hour or half-hour
                  const alignToGrid = (date: Date): Date => {
                    const minutes = date.getMinutes();
                    const aligned = new Date(date);
                    if (minutes === 0 || minutes === 30) {
                      return aligned;
                    }
                    // Snap to nearest 30-minute mark
                    aligned.setMinutes(minutes < 15 ? 0 : minutes < 45 ? 30 : 0);
                    if (minutes >= 45) {
                      aligned.setHours(aligned.getHours() + 1);
                    }
                    aligned.setSeconds(0);
                    aligned.setMilliseconds(0);
                    return aligned;
                  };

                  // Find all existing events that overlap with the time ranges (excluding selected events)
                  const blockingEvents: Array<{ start: Date; end: Date }> = [];

                  sortedTimeRanges.forEach((range) => {
                    // Check all events in the current view
                    visibleEvents.forEach((event) => {
                      // Skip if this event is being moved
                      if (selectedEventIds.has(event.id)) return;

                      const eventStart = new Date(event.start_time);
                      const eventEnd = new Date(event.end_time);

                      // Check if event overlaps with this time range
                      if (eventStart < range.end && eventEnd > range.start) {
                        blockingEvents.push({
                          start: eventStart,
                          end: eventEnd,
                        });
                      }
                    });
                  });

                  // Sort blocking events by start time
                  blockingEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

                  // Split time ranges around blocking events to create free slots
                  const freeSlots: Array<{ start: Date; end: Date }> = [];

                  sortedTimeRanges.forEach((range) => {
                    let currentStart = new Date(range.start);
                    const rangeEnd = new Date(range.end);

                    // Find blocking events that overlap with this range
                    const overlappingBlocks = blockingEvents.filter(
                      (block) => block.start < rangeEnd && block.end > currentStart
                    );

                    if (overlappingBlocks.length === 0) {
                      // No blocking events, entire range is free
                      freeSlots.push({ start: currentStart, end: rangeEnd });
                    } else {
                      // Split around blocking events
                      overlappingBlocks.forEach((block) => {
                        // Add free slot before this blocking event
                        if (currentStart < block.start) {
                          freeSlots.push({ start: currentStart, end: block.start });
                        }
                        // Move current start to end of blocking event
                        currentStart = new Date(Math.max(currentStart.getTime(), block.end.getTime()));
                      });

                      // Add remaining free slot after last blocking event
                      if (currentStart < rangeEnd) {
                        freeSlots.push({ start: currentStart, end: rangeEnd });
                      }
                    }
                  });

                  // Track current position in each free slot
                  const rangePositions = freeSlots.map((slot) => ({
                    range: slot,
                    currentTime: alignToGrid(new Date(slot.start)),
                    endTime: new Date(slot.end),
                  }));

                  // Try to fit each event
                  eventSelections.forEach((selection) => {
                    const eventData = selection.data as any;
                    const eventDuration =
                      new Date(eventData.end_time).getTime() -
                      new Date(eventData.start_time).getTime();

                    // Try to find a slot for this event - always check all ranges from beginning
                    let placed = false;
                    for (let i = 0; i < rangePositions.length && !placed; i++) {
                      const rangePos = rangePositions[i];
                      const proposedEnd = new Date(rangePos.currentTime.getTime() + eventDuration);

                      // Check if event fits in this range
                      if (proposedEnd.getTime() <= rangePos.endTime.getTime()) {
                        // Event fits! Update it
                        updateEventResolved(user.id, selection.id!, {
                          start_time: rangePos.currentTime,
                          end_time: proposedEnd,
                        });

                        // Move current position forward and align
                        rangePos.currentTime = alignToGrid(proposedEnd);
                        placed = true;
                      }
                    }

                    if (!placed) {
                      toast.error(`Could not fit "${eventData.title}" into available time slots`);
                    }
                  });

                  // Clear selections after fitting
                  clearAllSelections();
                  toast.success(
                    `Fitted ${eventSelections.length} event${eventSelections.length !== 1 ? 's' : ''}`
                  );
                }}
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
                selectedShowTimeAs={getSelectedEventState('show_time_as')}
                selectedCalendarId={getSelectedEventState('calendar_id')}
                selectedCategoryId={getSelectedEventState('category_id')}
                selectedIsOnlineMeeting={getSelectedEventState('online_event')}
                selectedIsInPerson={getSelectedEventState('in_person')}
                selectedIsPrivate={getSelectedEventState('private')}
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
      </div>

      {/* Event Details Panel - with simple resizable */}
      <div
        data-state={eventDetailsPanelOpen ? 'open' : 'closed'}
        className="relative overflow-hidden flex transition-[max-width] duration-200 ease-linear data-[state=open]:max-w-[600px] data-[state=closed]:max-w-0"
      >
        {eventDetailsPanelOpen && (
          <SimpleResizable
            defaultWidth={400}
            minWidth={300}
            maxWidth={600}
            storageKey="calendar:event-details-width"
          >
            <EventDetailsPanel
              selectedEvent={selectedEvent}
              selectedEventPrimary={selectedEventPrimary}
              eventDetailsPanelOpen={eventDetailsPanelOpen}
              userCalendars={(userCalendars || []).map((cal) => ({
                id: cal.id,
                name: cal.name,
                color: cal.color || 'blue',
              }))}
              userCategories={(userCategories || []).map((cat) => ({
                id: cat.id,
                name: cat.name,
                color: cat.color || 'blue',
              }))}
              onSave={async (updates) => {
                if (selectedEventPrimary && user?.id) {
                  await updateEventResolved(user.id, selectedEventPrimary, updates);
                }
              }}
              onClose={() => {
                setSelectedEventPrimary(null);
                setEventDetailsPanelOpen(false);
              }}
            />
          </SimpleResizable>
        )}
      </div>

      {/* AI Panel - with simple resizable */}
      {aiPanelOpen && (
        <SimpleResizable
          defaultWidth={400}
          minWidth={300}
          maxWidth={800}
          storageKey="calendar:ai-panel-width"
        >
          <AIAssistantPanelV2 />
        </SimpleResizable>
      )}

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

      {/* Navigation Glow Overlay - Fixed positioned to cover calendar grid */}
      <AnimatePresence>
        {showNavigationGlow && glowRect && (() => {
          // Use captured rect to prevent jitter during grid animations
          const maxHeight = Math.min(glowRect.height, window.innerHeight - glowRect.top - 8);

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed pointer-events-none z-50"
              style={{
                top: glowRect.top,
                left: glowRect.left,
                width: glowRect.width,
                height: maxHeight,
              }}
            >
              <div className="w-full h-full rounded-lg ring-2 ring-blue-400 dark:ring-indigo-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.7)] dark:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)] animate-pulse-glow" />
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

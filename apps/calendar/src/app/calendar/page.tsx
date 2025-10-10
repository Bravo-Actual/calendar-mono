'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Temporal } from '@js-temporal/polyfill';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { CalendarSchedule } from '@/components/cal-schedule';
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
import { useMultipleUsersFreeBusy } from '@/hooks/use-free-busy';
import { useUserProfilesServer } from '@/hooks/use-user-profile-server';
import { useHydrated } from '@/hooks/useHydrated';
import { SHOW_TIME_AS } from '@/lib/constants/event-enums';
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
  useUserWorkPeriods,
} from '@/lib/data-v2';
import { db } from '@/lib/data-v2/base/dexie';
import { useAppStore } from '@/store/app';
import { usePersonaSelection } from '@/store/chat';

// Timezone-aware date helpers using Temporal
function startOfDayInTimezone(date: Date, timezone: string): Date {
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);
  const startOfDay = zdt.withPlainTime(Temporal.PlainTime.from({ hour: 0, minute: 0, second: 0 }));
  return new Date(startOfDay.epochMilliseconds);
}

function endOfDayInTimezone(date: Date, timezone: string): Date {
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);
  const endOfDay = zdt.withPlainTime(Temporal.PlainTime.from({ hour: 23, minute: 59, second: 59, millisecond: 999 }));
  return new Date(endOfDay.epochMilliseconds);
}

function addDaysInTimezone(date: Date, days: number, timezone: string): Date {
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);
  const newZdt = zdt.add({ days });
  return new Date(newZdt.epochMilliseconds);
}

function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
  const zdt = instant.toZonedDateTimeISO(timezone);
  // Temporal uses ISO weekday (1=Monday, 7=Sunday), convert to JS (0=Sunday, 6=Saturday)
  return zdt.dayOfWeek === 7 ? 0 : zdt.dayOfWeek;
}

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
  owner_avatar_url?: string | null;
  role?: 'owner' | 'attendee' | 'viewer' | 'contributor' | 'delegate_full';
  attendees?: Array<{
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
    role?: string;
  }>;
  eventData: EventResolved;
};

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
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
    // Calendar view
    calendarView,
    toggleCalendarView,
    // Schedule view
    scheduleUserIds,
    addScheduleUser,
    removeScheduleUser,
  } = useAppStore();

  // Get selected persona for navigation toast
  const { selectedPersonaId } = usePersonaSelection();
  const selectedPersona = useAIPersona(user?.id, selectedPersonaId || undefined);

  // Get user profile to sync settings to store
  const profile = useUserProfile(user?.id);

  // Get user work schedule for shading non-work hours
  const workPeriods = useUserWorkPeriods(user?.id);

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

  // Calculate date range for the current view (grid view)
  const dateRange = useMemo(() => {
    if (viewMode === 'dateArray' && selectedDates.length > 0) {
      // Date Array mode: use earliest and latest selected dates
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      return {
        startDate: startOfDayInTimezone(sortedDates[0], timezone),
        endDate: endOfDayInTimezone(sortedDates[sortedDates.length - 1], timezone),
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
        // Adjust to week start based on user preference (timezone-aware)
        const dayOfWeek = getDayOfWeekInTimezone(startDate, timezone);
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = addDaysInTimezone(startDate, -daysFromWeekStart, timezone);
        break;
      }
      case 'workweek': {
        dayCount = 5;
        // Adjust to week start (Monday for work week, timezone-aware)
        const currentDay = getDayOfWeekInTimezone(startDate, timezone);
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        calculatedStartDate = addDaysInTimezone(startDate, -daysFromMonday, timezone);
        break;
      }
      case 'custom-days':
        dayCount = customDayCount;
        break;
    }

    const endDate = addDaysInTimezone(calculatedStartDate, dayCount - 1, timezone);

    return {
      startDate: startOfDayInTimezone(calculatedStartDate, timezone),
      endDate: endOfDayInTimezone(endDate, timezone),
    };
  }, [viewMode, dateRangeType, customDayCount, startDate, selectedDates, weekStartDay, timezone]);

  // Calculate wider date range for schedule view (10 days before to 20 days after)
  const scheduleRange = useMemo(() => {
    const now = new Date();
    return {
      startDate: startOfDayInTimezone(addDaysInTimezone(now, -10, timezone), timezone),
      endDate: endOfDayInTimezone(addDaysInTimezone(now, 20, timezone), timezone),
    };
  }, [timezone]);

  // Fetch events from database - use schedule range if in schedule view, otherwise use grid range
  const activeRange = calendarView === 'schedule' ? scheduleRange : dateRange;
  const events = useEventsResolvedRange(user?.id, {
    from: activeRange.startDate.getTime(),
    to: activeRange.endDate.getTime(),
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
    return [...new Set(events.map((e) => e.owner_id).filter((id) => id && id !== user?.id))];
  }, [events, user?.id]);

  // Fetch owner profiles from server
  const { data: ownerProfilesMap } = useUserProfilesServer(ownerIds);

  // Fetch profiles for schedule view users
  const { data: scheduleUsersProfilesMap } = useUserProfilesServer(scheduleUserIds);

  // Fetch free/busy data for schedule users (only when in schedule view)
  const { data: freeBusyBlocks } = useMultipleUsersFreeBusy({
    userIds: scheduleUserIds,
    startDate: scheduleRange.startDate,
    endDate: scheduleRange.endDate,
  });

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

  // Get all event_users for visible events to extract attendee IDs
  const allEventUsers =
    useLiveQuery(async () => {
      const eventIds = visibleEvents.map((e) => e.id);
      if (eventIds.length === 0) return [];
      return await db.event_users.where('event_id').anyOf(eventIds).toArray();
    }, [visibleEvents]) || [];

  // Extract unique attendee IDs (excluding current user)
  const attendeeIds = useMemo(() => {
    if (!user?.id) return [];
    return [...new Set(allEventUsers.map((eu) => eu.user_id).filter((id) => id !== user.id))];
  }, [allEventUsers, user?.id]);

  // Fetch attendee profiles from server (same method as owners)
  const { data: attendeeProfilesMap } = useUserProfilesServer(attendeeIds);

  // Build map of event ID -> attendees with profiles
  const eventAttendeesMap = useMemo(() => {
    if (!user?.id || !attendeeProfilesMap) return new Map();

    const attendeesMap = new Map<
      string,
      Array<{
        user_id: string;
        display_name?: string | null;
        avatar_url?: string | null;
        role?: string;
      }>
    >();

    // Group event_users by event_id
    const eventUsersGrouped = new Map<string, typeof allEventUsers>();
    allEventUsers.forEach((eu) => {
      if (!eventUsersGrouped.has(eu.event_id)) {
        eventUsersGrouped.set(eu.event_id, []);
      }
      eventUsersGrouped.get(eu.event_id)?.push(eu);
    });

    // Build attendees list for each event where user is owner
    visibleEvents.forEach((event) => {
      if (event.role === 'owner') {
        const eventUsers = eventUsersGrouped.get(event.id) || [];
        // Filter out the current user (owner)
        const attendees = eventUsers.filter((eu) => eu.user_id !== user.id);

        // Map attendees with their profiles from server
        const attendeesWithProfiles = attendees.map((eu) => {
          const profile = attendeeProfilesMap.get(eu.user_id);
          return {
            user_id: eu.user_id,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            role: eu.role,
          };
        });

        if (attendeesWithProfiles.length > 0) {
          attendeesMap.set(event.id, attendeesWithProfiles);
        }
      }
    });

    return attendeesMap;
  }, [user?.id, visibleEvents, allEventUsers, attendeeProfilesMap]);

  const calendarItems = visibleEvents.map((event) => {
    const ownerProfile =
      event.owner_id && event.owner_id !== user?.id ? ownerProfilesMap?.get(event.owner_id) : null;

    const attendees = eventAttendeesMap.get(event.id) || [];

    return {
      id: event.id,
      start_time: event.start_time,
      end_time: event.end_time,
      title: event.title,
      description: event.agenda || undefined,
      color: event.category?.color,
      owner_id: event.owner_id,
      owner_display_name: ownerProfile?.display_name || null,
      owner_avatar_url: ownerProfile?.avatar_url || null,
      role: event.role,
      attendees: attendees.length > 0 ? attendees : undefined,
      // Include the full event data for operations
      eventData: event,
    };
  });

  // Convert free/busy blocks to calendar items format
  const freeBusyItemsByUser = useMemo(() => {
    if (!freeBusyBlocks) return new Map();

    const itemsByUser = new Map<string, CalendarItem[]>();
    const userCounters = new Map<string, number>();

    freeBusyBlocks.forEach((block: any) => {
      if (!itemsByUser.has(block.user_id)) {
        itemsByUser.set(block.user_id, []);
        userCounters.set(block.user_id, 0);
      }

      // Get proper label for show_time_as value
      const showTimeAsLabel =
        SHOW_TIME_AS.find((item) => item.value === block.show_time_as)?.label || 'Busy';

      // Increment counter for this user to ensure unique IDs
      const counter = userCounters.get(block.user_id)!;
      userCounters.set(block.user_id, counter + 1);

      // Convert free/busy block to calendar item format
      itemsByUser.get(block.user_id)?.push({
        id: `fb-${block.user_id}-${counter}`,
        start_time: new Date(block.start_time),
        end_time: new Date(block.end_time),
        title: showTimeAsLabel,
        color: block.show_time_as === 'free' ? 'green' : 'neutral',
        owner_id: block.user_id,
        owner_display_name: null,
        owner_avatar_url: null,
        role: undefined,
        eventData: {} as EventResolved, // Minimal data
      });
    });

    return itemsByUser;
  }, [freeBusyBlocks]);

  // Build schedule rows with free/busy data for each user
  const scheduleRows = useMemo(() => {
    const rows = [
      // Current user row (always first) - show full events
      {
        id: user?.id || 'user',
        label: profile?.display_name || user?.email || 'Me',
        avatarUrl: profile?.avatar_url || undefined,
        items: calendarItems,
      },
    ];

    // Add rows for each schedule user with their free/busy blocks
    scheduleUserIds.forEach((userId) => {
      const userProfile = scheduleUsersProfilesMap?.get(userId);
      const userFreeBusyItems = freeBusyItemsByUser.get(userId) || [];

      rows.push({
        id: userId,
        label: userProfile?.display_name || 'Unknown User',
        avatarUrl: userProfile?.avatar_url || undefined,
        items: userFreeBusyItems,
      });
    });

    return rows;
  }, [
    user?.id,
    profile,
    calendarItems,
    scheduleUserIds,
    scheduleUsersProfilesMap,
    freeBusyItemsByUser,
    user?.email,
  ]);

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

  // Handler for creating single event from schedule view (with all schedule users)
  const handleCreateEventFromSchedule = useCallback(
    async (start: Date, end: Date) => {
      if (!user?.id) return;

      // Get all user IDs from schedule (excluding the current user)
      const attendeeUserIds = scheduleUserIds.filter((id) => id !== user.id);
      console.log('Creating event from schedule with attendees:', {
        scheduleUserIds,
        currentUserId: user.id,
        attendeeUserIds,
      });

      // Create event with all schedule users as attendees
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
        // Add attendees from schedule view
        invite_users:
          attendeeUserIds.length > 0
            ? attendeeUserIds.map((userId) => ({
                user_id: userId,
                role: 'attendee' as const,
                rsvp_status: 'tentative' as const,
              }))
            : undefined,
      });

      console.log('Created event:', newEvent);

      // Set as primary selected event and open details panel
      if (newEvent?.id) {
        setSelectedEventPrimary(newEvent.id);
        setEventDetailsPanelOpen(true);

        // Invalidate free/busy cache for all invited users so their schedules update
        queryClient.invalidateQueries({ queryKey: ['multiple-users-free-busy'] });
      }

      return newEvent;
    },
    [user?.id, scheduleUserIds, setSelectedEventPrimary, setEventDetailsPanelOpen, queryClient]
  );

  // Handler for creating events from schedule view with category
  const handleCreateEventsFromSchedule = useCallback(
    async (
      timeRanges: Array<{ start: Date; end: Date }>,
      categoryId: string,
      categoryName: string
    ) => {
      if (!user?.id) return [];

      try {
        const createdEvents = [];
        for (const range of timeRanges) {
          // Get attendee user IDs from schedule view (excluding current user)
          const attendeeUserIds = scheduleUserIds.filter((id) => id !== user.id);

          const eventData = {
            title: categoryName,
            start_time: range.start,
            end_time: range.end,
            all_day: false,
            private: false,
            category_id: categoryId,
            // Add attendees from schedule view
            invite_users:
              attendeeUserIds.length > 0
                ? attendeeUserIds.map((userId) => ({
                    user_id: userId,
                    role: 'attendee' as const,
                    rsvp_status: 'tentative' as const,
                  }))
                : undefined,
          };
          const createdEvent = await createEventResolved(user.id, eventData);
          if (createdEvent) {
            createdEvents.push(createdEvent);
          }
        }

        // Invalidate free/busy cache for all invited users so their schedules update
        if (scheduleUserIds.length > 1) {
          queryClient.invalidateQueries({ queryKey: ['multiple-users-free-busy'] });
        }

        // Return created events so the schedule can select them
        return createdEvents;
      } catch (error) {
        console.error('Error in handleCreateEventsFromSchedule:', error);
        return [];
      }
    },
    [user?.id, scheduleUserIds, queryClient]
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
      timeZone?: string;
    }) => {
      const { item, layout, selected, onMouseDownSelect, drag, highlight, timeZone } = props;

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
        owner_avatar_url: (item as any).owner_avatar_url,
        role: (item as any).role,
        attendees: (item as any).attendees,
      };

      return (
        <EventCard
          item={eventItem}
          layout={layout}
          selected={selected}
          onMouseDownSelect={onMouseDownSelect}
          drag={drag}
          highlight={highlight}
          timeZone={timeZone}
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
          <div className="h-full w-[260px] bg-background text-sidebar-foreground flex flex-col border-r border-border overflow-hidden flex-shrink-0">
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
            calendarView={calendarView}
            onToggleCalendarView={toggleCalendarView}
          />

          {/* Calendar Content */}
          <div className="flex-1 min-h-0">
            <div className="relative h-full overflow-hidden" id="calendar-grid-container">
              <AnimatePresence mode="wait">
                {calendarView === 'grid' ? (
                  <motion.div
                    key={`grid-view-${viewMode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
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
                      pxPerHour={96}
                      snapMinutes={15}
                      gridMinutes={30}
                      timeZones={[
                        { label: 'Local', timeZone: timezone, hour12: timeFormat === '12_hour' },
                      ]}
                      workSchedule={workPeriods}
                      operations={calendarOperations}
                      onSelectionsChange={handleGridSelectionsChange}
                      timeSelectionMode={timeSelectionMode}
                      onTimeSelection={timeSelectionCallback || undefined}
                      onTimeSelectionDismiss={disableTimeSelectionMode}
                      renderItem={renderCalendarItem}
                      renderRange={({ item, layout, onMouseDown }) => {
                        // Handle drag suggestions (SystemSlot format)
                        if ('startAbs' in item) {
                          return (
                            <div
                              className="absolute inset-x-0 bg-green-400/10 dark:bg-green-500/10 border-t border-b border-green-600 dark:border-green-400 pointer-events-none shadow-lg"
                              style={{
                                top: layout.top,
                                height: layout.height,
                              }}
                            >
                              <div className="text-xs text-green-800 dark:text-green-200 px-2 py-1 font-semibold">
                                ✓ Available
                              </div>
                            </div>
                          );
                        }

                        // Handle AI highlights (ClientAnnotation format)
                        return (
                          <TimeHighlight
                            annotation={item as any}
                            layout={layout}
                            onMouseDown={onMouseDown}
                          />
                        );
                      }}
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
                                    <ContextMenuItem disabled>
                                      No categories available
                                    </ContextMenuItem>
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
                      gridApi={gridApi}
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
                            return (
                              new Date(aData.start_time).getTime() -
                              new Date(bData.start_time).getTime()
                            );
                          });

                        const selectedEventIds = new Set(eventSelections.map((s) => s.id));
                        const unplacedEventIds = new Set(selectedEventIds); // Track which events haven't been placed yet

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

                        // Track already-placed events to avoid conflicts
                        const placedEvents: Array<{ start: Date; end: Date; id: string }> = [];

                        // Helper to get current blocking events (includes unplaced selected events)
                        const getBlockingEvents = () => {
                          const blocking: Array<{ start: Date; end: Date; id: string }> = [];

                          sortedTimeRanges.forEach((range) => {
                            visibleEvents.forEach((event) => {
                              const eventStart = new Date(event.start_time);
                              const eventEnd = new Date(event.end_time);

                              // Check if event overlaps with this time range
                              if (eventStart < range.end && eventEnd > range.start) {
                                // Include event if:
                                // 1. It's NOT selected at all, OR
                                // 2. It IS selected but hasn't been placed yet (still blocking)
                                if (
                                  !selectedEventIds.has(event.id) ||
                                  unplacedEventIds.has(event.id)
                                ) {
                                  blocking.push({
                                    start: eventStart,
                                    end: eventEnd,
                                    id: event.id,
                                  });
                                }
                              }
                            });
                          });

                          // Also add already-placed events from this operation
                          blocking.push(...placedEvents);

                          return blocking.sort((a, b) => a.start.getTime() - b.start.getTime());
                        };

                        // Helper to split ranges around blocking events
                        const getFreeSlots = () => {
                          const blockingEvents = getBlockingEvents();
                          const freeSlots: Array<{ start: Date; end: Date }> = [];

                          sortedTimeRanges.forEach((range) => {
                            let currentStart = new Date(range.start);
                            const rangeEnd = new Date(range.end);

                            const overlappingBlocks = blockingEvents.filter(
                              (block) => block.start < rangeEnd && block.end > currentStart
                            );

                            if (overlappingBlocks.length === 0) {
                              freeSlots.push({ start: currentStart, end: rangeEnd });
                            } else {
                              overlappingBlocks.forEach((block) => {
                                if (currentStart < block.start) {
                                  freeSlots.push({ start: currentStart, end: block.start });
                                }
                                currentStart = new Date(
                                  Math.max(currentStart.getTime(), block.end.getTime())
                                );
                              });

                              if (currentStart < rangeEnd) {
                                freeSlots.push({ start: currentStart, end: rangeEnd });
                              }
                            }
                          });

                          return freeSlots;
                        };

                        let placedCount = 0;
                        const failedEvents: string[] = [];

                        // Try to fit each event
                        eventSelections.forEach((selection) => {
                          const eventData = selection.data as any;
                          const eventDuration =
                            new Date(eventData.end_time).getTime() -
                            new Date(eventData.start_time).getTime();

                          // Recalculate free slots for this event (accounts for newly placed events)
                          const freeSlots = getFreeSlots();
                          const rangePositions = freeSlots.map((slot) => ({
                            currentTime: alignToGrid(new Date(slot.start)),
                            endTime: new Date(slot.end),
                          }));

                          // Try to find a slot for this event
                          let placed = false;
                          for (let i = 0; i < rangePositions.length && !placed; i++) {
                            const rangePos = rangePositions[i];
                            const proposedEnd = new Date(
                              rangePos.currentTime.getTime() + eventDuration
                            );

                            if (proposedEnd.getTime() <= rangePos.endTime.getTime()) {
                              // Event fits! Update it
                              updateEventResolved(user.id, selection.id!, {
                                start_time: rangePos.currentTime,
                                end_time: proposedEnd,
                              });

                              // Track this placement
                              placedEvents.push({
                                start: new Date(rangePos.currentTime),
                                end: new Date(proposedEnd),
                                id: selection.id!,
                              });

                              // Remove from unplaced set
                              unplacedEventIds.delete(selection.id!);

                              placed = true;
                              placedCount++;
                            }
                          }

                          if (!placed) {
                            failedEvents.push(eventData.title);
                          }
                        });

                        // Clear selections after fitting
                        clearAllSelections();

                        // Show summary toast
                        if (placedCount > 0 && failedEvents.length === 0) {
                          toast.success(
                            `Packed ${placedCount} event${placedCount !== 1 ? 's' : ''}`
                          );
                        } else if (placedCount > 0 && failedEvents.length > 0) {
                          toast.success(
                            `Packed ${placedCount} event${placedCount !== 1 ? 's' : ''}. ${failedEvents.length} could not be placed.`
                          );
                        } else {
                          toast.error('Could not pack any events - insufficient space');
                        }
                      }}
                      onSpread={() => {
                        if (!user?.id) return;

                        // Get selected events sorted chronologically
                        const eventSelections = gridSelections.items
                          .filter((item) => item.type === 'event' && item.id && item.data)
                          .sort((a, b) => {
                            const aData = a.data as any;
                            const bData = b.data as any;
                            return (
                              new Date(aData.start_time).getTime() -
                              new Date(bData.start_time).getTime()
                            );
                          });

                        const selectedEventIds = new Set(eventSelections.map((s) => s.id));
                        const unplacedEventIdsSpread = new Set(selectedEventIds); // Track which events haven't been placed yet

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

                        const SPREAD_GAP_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

                        // Track already-placed events to avoid conflicts
                        const placedEventsSpread: Array<{ start: Date; end: Date; id: string }> =
                          [];

                        // Helper to get current blocking events (includes unplaced selected events)
                        const getBlockingEventsSpread = () => {
                          const blocking: Array<{ start: Date; end: Date; id: string }> = [];

                          sortedTimeRanges.forEach((range) => {
                            visibleEvents.forEach((event) => {
                              const eventStart = new Date(event.start_time);
                              const eventEnd = new Date(event.end_time);

                              if (eventStart < range.end && eventEnd > range.start) {
                                if (
                                  !selectedEventIds.has(event.id) ||
                                  unplacedEventIdsSpread.has(event.id)
                                ) {
                                  blocking.push({
                                    start: eventStart,
                                    end: eventEnd,
                                    id: event.id,
                                  });
                                }
                              }
                            });
                          });

                          blocking.push(...placedEventsSpread);
                          return blocking.sort((a, b) => a.start.getTime() - b.start.getTime());
                        };

                        // Helper to get free slots with buffers around blocking events
                        const getFreeSlotsWithBuffers = () => {
                          const blockingEvents = getBlockingEventsSpread();
                          const freeSlots: Array<{ start: Date; end: Date }> = [];

                          sortedTimeRanges.forEach((range) => {
                            let currentStart = new Date(range.start);
                            const rangeEnd = new Date(range.end);

                            const overlappingBlocks = blockingEvents.filter(
                              (block) => block.start < rangeEnd && block.end > currentStart
                            );

                            if (overlappingBlocks.length === 0) {
                              freeSlots.push({ start: currentStart, end: rangeEnd });
                            } else {
                              overlappingBlocks.forEach((block) => {
                                const bufferBeforeBlock = new Date(
                                  block.start.getTime() - SPREAD_GAP_MS
                                );
                                const bufferAfterBlock = new Date(
                                  block.end.getTime() + SPREAD_GAP_MS
                                );

                                if (currentStart < bufferBeforeBlock) {
                                  freeSlots.push({ start: currentStart, end: bufferBeforeBlock });
                                }
                                currentStart = new Date(
                                  Math.max(currentStart.getTime(), bufferAfterBlock.getTime())
                                );
                              });

                              if (currentStart < rangeEnd) {
                                freeSlots.push({ start: currentStart, end: rangeEnd });
                              }
                            }
                          });

                          return freeSlots;
                        };

                        // Helper to get free slots without buffers (fallback)
                        const getFreeSlotsNoBuffers = () => {
                          const blockingEvents = getBlockingEventsSpread();
                          const freeSlots: Array<{ start: Date; end: Date }> = [];

                          sortedTimeRanges.forEach((range) => {
                            let currentStart = new Date(range.start);
                            const rangeEnd = new Date(range.end);

                            const overlappingBlocks = blockingEvents.filter(
                              (block) => block.start < rangeEnd && block.end > currentStart
                            );

                            if (overlappingBlocks.length === 0) {
                              freeSlots.push({ start: currentStart, end: rangeEnd });
                            } else {
                              overlappingBlocks.forEach((block) => {
                                if (currentStart < block.start) {
                                  freeSlots.push({ start: currentStart, end: block.start });
                                }
                                currentStart = new Date(
                                  Math.max(currentStart.getTime(), block.end.getTime())
                                );
                              });

                              if (currentStart < rangeEnd) {
                                freeSlots.push({ start: currentStart, end: rangeEnd });
                              }
                            }
                          });

                          return freeSlots;
                        };

                        let placedCountSpread = 0;
                        const failedEventsSpread: string[] = [];

                        // Try to fit each event with spread gap AND buffers around existing events, fallback progressively
                        eventSelections.forEach((selection) => {
                          const eventData = selection.data as any;
                          const eventDuration =
                            new Date(eventData.end_time).getTime() -
                            new Date(eventData.start_time).getTime();

                          let placed = false;

                          // Pass 1: With buffers around existing events AND gaps between placed events
                          const freeSlotsWithBuffers = getFreeSlotsWithBuffers();
                          for (let i = 0; i < freeSlotsWithBuffers.length && !placed; i++) {
                            const slot = freeSlotsWithBuffers[i];
                            const proposedStart = alignToGrid(new Date(slot.start));
                            const proposedEnd = new Date(proposedStart.getTime() + eventDuration);
                            const proposedEndWithGap = new Date(
                              proposedEnd.getTime() + SPREAD_GAP_MS
                            );

                            if (proposedEndWithGap.getTime() <= slot.end.getTime()) {
                              updateEventResolved(user.id, selection.id!, {
                                start_time: proposedStart,
                                end_time: proposedEnd,
                              });
                              placedEventsSpread.push({
                                start: new Date(proposedStart),
                                end: new Date(proposedEnd),
                                id: selection.id!,
                              });
                              unplacedEventIdsSpread.delete(selection.id!);
                              placed = true;
                              placedCountSpread++;
                            }
                          }

                          // Pass 2: With buffers around existing events but NO gaps between placed events
                          if (!placed) {
                            for (let i = 0; i < freeSlotsWithBuffers.length && !placed; i++) {
                              const slot = freeSlotsWithBuffers[i];
                              const proposedStart = alignToGrid(new Date(slot.start));
                              const proposedEnd = new Date(proposedStart.getTime() + eventDuration);

                              if (proposedEnd.getTime() <= slot.end.getTime()) {
                                updateEventResolved(user.id, selection.id!, {
                                  start_time: proposedStart,
                                  end_time: proposedEnd,
                                });
                                placedEventsSpread.push({
                                  start: new Date(proposedStart),
                                  end: new Date(proposedEnd),
                                  id: selection.id!,
                                });
                                unplacedEventIdsSpread.delete(selection.id!);
                                placed = true;
                                placedCountSpread++;
                              }
                            }
                          }

                          // Pass 3: NO buffers around existing events but WITH gaps between placed events
                          if (!placed) {
                            const freeSlotsNoBuffers = getFreeSlotsNoBuffers();
                            for (let i = 0; i < freeSlotsNoBuffers.length && !placed; i++) {
                              const slot = freeSlotsNoBuffers[i];
                              const proposedStart = alignToGrid(new Date(slot.start));
                              const proposedEnd = new Date(proposedStart.getTime() + eventDuration);
                              const proposedEndWithGap = new Date(
                                proposedEnd.getTime() + SPREAD_GAP_MS
                              );

                              if (proposedEndWithGap.getTime() <= slot.end.getTime()) {
                                updateEventResolved(user.id, selection.id!, {
                                  start_time: proposedStart,
                                  end_time: proposedEnd,
                                });
                                placedEventsSpread.push({
                                  start: new Date(proposedStart),
                                  end: new Date(proposedEnd),
                                  id: selection.id!,
                                });
                                unplacedEventIdsSpread.delete(selection.id!);
                                placed = true;
                                placedCountSpread++;
                              }
                            }
                          }

                          // Pass 4: NO buffers and NO gaps (tight pack - same as Pack feature)
                          if (!placed) {
                            const freeSlotsNoBuffers = getFreeSlotsNoBuffers();
                            for (let i = 0; i < freeSlotsNoBuffers.length && !placed; i++) {
                              const slot = freeSlotsNoBuffers[i];
                              const proposedStart = alignToGrid(new Date(slot.start));
                              const proposedEnd = new Date(proposedStart.getTime() + eventDuration);

                              if (proposedEnd.getTime() <= slot.end.getTime()) {
                                updateEventResolved(user.id, selection.id!, {
                                  start_time: proposedStart,
                                  end_time: proposedEnd,
                                });
                                placedEventsSpread.push({
                                  start: new Date(proposedStart),
                                  end: new Date(proposedEnd),
                                  id: selection.id!,
                                });
                                unplacedEventIdsSpread.delete(selection.id!);
                                placed = true;
                                placedCountSpread++;
                              }
                            }
                          }

                          if (!placed) {
                            failedEventsSpread.push(eventData.title);
                          }
                        });

                        // Clear selections after fitting
                        clearAllSelections();

                        // Show summary toast
                        if (placedCountSpread > 0 && failedEventsSpread.length === 0) {
                          toast.success(
                            `Spread ${placedCountSpread} event${placedCountSpread !== 1 ? 's' : ''}`
                          );
                        } else if (placedCountSpread > 0 && failedEventsSpread.length > 0) {
                          toast.success(
                            `Spread ${placedCountSpread} event${placedCountSpread !== 1 ? 's' : ''}. ${failedEventsSpread.length} could not be placed.`
                          );
                        } else {
                          toast.error('Could not spread any events - insufficient space');
                        }
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
                            await updateEventResolved(user.id, selection.id, {
                              in_person: isInPerson,
                            });
                          }
                        });
                      }}
                      onUpdateIsPrivate={(isPrivate: boolean) => {
                        const eventSelections = gridSelections.items.filter(
                          (item) => item.type === 'event' && item.id
                        );
                        eventSelections.forEach(async (selection) => {
                          if (selection.id && user?.id) {
                            await updateEventResolved(user.id, selection.id, {
                              private: isPrivate,
                            });
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="schedule-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <CalendarSchedule
                      rows={scheduleRows}
                      timeRange={{
                        start: scheduleRange.startDate,
                        end: scheduleRange.endDate,
                      }}
                      pxPerHour={240}
                      snapMinutes={15}
                      rowHeight={80}
                      timezone={timezone}
                      operations={calendarOperations}
                      userCalendars={userCalendars?.map((cal) => ({
                        ...cal,
                        color: cal.color || 'blue',
                      }))}
                      userCategories={userCategories?.map((cat) => ({
                        ...cat,
                        color: cat.color || 'blue',
                      }))}
                      onCreateEvent={handleCreateEventFromSchedule}
                      onCreateEvents={handleCreateEventsFromSchedule}
                      onUpdateShowTimeAs={(itemIds, showTimeAs) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, { show_time_as: showTimeAs });
                          }
                        });
                      }}
                      onUpdateCalendar={(itemIds, calendarId) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, { calendar_id: calendarId });
                          }
                        });
                      }}
                      onUpdateCategory={(itemIds, categoryId) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, { category_id: categoryId });
                          }
                        });
                      }}
                      onUpdateIsOnlineMeeting={(itemIds, isOnlineMeeting) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, {
                              online_event: isOnlineMeeting,
                            });
                          }
                        });
                      }}
                      onUpdateIsInPerson={(itemIds, isInPerson) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, { in_person: isInPerson });
                          }
                        });
                      }}
                      onUpdateIsPrivate={(itemIds, isPrivate) => {
                        itemIds.forEach(async (id) => {
                          if (user?.id) {
                            await updateEventResolved(user.id, id, { private: isPrivate });
                          }
                        });
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
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
        {showNavigationGlow &&
          glowRect &&
          (() => {
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

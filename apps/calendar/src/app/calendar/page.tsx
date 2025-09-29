"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import type { CalendarDayRangeHandle, TimeHighlight, SystemSlot } from "@/components/types";
import type { EventResolved } from "@/lib/data-v2";
import { motion, AnimatePresence } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { DatePicker } from "@/components/date-picker";
import { Calendars } from "@/components/calendars";
import { NavUser } from "@/components/nav-user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsModal } from "@/components/settings-modal";
import { CalendarHeader } from "@/components/calendar-view/calendar-header";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";
import {
  useUserCategories,
  useUserCalendars,
  useUserProfile,
  useUserAnnotations,
  useEventsResolvedRange,
  createEventResolved,
  updateEventResolved,
  deleteEventResolved
} from "@/lib/data-v2";
import { addDays, startOfDay, endOfDay } from "date-fns";
import type { SelectedTimeRange } from "@/components/types";
import CalendarDayRange from "@/components/calendar-view/calendar-day-range";
import { CalendarGrid } from "@/components/calendar-grid";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const api = useRef<CalendarDayRangeHandle>(null);

  // State for day expansion in CalendarGrid v2
  const [expandedDay, setExpandedDay] = useState<number | null>(null);


  // Use app store for date state
  const {
    viewMode, dateRangeType, customDayCount, startDate, selectedDates, weekStartDay, timezone, timeFormat,
    setDateRangeView, setCustomDayCount, setWeekStartDay, setTimezone, setTimeFormat, nextPeriod, prevPeriod, goToToday,
    settingsModalOpen, setSettingsModalOpen, aiPanelOpen,
    sidebarTab, setSidebarTab, sidebarOpen, toggleSidebar,
    displayMode, setDisplayMode,
    hiddenCalendarIds
  } = useAppStore();

  // Get user profile to sync settings to store
  const profile = useUserProfile(user?.id);

  // Sync profile settings to app store when profile loads
  React.useEffect(() => {
    if (profile) {
      if (profile.week_start_day) {
        const profileWeekStartDay = parseInt(profile.week_start_day) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
  }, [profile?.week_start_day, profile?.timezone, profile?.time_format, weekStartDay, timezone, timeFormat, setWeekStartDay, setTimezone, setTimeFormat]);

  // Calculate date range for the current view
  const dateRange = useMemo(() => {
    if (viewMode === 'dateArray' && selectedDates.length > 0) {
      // Date Array mode: use earliest and latest selected dates
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      return {
        startDate: startOfDay(sortedDates[0]),
        endDate: endOfDay(sortedDates[sortedDates.length - 1])
      };
    }

    // Date Range mode: calculate based on type and startDate
    let dayCount = 1;
    let calculatedStartDate = startDate;

    switch (dateRangeType) {
      case 'day':
        dayCount = 1;
        break;
      case 'week':
        dayCount = 7;
        // Adjust to week start based on user preference
        const dayOfWeek = startDate.getDay();
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
        break;
      case 'workweek':
        dayCount = 5;
        // Adjust to week start (Monday for work week)
        const currentDay = startDate.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
        break;
      case 'custom-days':
        dayCount = customDayCount;
        break;
    }

    const endDate = addDays(calculatedStartDate, dayCount - 1);

    return {
      startDate: startOfDay(calculatedStartDate),
      endDate: endOfDay(endDate)
    };
  }, [viewMode, dateRangeType, customDayCount, startDate, selectedDates, weekStartDay])

  // Fetch events from database for the current date range
  const events = useEventsResolvedRange(user?.id, {
    from: dateRange.startDate.getTime(),
    to: dateRange.endDate.getTime()
  }) || []

  // Fetch user's event categories
  const userCategories = useUserCategories(user?.id) || []

  // Fetch user's calendars
  const userCalendars = useUserCalendars(user?.id) || []

  // Fetch user's annotations (AI highlights)
  const userAnnotations = useUserAnnotations(user?.id) || []

  // V2 data layer uses direct function calls instead of hooks for mutations

  // Filter events based on calendar visibility
  const visibleEvents = useMemo((): EventResolved[] => {
    // If hiddenCalendarIds is not a Set yet (during hydration), show all events
    if (!(hiddenCalendarIds instanceof Set)) {
      return events;
    }

    const filtered = events.filter(event => {
      // If no calendar, assume it belongs to the default calendar which should always be visible
      if (!event.calendar?.id) {
        return true;
      }
      // Show event if its calendar is NOT in the hidden set
      return !hiddenCalendarIds.has(event.calendar.id);
    });

    return filtered;
  }, [events, hiddenCalendarIds])

  // Find the selected event for details panel

  // Handle events change from calendar (for updates, moves, etc)
  const handleEventsChange = async (updatedEvents: EventResolved[]) => {
    // Find events that have changed compared to the current events
    const currentEventsMap = new Map(events.map(e => [e.id, e]))

    for (const updatedEvent of updatedEvents) {
      const currentEvent = currentEventsMap.get(updatedEvent.id)
      if (!currentEvent) return

      // Check if the event's time or other properties have changed
      const hasTimeChanged =
        updatedEvent.start_time_ms !== currentEvent.start_time_ms ||
        updatedEvent.end_time_ms !== currentEvent.end_time_ms

      const hasTitleChanged = updatedEvent.title !== currentEvent.title

      if (hasTimeChanged || hasTitleChanged) {
        // Calculate new start_time and duration from the updated timestamps
        const newStartTime = new Date(updatedEvent.start_time_ms).toISOString()
        const newDuration = Math.round((updatedEvent.end_time_ms - updatedEvent.start_time_ms) / (1000 * 60)) // Convert ms to minutes

        const updates: { start_time?: Date; duration?: number; title?: string } = {}

        if (hasTimeChanged) {
          updates.start_time = new Date(newStartTime)
          updates.duration = newDuration
        }

        if (hasTitleChanged) {
          updates.title = updatedEvent.title
        }

        // Update the event in the database using V2 data layer
        if (user?.id) {
          const updateData: any = {};
          if (updates.start_time) updateData.start_time = updates.start_time.toISOString();
          if (updates.duration) {
            // Convert duration back to end_time
            const startMs = updates.start_time ? updates.start_time.getTime() : updatedEvent.start_time_ms;
            const endMs = startMs + (updates.duration * 60 * 1000);
            updateData.end_time = new Date(endMs).toISOString();
          }
          if (updates.title) updateData.title = updates.title;

          await updateEventResolved(user.id, updatedEvent.id, updateData);
        }
      }
    }
  }

  // Handle creating events from selected time ranges
  const handleCreateEvents = async (ranges: SelectedTimeRange[]) => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Create all events and collect their IDs
      const createPromises = ranges.map(range => {
        const startTime = new Date(range.startAbs)
        const endTime = new Date(range.endAbs)

        // Find default calendar for the user
        const defaultCalendar = userCalendars.find(cal => cal.type === 'default');

        if (!user?.id) throw new Error('User not authenticated');

        return createEventResolved(user.id, {
          title: "New Event",
          start_time: startTime,
          end_time: endTime,
          all_day: false,
          calendar_id: defaultCalendar?.id,
        })
      })

      // Wait for all events to be created
      const createdEvents = await Promise.all(createPromises)

      // Extract the event IDs
      const createdEventIds = createdEvents.map(event => event.id)

      // Select the newly created events
      if (createdEventIds.length > 0 && api.current) {
        api.current.selectEvents(createdEventIds)
      }

      console.log('Successfully created events:', createdEventIds);
    } catch (error) {
      console.error('Error creating events:', error);
    }
  }

  // Handle deleting events
  const handleDeleteEvents = (eventIds: string[]) => {
    if (!user?.id) return;

    eventIds.forEach(async eventId => {
      try {
        await deleteEventResolved(user.id, eventId);
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    })
  }

  // Handle updating events
  const handleUpdateEvents = (eventIds: string[], updates: Partial<EventResolved>) => {
    eventIds.forEach(async eventId => {
      // Prepare update object for V2 updateEventResolved
      const updateData: any = {};

      // Handle personal details updates
      if (updates.personal_details) {
        if (updates.personal_details.show_time_as !== undefined) {
          updateData.show_time_as = updates.personal_details.show_time_as;
        }
        if (updates.personal_details.time_defense_level !== undefined) {
          updateData.time_defense_level = updates.personal_details.time_defense_level;
        }
        if (updates.personal_details.ai_managed !== undefined) {
          updateData.ai_managed = updates.personal_details.ai_managed;
        }
        if (updates.personal_details.ai_instructions !== undefined) {
          updateData.ai_instructions = updates.personal_details.ai_instructions;
        }
        if (updates.personal_details.calendar_id !== undefined) {
          updateData.calendar_id = updates.personal_details.calendar_id;
        }
        if (updates.personal_details.category_id !== undefined) {
          updateData.category_id = updates.personal_details.category_id;
        }
      }

      // Handle calendar/category updates from resolved lookups
      if (updates.calendar?.id !== undefined) {
        updateData.calendar_id = updates.calendar.id;
      }
      if (updates.category?.id !== undefined) {
        updateData.category_id = updates.category.id;
      }

      // Handle event property updates
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.online_event !== undefined) updateData.online_event = updates.online_event;
      if (updates.in_person !== undefined) updateData.in_person = updates.in_person;
      if (updates.private !== undefined) updateData.private = updates.private;
      if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
      if (updates.end_time !== undefined) updateData.end_time = updates.end_time;

      // Use V2 updateEventResolved function
      if (user?.id && Object.keys(updateData).length > 0) {
        try {
          await updateEventResolved(user.id, eventId, updateData);
        } catch (error) {
          console.error('Failed to update event:', error);
        }
      }
    })
  }

  // Handle updating a single event (for drag and drop)
  const handleUpdateEvent = async (updates: { id: string; start_time: Date; end_time: Date }) => {
    if (!user?.id) return;

    try {
      await updateEventResolved(user.id, updates.id, {
        start_time: updates.start_time,
        end_time: updates.end_time
      });
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  }

  // Get AI highlights from database annotations (both time highlights and general highlights)
  const aiHighlights: TimeHighlight[] = useMemo(() => {
    return userAnnotations
      .filter(annotation =>
        annotation.type === 'ai_time_highlight' &&
        annotation.start_time &&
        annotation.end_time
      )
      .map(annotation => ({
        id: `db-highlight-${annotation.id}`,
        startAbs: annotation.start_time!.getTime(),
        endAbs: annotation.end_time!.getTime(),
        title: annotation.title || undefined,
        message: annotation.message || undefined,
        emoji: annotation.emoji_icon || undefined
      }));
  }, [userAnnotations]);

  // Get highlighted event IDs from database annotations
  const highlightedEventIds = useMemo(() => {
    return userAnnotations
      .filter(annotation => annotation.type === 'ai_event_highlight' && annotation.event_id)
      .map(annotation => annotation.event_id!)
      .filter(Boolean);
  }, [userAnnotations]);

  const [systemSlots] = useState<SystemSlot[]>([]);

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
              opacity: { duration: 0.2 }
            }}
            className="h-full bg-sidebar text-sidebar-foreground flex flex-col border-r border-border overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="border-sidebar-border h-16 border-b flex flex-row items-center px-4">
              <NavUser />
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
              <Tabs value={sidebarTab} onValueChange={(value) => setSidebarTab(value as 'dates' | 'calendars')} className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Navigation - Fixed */}
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="dates" className="text-xs">Dates</TabsTrigger>
                    <TabsTrigger value="calendars" className="text-xs">Calendars</TabsTrigger>
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
      <Allotment onChange={(sizes) => {
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
      }}>
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
              displayMode={displayMode}
              onSetDisplayMode={setDisplayMode}
            />

            {/* Calendar Content */}
            <div className="flex-1 min-h-0">
              {displayMode === 'v2' ? (
                <CalendarGrid
                  items={[]} // TODO: Connect to real data
                  viewMode={viewMode}
                  dateRangeType={dateRangeType}
                  startDate={startDate}
                  customDayCount={customDayCount}
                  weekStartDay={weekStartDay}
                  selectedDates={selectedDates}
                  expandedDay={expandedDay}
                  onExpandedDayChange={setExpandedDay}
                  pxPerHour={64}
                  snapMinutes={15}
                  timeZones={[
                    { label: 'Local', timeZone: timezone, hour12: timeFormat === '12_hour' }
                  ]}
                />
              ) : (
                <CalendarDayRange
                  ref={api}
                  days={viewMode === 'dateRange' ?
                    (dateRangeType === 'day' ? 1 :
                     dateRangeType === 'week' ? 7 :
                     dateRangeType === 'workweek' ? 5 :
                     customDayCount) : selectedDates.length}
                  timeZone={timezone}
                  timeFormat={timeFormat}
                  events={visibleEvents}
                  userCategories={userCategories}
                  userCalendars={userCalendars}
                  aiHighlights={aiHighlights}
                  highlightedEventIds={highlightedEventIds}
                  systemHighlightSlots={systemSlots}
                  slotMinutes={30}
                  dragSnapMinutes={5}
                  minDurationMinutes={15}
                  weekStartsOn={weekStartDay}
                />
              )}
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

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
      />
    </div>
  );
}
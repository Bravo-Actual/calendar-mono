"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import type { CalendarDayRangeHandle, TimeHighlight, SystemSlot } from "@/components/types";
import type { AssembledEvent } from "@/lib/data";
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
import { EventDetailsPanel } from "@/components/event-details-panel";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";
import {
  useUserProfile,
  useEventsRange,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useUpdateEventCalendar,
  useUpdateEventCategory,
  useUpdateEventShowTimeAs,
  useUpdateEventTimeDefense,
  useUpdateEventAI,
  useUserCategories,
  useUserCalendars,
  useUserAnnotations
} from "@/lib/data/queries";
import { addDays, startOfDay, endOfDay } from "date-fns";
import type { SelectedTimeRange } from "@/components/types";
import CalendarDayRange from "@/components/calendar-view/calendar-day-range";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const api = useRef<CalendarDayRangeHandle>(null);


  // Use app store for date state
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay, timezone, timeFormat,
    setConsecutiveView, setCustomDayCount, setWeekStartDay, setTimezone, setTimeFormat, nextPeriod, prevPeriod, goToToday,
    settingsModalOpen, setSettingsModalOpen, aiPanelOpen,
    sidebarTab, setSidebarTab, sidebarOpen, toggleSidebar,
    displayMode, setDisplayMode,
    eventDetailsPanelOpen, selectedEventForDetails, openEventDetails, closeEventDetails,
    hiddenCalendarIds
  } = useAppStore();

  // Get user profile to sync settings to store
  const { data: profile } = useUserProfile(user?.id);

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
    if (viewMode === 'non-consecutive' && selectedDates.length > 0) {
      // Non-consecutive mode: use earliest and latest selected dates
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      return {
        startDate: startOfDay(sortedDates[0]),
        endDate: endOfDay(sortedDates[sortedDates.length - 1])
      };
    }

    // Consecutive mode: calculate based on type and startDate
    let dayCount = 1;
    let calculatedStartDate = startDate;

    switch (consecutiveType) {
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
  }, [viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay])

  // Fetch events from database for the current date range
  const { data: events = [] } = useEventsRange(user?.id, {
    from: dateRange.startDate.getTime(),
    to: dateRange.endDate.getTime()
  })

  // Fetch user's event categories
  const { data: userCategories = [] } = useUserCategories(user?.id)

  // Fetch user's calendars
  const { data: userCalendars = [] } = useUserCalendars(user?.id)

  // Fetch user's annotations (AI highlights)
  const { data: userAnnotations = [] } = useUserAnnotations(user?.id)

  // Event mutation hooks
  const updateEvent = useUpdateEvent(user?.id)
  const createEvent = useCreateEvent(user?.id)
  const deleteEvent = useDeleteEvent(user?.id)

  // Convenience hooks for specific updates
  const updateEventCalendar = useUpdateEventCalendar(user?.id)
  const updateEventCategory = useUpdateEventCategory(user?.id)
  const updateEventShowTimeAs = useUpdateEventShowTimeAs(user?.id)
  const updateEventTimeDefense = useUpdateEventTimeDefense(user?.id)
  const updateEventAI = useUpdateEventAI(user?.id)

  // The new hook returns complete AssembledEvent objects directly

  // Filter events based on calendar visibility
  const visibleEvents = useMemo((): AssembledEvent[] => {
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
  const selectedEvent = useMemo(() => {
    if (!selectedEventForDetails) return null;
    return events.find(event => event.id === selectedEventForDetails) || null;
  }, [events, selectedEventForDetails])

  // Handle events change from calendar (for updates, moves, etc)
  const handleEventsChange = (updatedEvents: AssembledEvent[]) => {
    // Find events that have changed compared to the current events
    const currentEventsMap = new Map(events.map(e => [e.id, e]))

    updatedEvents.forEach(updatedEvent => {
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

        const updates: { start_time?: string; duration?: number; title?: string } = {}

        if (hasTimeChanged) {
          updates.start_time = newStartTime
          updates.duration = newDuration
        }

        if (hasTitleChanged) {
          updates.title = updatedEvent.title
        }

        // Update the event in the database
        updateEvent.mutate({
          id: updatedEvent.id,
          event: updates
        })
      }
    })
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
        const startTime = new Date(range.startAbs).toISOString()
        const endTime = new Date(range.endAbs).toISOString()

        // Find default calendar for the user
        const defaultCalendar = userCalendars.find(cal => cal.type === 'default');

        return createEvent.mutateAsync({
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
    eventIds.forEach(eventId => {
      deleteEvent.mutate(eventId)
    })
  }

  // Handle updating events
  const handleUpdateEvents = (eventIds: string[], updates: Partial<AssembledEvent>) => {
    eventIds.forEach(eventId => {
      // Use convenience hooks for personal details
      if (updates.show_time_as !== undefined) {
        updateEventShowTimeAs.mutate({ eventId, showTimeAs: updates.show_time_as })
      }
      if (updates.calendar?.id !== undefined) {
        updateEventCalendar.mutate({ eventId, calendarId: updates.calendar.id })
      }
      if (updates.category?.id !== undefined) {
        updateEventCategory.mutate({ eventId, categoryId: updates.category.id })
      }
      if (updates.time_defense_level !== undefined) {
        updateEventTimeDefense.mutate({ eventId, timeDefenseLevel: updates.time_defense_level })
      }
      if (updates.ai_managed !== undefined) {
        updateEventAI.mutate({ eventId, aiManaged: updates.ai_managed, aiInstructions: updates.ai_instructions })
      }

      // Use base updateEvent for event properties
      const eventUpdates: any = {}
      if (updates.title !== undefined) eventUpdates.title = updates.title
      if (updates.online_event !== undefined) eventUpdates.online_event = updates.online_event
      if (updates.in_person !== undefined) eventUpdates.in_person = updates.in_person
      if (updates.private !== undefined) eventUpdates.private = updates.private

      if (Object.keys(eventUpdates).length > 0) {
        updateEvent.mutate({ id: eventId, event: eventUpdates })
      }
    })
  }

  // Handle updating a single event (for drag and drop)
  const handleUpdateEvent = (updates: { id: string; start_time: string; end_time: string }) => {
    updateEvent.mutate({
      id: updates.id,
      event: {
        start_time: updates.start_time,
        end_time: updates.end_time
      }
    })
  }

  // Get AI highlights from database annotations (both time highlights and general highlights)
  const aiHighlights: TimeHighlight[] = useMemo(() => {
    return userAnnotations
      .filter(annotation =>
        (annotation.type === 'highlight' || annotation.type === 'ai_time_highlight') &&
        annotation.start_time &&
        annotation.end_time
      )
      .map(annotation => ({
        id: `db-highlight-${annotation.id}`,
        startAbs: new Date(annotation.start_time!).getTime(),
        endAbs: new Date(annotation.end_time!).getTime(),
        intent: annotation.message || annotation.title
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

      {/* Main Calendar, Event Details, and AI Area */}
      <Allotment onChange={(sizes) => {
        // Update panel states when user drags to snap
        if (sizes && sizes.length >= 2) {
          const totalWidth = window.innerWidth - (sidebarOpen ? 300 : 0);

          if (sizes.length === 3) {
            // Three panes: Calendar, Event Details, AI
            const eventDetailsSizePercent = sizes[1];
            const aiSizePercent = sizes[2];
            const eventDetailsSizePx = (eventDetailsSizePercent / 100) * totalWidth;
            const aiSizePx = (aiSizePercent / 100) * totalWidth;

            const eventDetailsOpen = eventDetailsSizePx >= 200;
            const aiOpen = aiSizePx >= 200;

            if (eventDetailsOpen !== eventDetailsPanelOpen) {
              useAppStore.setState({ eventDetailsPanelOpen: eventDetailsOpen });
            }
            if (aiOpen !== aiPanelOpen) {
              useAppStore.setState({ aiPanelOpen: aiOpen });
            }
          } else if (sizes.length === 2) {
            // Two panes: Calendar and one other panel
            const panelSizePercent = sizes[1];
            const panelSizePx = (panelSizePercent / 100) * totalWidth;
            const isOpen = panelSizePx >= 200;

            // Determine which panel is open based on current state
            if (eventDetailsPanelOpen && !aiPanelOpen) {
              if (isOpen !== eventDetailsPanelOpen) {
                useAppStore.setState({ eventDetailsPanelOpen: isOpen });
              }
            } else {
              if (isOpen !== aiPanelOpen) {
                useAppStore.setState({ aiPanelOpen: isOpen });
              }
            }
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
              consecutiveType={consecutiveType}
              customDayCount={customDayCount}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onGoToToday={handleGoToToday}
              onSetConsecutiveView={setConsecutiveView}
              onSetCustomDayCount={setCustomDayCount}
              startDate={startDate}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
              displayMode={displayMode}
              onSetDisplayMode={setDisplayMode}
            />

            {/* Calendar Content */}
            <div className="flex-1 min-h-0">
              <CalendarDayRange
                ref={api}
                days={viewMode === 'consecutive' ?
                  (consecutiveType === 'day' ? 1 :
                   consecutiveType === 'week' ? 7 :
                   consecutiveType === 'workweek' ? 5 :
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
                onEventDoubleClick={openEventDetails}
              />
            </div>
          </div>
        </Allotment.Pane>

        {/* Event Details Panel */}
        {eventDetailsPanelOpen && (
          <Allotment.Pane
            preferredSize={400}
            minSize={300}
            maxSize={600}
            snap
          >
            <EventDetailsPanel
              isOpen={eventDetailsPanelOpen}
              event={selectedEvent}
              onClose={closeEventDetails}
            />
          </Allotment.Pane>
        )}

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
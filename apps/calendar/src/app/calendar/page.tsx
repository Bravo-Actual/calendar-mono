"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "@/components/types";
import { motion, AnimatePresence } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { DatePicker } from "@/components/date-picker";
import { Calendars } from "@/components/calendars";
import { NavUser } from "@/components/nav-user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsModal } from "@/components/settings-modal";
import { CalendarHeader } from "@/components/calendar-header";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { EventDetailsPanel } from "@/components/event-details-panel";
import { SchedulingView } from "@/components/scheduling-view";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useUpdateEvent } from "@/hooks/use-update-event";
import { useCreateEvent } from "@/hooks/use-create-event";
import { useDeleteEvent } from "@/hooks/use-delete-event";
import { useEventCategories } from "@/hooks/use-event-categories";
import { addDays, startOfDay, endOfDay } from "date-fns";
import type { SelectedTimeRange } from "@/components/types";
import CalendarWeek from "@/components/calendar-week";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const api = useRef<CalendarWeekHandle>(null);


  // Use app store for date state
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay,
    setConsecutiveView, setCustomDayCount, setWeekStartDay, nextPeriod, prevPeriod, goToToday,
    settingsModalOpen, setSettingsModalOpen, aiPanelOpen,
    sidebarTab, setSidebarTab, sidebarOpen, toggleSidebar,
    displayMode, setDisplayMode,
    eventDetailsPanelOpen, selectedEventForDetails, openEventDetails, closeEventDetails
  } = useAppStore();

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
  const { data: dbEvents = [] } = useCalendarEvents({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    enabled: !!user
  })

  // Fetch user's event categories
  const { data: userCategories = [] } = useEventCategories(user?.id)

  // Event mutation hooks
  const updateEvent = useUpdateEvent()
  const createEvent = useCreateEvent()
  const deleteEvent = useDeleteEvent()

  // Add computed start/end fields to database events for calendar rendering
  const events = useMemo((): CalEvent[] => {
    return dbEvents.map(dbEvent => ({
      // Core event fields (from events table)
      id: dbEvent.id,
      owner: dbEvent.owner,
      creator: dbEvent.creator,
      series_id: dbEvent.series_id,
      title: dbEvent.title,
      agenda: dbEvent.agenda,
      online_event: dbEvent.online_event,
      online_join_link: dbEvent.online_join_link,
      online_chat_link: dbEvent.online_chat_link,
      in_person: dbEvent.in_person,
      start_time: dbEvent.start_time,
      duration: dbEvent.duration,
      all_day: dbEvent.all_day,
      private: dbEvent.private,
      request_responses: dbEvent.request_responses,
      allow_forwarding: dbEvent.allow_forwarding,
      hide_attendees: dbEvent.hide_attendees,
      history: dbEvent.history || [],
      created_at: dbEvent.created_at,
      updated_at: dbEvent.updated_at,

      // User's relationship to event (from event_user_roles or ownership)
      user_role: dbEvent.user_role,
      invite_type: dbEvent.invite_type,
      rsvp: dbEvent.rsvp,
      rsvp_timestamp: dbEvent.rsvp_timestamp,
      attendance_type: dbEvent.attendance_type,
      following: dbEvent.following || false,

      // User's event options (from user_event_options)
      show_time_as: dbEvent.show_time_as || 'busy',
      user_category_id: dbEvent.user_category_id,
      user_category_name: dbEvent.user_category_name,
      user_category_color: dbEvent.user_category_color,
      time_defense_level: dbEvent.time_defense_level || 'normal',
      ai_managed: dbEvent.ai_managed || false,
      ai_instructions: dbEvent.ai_instructions,

      // Computed fields for calendar rendering
      start: new Date(dbEvent.start_time).getTime(),
      end: new Date(dbEvent.start_time).getTime() + (dbEvent.duration * 60 * 1000),
      aiSuggested: false, // Not yet implemented in DB
    }))
  }, [dbEvents])

  // Find the selected event for details panel
  const selectedEvent = useMemo(() => {
    if (!selectedEventForDetails) return null;
    return events.find(event => event.id === selectedEventForDetails) || null;
  }, [events, selectedEventForDetails])

  // Handle events change from calendar (for updates, moves, etc)
  const handleEventsChange = (updatedEvents: CalEvent[]) => {
    // Find events that have changed compared to the current events
    const currentEventsMap = new Map(events.map(e => [e.id, e]))

    updatedEvents.forEach(updatedEvent => {
      const currentEvent = currentEventsMap.get(updatedEvent.id)
      if (!currentEvent) return

      // Check if the event's time or other properties have changed
      const hasTimeChanged =
        updatedEvent.start !== currentEvent.start ||
        updatedEvent.end !== currentEvent.end

      const hasTitleChanged = updatedEvent.title !== currentEvent.title

      if (hasTimeChanged || hasTitleChanged) {
        // Calculate new start_time and duration from the updated start/end times
        const newStartTime = new Date(updatedEvent.start).toISOString()
        const newDuration = Math.round((updatedEvent.end - updatedEvent.start) / (1000 * 60)) // Convert ms to minutes

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
          ...updates
        })
      }
    })
  }

  // Handle creating events from selected time ranges
  const handleCreateEvents = async (ranges: SelectedTimeRange[]) => {
    try {
      // Create all events and collect their IDs
      const createPromises = ranges.map(range => {
        const startTime = new Date(range.startAbs).toISOString()
        const duration = Math.round((range.endAbs - range.startAbs) / (1000 * 60)) // Convert ms to minutes

        return createEvent.mutateAsync({
          title: "New Event",
          start_time: startTime,
          duration: duration,
          all_day: false,
          show_time_as: 'busy',
          time_defense_level: 'normal',
          ai_managed: false,
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
    } catch (error) {
      console.error('Failed to create events:', error)
    }
  }

  // Handle deleting events
  const handleDeleteEvents = (eventIds: string[]) => {
    console.log('Parent handleDeleteEvents called with eventIds:', eventIds);
    eventIds.forEach(eventId => {
      console.log('Deleting event:', eventId);
      deleteEvent.mutate(eventId)
    })
  }

  // Handle updating events
  const handleUpdateEvents = (eventIds: string[], updates: Partial<CalEvent>) => {
    eventIds.forEach(eventId => {
      // Convert CalEvent updates to database update format
      const dbUpdates: Record<string, unknown> = {}

      if (updates.show_time_as !== undefined) {
        dbUpdates.show_time_as = updates.show_time_as
      }
      if (updates.user_category_id !== undefined) {
        dbUpdates.user_category_id = updates.user_category_id
      }
      if (updates.online_event !== undefined) {
        dbUpdates.online_event = updates.online_event
      }
      if (updates.in_person !== undefined) {
        dbUpdates.in_person = updates.in_person
      }

      updateEvent.mutate({
        id: eventId,
        ...dbUpdates
      })
    })
  }

  const [aiHighlights] = useState<TimeHighlight[]>([]);

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

  // Handle event updates from the details panel
  const handleEventDetailsUpdate = (eventId: string, updates: Partial<CalEvent>) => {
    // Convert CalEvent updates to database update format
    const dbUpdates: Record<string, unknown> = {};

    // Core event fields
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.agenda !== undefined) dbUpdates.agenda = updates.agenda;
    if (updates.online_event !== undefined) dbUpdates.online_event = updates.online_event;
    if (updates.online_join_link !== undefined) dbUpdates.online_join_link = updates.online_join_link;
    if (updates.online_chat_link !== undefined) dbUpdates.online_chat_link = updates.online_chat_link;
    if (updates.in_person !== undefined) dbUpdates.in_person = updates.in_person;
    if (updates.all_day !== undefined) dbUpdates.all_day = updates.all_day;
    if (updates.private !== undefined) dbUpdates.private = updates.private;
    if (updates.request_responses !== undefined) dbUpdates.request_responses = updates.request_responses;
    if (updates.allow_forwarding !== undefined) dbUpdates.allow_forwarding = updates.allow_forwarding;
    if (updates.hide_attendees !== undefined) dbUpdates.hide_attendees = updates.hide_attendees;

    // User event options
    if (updates.show_time_as !== undefined) dbUpdates.show_time_as = updates.show_time_as;
    if (updates.user_category_id !== undefined) dbUpdates.user_category_id = updates.user_category_id;
    if (updates.time_defense_level !== undefined) dbUpdates.time_defense_level = updates.time_defense_level;
    if (updates.ai_managed !== undefined) dbUpdates.ai_managed = updates.ai_managed;
    if (updates.ai_instructions !== undefined) dbUpdates.ai_instructions = updates.ai_instructions;

    updateEvent.mutate({
      id: eventId,
      ...dbUpdates
    });
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
              weekStartDay={weekStartDay}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onGoToToday={handleGoToToday}
              onSetConsecutiveView={setConsecutiveView}
              onSetCustomDayCount={setCustomDayCount}
              onSetWeekStartDay={setWeekStartDay}
              startDate={startDate}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
              displayMode={displayMode}
              onSetDisplayMode={setDisplayMode}
            />

            {/* Calendar Content */}
            <div className="flex-1 min-h-0">
              {displayMode === 'scheduling' ? (
                <SchedulingView
                  calendars={[
                    {
                      id: 'user-calendar',
                      name: 'My Calendar',
                      color: '#3b82f6',
                      visible: true,
                      events: events
                    }
                  ]}
                  onEventSelect={(eventId, isMultiSelect) => {
                    // Simple event selection for scheduling view
                    console.log('Event selected:', eventId, isMultiSelect)
                  }}
                  onEventUpdate={(eventId, updates) => {
                    // Handle event updates
                    handleEventDetailsUpdate(eventId, updates)
                  }}
                  onCreateEvents={handleCreateEvents}
                />
              ) : (
                <CalendarWeek
                ref={api}
                days={viewMode === 'consecutive' ?
                  (consecutiveType === 'day' ? 1 :
                   consecutiveType === 'week' ? 7 :
                   consecutiveType === 'workweek' ? 5 :
                   customDayCount) : selectedDates.length}
                events={events}
                onEventsChange={handleEventsChange}
                onCreateEvents={handleCreateEvents}
                onDeleteEvents={handleDeleteEvents}
                onUpdateEvents={handleUpdateEvents}
                userCategories={userCategories}
                aiHighlights={aiHighlights}
                systemHighlightSlots={systemSlots}
                onSelectChange={() => {}}
                onTimeSelectionChange={() => {}}
                slotMinutes={30}
                dragSnapMinutes={5}
                minDurationMinutes={15}
                weekStartsOn={weekStartDay}
                onEventDoubleClick={openEventDetails}
              />
              )}
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
              onEventUpdate={handleEventDetailsUpdate}
              userCategories={userCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                color: cat.color || 'neutral'
              }))}
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
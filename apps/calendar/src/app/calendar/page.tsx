"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "@/components/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { SettingsModal } from "@/components/settings-modal";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useUpdateEvent } from "@/hooks/use-update-event";
import { useCreateEvent } from "@/hooks/use-create-event";
import { useDeleteEvent } from "@/hooks/use-delete-event";
import { addDays, startOfDay, endOfDay } from "date-fns";
import type { SelectedTimeRange } from "@/components/types";
import CalendarWeek from "@/components/calendar-week";

export default function CalendarPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const api = useRef<CalendarWeekHandle>(null);

  // Use app store for date state
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay,
    setConsecutiveView, setCustomDayCount, setWeekStartDay, nextPeriod, prevPeriod, goToToday,
    settingsModalOpen, setSettingsModalOpen
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
  const handleCreateEvents = (ranges: SelectedTimeRange[]) => {
    ranges.forEach(range => {
      const startTime = new Date(range.startAbs).toISOString()
      const duration = Math.round((range.endAbs - range.startAbs) / (1000 * 60)) // Convert ms to minutes

      createEvent.mutate({
        title: "New Event",
        start_time: startTime,
        duration: duration,
        all_day: false,
        show_time_as: 'busy',
        time_defense_level: 'normal',
        ai_managed: false,
      })
    })
  }

  // Handle deleting events
  const handleDeleteEvents = (eventIds: string[]) => {
    eventIds.forEach(eventId => {
      deleteEvent.mutate(eventId)
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

          {/* Date Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {viewMode === 'non-consecutive' && selectedDates.length > 0
                    ? `${selectedDates.length} Selected Days`
                    : dateRange.startDate.toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoToToday}
              title="Go to today"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {consecutiveType === 'day' ? 'Day' :
                   consecutiveType === 'week' ? 'Week' :
                   consecutiveType === 'workweek' ? 'Work Week' :
                   `${customDayCount} Days`}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* View Type Options */}
                <DropdownMenuItem onClick={() => setConsecutiveView('day', startDate)}>
                  Day
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConsecutiveView('week', startDate)}>
                  Week (7 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConsecutiveView('workweek', startDate)}>
                  Work Week (5 days)
                </DropdownMenuItem>

                {/* Custom Days Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    # of Days ({customDayCount})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(count => (
                      <DropdownMenuItem
                        key={count}
                        onClick={() => {
                          setCustomDayCount(count);
                          setConsecutiveView('custom-days', startDate, count);
                        }}
                      >
                        {count} Day{count > 1 ? 's' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Week Start Day Options */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Week Starts On ({['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekStartDay]})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                      <DropdownMenuItem
                        key={day}
                        onClick={() => setWeekStartDay(index as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                      >
                        {day}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Calendar Content */}
        <div className="flex-1 min-h-0">
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
            aiHighlights={aiHighlights}
            systemHighlightSlots={systemSlots}
            onSelectChange={() => {}}
            onTimeSelectionChange={() => {}}
            slotMinutes={30}
            dragSnapMinutes={5}
            minDurationMinutes={15}
            weekStartsOn={weekStartDay}
          />
        </div>
      </SidebarInset>

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
      />
    </SidebarProvider>
  );
}
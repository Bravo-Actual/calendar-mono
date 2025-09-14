"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "../components/types";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { useAppStore } from "../store/app";

const CalendarWeek = dynamic(() => import("../components/CalendarWeek"), { ssr: false });

export default function Page() {
  const api = useRef<CalendarWeekHandle>(null);

  // Use app store for date state
  const { selectedDate, days, setSelectedDate, setDays } = useAppStore();

  // Local state for popover
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const [events, setEvents] = useState<CalEvent[]>(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).getTime();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0).getTime();

    return [
      {
        id: "demo-1",
        title: "Team Standup",
        start: todayStart + 30 * 60 * 1000, // 9:30 AM
        end: todayStart + 60 * 60 * 1000, // 10:00 AM
      },
      {
        id: "ai-1",
        title: "Deep Work Block",
        start: todayStart + 2 * 60 * 60 * 1000, // 11:00 AM
        end: todayStart + 4 * 60 * 60 * 1000, // 1:00 PM
        aiSuggested: true,
      },
      {
        id: "ai-2",
        title: "Review & Planning",
        start: todayStart + 6 * 60 * 60 * 1000, // 3:00 PM
        end: todayStart + 7 * 60 * 60 * 1000, // 4:00 PM
        aiSuggested: true,
      },
      {
        id: "ai-3",
        title: "Coffee Break",
        start: tomorrowStart + 1.5 * 60 * 60 * 1000, // 10:30 AM tomorrow
        end: tomorrowStart + 2 * 60 * 60 * 1000, // 11:00 AM tomorrow
        aiSuggested: true,
      }
    ];
  });

  const [aiHighlights] = useState<TimeHighlight[]>([]);

  const [systemSlots] = useState<SystemSlot[]>([]);


  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => api.current?.prevWeek()}
            title="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => api.current?.nextWeek()}
            title="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => api.current?.goTo(new Date())}
            title="Go to today"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>

          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="ml-2">
                {selectedDate.toLocaleDateString()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    api.current?.goTo(date);
                    setIsPopoverOpen(false); // Close the popover
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1 ml-4">
            <Button
              variant={days === 5 ? "default" : "outline"}
              onClick={() => setDays(5)}
            >
              5 days
            </Button>
            <Button
              variant={days === 7 ? "default" : "outline"}
              onClick={() => setDays(7)}
            >
              7 days
            </Button>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Calendar - fills remaining space */}
      <div className="flex-1 min-h-0">
        <CalendarWeek
          ref={api}
          days={days}
          events={events}
          onEventsChange={setEvents}
          aiHighlights={aiHighlights}
          systemHighlightSlots={systemSlots}
          onSelectChange={(ids) => console.log("selected events:", ids)}
          onTimeSelectionChange={(ranges) => console.log("selected ranges:", ranges)}
          slotMinutes={30}
          dragSnapMinutes={5}
          minDurationMinutes={15}
          weekStartsOn={0}
        />
      </div>
    </div>
  );
}
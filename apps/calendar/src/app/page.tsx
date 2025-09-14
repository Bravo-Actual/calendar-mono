"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "../components/types";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";

const CalendarWeek = dynamic(() => import("../components/CalendarWeek"), { ssr: false });

export default function Page() {
  const api = useRef<CalendarWeekHandle>(null);

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
          <Button variant="outline" onClick={() => api.current?.prevWeek()}>Prev week</Button>
          <Button variant="outline" onClick={() => api.current?.nextWeek()}>Next week</Button>
          <Button variant="default" onClick={() => api.current?.goTo(new Date())}>Today</Button>
          <Button variant="outline" onClick={() => api.current?.setDays(5)}>5 days</Button>
          <Button variant="outline" onClick={() => api.current?.setDays(7)}>7 days</Button>
        </div>
        <ThemeToggle />
      </div>

      {/* Calendar - fills remaining space */}
      <div className="flex-1 min-h-0">
        <CalendarWeek
          ref={api}
          events={events}
          onEventsChange={setEvents}
          aiHighlights={aiHighlights}
          systemHighlightSlots={systemSlots}
          onSelectChange={(ids) => console.log("selected events:", ids)}
          onTimeSelectionChange={(ranges) => console.log("selected ranges:", ranges)}
          slotMinutes={30}
          dragSnapMinutes={5}
          minDurationMinutes={15}
          weekStartsOn={1}
        />
      </div>
    </div>
  );
}
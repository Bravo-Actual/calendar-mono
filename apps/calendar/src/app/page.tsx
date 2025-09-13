"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "../components/types";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";

const CalendarWeek = dynamic(() => import("../components/CalendarWeek"), { ssr: false });

export default function Page() {
  const api = useRef<CalendarWeekHandle>(null);
  const [events, setEvents] = useState<CalEvent[]>([{
    id: "demo-1",
    title: "Team Standup",
    start: Date.now() + 60 * 60 * 1000,
    end: Date.now() + 2 * 60 * 60 * 1000,
  }]);

  const [aiHighlights] = useState<TimeHighlight[]>([
    { id: "ai-1", dayIdx: 0, start: (9 * 60 + 30) * 60 * 1000, end: (10 * 60 + 15) * 60 * 1000, intent: "Focus block?" },
  ]);

  const [systemSlots] = useState<SystemSlot[]>([]);

  return (
    <div className="p-4 space-y-3 bg-background text-foreground min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => api.current?.prevWeek()}>Prev week</Button>
          <Button variant="outline" onClick={() => api.current?.nextWeek()}>Next week</Button>
          <Button variant="default" onClick={() => api.current?.goTo(new Date())}>Today</Button>
          <Button variant="outline" onClick={() => api.current?.setDays(5)}>5 days</Button>
          <Button variant="outline" onClick={() => api.current?.setDays(7)}>7 days</Button>
        </div>
        <ThemeToggle />
      </div>

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

      <div className="text-xs text-gray-500">
        Tips: Drag on empty grid to select time. Hold <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd> to clone the same time range across days. Hold <kbd>Ctrl/Cmd</kbd> and click events for multi-select. Drag events to move; use top/bottom edges to resize. Press <kbd>Esc</kbd> to clear selection(s); <kbd>Delete</kbd> to remove selected events.
      </div>
    </div>
  );
}
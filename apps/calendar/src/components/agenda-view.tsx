"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, PersonStanding } from "lucide-react";
import type { CalEvent } from "./types";
import { formatTimeRangeLabel } from "./utils";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/app";

const getCategoryColors = (colorString?: string) => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case "neutral": return { bg: "bg-neutral-950", text: "text-neutral-300" };
    case "slate": return { bg: "bg-slate-950", text: "text-slate-300" };
    case "orange": return { bg: "bg-orange-950", text: "text-orange-300" };
    case "yellow": return { bg: "bg-yellow-950", text: "text-yellow-300" };
    case "green": return { bg: "bg-green-950", text: "text-green-300" };
    case "blue": return { bg: "bg-blue-950", text: "text-blue-300" };
    case "indigo": return { bg: "bg-indigo-950", text: "text-indigo-300" };
    case "violet": return { bg: "bg-violet-950", text: "text-violet-300" };
    case "fuchsia": return { bg: "bg-fuchsia-950", text: "text-fuchsia-300" };
    case "rose": return { bg: "bg-rose-950", text: "text-rose-300" };
    default: return { bg: "bg-card", text: "text-card-foreground" };
  }
};

const getMeetingTypeIcons = (event: CalEvent) => {
  const icons = [];

  if (event.online_event) {
    icons.push(<Video key="video" className="w-3 h-3" />);
  }

  if (event.in_person) {
    icons.push(<PersonStanding key="person" className="w-3 h-3" />);
  }

  return icons;
};

export interface AgendaViewProps {
  events: CalEvent[];
  tz: string;
  colStarts: number[]; // Day start timestamps for each column
  onEventSelect?: (id: string, multi: boolean) => void;
  selectedEventIds?: Set<string>;
  expandedDay: number | null;
  displayDays: number;
}

export function AgendaView({
  events,
  tz,
  colStarts,
  onEventSelect,
  selectedEventIds = new Set(),
  expandedDay,
  displayDays,
}: AgendaViewProps) {
  const { viewMode, selectedDates } = useAppStore();

  // Track previous selectedDates to detect newly added days in non-consecutive mode
  const prevSelectedDatesRef = useRef<Date[]>([]);

  // Constants
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Calculate which days are new by comparing current vs previous selectedDates
  const newlyAddedDays = useMemo(() => {
    if (viewMode !== 'non-consecutive') return new Set<number>();

    const prevDayKeys = new Set(prevSelectedDatesRef.current.map(date => Math.floor(date.getTime() / DAY_MS)));
    const currentDayKeys = new Set(selectedDates.map(date => Math.floor(date.getTime() / DAY_MS)));

    // Find days that are in current but NOT in previous (truly new days)
    const newDays = new Set<number>();
    currentDayKeys.forEach(dayKey => {
      if (!prevDayKeys.has(dayKey)) {
        newDays.add(dayKey);
      }
    });

    return newDays;
  }, [viewMode, selectedDates, DAY_MS]);

  // Update ref after render
  useEffect(() => {
    prevSelectedDatesRef.current = [...selectedDates];
  }, [selectedDates]);

  const handleEventClick = (event: CalEvent, ctrlKey: boolean) => {
    onEventSelect?.(event.id, ctrlKey);
  };

  return (
    <div className="flex pr-2.5 h-full items-stretch">
        {colStarts.map((dayStartMs, dayIdx) => {
          const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000; // Add 24 hours

          // Calculate if this day should animate entry
          const dayKey = Math.floor(dayStartMs / DAY_MS);
          const shouldAnimateEntry = viewMode === 'consecutive' || newlyAddedDays.has(dayKey);

          // Filter events for this day and sort by start time
          const dayEvents = events
            .filter(event => event.start >= dayStartMs && event.start < dayEndMs)
            .sort((a, b) => a.start - b.start);

          return (
            <motion.div
              key={`${Math.floor(dayStartMs / (24 * 60 * 60 * 1000))}`}
              className="relative border-r border-border last:border-r-0 overflow-hidden h-full"
              initial={!shouldAnimateEntry ? false : { scale: 0.95, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                flex: expandedDay === null
                  ? 1
                  : expandedDay === dayIdx
                    ? displayDays
                    : 0
              }}
              exit={{
                scale: 0.97,
                opacity: 0,
                transition: {
                  duration: 0.2
                }
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
                delay: !shouldAnimateEntry ? 0 : dayIdx * 0.05 // Stagger day animations
              }}
            >
              <ScrollArea className="w-full h-full">
                <div className="p-3 space-y-2">
                    <AnimatePresence>
                      {dayEvents.map((event, eventIndex) => {
                        const categoryColors = getCategoryColors(event.user_category_color);
                        const timeLabel = formatTimeRangeLabel(event.start, event.end, tz);
                        const isSelected = selectedEventIds.has(event.id);
                        const isPastEvent = event.end < Date.now();
                        const meetingTypeIcons = getMeetingTypeIcons(event);

                        return (
                          <motion.div
                            key={event.id}
                            initial={!shouldAnimateEntry ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              y: -10,
                              transition: {
                                duration: 0.2
                              }
                            }}
                            transition={{
                              delay: !shouldAnimateEntry ? 0 : eventIndex * 0.03,
                              duration: 0.2,
                              ease: "easeOut"
                            }}
                            className={cn(
                              "p-2 rounded-md border cursor-pointer transition-all duration-150",
                              "hover:shadow-sm hover:border-ring/50",
                              categoryColors.bg,
                              categoryColors.text,
                              isPastEvent && "opacity-50",
                              isSelected && "ring-2 ring-ring border-ring",
                              event.aiSuggested && "bg-gradient-to-r from-violet-950 to-blue-950"
                            )}
                            onClick={(e) => handleEventClick(event, e.ctrlKey || e.metaKey)}
                          >
                            {/* Event Details */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <h4 className="text-sm font-medium truncate">{event.title}</h4>
                                {meetingTypeIcons.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {meetingTypeIcons}
                                  </div>
                                )}
                              </div>

                              {/* Time */}
                              <div className="text-xs font-medium text-muted-foreground">
                                {timeLabel}
                              </div>
                              {event.agenda && (
                                <p className="text-xs opacity-70 line-clamp-2">
                                  {event.agenda}
                                </p>
                              )}
                            </div>

                            {/* Status Indicator */}
                            <div className="flex justify-end mt-1">
                              {event.show_time_as === 'tentative' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Tentative" />
                              )}
                              {event.show_time_as === 'free' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Free" />
                              )}
                              {event.show_time_as === 'busy' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Busy" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {dayEvents.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No events
                      </div>
                    )}
                </div>
              </ScrollArea>
            </motion.div>
          );
        })}
    </div>
  );
}
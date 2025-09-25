"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, PersonStanding } from "lucide-react";
import type { CalendarEvent } from "./types";
import { formatTimeRangeLabel } from "../utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";

const getCategoryColors = (colorString?: string) => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case "neutral": return { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-900 dark:text-neutral-100", border: "border-neutral-300 dark:border-neutral-600" };
    case "slate": return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", border: "border-slate-300 dark:border-slate-600" };
    case "orange": return { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-900 dark:text-orange-100", border: "border-orange-300 dark:border-orange-600" };
    case "yellow": return { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-900 dark:text-yellow-100", border: "border-yellow-300 dark:border-yellow-600" };
    case "green": return { bg: "bg-green-100 dark:bg-green-900", text: "text-green-900 dark:text-green-100", border: "border-green-300 dark:border-green-600" };
    case "blue": return { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-900 dark:text-blue-100", border: "border-blue-300 dark:border-blue-600" };
    case "indigo": return { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-900 dark:text-indigo-100", border: "border-indigo-300 dark:border-indigo-600" };
    case "violet": return { bg: "bg-violet-100 dark:bg-violet-900", text: "text-violet-900 dark:text-violet-100", border: "border-violet-300 dark:border-violet-600" };
    case "fuchsia": return { bg: "bg-fuchsia-100 dark:bg-fuchsia-900", text: "text-fuchsia-900 dark:text-fuchsia-100", border: "border-fuchsia-300 dark:border-fuchsia-600" };
    case "rose": return { bg: "bg-rose-100 dark:bg-rose-900", text: "text-rose-900 dark:text-rose-100", border: "border-rose-300 dark:border-rose-600" };
    default: return { bg: "bg-card dark:bg-neutral-800", text: "text-card-foreground", border: "border-border" };
  }
};

const getMeetingTypeIcons = (event: CalendarEvent) => {
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
  events: CalendarEvent[];
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

  const handleEventClick = (event: CalendarEvent, ctrlKey: boolean) => {
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
            .filter(event => {
              return event.start_time_ms >= dayStartMs && event.start_time_ms < dayEndMs;
            })
            .sort((a, b) => a.start_time_ms - b.start_time_ms);

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
                        const categoryColors = getCategoryColors(event.category?.color);
                        const timeLabel = formatTimeRangeLabel(event.start_time_ms, event.end_time_ms, tz);
                        const isSelected = selectedEventIds.has(event.id);
                        const isPastEvent = event.end_time_ms < Date.now();
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
                              "p-2 rounded-md cursor-pointer transition-all duration-150",
                              "hover:shadow-md border-2",
                              categoryColors.border,
                              categoryColors.bg,
                              categoryColors.text,
                              isPastEvent && "opacity-50",
                              isSelected && "ring-2 ring-ring border-ring shadow-lg",
                              // Removed ai_suggested styling
                            )}
                            // Removed ai_suggested styling
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
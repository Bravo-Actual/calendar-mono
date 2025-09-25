"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Video, PersonStanding } from "lucide-react";
import type { CalendarEvent, EventId, DragKind, EventCategory, ShowTimeAs } from "./types";
import { MIN_SLOT_PX, formatTimeRangeLabel } from "../utils";
import type { PositionedEvent } from "../utils";
import { cn } from "@/lib/utils";
import { EventContextMenu } from "./event-context-menu";
import {
  useUpdateEvent,
  useDeleteEvent,
  useUpdateEventCalendar,
  useUpdateEventCategory,
  useUpdateEventShowTimeAs,
  useUpdateEventTimeDefense,
  useUpdateEventAI,
  useUserCalendars,
  useUserCategories,
} from '@/lib/data/queries';

const getCategoryColors = (colorString?: string) => {
  // Map database color string to EventCategory enum values (force lowercase)
  const category = colorString?.toLowerCase() as EventCategory;

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

const getShowTimeAsIcon = (showTimeAs?: ShowTimeAs) => {
  switch (showTimeAs) {
    case "tentative": return "?";
    case "free": return "○";
    case "busy": return "✓";
    default: return "✓"; // busy is default
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

export interface EventCardProps {
  event: CalendarEvent;
  position: PositionedEvent;
  selected: boolean;
  highlighted: boolean;
  isAiHighlighted?: boolean; // AI highlight (yellow) - separate from user selection
  isDragging: boolean;
  tz: string;
  timeFormat?: '12_hour' | '24_hour';
  onSelect: (id: EventId, multi: boolean) => void;
  onPointerDownMove: (e: React.PointerEvent, id: EventId, kind: DragKind) => void;
  onPointerMoveColumn: (e: React.PointerEvent) => void;
  onPointerUpColumn: () => void;
  onDoubleClick?: (eventId: EventId) => void;
}


export function EventCard({
  event,
  position,
  selected,
  highlighted,
  isAiHighlighted = false,
  isDragging,
  tz,
  timeFormat = '12_hour',
  onSelect,
  onPointerDownMove,
  onPointerMoveColumn,
  onPointerUpColumn,
  onDoubleClick,
}: EventCardProps): React.ReactElement {
  const handleClick = (ev: React.MouseEvent): void => {
    ev.preventDefault();
    ev.stopPropagation();
    onSelect(event.id, ev.ctrlKey || ev.metaKey);
  };

  const handleDoubleClick = (ev: React.MouseEvent): void => {
    ev.stopPropagation();
    onDoubleClick?.(event.id);
  };


  const isPastEvent = event.end_time_ms < Date.now();
  const categoryColors = getCategoryColors(event.category?.color);
  const showTimeAsIcon = getShowTimeAsIcon(event.show_time_as as ShowTimeAs);

  const meetingTypeIcons = getMeetingTypeIcons(event);

  const handlePointerDownResize = (ev: React.PointerEvent, kind: "resize-start" | "resize-end"): void => {
    // Only handle left mouse button (button 0) for drag operations
    if (ev.button !== 0) return;
    onPointerDownMove(ev, event.id, kind);
  };

  const handlePointerDownMove = (ev: React.PointerEvent): void => {
    // Only handle left mouse button (button 0) for drag operations
    if (ev.button !== 0) return;
    onPointerDownMove(ev, event.id, "move");
  };

  const timeLabel = formatTimeRangeLabel(event.start_time_ms, event.end_time_ms, tz, timeFormat);

  return (
    <motion.div
            role="option"
            aria-selected={selected}
            className={cn(
              "absolute overflow-hidden cursor-pointer transition-all duration-150 rounded-sm",
              "shadow-sm hover:shadow-md p-0 m-0",
              "border-2",
              categoryColors.border,
              categoryColors.bg,
              isPastEvent && "opacity-50",
              // User selection (existing blue highlight)
              selected && "ring-2 ring-ring border-ring shadow-lg",
              // Legacy highlighted prop (keeping for backward compatibility)
              highlighted && "ring-2 ring-yellow-400 shadow-lg",
              // AI highlight (yellow) - separate from user selection
              isAiHighlighted && !selected && "ring-2 shadow-lg",
              // Dual highlight state (both user selected AND AI highlighted)
              selected && isAiHighlighted && "ring-4 shadow-xl",
              isDragging && "opacity-35 shadow-xl"
            )}
            style={{
              top: position.rect.top,
              height: Math.max(MIN_SLOT_PX, position.rect.height),
              left: `calc(${position.rect.leftPct}% + 4px)`,
              width: `calc(${position.rect.widthPct}% - 4px)`,
              padding: "0 !important",
              margin: "0 !important",
              // AI highlight ring color
              ...(isAiHighlighted && !selected && {
                "--tw-ring-color": "oklch(0.858 0.158 93.329)", // yellow-400
              }),
              // Dual highlight: gradient ring or special treatment
              ...(selected && isAiHighlighted && {
                "--tw-ring-color": "oklch(0.858 0.158 93.329)", // yellow-400 takes precedence
              }),
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            key={`${event.id}-${position.rect.top}-${position.rect.leftPct}`}
            initial={false}
            animate={{
              scale: isDragging ? 1 : [1, 1.02, 1],
            }}
            transition={{
              scale: {
                duration: isDragging ? 0 : 0.3,
                ease: "easeOut"
              }
            }}
          >
            {false ? (
              /* AI suggestion with inner card for gradient border */
              <div className="h-full w-full bg-card rounded-sm relative overflow-hidden">
                {/* Resize handles - thinner and overlapping content */}
                <div
                  className="absolute inset-x-0 top-0 h-1 cursor-n-resize hover:bg-blue-100 hover:bg-opacity-50 transition-colors z-10"
                  onPointerDown={(ev) => handlePointerDownResize(ev, "resize-start")}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                  title="Resize start"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-1 cursor-s-resize hover:bg-blue-100 hover:bg-opacity-50 transition-colors z-10"
                  onPointerDown={(ev) => handlePointerDownResize(ev, "resize-end")}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                  title="Resize end"
                />

                {/* Move handle / content */}
                <div
                  className={`h-full w-full ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'} transition-colors duration-150 px-1.5 pt-1.5 pb-1 flex flex-col justify-start items-start overflow-hidden gap-0.5`}
                  onPointerDown={handlePointerDownMove}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                >
                  <div className="flex items-start justify-between w-full h-full">
                    <div className="flex-1 min-w-0">
                      {position.rect.height > 16 ? (
                        <>
                          <div className="font-medium truncate text-sm leading-none w-full text-left text-card-foreground">
                            {event.title}
                          </div>
                          {position.rect.height > 28 && (
                            <div className="opacity-60 text-xs truncate leading-none w-full text-left text-card-foreground">
                              {timeLabel}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="font-medium truncate text-xs leading-none w-full text-left text-card-foreground">
                          {event.title}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs opacity-70 ml-1 text-card-foreground flex items-center gap-1">
                      {meetingTypeIcons}
                      <span>{showTimeAsIcon}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Resize handles - thinner and overlapping content */}
                <div
                  className="absolute inset-x-0 top-0 h-1 cursor-n-resize hover:bg-white hover:bg-opacity-20 transition-colors z-10"
                  onPointerDown={(ev) => handlePointerDownResize(ev, "resize-start")}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                  title="Resize start"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-1 cursor-s-resize hover:bg-white hover:bg-opacity-20 transition-colors z-10"
                  onPointerDown={(ev) => handlePointerDownResize(ev, "resize-end")}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                  title="Resize end"
                />

                {/* Move handle / content */}
                <div
                  className={`h-full w-full ${isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'} transition-colors duration-150 px-1.5 pt-1.5 pb-1 flex flex-col justify-start items-start overflow-hidden gap-0.5`}
                  onPointerDown={handlePointerDownMove}
                  onPointerMove={onPointerMoveColumn}
                  onPointerUp={onPointerUpColumn}
                >
                  <div className="flex items-start justify-between w-full h-full">
                    <div className="flex-1 min-w-0">
                      {position.rect.height > 16 ? (
                        <>
                          <div className={cn("font-medium truncate text-sm leading-none w-full text-left", categoryColors.text)}>
                            {event.title}
                          </div>
                          {position.rect.height > 28 && (
                            <div className={cn("opacity-60 text-xs truncate leading-none w-full text-left", categoryColors.text)}>
                              {timeLabel}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={cn("font-medium truncate text-xs leading-none w-full text-left", categoryColors.text)}>
                          {event.title}
                        </div>
                      )}
                    </div>
                    <div className={cn("flex-shrink-0 text-xs opacity-70 ml-1 flex items-center gap-1", categoryColors.text)}>
                      {meetingTypeIcons}
                      <span>{showTimeAsIcon}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
    </motion.div>
  );
}
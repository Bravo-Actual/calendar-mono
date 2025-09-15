"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card } from "./ui/card";
import { Video, PersonStanding } from "lucide-react";
import type { CalEvent, EventId, DragKind, EventCategory, ShowTimeAs } from "./types";
import { MIN_SLOT_PX, formatTimeRangeLabel } from "./utils";
import type { PositionedEvent } from "./utils";
import { cn } from "../lib/utils";

const getCategoryColors = (colorString?: string) => {
  // Map database color string to EventCategory enum values (force lowercase)
  const category = colorString?.toLowerCase() as EventCategory;

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

const getShowTimeAsIcon = (showTimeAs?: ShowTimeAs) => {
  switch (showTimeAs) {
    case "tentative": return "?";
    case "free": return "○";
    case "busy": return "✓";
    default: return "✓"; // busy is default
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

export interface EventCardProps {
  event: CalEvent;
  position: PositionedEvent;
  selected: boolean;
  highlighted: boolean;
  isDragging: boolean;
  tz: string;
  onSelect: (id: EventId, multi: boolean) => void;
  onPointerDownMove: (e: React.PointerEvent, id: EventId, kind: DragKind) => void;
  onPointerMoveColumn: (e: React.PointerEvent) => void;
  onPointerUpColumn: () => void;
}


export function EventCard({
  event,
  position,
  selected,
  highlighted,
  isDragging,
  tz,
  onSelect,
  onPointerDownMove,
  onPointerMoveColumn,
  onPointerUpColumn,
}: EventCardProps): React.ReactElement {
  const handleClick = (ev: React.MouseEvent): void => {
    onSelect(event.id, ev.ctrlKey || ev.metaKey);
  };

  const isPastEvent = event.end < Date.now();
  const categoryColors = getCategoryColors(event.user_category_color);
  const showTimeAsIcon = getShowTimeAsIcon(event.show_time_as);
  const meetingTypeIcons = getMeetingTypeIcons(event);

  const handlePointerDownResize = (ev: React.PointerEvent, kind: "resize-start" | "resize-end"): void => {
    onPointerDownMove(ev, event.id, kind);
  };

  const handlePointerDownMove = (ev: React.PointerEvent): void => {
    onPointerDownMove(ev, event.id, "move");
  };

  const timeLabel = formatTimeRangeLabel(event.start, event.end, tz);

  return (
    <motion.div
            role="group"
            aria-selected={selected}
            className={cn(
              "absolute overflow-hidden cursor-pointer transition-all duration-150 rounded-sm",
              "hover:shadow-md p-0 m-0 bg-card",
              event.aiSuggested ? "" : "border border-border",
              categoryColors.bg,
              isPastEvent && "opacity-50",
              selected && "ring-2 ring-ring border-ring",
              highlighted && "ring-2 ring-yellow-400",
              isDragging && "opacity-35"
            )}
            style={{
              top: position.rect.top,
              height: Math.max(MIN_SLOT_PX, position.rect.height),
              left: `calc(${position.rect.leftPct}% + 4px)`,
              width: `calc(${position.rect.widthPct}% - 4px)`,
              padding: event.aiSuggested ? "1px" : "0 !important",
              margin: "0 !important",
              ...(event.aiSuggested && {
                background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              }),
            }}
            onClick={handleClick}
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
            {event.aiSuggested ? (
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
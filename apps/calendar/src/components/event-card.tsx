"use client";

import React from "react";
import { Card } from "./ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import type { CalEvent, EventId, DragKind, EventCategory, ShowTimeAs } from "./types";
import { MIN_SLOT_PX, formatTimeRangeLabel } from "./utils";
import type { PositionedEvent } from "./utils";
import { cn } from "../lib/utils";

const getCategoryColors = (category?: EventCategory) => {
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
  const categoryColors = getCategoryColors(event.category);
  const showTimeAsIcon = getShowTimeAsIcon(event.showTimeAs);

  const handlePointerDownResize = (ev: React.PointerEvent, kind: "resize-start" | "resize-end"): void => {
    onPointerDownMove(ev, event.id, kind);
  };

  const handlePointerDownMove = (ev: React.PointerEvent): void => {
    onPointerDownMove(ev, event.id, "move");
  };

  const timeLabel = formatTimeRangeLabel(event.start, event.end, tz);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            role="group"
            aria-selected={selected}
            className={cn(
              "absolute overflow-hidden cursor-pointer transition-all duration-150 rounded-sm",
              "hover:shadow-md p-0 m-0",
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
                  className="h-full w-full cursor-grab active:cursor-grabbing px-1.5 pt-1.5 pb-1 flex flex-col justify-start items-start overflow-hidden gap-0.5"
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
                    <div className="flex-shrink-0 text-xs opacity-70 ml-1 text-card-foreground">
                      {showTimeAsIcon}
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
                  className="h-full w-full cursor-grab active:cursor-grabbing px-1.5 pt-1.5 pb-1 flex flex-col justify-start items-start overflow-hidden gap-0.5"
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
                    <div className={cn("flex-shrink-0 text-xs opacity-70 ml-1", categoryColors.text)}>
                      {showTimeAsIcon}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-medium">{event.title}</div>
            <div className="text-muted-foreground">{timeLabel}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
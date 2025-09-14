"use client";

import React from "react";
import { Card } from "./ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import type { CalEvent, EventId, DragKind } from "./types";
import { DEFAULT_COLORS, MIN_SLOT_PX, toZDT } from "./utils";
import type { PositionedEvent } from "./utils";
import { cn } from "../lib/utils";

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

function formatTimeRangeLabel(startMs: number, endMs: number, tz: string): string {
  const s = toZDT(startMs, tz);
  const e = toZDT(endMs, tz);
  const f = (z: ReturnType<typeof toZDT>) => `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
  return `${f(s)} – ${f(e)}`;
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
              selected && "ring-2 ring-blue-400 border-blue-600",
              highlighted && "ring-2 ring-yellow-400",
              isDragging && "opacity-35"
            )}
            style={{
              top: position.rect.top,
              height: Math.max(MIN_SLOT_PX, position.rect.height),
              left: `${position.rect.leftPct}%`,
              width: `calc(${position.rect.widthPct}% - 2px)`,
              background: DEFAULT_COLORS.eventBg,
              borderColor: DEFAULT_COLORS.eventBorder,
              padding: "0 !important",
              margin: "0 !important",
            }}
            onClick={handleClick}
          >
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
              className="h-full w-full cursor-grab active:cursor-grabbing px-1 pt-1 pb-1 flex flex-col justify-start items-start overflow-hidden"
              onPointerDown={handlePointerDownMove}
              onPointerMove={onPointerMoveColumn}
              onPointerUp={onPointerUpColumn}
            >
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
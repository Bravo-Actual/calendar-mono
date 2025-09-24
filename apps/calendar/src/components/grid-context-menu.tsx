"use client";

import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "./ui/context-menu";
import { Plus, Trash2, Clock } from "lucide-react";
import type { SelectedTimeRange } from "./types";

export interface GridContextMenuProps {
  children: React.ReactNode;
  selectedTimeRanges: SelectedTimeRange[];
  hasActiveSelection?: boolean;
  onCreateEvent?: (ranges: SelectedTimeRange[]) => void;
  onClearSelection?: () => void;
}

export function GridContextMenu({
  children,
  selectedTimeRanges,
  hasActiveSelection,
  onCreateEvent,
  onClearSelection,
}: GridContextMenuProps) {
  const rangeCount = selectedTimeRanges.length;
  const rangeText = rangeCount === 1 ? "time slot" : "time slots";
  const eventText = rangeCount === 1 ? "event" : "events";

  const totalMinutes = selectedTimeRanges.reduce((sum, range) => {
    return sum + (range.endAbs - range.startAbs) / (1000 * 60);
  }, 0);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {rangeCount > 0 ? (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              {rangeCount} {rangeText} selected ({formatDuration(totalMinutes)})
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onCreateEvent?.(selectedTimeRanges);
              }}
            >
              <Plus />
              Create {eventText}
            </ContextMenuItem>

            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

            <ContextMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onClearSelection?.();
              }}
            >
              <Trash2 />
              Clear selection
            </ContextMenuItem>
          </>
        ) : hasActiveSelection ? (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              Time Selection
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

            <ContextMenuItem disabled onClick={(e) => e.stopPropagation()}>
              <Clock />
              No time slots selected
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              Calendar Grid
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

            <ContextMenuItem disabled onClick={(e) => e.stopPropagation()}>
              <Clock />
              Click and drag to select time
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
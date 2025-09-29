"use client";

import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import { Plus, Trash2, Clock } from "lucide-react";

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface TimeSelectionContextMenuProps {
  children: React.ReactNode;
  selectedTimeRanges: Array<{ type: 'timeRange'; start: Date; end: Date }>;
  onCreateEvents?: () => void;  // Same signature as action bar
  onClearSelection?: () => void;
}

export function TimeSelectionContextMenu({
  children,
  selectedTimeRanges,
  onCreateEvents,
  onClearSelection,
}: TimeSelectionContextMenuProps) {
  const rangeCount = selectedTimeRanges.length;
  const rangeText = rangeCount === 1 ? "time slot" : "time slots";
  const eventText = rangeCount === 1 ? "event" : "events";
  const hasActiveSelection = rangeCount > 0;

  const totalMinutes = selectedTimeRanges.reduce((sum, range) => {
    return sum + (range.end.getTime() - range.start.getTime()) / (1000 * 60);
  }, 0);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
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
        {hasActiveSelection ? (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              {rangeCount} {rangeText} selected ({formatDuration(totalMinutes)})
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onCreateEvents?.(); // Same signature as action bar - no parameters
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
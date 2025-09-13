"use client";

import React from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import type { SelectedTimeRange } from "./types";

export interface ActionBarProps {
  // Time selection actions
  timeRanges: SelectedTimeRange[];
  onCreateEvents: () => void;
  onClearSelection: () => void;

  // Event selection actions
  selectedEventCount: number;
  onDeleteSelected: () => void;

  // Optional positioning
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom-center" | "top-center";
  className?: string;
}

export function ActionBar({
  timeRanges,
  onCreateEvents,
  onClearSelection,
  selectedEventCount,
  onDeleteSelected,
  position = "bottom-center",
  className = "",
}: ActionBarProps) {
  const hasRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedEventCount > 0;

  // Don't render if no actions are available
  if (!hasRanges && !hasSelectedEvents) {
    return null;
  }

  const positionClasses = {
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "top-right": "top-3 right-3",
    "top-left": "top-3 left-3",
    "bottom-center": "bottom-3 left-1/2 transform -translate-x-1/2",
    "top-center": "top-3 left-1/2 transform -translate-x-1/2",
  };

  return (
    <div className={`pointer-events-none absolute ${positionClasses[position]} z-10 ${className}`}>
      <div className="pointer-events-auto bg-background/90 backdrop-blur rounded-xl shadow-lg border flex items-center gap-2 p-2">
        {/* Time selection actions */}
        {hasRanges && (
          <>
            <Button
              onClick={onCreateEvents}
              size="sm"
              title={`Create ${timeRanges.length} event${timeRanges.length > 1 ? "s" : ""}`}
            >
              Create {timeRanges.length} event{timeRanges.length === 1 ? "" : "s"}
            </Button>
            <Button
              variant="outline"
              onClick={onClearSelection}
              size="sm"
            >
              Clear selection
            </Button>
          </>
        )}

        {/* Separator between action groups */}
        {hasRanges && hasSelectedEvents && (
          <Separator orientation="vertical" className="h-5" />
        )}

        {/* Event selection actions */}
        {hasSelectedEvents && (
          <Button
            variant="destructive"
            onClick={onDeleteSelected}
            size="sm"
            title={`Delete ${selectedEventCount} selected event${selectedEventCount > 1 ? "s" : ""}`}
          >
            Delete {selectedEventCount} selected
          </Button>
        )}
      </div>
    </div>
  );
}
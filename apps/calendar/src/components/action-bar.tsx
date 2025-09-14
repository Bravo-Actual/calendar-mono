"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Video, PersonStanding, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "./ui/dropdown-menu";
import type { SelectedTimeRange, ShowTimeAs, EventCategory } from "./types";

export interface ActionBarProps {
  // Time selection actions
  timeRanges: SelectedTimeRange[];
  onCreateEvents: () => void;
  onClearSelection: () => void;

  // Event selection actions
  selectedEventCount: number;
  onDeleteSelected: () => void;
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (category: EventCategory) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  // Current state of selected events (for checkbox states)
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;

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
  onUpdateShowTimeAs,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  position = "bottom-center",
  className = "",
}: ActionBarProps) {
  const hasRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedEventCount > 0;

  const positionClasses = {
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "top-right": "top-3 right-3",
    "top-left": "top-3 left-3",
    "bottom-center": "bottom-3 left-1/2 transform -translate-x-1/2",
    "top-center": "top-3 left-1/2 transform -translate-x-1/2",
  };

  return (
    <AnimatePresence>
      {(hasRanges || hasSelectedEvents) && (
        <motion.div
          className={`pointer-events-none absolute ${positionClasses[position]} z-10 ${className}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            mass: 0.8
          }}
        >
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
          </>
        )}

        {/* Separator between action groups */}
        {hasRanges && hasSelectedEvents && (
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
        )}

        {/* Event selection actions */}
        {hasSelectedEvents && (
          <>
            {/* Show Time As dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Show Time As
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onUpdateShowTimeAs("busy")}>
                  Busy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateShowTimeAs("tentative")}>
                  Tentative
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateShowTimeAs("free")}>
                  Free
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Category dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onUpdateCategory("neutral")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-neutral-500 rounded"></div>
                    Neutral
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("slate")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-500 rounded"></div>
                    Slate
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("orange")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    Orange
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("yellow")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    Yellow
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("green")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    Green
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("blue")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    Blue
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("indigo")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded"></div>
                    Indigo
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("violet")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-violet-500 rounded"></div>
                    Violet
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("fuchsia")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-fuchsia-500 rounded"></div>
                    Fuchsia
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateCategory("rose")}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-rose-500 rounded"></div>
                    Rose
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Meeting Type dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Meeting Type
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem
                  checked={selectedIsOnlineMeeting || false}
                  onCheckedChange={onUpdateIsOnlineMeeting}
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Online Meeting
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedIsInPerson || false}
                  onCheckedChange={onUpdateIsInPerson}
                >
                  <div className="flex items-center gap-2">
                    <PersonStanding className="w-4 h-4" />
                    In Person
                  </div>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              onClick={onDeleteSelected}
              size="icon"
              title={`Delete ${selectedEventCount} selected event${selectedEventCount > 1 ? "s" : ""}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />

            <Button
              variant="ghost"
              onClick={onClearSelection}
              size="icon"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Clear selection for time ranges */}
        {hasRanges && !hasSelectedEvents && (
          <>
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
            <Button
              variant="ghost"
              onClick={onClearSelection}
              size="icon"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
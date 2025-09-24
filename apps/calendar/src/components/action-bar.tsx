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
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import type { SelectedTimeRange, ShowTimeAs } from "./types";
import type { UserEventCategory } from "@/hooks/use-event-categories";
import type { UserEventCalendar } from "@/hooks/use-user-calendars";

export interface ActionBarProps {
  // Time selection actions
  timeRanges: SelectedTimeRange[];
  onCreateEvents: () => void;
  onClearSelection: () => void;

  // Event selection actions
  selectedEventCount: number;
  onDeleteSelected: () => void;
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCalendar: (calendarId: string) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  // Current state of selected events (for checkbox states)
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;

  // User calendars and categories for the dropdown
  userCalendars?: UserEventCalendar[];
  userCategories?: UserEventCategory[];

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
  onUpdateCalendar,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  userCalendars = [],
  userCategories = [],
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
          className={`pointer-events-none absolute ${positionClasses[position]} z-30 ${className}`}
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

            {/* Calendar & Category dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Calendar & Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {/* Calendars section */}
                {userCalendars.length > 0 && (
                  <>
                    {userCalendars.map((calendar) => (
                      <DropdownMenuItem
                        key={calendar.id}
                        onClick={() => onUpdateCalendar(calendar.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-sm bg-${calendar.color}-500`}></div>
                          {calendar.name}
                          {calendar.type === 'default' && (
                            <span className="text-xs text-muted-foreground">(Default)</span>
                          )}
                          {calendar.type === 'archive' && (
                            <span className="text-xs text-muted-foreground">(Archive)</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                    {userCategories.length > 0 && <DropdownMenuSeparator />}
                  </>
                )}

                {/* Categories section */}
                {userCategories.length > 0 ? (
                  userCategories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => onUpdateCategory(category.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${
                          category.color === 'neutral' ? 'bg-neutral-500' :
                          category.color === 'slate' ? 'bg-slate-500' :
                          category.color === 'orange' ? 'bg-orange-500' :
                          category.color === 'yellow' ? 'bg-yellow-500' :
                          category.color === 'green' ? 'bg-green-500' :
                          category.color === 'blue' ? 'bg-blue-500' :
                          category.color === 'indigo' ? 'bg-indigo-500' :
                          category.color === 'violet' ? 'bg-violet-500' :
                          category.color === 'fuchsia' ? 'bg-fuchsia-500' :
                          category.color === 'rose' ? 'bg-rose-500' :
                          'bg-neutral-500'
                        }`}></div>
                        {category.name}
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  userCalendars.length === 0 && (
                    <DropdownMenuItem disabled>
                      No calendars or categories available
                    </DropdownMenuItem>
                  )
                )}
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
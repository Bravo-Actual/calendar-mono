"use client";

import React from "react";
import { Calendar, MoreHorizontal, Plus, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useUserCalendars } from "@/lib/data/queries";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

export function Calendars() {
  const { user } = useAuth();
  const { data: calendars = [], isLoading } = useUserCalendars(user?.id);
  const { hiddenCalendarIds, toggleCalendarVisibility, setSettingsModalOpen } = useAppStore();

  // All calendars are visible by default with hiddenCalendarIds approach

  const handleToggleVisibility = (calendarId: string) => {
    toggleCalendarVisibility(calendarId);
  };

  const handleEditCalendar = (calendarId: string) => {
    // Open settings modal to calendars section for editing
    setSettingsModalOpen(true);
  };

  const handleDeleteCalendar = (calendarId: string) => {
    // Open settings modal to calendars section for deletion
    setSettingsModalOpen(true);
  };

  const handleCreateCalendar = () => {
    // Open settings modal to calendars section for creation
    setSettingsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Create button */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">My Calendars</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateCalendar}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar List */}
      <div className="flex-1 min-h-0">
        <div className="p-2">
          {calendars.map((calendar) => {
            return (
              <React.Fragment key={calendar.id}>
                <div
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                  onClick={() => handleToggleVisibility(calendar.id)}
                >
                  {/* Color indicator and checkbox */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                      checked={hiddenCalendarIds instanceof Set ? !hiddenCalendarIds.has(calendar.id) : true}
                      onCheckedChange={() => handleToggleVisibility(calendar.id)}
                      className="shrink-0"
                    />
                    <div className={cn("w-3 h-3 rounded-sm shrink-0", `bg-${calendar.color}-500`)} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {calendar.name}
                        {calendar.is_default && (
                          <span className="ml-1 text-xs text-muted-foreground">(Default)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Menu */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCalendar(calendar.id)}>
                          Edit Calendar
                        </DropdownMenuItem>
                        {!calendar.is_default && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteCalendar(calendar.id)}
                            className="text-destructive"
                          >
                            Delete Calendar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer with summary */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
{hiddenCalendarIds instanceof Set ? calendars.length - hiddenCalendarIds.size : calendars.length} of {calendars.length} calendars visible
          </span>
        </div>
      </div>
    </div>
  );
}

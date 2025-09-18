"use client";

import React from "react";
import { Calendar, Eye, EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

// Sample calendar data - this would come from your database/API
const sampleCalendars = [
  {
    id: 'personal',
    name: 'Personal',
    color: 'blue',
    visible: true,
    isOwner: true,
  },
  {
    id: 'work',
    name: 'Work',
    color: 'green',
    visible: true,
    isOwner: true,
  },
  {
    id: 'team',
    name: 'Team Events',
    color: 'purple',
    visible: false,
    isOwner: false,
  },
  {
    id: 'holidays',
    name: 'Holidays',
    color: 'red',
    visible: true,
    isOwner: false,
  },
];

const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  rose: 'bg-rose-500',
};

export function Calendars() {
  const [calendars, setCalendars] = React.useState(sampleCalendars);

  const toggleCalendarVisibility = (calendarId: string) => {
    setCalendars(prevCalendars =>
      prevCalendars.map(cal =>
        cal.id === calendarId
          ? { ...cal, visible: !cal.visible }
          : cal
      )
    );
  };

  const handleEditCalendar = (calendarId: string) => {
    // TODO: Implement edit calendar functionality
    console.log('Edit calendar:', calendarId);
  };

  const handleDeleteCalendar = (calendarId: string) => {
    // TODO: Implement delete calendar functionality
    console.log('Delete calendar:', calendarId);
  };

  const handleCreateCalendar = () => {
    // TODO: Implement create calendar functionality
    console.log('Create new calendar');
  };

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
          {calendars.map((calendar, index) => (
            <React.Fragment key={calendar.id}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group">
                {/* Color indicator and checkbox */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    checked={calendar.visible}
                    onCheckedChange={() => toggleCalendarVisibility(calendar.id)}
                    className="shrink-0"
                  />
                  <div className={`w-3 h-3 rounded-sm shrink-0 ${colorMap[calendar.color as keyof typeof colorMap]}`} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {calendar.name}
                    </span>
                    {!calendar.isOwner && (
                      <span className="text-xs text-muted-foreground">
                        Shared
                      </span>
                    )}
                  </div>
                </div>

                {/* Visibility toggle and menu */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCalendarVisibility(calendar.id)}
                    className="h-6 w-6 p-0"
                  >
                    {calendar.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </Button>

                  {calendar.isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCalendar(calendar.id)}>
                          Edit Calendar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteCalendar(calendar.id)}
                          className="text-destructive"
                        >
                          Delete Calendar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Footer with summary */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            {calendars.filter(cal => cal.visible).length} of {calendars.length} calendars visible
          </span>
        </div>
      </div>
    </div>
  );
}

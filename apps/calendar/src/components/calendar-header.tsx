"use client";

import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "./ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface CalendarHeaderProps {
  viewMode: 'consecutive' | 'non-consecutive';
  selectedDates: Date[];
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  consecutiveType: 'day' | 'week' | 'workweek' | 'custom-days';
  customDayCount: number;
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onSetConsecutiveView: (type: 'day' | 'week' | 'workweek' | 'custom-days', date: Date, count?: number) => void;
  onSetCustomDayCount: (count: number) => void;
  onSetWeekStartDay: (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void;
  startDate: Date;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
}

export function CalendarHeader({
  viewMode,
  selectedDates,
  dateRange,
  consecutiveType,
  customDayCount,
  weekStartDay,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onSetConsecutiveView,
  onSetCustomDayCount,
  onSetWeekStartDay,
  startDate,
  aiPanelOpen,
  onToggleAiPanel,
}: CalendarHeaderProps) {
  return (
    <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

      {/* Date Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              {viewMode === 'non-consecutive' && selectedDates.length > 0
                ? `${selectedDates.length} Selected Days`
                : dateRange.startDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

      {/* Navigation Controls */}
      <div className="flex items-center gap-2 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevWeek}
          title="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextWeek}
          title="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onGoToToday}
          title="Go to today"
        >
          <CalendarDays className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {consecutiveType === 'day' ? 'Day' :
               consecutiveType === 'week' ? 'Week' :
               consecutiveType === 'workweek' ? 'Work Week' :
               `${customDayCount} Days`}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* View Type Options */}
            <DropdownMenuItem onClick={() => onSetConsecutiveView('day', startDate)}>
              Day
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetConsecutiveView('week', startDate)}>
              Week (7 days)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetConsecutiveView('workweek', startDate)}>
              Work Week (5 days)
            </DropdownMenuItem>

            {/* Custom Days Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                # of Days ({customDayCount})
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(count => (
                  <DropdownMenuItem
                    key={count}
                    onClick={() => {
                      onSetCustomDayCount(count);
                      onSetConsecutiveView('custom-days', startDate, count);
                    }}
                  >
                    {count} Day{count > 1 ? 's' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Week Start Day Options */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Week Starts On ({['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekStartDay]})
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                  <DropdownMenuItem
                    key={day}
                    onClick={() => onSetWeekStartDay(index as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                  >
                    {day}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Panel Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleAiPanel}
        title={aiPanelOpen ? "Hide AI Assistant" : "Show AI Assistant"}
        className={aiPanelOpen ? "bg-muted" : ""}
      >
        <Bot className="h-4 w-4" />
      </Button>
    </header>
  );
}
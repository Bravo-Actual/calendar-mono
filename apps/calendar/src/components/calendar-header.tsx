"use client";

import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, PanelLeft, Grid3X3, List } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
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
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onSetConsecutiveView: (type: 'day' | 'week' | 'workweek' | 'custom-days', date: Date, count?: number) => void;
  onSetCustomDayCount: (count: number) => void;
  startDate: Date;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  displayMode: 'grid' | 'agenda';
  onSetDisplayMode: (mode: 'grid' | 'agenda') => void;
}

export function CalendarHeader({
  viewMode,
  selectedDates,
  dateRange,
  consecutiveType,
  customDayCount,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onSetConsecutiveView,
  onSetCustomDayCount,
  startDate,
  sidebarOpen,
  onToggleSidebar,
  displayMode,
  onSetDisplayMode,
}: CalendarHeaderProps) {
  return (
    <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        className={sidebarOpen ? "bg-muted" : ""}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
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

          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* View Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {displayMode === 'grid' ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
            {displayMode === 'grid' ? 'Grid' : 'Agenda'}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onSetDisplayMode('grid')}>
            <Grid3X3 className="h-4 w-4 mr-2" />
            Grid View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetDisplayMode('agenda')}>
            <List className="h-4 w-4 mr-2" />
            Agenda View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </header>
  );
}
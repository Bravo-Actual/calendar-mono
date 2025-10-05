'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

export interface CalendarHeaderProps {
  viewMode: 'dateRange' | 'dateArray';
  selectedDates: Date[];
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  dateRangeType: 'day' | 'week' | 'workweek' | 'custom-days';
  customDayCount: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onSetDateRangeView: (
    type: 'day' | 'week' | 'workweek' | 'custom-days',
    date: Date,
    count?: number
  ) => void;
  onSetCustomDayCount: (count: number) => void;
  startDate: Date;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  eventDetailsPanelOpen: boolean;
  onToggleEventDetails: () => void;
}

export function CalendarHeader({
  viewMode,
  selectedDates,
  dateRange,
  dateRangeType,
  customDayCount,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onSetDateRangeView,
  onSetCustomDayCount,
  startDate,
  sidebarOpen,
  onToggleSidebar,
  eventDetailsPanelOpen,
  onToggleEventDetails,
}: CalendarHeaderProps) {
  return (
    <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b">
      {/* Sidebar Toggle Tab */}
      <button
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        className="h-12 px-1 bg-background hover:bg-muted/50 border-r border-t border-b border-border rounded-tr-md rounded-br-md flex items-center transition-colors"
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

      {/* Date Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              {viewMode === 'dateArray' && selectedDates.length > 0
                ? `${selectedDates.length} Selected Days`
                : dateRange.startDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2 flex-1">
        <div className="ml-auto">
          <ButtonGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {dateRangeType === 'day'
                    ? 'Day'
                    : dateRangeType === 'week'
                      ? 'Week'
                      : dateRangeType === 'workweek'
                        ? 'Work Week'
                        : `${customDayCount} Days`}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* View Type Options */}
                <DropdownMenuItem onClick={() => onSetDateRangeView('day', startDate)}>
                  Day
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetDateRangeView('week', startDate)}>
                  Week (7 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetDateRangeView('workweek', startDate)}>
                  Work Week (5 days)
                </DropdownMenuItem>

                {/* Custom Days Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger># of Days ({customDayCount})</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((count) => (
                      <DropdownMenuItem
                        key={count}
                        onClick={() => {
                          onSetCustomDayCount(count);
                          onSetDateRangeView('custom-days', startDate, count);
                        }}
                      >
                        {count} Day{count > 1 ? 's' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={onGoToToday} title="Go to today">
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onPrevWeek} title="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onNextWeek} title="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </ButtonGroup>
        </div>

        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

        {/* Event Details Toggle Tab */}
        <button
          onClick={onToggleEventDetails}
          title={eventDetailsPanelOpen ? 'Hide event details' : 'Show event details'}
          className="h-12 px-1 bg-background hover:bg-muted/50 border-l border-t border-b border-border rounded-tl-md rounded-bl-md flex items-center transition-colors"
        >
          {eventDetailsPanelOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}

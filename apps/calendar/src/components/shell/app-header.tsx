'use client';

import {
  CalendarToday20Regular,
  ChevronDown20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Calendar3Day20Regular,
  CalendarDay20Regular,
  GanttChart20Regular,
} from '@fluentui/react-icons';
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
  calendarView: 'grid' | 'schedule';
  onToggleCalendarView: () => void;
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
  calendarView,
  onToggleCalendarView,
}: CalendarHeaderProps) {
  return (
    <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b pr-4">
      {/* Sidebar Toggle Tab */}
      <button
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        className="h-12 px-1 hover:bg-muted/50 border-r border-t border-b border-border rounded-tr-md rounded-br-md flex items-center transition-colors"
      >
        {sidebarOpen ? <ChevronLeft20Regular className="size-5" /> : <ChevronRight20Regular className="size-5" />}
      </button>

      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

      {/* Date Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-lg font-semibold truncate max-w-[300px]">
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
                  {calendarView === 'schedule' ? (
                    <>
                      <GanttChart20Regular className="size-5" />
                      <span className="ml-2">Schedule</span>
                    </>
                  ) : (
                    <>
                      {dateRangeType === 'day' ? (
                        <CalendarDay20Regular className="size-5" />
                      ) : dateRangeType === 'week' ? (
                        <Calendar3Day20Regular className="size-5" />
                      ) : dateRangeType === 'workweek' ? (
                        <Calendar3Day20Regular className="size-5" />
                      ) : (
                        <Calendar3Day20Regular className="size-5" />
                      )}
                      <span className="ml-2">
                        {dateRangeType === 'day'
                          ? 'Day'
                          : dateRangeType === 'week'
                            ? 'Week'
                            : dateRangeType === 'workweek'
                              ? 'Work Week'
                              : `${customDayCount} Days`}
                      </span>
                    </>
                  )}
                  <ChevronDown20Regular className="ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {/* Grid View Options */}
                <DropdownMenuItem
                  onClick={() => {
                    if (calendarView === 'schedule') {
                      onToggleCalendarView();
                    }
                    onSetDateRangeView('workweek', startDate);
                  }}
                >
                  <Calendar3Day20Regular className="size-5 mr-2" />
                  Work Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (calendarView === 'schedule') {
                      onToggleCalendarView();
                    }
                    onSetDateRangeView('week', startDate);
                  }}
                >
                  <Calendar3Day20Regular className="size-5 mr-2" />
                  Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (calendarView === 'schedule') {
                      onToggleCalendarView();
                    }
                    onSetDateRangeView('day', startDate);
                  }}
                >
                  <CalendarDay20Regular className="size-5 mr-2" />
                  Day
                </DropdownMenuItem>

                {/* Custom Days Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Calendar3Day20Regular className="size-5 mr-2" />
                    # of Days
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((count) => (
                      <DropdownMenuItem
                        key={count}
                        onClick={() => {
                          if (calendarView === 'schedule') {
                            onToggleCalendarView();
                          }
                          onSetCustomDayCount(count);
                          onSetDateRangeView('custom-days', startDate, count);
                        }}
                      >
                        {count} Day{count > 1 ? 's' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Schedule View Option */}
                <DropdownMenuItem
                  onClick={() => {
                    if (calendarView === 'grid') {
                      onToggleCalendarView();
                    }
                  }}
                >
                  <GanttChart20Regular className="size-5 mr-2" />
                  Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={onPrevWeek} title="Previous">
              <ChevronLeft20Regular className="size-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onGoToToday} title="Go to today">
              <CalendarToday20Regular className="size-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onNextWeek} title="Next">
              <ChevronRight20Regular className="size-5" />
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </header>
  );
}

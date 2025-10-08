'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useAppStore } from '@/store/app';
import type { TimeItem } from '../cal-grid/types';
import type { CalendarScheduleProps, HorizontalGeometryConfig, ScheduleRow } from './types';
import { DateGutter } from './DateGutter';
import { DayRow } from './DayRow';
import { DayNavigator } from './DayNavigator';
import { JoystickScrollbar } from './JoystickScrollbar';

export function CalendarSchedule<T extends TimeItem>({
  rows,
  timeRange,
  pxPerHour = 240,
  snapMinutes = 15,
  rowHeight = 80,
  timezone,
  operations,
  onSelectionChange,
  selectedIds = [],
  className,
}: CalendarScheduleProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set(selectedIds));
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [timeRangeSelection, setTimeRangeSelection] = useState<{ start: number; end: number } | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const dragStartX = useRef<number>(0);
  const [stickyMonth, setStickyMonth] = useState<string | null>(null);
  const hasInitialScrolled = useRef(false);

  const hourWidth = pxPerHour; // 240px per hour by default
  const startHour = 8; // 8am
  const endHour = 18; // 6pm

  // Get app store actions for date navigation
  const { setDateRangeView, dateRangeType, startDate: appStartDate } = useAppStore();

  // Set view to single day mode when schedule is mounted
  useEffect(() => {
    if (dateRangeType !== 'day') {
      setDateRangeView('day', appStartDate || new Date());
    }
  }, [dateRangeType, setDateRangeView, appStartDate]);

  // Initial scroll to appropriate time on mount
  useEffect(() => {
    if (!scrollContainerRef.current || hasInitialScrolled.current || !appStartDate) return;

    const now = new Date();
    const normalizedStart = new Date(timeRange.start);
    normalizedStart.setHours(0, 0, 0, 0);

    // Determine target date and time
    // If appStartDate is today, use current time. Otherwise use start of business hours.
    const targetDate = new Date(appStartDate);
    const normalizedTarget = new Date(targetDate);
    normalizedTarget.setHours(0, 0, 0, 0);

    const normalizedNow = new Date(now);
    normalizedNow.setHours(0, 0, 0, 0);

    const isToday = normalizedTarget.getTime() === normalizedNow.getTime();

    // Check if target is within the timeline range
    if (targetDate < timeRange.start || targetDate > timeRange.end) return;

    // Calculate which day we're on
    const daysFromStart = Math.floor((normalizedTarget.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));

    // Hours per day in business hours
    const hoursPerDay = endHour - startHour;

    // Calculate time position within the day
    let businessHoursIntoDay: number;
    if (isToday) {
      // Use current time if it's today
      const currentHour = now.getHours() + now.getMinutes() / 60;
      businessHoursIntoDay = Math.max(0, Math.min(hoursPerDay, currentHour - startHour));
    } else {
      // Use start of business hours for other days
      businessHoursIntoDay = 0;
    }

    // Position to show target time
    const totalBusinessHours = (daysFromStart * hoursPerDay) + businessHoursIntoDay;
    const targetX = totalBusinessHours * hourWidth;

    // Scroll to position with target time visible
    scrollContainerRef.current.scrollTo({
      left: Math.max(0, targetX - hourWidth * 2), // Show 2 hours before target time
      behavior: 'auto',
    });

    hasInitialScrolled.current = true;
  }, [appStartDate, timeRange.start, timeRange.end, hourWidth, startHour, endHour]);

  // Calculate which month should be sticky based on scroll position
  const calculateStickyMonth = useCallback((scrollPos: number) => {
    const hoursPerDay = endHour - startHour;
    const totalBusinessHours = scrollPos / hourWidth;
    const daysFromStart = Math.floor(totalBusinessHours / hoursPerDay);

    const normalizedStart = new Date(timeRange.start);
    normalizedStart.setHours(0, 0, 0, 0);

    const currentScrollDate = new Date(normalizedStart);
    currentScrollDate.setDate(currentScrollDate.getDate() + daysFromStart);

    return currentScrollDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [hourWidth, timeRange.start, startHour, endHour]);

  // Handle scroll and update current date based on scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(newScrollLeft);

    // Calculate sticky month
    setStickyMonth(calculateStickyMonth(newScrollLeft));

    // Calculate the date at the current scroll position (center of viewport)
    const viewportWidth = e.currentTarget.clientWidth;
    const centerScrollX = newScrollLeft + viewportWidth / 2;

    // Hours per day in business hours
    const hoursPerDay = endHour - startHour;

    // Convert X position to date (business hours only)
    const totalBusinessHours = centerScrollX / hourWidth;
    const daysFromStart = Math.floor(totalBusinessHours / hoursPerDay);

    const normalizedStart = new Date(timeRange.start);
    normalizedStart.setHours(0, 0, 0, 0);

    const dateAtCenter = new Date(normalizedStart);
    dateAtCenter.setDate(dateAtCenter.getDate() + daysFromStart);

    setCurrentDate(dateAtCenter);
  }, [hourWidth, timeRange.start, startHour, endHour, calculateStickyMonth]);

  // Handle day navigation click - jump to date and update app state
  const handleJumpToDate = useCallback((date: Date) => {
    // Update app state to the selected date
    setDateRangeView('day', date);

    if (!scrollContainerRef.current) return;

    const normalizedStart = new Date(timeRange.start);
    normalizedStart.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Calculate which day from start
    const daysFromStart = Math.floor((targetDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));

    // Hours per day in business hours
    const hoursPerDay = endHour - startHour;

    // Position of the start of the day
    const dayStartX = daysFromStart * hoursPerDay * hourWidth;

    // Center the day in the viewport
    const viewportWidth = scrollContainerRef.current.clientWidth;
    const dayWidth = hoursPerDay * hourWidth;
    const centerOffset = (viewportWidth - dayWidth) / 2;

    // Scroll to center the selected day
    const scrollPosition = Math.max(0, dayStartX - centerOffset);

    scrollContainerRef.current.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });
  }, [timeRange.start, hourWidth, startHour, endHour, setDateRangeView]);

  // Handle joystick scroll
  const handleJoystickScroll = useCallback((delta: number) => {
    if (!scrollContainerRef.current) return;

    scrollContainerRef.current.scrollLeft += delta;
  }, []);

  // Handle item selection
  const handleSelectMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const newSelection = new Set(selection);

    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
    } else {
      // Replace selection
      newSelection.clear();
      newSelection.add(id);
    }

    setSelection(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  }, [selection, onSelectionChange]);

  // Snap X position to grid
  const snapXToGrid = useCallback((x: number): number => {
    const minuteWidth = hourWidth / 60;
    const snapWidth = snapMinutes * minuteWidth;
    return Math.round(x / snapWidth) * snapWidth;
  }, [hourWidth, snapMinutes]);

  // Handle mouse move on grid - track cursor and handle dragging
  const handleGridMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const snappedX = snapXToGrid(x);

    setCursorX(snappedX);

    if (isDraggingRange) {
      const start = Math.min(dragStartX.current, snappedX);
      const end = Math.max(dragStartX.current, snappedX);
      setTimeRangeSelection({ start, end });
    }
  }, [scrollLeft, snapXToGrid, isDraggingRange]);

  // Handle mouse down on grid - start range selection
  const handleGridMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const snappedX = snapXToGrid(x);

    setIsDraggingRange(true);
    dragStartX.current = snappedX;
    setTimeRangeSelection({ start: snappedX, end: snappedX });
  }, [scrollLeft, snapXToGrid]);

  // Handle mouse up - finish range selection
  const handleGridMouseUp = useCallback(() => {
    if (isDraggingRange) {
      setIsDraggingRange(false);

      // If start and end are the same (single click), clear selection
      if (timeRangeSelection && timeRangeSelection.start === timeRangeSelection.end) {
        setTimeRangeSelection(null);
      } else if (timeRangeSelection) {
        // Convert X positions to dates and log
        const startDate = new Date(timeRange.start.getTime() + (timeRangeSelection.start / hourWidth) * 60 * 60 * 1000);
        const endDate = new Date(timeRange.start.getTime() + (timeRangeSelection.end / hourWidth) * 60 * 60 * 1000);
        console.log('Time range selected:', startDate, endDate);
      }
    }
  }, [isDraggingRange, timeRangeSelection, timeRange.start, hourWidth]);

  // Handle mouse leave - hide cursor line
  const handleGridMouseLeave = useCallback(() => {
    setCursorX(null);
  }, []);

  // Calculate current time position
  const calculateNowPosition = useCallback(() => {
    const now = new Date();

    // Check if now is within the visible date range
    if (now < timeRange.start || now > timeRange.end) {
      return null;
    }

    // Calculate which day we're on
    const normalizedStart = new Date(timeRange.start);
    normalizedStart.setHours(0, 0, 0, 0);

    const normalizedNow = new Date(now);
    normalizedNow.setHours(0, 0, 0, 0);

    const daysFromStart = Math.floor((normalizedNow.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate hours into the current day (in business hours)
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // If outside business hours, don't show
    if (currentHour < startHour || currentHour > endHour) {
      return null;
    }

    // Calculate X position
    const hoursPerDay = endHour - startHour;
    const businessHoursIntoDay = currentHour - startHour;
    const totalBusinessHoursFromStart = (daysFromStart * hoursPerDay) + businessHoursIntoDay;
    const x = totalBusinessHoursFromStart * hourWidth;

    return x;
  }, [timeRange.start, timeRange.end, hourWidth, startHour, endHour]);

  const nowX = calculateNowPosition();

  return (
    <DndContext>
      <div className={cn('flex flex-col h-full bg-background relative', className)}>
        {/* Now Moment indicator - vertical line showing current time */}
        {nowX !== null && (
          <>
            {/* Dot at top */}
            <div
              className="absolute w-3 h-3 rounded-full bg-ring border-2 border-background pointer-events-none z-10"
              style={{
                left: 192 + nowX - scrollLeft - 6, // Center the dot (6px = half of 12px width)
                top: 96 - 6, // 96px = 40px (h-10 month) + 32px (h-8 day) + 24px (h-6 hours) - 6px to center dot
              }}
            />
            {/* Vertical line */}
            <div
              className="absolute w-0.5 bg-ring pointer-events-none z-10"
              style={{
                left: 192 + nowX - scrollLeft, // 192px = w-48 row header width
                top: 96, // Start below hours row: 40px + 32px + 24px
                bottom: 40, // 40px = h-10 for day navigator
              }}
            />
          </>
        )}

        {/* Cursor follower line - from below hours row to day navigator */}
        {cursorX !== null && !isDraggingRange && (
          <>
            {/* Dot at top */}
            <div
              className="absolute w-2 h-2 rounded-full bg-primary pointer-events-none z-30"
              style={{
                left: 192 + cursorX - scrollLeft - 4, // Center the dot (4px = half of 8px width)
                top: 96 - 4, // 96px = 40px (h-10 month) + 32px (h-8 day) + 24px (h-6 hours) - 4px to center dot
              }}
            />
            {/* Line */}
            <div
              className="absolute w-0.5 bg-primary/40 pointer-events-none z-30"
              style={{
                left: 192 + cursorX - scrollLeft, // 192px = w-48 row header width
                top: 96, // Start below hours row: 40px + 32px + 24px
                bottom: 40, // 40px = h-10 for day navigator
              }}
            />
          </>
        )}

        {/* Time range highlight - from below hours row to day navigator */}
        {timeRangeSelection && (
          <>
            {/* Dots at top of each edge */}
            <div
              className="absolute w-2 h-2 rounded-full bg-primary pointer-events-none z-30"
              style={{
                left: 192 + timeRangeSelection.start - scrollLeft - 4,
                top: 96 - 4,
              }}
            />
            <div
              className="absolute w-2 h-2 rounded-full bg-primary pointer-events-none z-30"
              style={{
                left: 192 + timeRangeSelection.end - scrollLeft - 4,
                top: 96 - 4,
              }}
            />
            {/* Selection area */}
            <div
              className="absolute bg-primary/10 border-x-2 border-primary pointer-events-none z-30"
              style={{
                left: 192 + timeRangeSelection.start - scrollLeft,
                width: timeRangeSelection.end - timeRangeSelection.start,
                top: 96, // Start below hours row
                bottom: 40,
              }}
            />
          </>
        )}

        {/* Header with time gutter */}
        <div className="flex border-b border-border bg-muted/30 relative">
          {/* Empty corner for row header alignment */}
          <div className="w-48 flex-shrink-0 border-r border-border bg-muted/30 z-20" />

          {/* Sticky month label */}
          {stickyMonth && (
            <div className="absolute left-48 top-0 h-10 flex items-center px-2 bg-muted/30 border-r border-border z-20 pointer-events-none">
              <span className="text-sm font-medium">{stickyMonth}</span>
            </div>
          )}

          {/* Time header - scrolls horizontally with content */}
          <div className="flex-1 overflow-hidden">
            <div style={{ marginLeft: -scrollLeft }}>
              <DateGutter
                startDate={timeRange.start}
                endDate={timeRange.end}
                hourWidth={hourWidth}
                startHour={startHour}
                endHour={endHour}
              />
            </div>
          </div>
        </div>

        {/* Content area with row headers and timelines */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Row headers column (like day column headers, but vertical) */}
          <div className="w-48 flex-shrink-0 border-r border-border bg-background flex flex-col z-10">
            {rows.map((row) => {
              const avatarUrl = getAvatarUrl(row.avatarUrl);
              return (
                <div
                  key={`header-${row.id}`}
                  className="flex items-center px-4 gap-3 border-b border-border"
                  style={{ height: rowHeight }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={row.label} className="w-8 h-8 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        {row.label.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="truncate text-sm">{row.label}</span>
                </div>
              );
            })}
          </div>

          {/* Scrollable timelines */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative"
            onScroll={handleScroll}
            onMouseMove={handleGridMouseMove}
            onMouseDown={handleGridMouseDown}
            onMouseUp={handleGridMouseUp}
            onMouseLeave={handleGridMouseLeave}
          >
            <div className="flex flex-col">
              {rows.map((row) => (
                <DayRow
                  key={`timeline-${row.id}`}
                  id={`row-${row.id}`}
                  rowId={row.id}
                  items={row.items as T[]}
                  startDate={timeRange.start}
                  endDate={timeRange.end}
                  hourWidth={hourWidth}
                  rowHeight={rowHeight}
                  snapMinutes={snapMinutes}
                  startHour={startHour}
                  endHour={endHour}
                  selection={selection}
                  onSelectMouseDown={handleSelectMouseDown}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Joystick scrollbar */}
        <JoystickScrollbar onScroll={handleJoystickScroll} />

        {/* Day navigator - macro view */}
        <DayNavigator
          startDate={timeRange.start}
          endDate={timeRange.end}
          currentDate={currentDate}
          onJumpTo={handleJumpToDate}
        />
      </div>

      <DragOverlay>{/* TODO: Drag preview */}</DragOverlay>
    </DndContext>
  );
}

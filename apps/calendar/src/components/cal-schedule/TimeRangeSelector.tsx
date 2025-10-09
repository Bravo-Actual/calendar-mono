'use client';

import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TimeRangeSelectorProps {
  startDate: Date;
  endDate: Date;
  hourWidth: number;
  startHour?: number;
  endHour?: number;
  snapMinutes?: number;
  onRangeChange?: (start: Date, end: Date) => void;
  className?: string;
}

export function TimeRangeSelector({
  startDate,
  endDate,
  hourWidth,
  startHour = 8,
  endHour = 18,
  snapMinutes = 15,
  onRangeChange,
  className,
}: TimeRangeSelectorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'middle' | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null); // X position
  const [rangeEnd, setRangeEnd] = useState<number | null>(null); // X position

  // Snap to grid
  const snapToGrid = useCallback(
    (x: number): number => {
      const minuteWidth = hourWidth / 60;
      const snapWidth = snapMinutes * minuteWidth;
      return Math.round(x / snapWidth) * snapWidth;
    },
    [hourWidth, snapMinutes]
  );

  // Convert X position to Date
  const xToDate = useCallback(
    (x: number): Date => {
      const hoursPerDay = endHour - startHour;
      const totalMinutes = (x / hourWidth) * 60; // Minutes from start
      const daysFromStart = Math.floor(totalMinutes / (hoursPerDay * 60));
      const minutesInDay = totalMinutes % (hoursPerDay * 60);

      const date = new Date(startDate);
      date.setDate(date.getDate() + daysFromStart);
      date.setHours(startHour + Math.floor(minutesInDay / 60), minutesInDay % 60, 0, 0);

      return date;
    },
    [startDate, hourWidth, startHour, endHour]
  );

  // Convert Date to X position
  const _dateToX = useCallback(
    (date: Date): number => {
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0);

      const targetDate = new Date(date);
      const daysFromStart = Math.floor(
        (targetDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      const hour = targetDate.getHours();
      const minute = targetDate.getMinutes();
      const totalMinutesInDay = hour * 60 + minute;
      const businessHourMinutes = totalMinutesInDay - startHour * 60;

      const hoursPerDay = endHour - startHour;
      return daysFromStart * (hoursPerDay * hourWidth) + (businessHourMinutes / 60) * hourWidth;
    },
    [startDate, hourWidth, startHour, endHour]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: 'start' | 'end' | 'middle') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const rawX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const x = snapToGrid(rawX);

      if (isDragging === 'start') {
        if (rangeEnd === null || x < rangeEnd) {
          setRangeStart(x);
        }
      } else if (isDragging === 'end') {
        if (rangeStart === null || x > rangeStart) {
          setRangeEnd(x);
        }
      } else if (isDragging === 'middle' && rangeStart !== null && rangeEnd !== null) {
        const rangeWidth = rangeEnd - rangeStart;
        const centerX = x;
        const newStart = snapToGrid(Math.max(0, centerX - rangeWidth / 2));
        const newEnd = snapToGrid(Math.min(rect.width, newStart + rangeWidth));
        setRangeStart(newStart);
        setRangeEnd(newEnd);
      }
    },
    [isDragging, rangeStart, rangeEnd, snapToGrid]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && rangeStart !== null && rangeEnd !== null && onRangeChange) {
      const startDateValue = xToDate(rangeStart);
      const endDateValue = xToDate(rangeEnd);
      onRangeChange(startDateValue, endDateValue);
    }
    setIsDragging(null);
  }, [isDragging, rangeStart, rangeEnd, xToDate, onRangeChange]);

  // Global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle track click to start new selection
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current || isDragging) return;

      const rect = trackRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const x = snapToGrid(rawX);

      // Start new selection - default to 1 hour (60 minutes)
      const minuteWidth = hourWidth / 60;
      const defaultWidth = 60 * minuteWidth; // 1 hour
      setRangeStart(x);
      setRangeEnd(snapToGrid(x + defaultWidth));
    },
    [isDragging, snapToGrid, hourWidth]
  );

  if (rangeStart === null || rangeEnd === null) {
    return (
      <div
        ref={trackRef}
        className={cn('absolute inset-0 cursor-crosshair', className)}
        onClick={handleTrackClick}
      />
    );
  }

  const left = Math.min(rangeStart, rangeEnd);
  const width = Math.abs(rangeEnd - rangeStart);

  return (
    <div ref={trackRef} className={cn('absolute inset-0', className)}>
      {/* Selection overlay */}
      <div
        className="absolute top-0 bottom-0 bg-primary/20 border-y-2 border-primary cursor-move"
        style={{ left, width }}
        onMouseDown={(e) => handleMouseDown(e, 'middle')}
      >
        {/* Start handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-2 -left-1 bg-primary cursor-ew-resize hover:bg-primary/80 transition-colors',
            isDragging === 'start' && 'bg-primary/80'
          )}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
        />

        {/* End handle */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-2 -right-1 bg-primary cursor-ew-resize hover:bg-primary/80 transition-colors',
            isDragging === 'end' && 'bg-primary/80'
          )}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
        />
      </div>
    </div>
  );
}

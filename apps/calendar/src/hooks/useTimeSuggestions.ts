import { useState, useEffect, useMemo } from "react";
import type { SystemSlot } from "../components/types";
import { toZDT, DAY_MS, getTZ } from "../components/utils";

interface TimeSuggestionsOptions {
  dates: Date[] | { startDate: Date; endDate: Date };  // Array of dates or date range
  timeZone?: string;
  durationMinutes?: number; // Duration for suggested time slots (defaults to 60 minutes)
  existingEvents?: { id: string; start: number; end: number }[]; // Existing events to avoid overlapping
  currentDragEventId?: string; // ID of event being dragged (exclude from overlap check)
  currentDragEventOriginalTime?: { start: number; end: number }; // Original time of dragged event to avoid suggesting
}

export function useTimeSuggestions(isDragging: boolean, options: TimeSuggestionsOptions): SystemSlot[] {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragStartTime, setDragStartTime] = useState<number>(0);

  useEffect(() => {
    if (isDragging) {
      if (!dragStartTime) {
        setDragStartTime(Date.now());
      }
      const timer = setTimeout(() => {
        setShowSuggestions(true);
      }, 400); // 400ms delay
      return () => clearTimeout(timer);
    } else {
      setShowSuggestions(false);
      setDragStartTime(0);
    }
  }, [isDragging, dragStartTime]);

  // Helper function to check if two time ranges overlap
  const timeRangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return start1 < end2 && start2 < end1;
  };

  // Helper function to check if a time slot is available
  const isTimeSlotAvailable = (startTime: number, endTime: number, dayEvents: { start: number; end: number }[]): boolean => {
    // Check against existing events (excluding the dragged event)
    for (const event of dayEvents) {
      if (timeRangesOverlap(startTime, endTime, event.start, event.end)) {
        return false;
      }
    }
    return true;
  };

  // Memoize suggestions based on drag start time to keep them stable
  const suggestions = useMemo(() => {
    if (!showSuggestions || !dragStartTime) return [];

    const tz = getTZ(options.timeZone);
    const durationMs = (options.durationMinutes || 60) * 60 * 1000; // Convert minutes to milliseconds
    const now = Date.now();
    const earliestAllowedTime = now + (3 * 60 * 60 * 1000); // 3 hours from now
    const suggestionsList: SystemSlot[] = [];

    // Time slots for suggestions (9am-5pm business hours, avoid 12-1pm lunch)
    const primaryTimeSlots = [
      { hour: 9, minute: 0, label: 'morning' },
      { hour: 10, minute: 0, label: 'morning' },
      { hour: 10, minute: 30, label: 'morning' },
      { hour: 11, minute: 0, label: 'late morning' },
      { hour: 13, minute: 0, label: 'afternoon' }, // 1pm
      { hour: 14, minute: 0, label: 'afternoon' },
      { hour: 14, minute: 30, label: 'afternoon' },
      { hour: 15, minute: 0, label: 'mid afternoon' },
      { hour: 15, minute: 30, label: 'mid afternoon' },
      { hour: 16, minute: 0, label: 'late afternoon' },
      { hour: 16, minute: 30, label: 'late afternoon' }
    ];

    // Lunch time slots (fallback if no other slots available)
    const lunchTimeSlots = [
      { hour: 12, minute: 0, label: 'lunch hour' },
      { hour: 12, minute: 30, label: 'lunch hour' }
    ];

    // Use dragStartTime as seed for consistent random selections
    const seed = dragStartTime;

    // Generate suggestions for each date in the current view
    const dates = Array.isArray(options.dates)
      ? options.dates
      : (() => {
          const { startDate, endDate } = options.dates;
          const dateArray: Date[] = [];
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            dateArray.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          return dateArray;
        })();

    for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
      const date = dates[dayIdx];
      const dayMs = date.getTime();
      const dayStart = toZDT(dayMs, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
      const dayEnd = dayStart + DAY_MS;

      // Only suggest for future dates
      if (dayStart < now - DAY_MS) continue;

      const dayName = new Date(dayMs).toLocaleDateString('en-US', { weekday: 'long' });

      // Get existing events for this day (excluding the dragged event)
      const dayEvents = (options.existingEvents || [])
        .filter(event => {
          // Exclude the event being dragged
          if (options.currentDragEventId && event.id === options.currentDragEventId) {
            return false;
          }
          // Include events that overlap with this day
          return event.start < dayEnd && event.end > dayStart;
        })
        .map(event => ({ start: event.start, end: event.end }));

      // Add the original time slot of the dragged event to avoid suggesting it
      if (options.currentDragEventOriginalTime) {
        const { start, end } = options.currentDragEventOriginalTime;
        if (start < dayEnd && end > dayStart) {
          dayEvents.push({ start, end });
        }
      }

      // Try primary time slots first
      const availableSlots: typeof primaryTimeSlots = [];
      const daySuggestions: SystemSlot[] = [];

      // Test each primary time slot
      for (const slot of primaryTimeSlots) {
        const startTime = dayStart + (slot.hour * 60 * 60 * 1000) + (slot.minute * 60 * 1000);
        const endTime = startTime + durationMs;

        // Check if slot is at least 3 hours in the future, within business hours, and doesn't conflict
        if (startTime >= earliestAllowedTime && endTime <= dayStart + (17 * 60 * 60 * 1000) && isTimeSlotAvailable(startTime, endTime, dayEvents)) {
          availableSlots.push(slot);
        }
      }

      // If no primary slots available, try lunch slots
      if (availableSlots.length === 0) {
        for (const slot of lunchTimeSlots) {
          const startTime = dayStart + (slot.hour * 60 * 60 * 1000) + (slot.minute * 60 * 1000);
          const endTime = startTime + durationMs;

          // Check if slot is at least 3 hours in the future, within business hours, and doesn't conflict
          if (startTime >= earliestAllowedTime && endTime <= dayStart + (17 * 60 * 60 * 1000) && isTimeSlotAvailable(startTime, endTime, dayEvents)) {
            availableSlots.push(slot);
          }
        }
      }

      // Shuffle available slots deterministically based on seed
      const shuffledSlots = [...availableSlots];
      for (let i = shuffledSlots.length - 1; i > 0; i--) {
        const j = ((seed + dayIdx * 2531 + i * 743) % (i + 1));
        [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
      }

      // Limit to max 3 suggestions per day and ensure no overlaps between suggestions
      const selectedSlots = shuffledSlots.slice(0, 3);
      for (const slot of selectedSlots) {
        const startTime = dayStart + (slot.hour * 60 * 60 * 1000) + (slot.minute * 60 * 1000);
        const endTime = startTime + durationMs;

        // Check against other suggestions for this day to avoid overlaps
        const conflictsWithExistingSuggestion = daySuggestions.some(suggestion =>
          timeRangesOverlap(startTime, endTime, suggestion.startAbs, suggestion.endAbs)
        );

        if (!conflictsWithExistingSuggestion) {
          daySuggestions.push({
            id: `${dayName.toLowerCase()}-${slot.label}-${daySuggestions.length}`,
            startAbs: startTime,
            endAbs: endTime,
            reason: `${dayName} ${formatTime(slot.hour, slot.minute)}`
          });
        }

        // Stop once we have 3 suggestions for this day
        if (daySuggestions.length >= 3) break;
      }

      suggestionsList.push(...daySuggestions);
    }

    return suggestionsList;
  }, [showSuggestions, dragStartTime, options.dates, options.timeZone, options.durationMinutes, options.existingEvents, options.currentDragEventId, options.currentDragEventOriginalTime]);

  return suggestions;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${period}`;
}
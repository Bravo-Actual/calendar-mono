import { useState, useEffect, useMemo } from "react";
import type { SystemSlot } from "../components/types";
import { toZDT, DAY_MS, getTZ } from "../components/utils";

interface TimeSuggestionsOptions {
  weekStartMs: number;
  days: number;
  timeZone?: string;
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

  // Memoize suggestions based on drag start time to keep them stable
  const suggestions = useMemo(() => {
    if (!showSuggestions || !dragStartTime) return [];

    const tz = getTZ(options.timeZone);
    const now = Date.now();
    const suggestionsList: SystemSlot[] = [];

    // Time slots for suggestions (9am-5pm business hours)
    const timeSlots = [
      { hour: 9, minute: 0, label: 'morning' },
      { hour: 10, minute: 30, label: 'morning' },
      { hour: 13, minute: 0, label: 'afternoon' },
      { hour: 14, minute: 30, label: 'afternoon' },
      { hour: 16, minute: 0, label: 'late afternoon' }
    ];

    // Use dragStartTime as seed for consistent random selections
    const seed = dragStartTime;

    // Generate suggestions for each day in the current view
    for (let dayIdx = 0; dayIdx < options.days; dayIdx++) {
      const dayMs = options.weekStartMs + dayIdx * DAY_MS;
      const dayStart = toZDT(dayMs, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;

      // Only suggest for future dates
      if (dayStart < now - DAY_MS) continue;

      const dayName = new Date(dayMs).toLocaleDateString('en-US', { weekday: 'long' });

      // Use seeded random for consistent suggestions during drag
      const dayRandom = (seed + dayIdx * 1347) % 10000; // Larger range for better distribution
      const numSuggestions = (dayRandom % 3) + 1; // 1-3 suggestions

      // Shuffle time slots deterministically based on seed
      const shuffledSlots = [...timeSlots];
      for (let i = shuffledSlots.length - 1; i > 0; i--) {
        const j = ((seed + dayIdx * 2531 + i * 743) % (i + 1));
        [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
      }

      const selectedSlots = shuffledSlots.slice(0, numSuggestions);

      selectedSlots.forEach((slot, slotIdx) => {
        const startTime = dayStart + (slot.hour * 60 * 60 * 1000) + (slot.minute * 60 * 1000);
        const endTime = startTime + (60 * 60 * 1000); // 1 hour duration

        suggestionsList.push({
          id: `${dayName.toLowerCase()}-${slot.label}-${slotIdx}`,
          startAbs: startTime,
          endAbs: endTime,
          reason: `${dayName} ${formatTime(slot.hour, slot.minute)}`
        });
      });
    }

    return suggestionsList;
  }, [showSuggestions, dragStartTime, options.weekStartMs, options.days, options.timeZone]);

  return suggestions;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${period}`;
}
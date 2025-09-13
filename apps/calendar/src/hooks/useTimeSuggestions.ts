import type { SystemSlot } from "../components/types";
import { toZDT, DAY_MS, parseWeekStart, getTZ } from "../components/utils";

export function useTimeSuggestions(isDragging: boolean): SystemSlot[] {
  if (!isDragging) return [];

  // Use the same logic as the original working code
  const tz = getTZ();
  const weekStartMs = parseWeekStart(undefined, tz, 1); // Monday start

  const suggestions: SystemSlot[] = [];

  // Wednesday (dayIdx 2)
  const wedStart = toZDT(weekStartMs + 2 * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
  suggestions.push({
    id: 'wed-morning',
    dayIdx: 2,
    startAbs: wedStart + (9 * 60 * 60 * 1000) + (30 * 60 * 1000),
    endAbs: wedStart + (10 * 60 * 60 * 1000) + (30 * 60 * 1000),
    reason: 'Wednesday 9:30-10:30 AM'
  });
  suggestions.push({
    id: 'wed-afternoon',
    dayIdx: 2,
    startAbs: wedStart + (14 * 60 * 60 * 1000),
    endAbs: wedStart + (15 * 60 * 60 * 1000),
    reason: 'Wednesday 2-3 PM'
  });

  // Thursday (dayIdx 3)
  const thuStart = toZDT(weekStartMs + 3 * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
  suggestions.push({
    id: 'thu-morning',
    dayIdx: 3,
    startAbs: thuStart + (10 * 60 * 60 * 1000),
    endAbs: thuStart + (11 * 60 * 60 * 1000),
    reason: 'Thursday 10-11 AM'
  });
  suggestions.push({
    id: 'thu-afternoon',
    dayIdx: 3,
    startAbs: thuStart + (13 * 60 * 60 * 1000) + (30 * 60 * 1000),
    endAbs: thuStart + (14 * 60 * 60 * 1000) + (30 * 60 * 1000),
    reason: 'Thursday 1:30-2:30 PM'
  });
  suggestions.push({
    id: 'thu-late',
    dayIdx: 3,
    startAbs: thuStart + (16 * 60 * 60 * 1000),
    endAbs: thuStart + (17 * 60 * 60 * 1000),
    reason: 'Thursday 4-5 PM'
  });

  // Friday (dayIdx 4)
  const friStart = toZDT(weekStartMs + 4 * DAY_MS, tz).with({ hour: 0, minute: 0, second: 0, millisecond: 0 }).epochMilliseconds;
  suggestions.push({
    id: 'fri-morning',
    dayIdx: 4,
    startAbs: friStart + (11 * 60 * 60 * 1000),
    endAbs: friStart + (12 * 60 * 60 * 1000),
    reason: 'Friday 11 AM-12 PM'
  });
  suggestions.push({
    id: 'fri-afternoon',
    dayIdx: 4,
    startAbs: friStart + (15 * 60 * 60 * 1000) + (30 * 60 * 1000),
    endAbs: friStart + (16 * 60 * 60 * 1000) + (30 * 60 * 1000),
    reason: 'Friday 3:30-4:30 PM'
  });

  return suggestions;
}
"use client";

import { Temporal } from "@js-temporal/polyfill";
import type { CalEvent, SystemSlot, UserRole, ShowTimeAs, TimeDefenseLevel } from "./types";

export const DAY_MS = 86_400_000;

export const DEFAULT_COLORS = {
  eventBg: "var(--card)",
  eventBorder: "var(--border)",
  selection: "color-mix(in oklch, var(--primary) 20%, transparent)",
  selectionBorder: "var(--primary)",
  ai: "color-mix(in oklch, var(--accent) 30%, transparent)",
  aiBorder: "var(--accent-foreground)",
  highlightRing: "var(--ring)",
  ghost: "color-mix(in oklch, var(--primary) 20%, transparent)",
  ghostBorder: "var(--primary)",
  system: "rgba(168,85,247,0.18)",
  systemBorder: "rgba(147,51,234,0.9)",
};

export const MIN_SLOT_PX = 8;

export function getTZ(tz?: string) {
  return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
export function toZDT(ms: number, tz: string) {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
}
export function parseWeekStart(initialISO: string | undefined, tz: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  const base = initialISO ? Temporal.ZonedDateTime.from(`${initialISO}[${tz}]`) : Temporal.Now.zonedDateTimeISO(tz);
  const weekday = base.dayOfWeek; // 1=Monday, 2=Tuesday, ..., 7=Sunday

  // Convert weekStartsOn (0=Sunday, 1=Monday, etc.) to Temporal's weekday system (1=Monday, 7=Sunday)
  const target = weekStartsOn === 0 ? 7 : weekStartsOn;

  const diff = (weekday - target + 7) % 7;
  const atStart = base.subtract({ days: diff }).with({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return atStart.epochMilliseconds;
}

export function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
export function formatHourLabel(h: number, format: '12_hour' | '24_hour' = '12_hour') {
  // Create a Temporal time for the hour
  const time = Temporal.PlainTime.from({ hour: h, minute: 0 });

  // Use Temporal's built-in formatting
  const hourCycle = format === '24_hour' ? 'h23' : 'h12';
  return time.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle
  });
}
export function snapMs(ms: number, step: number) { return Math.round(ms / step) * step; }
export function uid(prefix = "evt") { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
export function seedRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatTimeRangeLabel(startMs: number, endMs: number, tz: string, format: '12_hour' | '24_hour' = '12_hour') {
  const s = toZDT(startMs, tz);
  const e = toZDT(endMs, tz);

  // Use Temporal's built-in formatting
  const hourCycle = format === '24_hour' ? 'h23' : 'h12';
  const formatOptions = {
    hour: 'numeric' as const,
    minute: '2-digit' as const,
    hourCycle
  };

  const startTime = s.toPlainTime().toLocaleString('en-US', formatOptions);
  const endTime = e.toPlainTime().toLocaleString('en-US', formatOptions);

  return `${startTime} – ${endTime}`;
}

export function computeFreeGapsForDay(events: CalEvent[], dayStartAbs: number, dayEndAbs: number): Array<{ start: number; end: number }> {
  const dayEvents = events
    .filter(e => e.end > dayStartAbs && e.start < dayEndAbs)
    .map(e => ({ start: Math.max(e.start, dayStartAbs), end: Math.min(e.end, dayEndAbs) }))
    .sort((a, b) => a.start - b.start);
  const gaps: Array<{ start: number; end: number }> = [];
  let cur = dayStartAbs;
  for (const ev of dayEvents) {
    if (ev.start > cur) gaps.push({ start: cur, end: ev.start });
    cur = Math.max(cur, ev.end);
  }
  if (cur < dayEndAbs) gaps.push({ start: cur, end: dayEndAbs });
  return gaps;
}

export function recommendSlotsForDay(
  events: CalEvent[],
  dayStartAbs: number,
  durationMs: number,
  count = 2,
  snapStepMs = 5 * 60_000,
  seed = 42
): SystemSlot[] {
  const dayEndAbs = dayStartAbs + DAY_MS;
  const gaps = computeFreeGapsForDay(events, dayStartAbs, dayEndAbs).filter(g => g.end - g.start >= durationMs);
  if (!gaps.length || durationMs <= 0) return [];
  const rnd = seedRng(seed);
  const out: SystemSlot[] = [];
  let attempts = 0;
  while (out.length < count && attempts < 50) {
    attempts++;
    const g = gaps[Math.floor(rnd() * gaps.length)];
    const span = g.end - g.start - durationMs;
    if (span < 0) continue;
    const offset = Math.floor((rnd() * span) / snapStepMs) * snapStepMs;
    const s = g.start + offset;
    const e = s + durationMs;
    if (out.some(sl => !(e <= sl.startAbs || s >= sl.endAbs))) continue;
    out.push({ id: uid("sys"), startAbs: s, endAbs: e });
  }
  return out;
}

export function createEventsFromRanges(ranges: {startAbs:number; endAbs:number;}[], defaultTitle = "New event"): CalEvent[] {
  return ranges.map((r) => ({
    // Core event fields
    id: uid("evt"),
    owner: "", // Will be set when creating
    creator: "", // Will be set when creating
    title: defaultTitle,
    agenda: undefined,
    online_event: false,
    online_join_link: undefined,
    online_chat_link: undefined,
    in_person: false,
    start_time: new Date(r.startAbs).toISOString(),
    duration: Math.round((r.endAbs - r.startAbs) / (1000 * 60)), // Convert ms to minutes
    all_day: false,
    private: false,
    request_responses: true,
    allow_forwarding: false,
    hide_attendees: false,
    history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),

    // User's relationship to event
    user_role: "owner" as UserRole,
    invite_type: undefined,
    rsvp: undefined,
    rsvp_timestamp: undefined,
    attendance_type: undefined,
    following: false,

    // User's event options
    show_time_as: "busy" as ShowTimeAs,
    user_category_id: undefined,
    user_category_name: undefined,
    user_category_color: undefined,
    time_defense_level: "normal" as TimeDefenseLevel,
    ai_managed: false,
    ai_instructions: undefined,

    // Computed fields for calendar rendering
    start: r.startAbs,
    end: r.endAbs,
    aiSuggested: false,
  }));
}
export function deleteEventsByIds(events: CalEvent[], ids: Set<string>): CalEvent[] {
  return events.filter(e => !ids.has(e.id));
}

export interface PositionedEvent {
  id: string;
  rect: { top: number; height: number; leftPct: number; widthPct: number };
  dayIdx: number;
}

export function layoutDay(
  events: CalEvent[],
  dayStart: number,
  dayEnd: number,
  pxPerMs: number,
  gap = 2
): PositionedEvent[] {
  const dayEvents = events
    .filter((e) => e.end > dayStart && e.start < dayEnd && !e.all_day)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));

  const clusters: CalEvent[][] = [];
  let current: CalEvent[] = [];
  let currentEnd = -Infinity;
  for (const e of dayEvents) {
    if (current.length === 0 || e.start < currentEnd) {
      current.push(e);
      currentEnd = Math.max(currentEnd, e.end);
    } else {
      clusters.push(current);
      current = [e];
      currentEnd = e.end;
    }
  }
  if (current.length) clusters.push(current);

  const out: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const cols: CalEvent[][] = [];
    for (const e of cluster) {
      let placed = false;
      for (const col of cols) {
        if (col[col.length - 1].end <= e.start) { col.push(e); placed = true; break; }
      }
      if (!placed) cols.push([e]);
    }
    const colCount = cols.length;
    const colIdx = new Map<string, number>();
    cols.forEach((col, i) => col.forEach((e) => colIdx.set(e.id, i)));

    for (const e of cluster) {
      const top = Math.max(0, (Math.max(e.start, dayStart) - dayStart) * pxPerMs + 2);
      const height = Math.max(12, (Math.min(e.end, dayEnd) - Math.max(e.start, dayStart)) * pxPerMs - 4);
      const leftPct = (colIdx.get(e.id)! / colCount) * 94; // Leave 6% on right
      const widthPct = 94 / colCount;
      out.push({ id: e.id, rect: { top, height, leftPct, widthPct }, dayIdx: 0 });
    }
  }
  return out;
}
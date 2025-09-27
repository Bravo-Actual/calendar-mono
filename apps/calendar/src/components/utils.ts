"use client";

import { Temporal } from "@js-temporal/polyfill";
import type { EventResolved } from "@/lib/data-v2";
import type { SystemSlot } from "./types";
import type { UserRole, ShowTimeAs, TimeDefenseLevel, EventDiscoveryType, EventJoinModelType } from "@/types";
import { db } from "@/lib/data-v2/base/dexie";

export const DAY_MS = 86_400_000;

export const DEFAULT_COLORS = {
  eventBg: "var(--card)",
  eventBorder: "var(--border)",
  selection: "color-mix(in oklch, var(--primary) 20%, transparent)",
  selectionBorder: "var(--primary)",
  ai: "color-mix(in oklch, var(--accent) 30%, transparent)",
  aiBorder: "var(--accent-foreground)",
  // AI Highlights (yellow) - separate from user selections, using shadcn yellow palette
  aiHighlight: "color-mix(in oklch, oklch(0.858 0.158 93.329) 30%, transparent)", // yellow-400 with transparency
  aiHighlightBorder: "oklch(0.858 0.158 93.329)", // yellow-400
  aiTimeHighlight: "color-mix(in oklch, oklch(0.858 0.158 93.329) 20%, transparent)", // yellow-400 with lower transparency
  aiTimeHighlightBorder: "color-mix(in oklch, oklch(0.858 0.158 93.329) 40%, transparent)", // yellow-400 with transparency
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
  return Temporal.Instant.from(new Date(ms).toISOString()).toZonedDateTimeISO(tz);
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
  const hourCycle: 'h23' | 'h12' = format === '24_hour' ? 'h23' : 'h12';
  const formatOptions = {
    hour: 'numeric' as const,
    minute: '2-digit' as const,
    hourCycle
  };

  const startTime = s.toPlainTime().toLocaleString('en-US', formatOptions);
  const endTime = e.toPlainTime().toLocaleString('en-US', formatOptions);

  return `${startTime} – ${endTime}`;
}

export function computeFreeGapsForDay(events: EventResolved[], dayStartAbs: number, dayEndAbs: number): Array<{ start: number; end: number }> {
  const dayEvents = events
    .filter(e => {
      return e.end_time_ms > dayStartAbs && e.start_time_ms < dayEndAbs;
    })
    .map(e => {
      return { start: Math.max(e.start_time_ms, dayStartAbs), end: Math.min(e.end_time_ms, dayEndAbs) };
    })
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
  events: EventResolved[],
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

export async function createEventsFromRanges(ranges: {startAbs:number; endAbs:number;}[], defaultTitle = "New event"): Promise<EventResolved[]> {
  // Get default calendar and category from Dexie
  const defaultCalendar = await db.user_calendars.filter(cal => cal.type === 'default').first();
  const defaultCategory = await db.user_categories.filter(cat => cat.is_default === true).first();

  return ranges.map((r) => ({
    // Core event fields
    id: uid("evt"),
    owner_id: "", // Will be set when creating
    title: defaultTitle,
    agenda: null,
    online_event: false,
    online_join_link: null,
    online_chat_link: null,
    in_person: false,
    start_time: new Date(r.startAbs),
    start_time_ms: r.startAbs,
    end_time: new Date(r.endAbs),
    end_time_ms: r.endAbs,
    all_day: false,
    series_id: null,
    private: false,
    request_responses: true,
    allow_forwarding: false,
    allow_reschedule_request: true,
    hide_attendees: false,
    history: [],
    discovery: "audience_only" as EventDiscoveryType,
    join_model: "invite_only" as EventJoinModelType,
    created_at: new Date(),
    updated_at: new Date(),

    // User perspective fields
    viewing_user_id: "", // Will be set when creating

    // User's relationship to event
    user_role: "owner" as UserRole,
    invite_type: null,
    rsvp: null,
    rsvp_timestamp: null,
    attendance_type: null,

    // User personal details
    calendar_id: defaultCalendar?.id,
    calendar_name: defaultCalendar?.name,
    calendar_color: defaultCalendar?.color || null,
    show_time_as: "busy" as ShowTimeAs,
    category_id: defaultCategory?.id,
    category_name: defaultCategory?.name,
    category_color: defaultCategory?.color || null,
    time_defense_level: "normal" as TimeDefenseLevel,
    ai_managed: false,
    ai_instructions: null,

    // EventResolved specific fields
    calendar: defaultCalendar ? {
      id: defaultCalendar.id!,
      name: defaultCalendar.name!,
      color: defaultCalendar.color || 'neutral'
    } : null,
    category: defaultCategory ? {
      id: defaultCategory.id!,
      name: defaultCategory.name!,
      color: defaultCategory.color || 'neutral'
    } : null,
    role: "owner" as const,
    following: false,
  }));
}
export function deleteEventsByIds(events: EventResolved[], ids: Set<string>): EventResolved[] {
  return events.filter(e => !ids.has(e.id));
}

export interface PositionedEvent {
  id: string;
  rect: { top: number; height: number; leftPct: number; widthPct: number };
  dayIdx: number;
}

export function layoutDay(
  events: EventResolved[],
  dayStart: number,
  dayEnd: number,
  pxPerMs: number,
  _gap = 2
): PositionedEvent[] {
  const dayEvents = events
    .filter((e) => {
      return e.end_time_ms > dayStart && e.start_time_ms < dayEnd && !e.all_day;
    })
    .sort((a, b) => {
      return (a.start_time_ms - b.start_time_ms) || (a.end_time_ms - b.end_time_ms);
    });

  const clusters: EventResolved[][] = [];
  let current: EventResolved[] = [];
  let currentEnd = -Infinity;
  for (const e of dayEvents) {
    const eStartMs = e.start_time_ms;
    const eEndMs = e.end_time_ms;
    if (current.length === 0 || eStartMs < currentEnd) {
      current.push(e);
      currentEnd = Math.max(currentEnd, eEndMs);
    } else {
      clusters.push(current);
      current = [e];
      currentEnd = eEndMs;
    }
  }
  if (current.length) clusters.push(current);

  const out: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const cols: EventResolved[][] = [];
    for (const e of cluster) {
      let placed = false;
      for (const col of cols) {
        const lastEndMs = col[col.length - 1].end_time_ms;
        const eStartMs = e.start_time_ms;
        if (lastEndMs <= eStartMs) { col.push(e); placed = true; break; }
      }
      if (!placed) cols.push([e]);
    }
    const colCount = cols.length;
    const colIdx = new Map<string, number>();
    cols.forEach((col, i) => col.forEach((e) => colIdx.set(e.id, i)));

    for (const e of cluster) {
      const eStartMs = e.start_time_ms;
      const eEndMs = e.end_time_ms;
      const top = Math.max(0, (Math.max(eStartMs, dayStart) - dayStart) * pxPerMs + 2);
      const height = Math.max(12, (Math.min(eEndMs, dayEnd) - Math.max(eStartMs, dayStart)) * pxPerMs - 4);
      const leftPct = (colIdx.get(e.id)! / colCount) * 94; // Leave 6% on right
      const widthPct = 94 / colCount;
      out.push({ id: e.id, rect: { top, height, leftPct, widthPct }, dayIdx: 0 });
    }
  }
  return out;
}
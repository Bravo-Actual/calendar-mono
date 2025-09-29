// Utility functions for calendar grid calculations
import { format } from 'date-fns';
import type { TimeItem, TimeLike, ItemPlacement, GeometryConfig } from './types';

// Date utilities
export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const toDate = (t: TimeLike) => new Date(t);

// Formatting utilities
export const fmtTime = (t: TimeLike) =>
  format(new Date(t), 'h:mm');

export const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// Geometry calculations
export const createGeometry = (config: Partial<GeometryConfig> = {}): GeometryConfig => ({
  minuteHeight: 1.5,
  topOffset: 8,
  snapMinutes: 15,
  ...config,
});

export const minuteToY = (min: number, geo: GeometryConfig) =>
  geo.topOffset + min * geo.minuteHeight;

export const yToMinute = (y: number, geo: GeometryConfig) =>
  Math.max(0, Math.round((y - geo.topOffset) / geo.minuteHeight));

export const snap = (min: number, snapMinutes: number) =>
  Math.round(min / snapMinutes) * snapMinutes;

export const snapTo = (min: number, step: number) => Math.round(min / step) * step;

// Interval merging for time range selections
export interface Range {
  start: Date;
  end: Date;
}

function cloneRange(r: Range): Range {
  return { start: new Date(r.start), end: new Date(r.end) };
}

export function mergeRanges(ranges: Range[], step: number = 5): Range[] {
  if (!ranges || ranges.length === 0) return [];

  const arr = ranges
    .filter(r => r && r.start <= r.end)
    .map(cloneRange)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const out: Range[] = [];
  let cur = arr[0];

  for (let i = 1; i < arr.length; i++) {
    const nxt = arr[i];
    // Merge if overlapping or touching (<= step minutes apart)
    const gapMin = (nxt.start.getTime() - cur.end.getTime()) / 60000;
    if (gapMin <= 0 || Math.abs(gapMin) <= step) {
      if (nxt.end > cur.end) cur.end = nxt.end;
    } else {
      out.push(cur);
      cur = nxt;
    }
  }
  out.push(cur);
  return out;
}

// Compute horizontal lanes for overlapping items (interval partitioning)
export function computePlacements(items: TimeItem[]): Record<string, ItemPlacement> {
  type Place = { id: string; startMin: number; endMin: number; lane: number };

  const sorted = items
    .map(it => ({
      id: it.id,
      startMin: minutes(toDate(it.start_time)),
      endMin: minutes(toDate(it.end_time))
    }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const active: Place[] = [];
  const placements: Record<string, ItemPlacement> = {};
  let clusterIds: string[] = [];
  let clusterMaxLane = -1;

  const finalizeCluster = () => {
    if (clusterIds.length === 0) return;
    const lanes = clusterMaxLane + 1;
    clusterIds.forEach(id => {
      placements[id] = { lane: (placements[id] as any).lane, lanes };
    });
    clusterIds = [];
    clusterMaxLane = -1;
  };

  const prune = (now: number) => {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= now) active.splice(i, 1);
    }
  };

  const smallestFreeLane = () => {
    const used = new Set(active.map(a => a.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    return lane;
  };

  for (const ev of sorted) {
    prune(ev.startMin);
    if (active.length === 0) finalizeCluster();
    const lane = smallestFreeLane();
    const p: Place = { id: ev.id, startMin: ev.startMin, endMin: ev.endMin, lane };
    active.push(p);
    (placements as any)[ev.id] = { lane };
    clusterIds.push(ev.id);
    clusterMaxLane = Math.max(clusterMaxLane, lane);
  }
  finalizeCluster();

  return placements;
}

// Merge maps function from demo
export function mergeMaps(base: Record<number, Range[]>, add: Record<number, Range[]>, step: number = 5): Record<number, Range[]> {
  const out: Record<number, Range[]> = { ...base };
  for (const [k, arr] of Object.entries(add)){
    const idx = Number(k);
    const combined = [ ...(out[idx]||[]), ...(arr||[]) ];
    out[idx] = mergeRanges(combined, step);
  }
  return out;
}

// Find day index for a given date
export function findDayIndexForDate(date: Date, days: Date[]): number {
  const t = startOfDay(date).getTime();
  return days.findIndex(d => startOfDay(d).getTime() === t);
}
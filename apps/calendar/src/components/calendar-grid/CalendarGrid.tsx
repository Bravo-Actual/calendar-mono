import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';

import type {
  TimeItem,
  CalendarGridProps,
  DragState,
  GeometryConfig,
} from './types';
import {
  createGeometry,
  minuteToY,
  yToMinute,
  snap,
  snapTo,
  toDate,
  minutes,
  fmtDay,
  startOfDay,
  addDays,
  addMinutes,
  mergeRanges,
  mergeMaps,
  findDayIndexForDate,
} from './utils';
import { DayColumn } from './DayColumn';
import { TimeGutter } from './TimeGutter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CalendarGrid<T extends TimeItem>({
  items: initialItems,
  days,
  pxPerHour = 64,
  snapMinutes = 15,
  gutterWidth = 80,
  onItemUpdate,
  onSelectionChange,
  renderItem,
  className = '',
  timeZones = [{ label: 'Local', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour12: true }],
  expandedDay = null,
  onExpandedDayChange,
}: CalendarGridProps<T>) {
  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Geometry configuration
  const geometry = useMemo(
    () =>
      createGeometry({
        minuteHeight: pxPerHour / 60,
        snapMinutes,
      }),
    [pxPerHour, snapMinutes]
  );

  // State
  const [items, setItems] = useState<T[]>(initialItems);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Record<string, { start: Date; end: Date }>>({});
  const [overlayItem, setOverlayItem] = useState<T | null>(null);

  // Lasso selection state from demo
  const [lasso, setLasso] = useState<null | {
    x0: number; y0: number; x1: number; y1: number;
    sx0: number; sx1: number; sy0: number; sy1: number;
    additive: boolean;
  }>(null);
  const [rubberPreviewByDay, setRubberPreviewByDay] = useState<Record<number, Array<{ start: Date; end: Date }>>>({});
  const [highlightsByDay, setHighlightsByDay] = useState<Record<number, Array<{ start: Date; end: Date }>>>({});

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);

  // Notify parent of selection changes only
  useEffect(() => {
    onSelectionChange?.(Array.from(selection));
  }, [selection, onSelectionChange]);

  // Column widths for expanded day view
  const columnPercents = useMemo(() => {
    const n = days.length;
    if (n === 0) return [] as number[];
    const weights = Array.from({ length: n }, (_, i) =>
      expandedDay === null ? 1 : i === expandedDay ? 4 : 0.8
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => (w / sum) * 100);
  }, [days, expandedDay]);

  // Filter items by day
  const itemsForDay = useCallback(
    (day: Date) => {
      const dayStart = startOfDay(day).getTime();
      return items.filter(it => {
        const itemStart = startOfDay(toDate(it.start_time)).getTime();
        return itemStart === dayStart;
      });
    },
    [items]
  );

  // Build per-day ghost lists from preview
  const ghostsByDay = useMemo(() => {
    const map: Record<number, Array<{ id: string; title: string; start: Date; end: Date; selected?: boolean }>> = {};
    for (const [id, range] of Object.entries(preview)) {
      const it = items.find(x => x.id === id);
      if (!it) continue;
      const idx = findDayIndexForDate(new Date(range.start), days);
      if (idx < 0) continue;
      (map[idx] ||= []).push({
        id,
        title: (it as any).title || (it as any).label || '(untitled)',
        start: new Date(range.start),
        end: new Date(range.end),
        selected: selection.has(id),
      });
    }
    return map;
  }, [preview, items, days, selection]);

  // Keyboard shortcuts
  const clearAllSelections = useCallback(() => {
    setSelection(new Set());
    setHighlightsByDay({});
    setRubberPreviewByDay({});
    setPreview({});
    setLasso(null);
    setOverlayItem(null);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const isTyping = !!(
        tgt &&
        (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)
      );
      if (isTyping) return;

      if (e.key === 'Escape') {
        clearAllSelections();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        // Select all items (cards) but clear time selections for clarity
        setHighlightsByDay({});
        setRubberPreviewByDay({});
        setLasso(null);
        setSelection(new Set(items.map(i => i.id)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, clearAllSelections]);

  // Selection handler
  const onSelectMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      const multi = e.ctrlKey || e.metaKey;
      setSelection(prev => {
        const next = new Set(prev);
        if (multi) {
          next.has(id) ? next.delete(id) : next.add(id);
        } else {
          next.clear();
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  // Drag handlers
  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);
      if (id.startsWith('resize:')) {
        const [, edge, itemId] = id.split(':');
        const anchor = items.find(i => i.id === itemId);
        const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time), days) : 0;
        dragRef.current = { kind: 'resize', edge: edge as 'start' | 'end', id: itemId, anchorDayIdx: idx };
        setOverlayItem(anchor ?? null);
      } else if (id.startsWith('move:')) {
        const itemId = id.split(':')[1];
        const anchor = items.find(i => i.id === itemId);
        const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time), days) : 0;
        dragRef.current = { kind: 'move', id: itemId, anchorDayIdx: idx };
        setOverlayItem(anchor ?? null);
      }
    },
    [items, days]
  );

  const onDragMove = useCallback(
    (e: DragMoveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      // Auto-scroll
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        const M = 48;
        const speed = 20;
        if (e.activatorEvent && 'clientY' in e.activatorEvent) {
          const y = (e.activatorEvent as any).clientY;
          if (y < r.top + M) containerRef.current.scrollTop -= speed;
          if (y > r.bottom - M) containerRef.current.scrollTop += speed;
        }
      }

      // Compute day offset via droppable id
      let dayOffset = 0;
      const overId = e.over?.id ? String(e.over.id) : null;
      if (overId && overId.startsWith('day-')) {
        const overIdx = parseInt(overId.split('-')[1], 10);
        dayOffset = overIdx - drag.anchorDayIdx;
      }

      // Pixel delta → minutes delta (snap)
      const deltaY = e.delta?.y ?? 0;
      const deltaMinutes = snap(Math.round(deltaY / geometry.minuteHeight), geometry.snapMinutes);
      const dayMinuteDelta = dayOffset * 1440;

      if (drag.kind === 'move') {
        const activeId = drag.id;
        const ids = selection.has(activeId) ? Array.from(selection) : [activeId];
        const p: Record<string, { start: Date; end: Date }> = {};
        ids.forEach(iid => {
          const it = items.find(x => x.id === iid);
          if (!it) return;
          p[iid] = {
            start: new Date(toDate(it.start_time).getTime() + (deltaMinutes + dayMinuteDelta) * 60000),
            end: new Date(toDate(it.end_time).getTime() + (deltaMinutes + dayMinuteDelta) * 60000),
          };
        });
        setPreview(p);
      } else {
        const it = items.find(x => x.id === drag.id);
        if (!it) return;
        const s = toDate(it.start_time);
        const en = toDate(it.end_time);
        if (drag.edge === 'start') {
          const nextStart = new Date(s.getTime() + deltaMinutes * 60000);
          if (nextStart < en) setPreview({ [it.id]: { start: nextStart, end: en } });
        } else {
          const nextEnd = new Date(en.getTime() + deltaMinutes * 60000);
          if (nextEnd > s) setPreview({ [it.id]: { start: s, end: nextEnd } });
        }
      }
    },
    [items, selection, geometry]
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) {
        setPreview({});
        setOverlayItem(null);
        return;
      }

      // Compute final day offset
      let dayOffset = 0;
      const overId = e.over?.id ? String(e.over.id) : null;
      if (overId && overId.startsWith('day-')) {
        const overIdx = parseInt(overId.split('-')[1], 10);
        dayOffset = overIdx - drag.anchorDayIdx;
      }

      const deltaY = e.delta?.y ?? 0;
      const deltaMinutes = snap(Math.round(deltaY / geometry.minuteHeight), geometry.snapMinutes);
      const dayMinuteDelta = dayOffset * 1440;

      if (drag.kind === 'move') {
        const activeId = drag.id;
        const ids = selection.has(activeId) ? Array.from(selection) : [activeId];

        // Direct state update like the demo
        setItems(prev => prev.map(it => ids.includes(it.id)
          ? {
              ...it,
              start_time: new Date(toDate(it.start_time).getTime() + (deltaMinutes + dayMinuteDelta) * 60000),
              end_time: new Date(toDate(it.end_time).getTime() + (deltaMinutes + dayMinuteDelta) * 60000)
            }
          : it
        ));
      } else {
        // Direct state update for resize
        setItems(prev => prev.map(it => {
          if (it.id !== drag.id) return it;
          const s = toDate(it.start_time);
          const en = toDate(it.end_time);
          if (drag.edge === 'start') {
            const ns = new Date(s.getTime() + deltaMinutes * 60000);
            return ns < en ? { ...it, start_time: ns } : it;
          } else {
            const ne = new Date(en.getTime() + deltaMinutes * 60000);
            return ne > s ? { ...it, end_time: ne } : it;
          }
        }));
      }

      setPreview({});
      setOverlayItem(null);
    },
    [items, selection, geometry]
  );

  // Lasso constants from demo
  const RUBBER_SNAP_MIN = 5; // lasso/time selection snaps in 5-minute increments

  // Lasso functions from demo
  function beginLasso(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.calendar-item')) return; // don't start on cards
    const additive = e.ctrlKey || e.metaKey;
    // Clear any selected event cards when starting a canvas drag without Ctrl/Cmd
    if (!additive) setSelection(new Set());
    const gr = gridRef.current!.getBoundingClientRect();
    const rx = e.clientX - gr.left;
    const ry = e.clientY - gr.top;
    // snap horizontal edges to the column we start in & compute vertical snap baseline
    let sx0 = rx, sx1 = rx, firstTop = 0;
    for (let idx = 0; idx < days.length; idx++) {
      const col = columnRefs.current[idx];
      if (!col) continue;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left;
      const right = cr.right - gr.left;
      if (rx >= left && rx <= right) {
        sx0 = left;
        sx1 = right;
        firstTop = cr.top - gr.top;
        break;
      }
    }
    // snap vertical start to 5-minute grid relative to first column's top
    const m0 = snapTo(yToMinute(ry - firstTop, geometry), RUBBER_SNAP_MIN);
    const sy = firstTop + minuteToY(m0, geometry);
    setLasso({ x0: rx, y0: ry, x1: rx, y1: ry, sx0, sx1, sy0: sy, sy1: sy, additive });
    setRubberPreviewByDay({});
  }

  function moveLasso(e: React.MouseEvent) {
    if (!lasso) return;
    const gr = gridRef.current!.getBoundingClientRect();
    const x1 = e.clientX - gr.left;
    const y1 = e.clientY - gr.top;
    // compute box extents
    const xlo = Math.min(lasso.x0, x1), xhi = Math.max(lasso.x0, x1);
    const ylo = Math.min(lasso.y0, y1), yhi = Math.max(lasso.y0, y1);

    // determine snapped left/right to column edges spanned by the box and the first-top for vertical snapping
    let snappedLeft = lasso.sx0, snappedRight = lasso.sx1;
    let any = false;
    let firstTop = 0;
    const raw: Record<number, Array<{ start: Date; end: Date }>> = {};
    days.forEach((day, idx) => {
      const col = columnRefs.current[idx];
      if (!col) return;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left, right = cr.right - gr.left;
      const top = cr.top - gr.top, bottom = cr.bottom - gr.top;
      const intersectX = !(xhi < left || xlo > right);
      const intersectY = !(yhi < top || ylo > bottom);
      if (!intersectX || !intersectY) return;
      if (!any) {
        snappedLeft = left;
        snappedRight = right;
        firstTop = top;
        any = true;
      } else {
        snappedLeft = Math.min(snappedLeft, left);
        snappedRight = Math.max(snappedRight, right);
      }
      // vertical snap for this column's preview band (5-minute increments)
      const y0 = Math.max(ylo, top), y1c = Math.min(yhi, bottom);
      const m0 = snapTo(yToMinute(y0 - top, geometry), RUBBER_SNAP_MIN);
      const m1 = snapTo(yToMinute(y1c - top, geometry), RUBBER_SNAP_MIN);
      const s = new Date(startOfDay(day));
      s.setMinutes(m0);
      const e2 = new Date(startOfDay(day));
      e2.setMinutes(Math.max(m1, m0 + RUBBER_SNAP_MIN));
      (raw[idx] ||= []).push({ start: s, end: e2 });
    });
    // Merge overlaps within the drag preview, and with existing highlights if additive
    const mergedPreview = lasso.additive
      ? mergeMaps(highlightsByDay, raw, RUBBER_SNAP_MIN)
      : Object.fromEntries(Object.entries(raw).map(([k, v]) => [Number(k), mergeRanges(v, RUBBER_SNAP_MIN)]));

    // compute snapped rectangle verticals using first intersected column's top; fallback to previous
    let sy0 = lasso.sy0;
    let sy1 = lasso.sy1;
    if (any) {
      const mTop = snapTo(yToMinute(Math.min(ylo, yhi) - firstTop, geometry), RUBBER_SNAP_MIN);
      const mBot = snapTo(yToMinute(Math.max(ylo, yhi) - firstTop, geometry), RUBBER_SNAP_MIN);
      sy0 = firstTop + minuteToY(mTop, geometry);
      sy1 = firstTop + minuteToY(mBot, geometry);
    }

    setLasso(ls => ls ? { ...ls, x1, y1, sx0: snappedLeft, sx1: snappedRight, sy0, sy1 } : ls);
    setRubberPreviewByDay(mergedPreview);
  }

  function endLasso() {
    if (!lasso) return;
    // commit merged preview (already merged live), but ensure a final merge just in case
    const merged = lasso.additive
      ? mergeMaps(highlightsByDay, rubberPreviewByDay, RUBBER_SNAP_MIN)
      : Object.fromEntries(Object.entries(rubberPreviewByDay).map(([k, v]) => [Number(k), mergeRanges(v, RUBBER_SNAP_MIN)]));

    setHighlightsByDay(merged);
    setRubberPreviewByDay({});
    setLasso(null);
  }

  // Per-day band toggle (Ctrl/Cmd-click to remove a single day)
  const eqRange = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
    a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();

  const onHighlightMouseDown = (dayIndex: number, r: { start: Date; end: Date }, e: React.MouseEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return; // only toggle on Ctrl/Cmd
    e.stopPropagation();
    setHighlightsByDay(prev => {
      const cur = prev[dayIndex] || [];
      const next = cur.filter(x => !eqRange(x, r));
      return { ...prev, [dayIndex]: next };
    });
  };

  const guttersWidth = timeZones.length * gutterWidth;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {fmtDay(days[0])} {days.length > 1 && `– ${fmtDay(days[days.length - 1])}`}
          </h2>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border bg-muted/30">
        {/* Time gutter spacer */}
        <div style={{ width: guttersWidth }} className="border-r border-border bg-muted/50" />

        {/* Day header buttons */}
        <div className="flex-1 flex">
          {days.map((d, i) => (
            <motion.div
              key={i}
              className="relative"
              animate={{ width: `${columnPercents[i] ?? 100 / days.length}%` }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              <Button
                variant="ghost"
                className="w-full h-12 rounded-none border-r border-border last:border-r-0 font-medium text-sm"
                onClick={() => onExpandedDayChange?.(expandedDay === i ? null : i)}
              >
                {fmtDay(d)}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
          <div
            className="flex"
            ref={gridRef}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('.calendar-item')) return;
              if (!(e.ctrlKey || e.metaKey)) setSelection(new Set());
              e.preventDefault();
              beginLasso(e);
            }}
            onMouseMove={moveLasso}
            onMouseUp={endLasso}
            style={{ userSelect: lasso ? 'none' : undefined }}
          >
            {/* Time gutters */}
            <div className="flex" style={{ width: guttersWidth }}>
              {timeZones.map((tz, i) => (
                <TimeGutter
                  key={i}
                  config={tz}
                  geometry={geometry}
                  width={gutterWidth}
                  className="border-r border-border bg-muted/50"
                />
              ))}
            </div>

            {/* Day columns container */}
            <div className="flex-1 flex relative">
              {days.map((day, i) => (
                <motion.div
                  key={i}
                  className="relative"
                  animate={{ width: `${columnPercents[i] ?? 100 / days.length}%` }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                >
                  <DayColumn
                    id={`day-${i}`}
                    dayStart={day}
                    dayIndex={i}
                    items={itemsForDay(day)}
                    selection={selection}
                    onSelectMouseDown={onSelectMouseDown}
                    setColumnRef={el => (columnRefs.current[i] = el)}
                    ghosts={ghostsByDay[i]}
                    highlights={highlightsByDay[i]}
                    rubber={rubberPreviewByDay[i]}
                    onHighlightMouseDown={onHighlightMouseDown}
                    renderItem={renderItem}
                    geometry={geometry}
                    className="border-r border-border last:border-r-0"
                  />
                </motion.div>
              ))}

              {/* Lasso rectangle */}
              {lasso && (
                <div
                  className="absolute bg-primary/10 border border-primary pointer-events-none z-0"
                  style={{
                    left: Math.min(lasso.sx0, lasso.sx1) - guttersWidth,
                    top: Math.min(lasso.sy0, lasso.sy1),
                    width: Math.abs(lasso.sx1 - lasso.sx0),
                    height: Math.abs(lasso.sy1 - lasso.sy0)
                  }}
                />
              )}
            </div>
          </div>

          {/* Global drag overlay */}
          <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
            {overlayItem ? (
              <div className="absolute rounded-md shadow-lg bg-card border ring-2 ring-ring/50 ring-offset-2 ring-offset-background">
                <div className="p-2 text-sm">
                  <div className="font-medium truncate">
                    {(overlayItem as any).title || (overlayItem as any).label || '(untitled)'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Dragging...
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
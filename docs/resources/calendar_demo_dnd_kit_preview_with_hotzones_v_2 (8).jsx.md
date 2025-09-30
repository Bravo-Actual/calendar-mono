import React, {useEffect, useMemo, useRef, useState} from "react";
import { motion } from "framer-motion";
import {DndContext, PointerSensor, KeyboardSensor, useSensors, useSensor, DragStartEvent, DragMoveEvent, DragEndEvent, useDroppable, useDraggable, DragOverlay} from "@dnd-kit/core";

// ==========================================================
// Utilities
// ==========================================================
const startOfDay = (d: Date)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d: Date,n:number)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const addMinutes = (d: Date,m:number)=> new Date(d.getTime()+m*60000);
const minutes = (d: Date)=> d.getHours()*60 + d.getMinutes();
const fmtTime = (t: Date|string|number)=> new Date(t).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
const fmtDay = (d: Date)=> d.toLocaleDateString([], {weekday:"short", month:"short", day:"numeric"});

// ==========================================================
// Generic Time Item Model
// ==========================================================
export type TimeLike = Date | string | number;
export interface TimeItemBase { id: string; start_time: TimeLike; end_time: TimeLike; }
export type ItemKind = 'event' | 'task';
export type TimeItem = TimeItemBase & { kind: ItemKind; title?: string; label?: string };

const toDate   = (t: TimeLike)=> new Date(t);
const getTitle = (it: TimeItem)=> it.title ?? it.label ?? "(untitled)";

// ==========================================================
// Interval merge utilities for per-day rubber ranges
// ==========================================================
type Range = { start: Date; end: Date };
function cloneRange(r: Range): Range { return { start: new Date(r.start), end: new Date(r.end) }; }
const RUBBER_SNAP_MIN = 5; // lasso/time selection snaps in 5-minute increments
function mergeRanges(ranges: Range[], step: number = RUBBER_SNAP_MIN): Range[] {
  if (!ranges || ranges.length === 0) return [];
  const arr = ranges
    .filter(r => r && r.start <= r.end)
    .map(cloneRange)
    .sort((a,b)=> a.start.getTime() - b.start.getTime());
  const out: Range[] = [];
  let cur = arr[0];
  for (let i=1;i<arr.length;i++){
    const nxt = arr[i];
    // Merge if overlapping or touching (<= step minutes apart)
    const gapMin = (nxt.start.getTime() - cur.end.getTime()) / 60000;
    if (gapMin <= 0 || Math.abs(gapMin) <= step){
      if (nxt.end > cur.end) cur.end = nxt.end;
    } else {
      out.push(cur); cur = nxt;
    }
  }
  out.push(cur);
  return out;
}
function mergeMaps(base: Record<number, Range[]>, add: Record<number, Range[]>, step: number = RUBBER_SNAP_MIN): Record<number, Range[]> {
  const out: Record<number, Range[]> = { ...base };
  for (const [k, arr] of Object.entries(add)){
    const idx = Number(k);
    const combined = [ ...(out[idx]||[]), ...(arr||[]) ];
    out[idx] = mergeRanges(combined, step);
  }
  return out;
}

// ==========================================================
// Geometry (match to your CSS)
// ==========================================================
const GEO = { minuteHeight: 1.5, topOffset: 8, snapMinutes: 15 } as const;
const minuteToY = (min:number)=> GEO.topOffset + min * GEO.minuteHeight;
const yToMinute = (y:number)=> Math.max(0, Math.round((y - GEO.topOffset) / GEO.minuteHeight));
const snap = (min:number)=> Math.round(min / GEO.snapMinutes) * GEO.snapMinutes;
const snapTo = (min:number, step:number)=> Math.round(min / step) * step;

// ==========================================================
// Time gutters with time zone support (multiple columns)
// ==========================================================
const GUTTER_W = 56; // px per timezone column
function TimeGutter({label, timeZone, hour12}:{label:string; timeZone:string; hour12:boolean}){
  const base = startOfDay(new Date());
  const fmt = (h:number)=> new Intl.DateTimeFormat('en-US', { hour:'2-digit', minute:'2-digit', hour12, timeZone }).format(addMinutes(base, h*60));
  return (
    <div className="relative border-r border-white/10 shrink-0" style={{width: GUTTER_W, height: minuteToY(24*60)}}>
      {Array.from({length:24}).map((_,h)=> (
        <div key={h} className="absolute right-1 text-[10px] text-white/70 select-none"
             style={{top: minuteToY(h*60)-6}}>{fmt(h)}</div>
      ))}
    </div>
  );
}

// ==========================================================
// Default Renderers (EventCard + TaskChip) and ItemHost
// ==========================================================
function ResizeHandle({id, edge}:{id:string; edge:"start"|"end"}){
  const {attributes, listeners, setNodeRef} = useDraggable({ id: `resize:${edge}:${id}`, data: { kind: "resize", edge, id }});
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
         className={`absolute left-0 right-0 h-1 cursor-ns-resize ${edge==='start'?'top-0':'bottom-0'}`} />
  );
}

// Render args now include horizontal placement (overlap lanes)
type RenderItemArgs = { item: TimeItem; layout: {top:number;height:number; leftPct:number; widthPct:number}; selected: boolean; onMouseDownSelect:(e:React.MouseEvent,id:string)=>void; drag:{move:any} };
export type RenderItem = (args: RenderItemArgs) => React.ReactNode;

function DefaultEventCard({item, top, height, selected, onMouseDownSelect, drag, leftPct, widthPct}:
  { item: TimeItem; top:number; height:number; selected:boolean; onMouseDownSelect:(e:React.MouseEvent,id:string)=>void; drag:{move:any}; leftPct:number; widthPct:number }){
  return (
    <div ref={drag.move.setNodeRef} {...drag.move.attributes} {...drag.move.listeners}
         onMouseDown={(e)=>{ e.stopPropagation(); onMouseDownSelect(e,item.id); }}
         className={`absolute rounded-md shadow-sm calendar-item event-card z-20 ${selected?"ring-2 ring-blue-500":""}`}
         style={{top, height, left: `${leftPct}%`, width: `${widthPct}%`, background:"#1f2937", color:"white"}}>
      <ResizeHandle id={item.id} edge="start" />
      <div className="p-1 text-xs select-none">
        <div className="font-semibold truncate">{getTitle(item)}</div>
        <div className="opacity-80">{fmtTime(item.start_time)} – {fmtTime(item.end_time)}</div>
      </div>
      <ResizeHandle id={item.id} edge="end" />
    </div>
  );
}

function DefaultTaskChip({item, top, height, selected, onMouseDownSelect, drag, leftPct, widthPct}:
  { item: TimeItem; top:number; height:number; selected:boolean; onMouseDownSelect:(e:React.MouseEvent,id:string)=>void; drag:{move:any}; leftPct:number; widthPct:number }){
  return (
    <div ref={drag.move.setNodeRef} {...drag.move.attributes} {...drag.move.listeners}
         onMouseDown={(e)=>{ e.stopPropagation(); onMouseDownSelect(e,item.id); }}
         className={`absolute rounded-full border border-emerald-400/60 bg-emerald-500/15 backdrop-blur-sm calendar-item z-20 ${selected?"ring-2 ring-emerald-400":""}`}
         style={{top, left: `${leftPct}%`, width: `${widthPct}%`, height: Math.max(18, height), display:'flex', alignItems:'center', padding:'0 6px'}}>
      <div className="text-[11px] text-emerald-200 truncate select-none">✓ {getTitle(item)} <span className="opacity-70">({fmtTime(item.start_time)})</span></div>
      {/* keep compact: only end handle */}
      <ResizeHandle id={item.id} edge="end" />
    </div>
  );
}

function ItemHost({item, layout, selected, onMouseDownSelect, renderItem}:{item: TimeItem; layout:{top:number;height:number; leftPct:number; widthPct:number}; selected:boolean; onMouseDownSelect:(e:React.MouseEvent,id:string)=>void; renderItem?: RenderItem}){
  const move = useDraggable({ id: `move:${item.id}`, data: { kind: 'move', id: item.id } });
  const drag = { move };
  if (renderItem) return <>{renderItem({ item, layout, selected, onMouseDownSelect, drag })}</>;
  if (item.kind === 'task') return <DefaultTaskChip item={item} top={layout.top} height={layout.height} leftPct={layout.leftPct} widthPct={layout.widthPct} selected={selected} onMouseDownSelect={onMouseDownSelect} drag={drag} />;
  return <DefaultEventCard item={item} top={layout.top} height={layout.height} leftPct={layout.leftPct} widthPct={layout.widthPct} selected={selected} onMouseDownSelect={onMouseDownSelect} drag={drag} />;
}

// Helper: compute horizontal lanes for overlapping items (interval partitioning)
function computePlacements(items: TimeItem[]): Record<string, { lane:number; lanes:number }> {
  type Place = { id:string; startMin:number; endMin:number; lane:number };
  const sorted = items
    .map(it=>({ id: it.id, startMin: minutes(toDate(it.start_time)), endMin: minutes(toDate(it.end_time)) }))
    .sort((a,b)=> a.startMin - b.startMin || a.endMin - b.endMin);
  const active: Place[] = [];
  const placements: Record<string, { lane:number; lanes:number }> = {};
  let clusterIds: string[] = [];
  let clusterMaxLane = -1;
  const finalizeCluster = () => {
    if (clusterIds.length === 0) return;
    const lanes = clusterMaxLane + 1;
    clusterIds.forEach(id => { placements[id] = { lane: (placements[id] as any).lane, lanes }; });
    clusterIds = []; clusterMaxLane = -1;
  };
  const prune = (now:number) => {
    for(let i=active.length-1;i>=0;i--){ if(active[i].endMin <= now) active.splice(i,1); }
  };
  const smallestFreeLane = () => {
    const used = new Set(active.map(a=>a.lane));
    let lane = 0; while(used.has(lane)) lane++; return lane;
  };
  for (const ev of sorted){
    prune(ev.startMin);
    if (active.length===0) finalizeCluster();
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

// ==========================================================
// Day column (droppable host)
// ==========================================================
function DayColumn({id, dayStart, dayIndex, items, selection, onSelectMouseDown, highlights, setColumnRef, ghosts, rubber, onHighlightMouseDown, renderItem}:
  { id:string; dayStart:Date; dayIndex:number; items:TimeItem[]; selection:Set<string>; onSelectMouseDown:(e:React.MouseEvent,id:string)=>void; highlights?: Array<{start:Date; end:Date}>; setColumnRef?: (el:HTMLDivElement|null)=>void; ghosts?: Array<{id:string; title:string; start:Date; end:Date; selected?: boolean}>; rubber?: Array<{start:Date; end:Date}>; onHighlightMouseDown?: (dayIndex:number, r:{start:Date; end:Date}, e:React.MouseEvent)=>void; renderItem?: RenderItem; }){
  const {setNodeRef} = useDroppable({ id, data: { dayStart, geometry: GEO } });
  // placements for this single day's items
  const placements = useMemo(()=> computePlacements(items), [items]);
  return (
    <div ref={(el)=>{ setNodeRef(el); setColumnRef?.(el); }}
         className="relative border-l bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(8px),rgba(255,255,255,0.06)_calc(8px),rgba(255,255,255,0.06)_calc(9px))] bg-[length:1px_90px]" style={{height: minuteToY(24*60)}}>
      {/* real items stay put during drag */}
      {items.map(item=>{ const s=toDate(item.start_time); const e=toDate(item.end_time);
        const top=minuteToY(minutes(s)); const height=Math.max(8, minuteToY(minutes(e)) - top);
        const plc = placements[item.id] || { lane:0, lanes:1 };
        const leftPct = (plc.lane / plc.lanes) * 100; const widthPct = (1 / plc.lanes) * 100;
        return (
          <ItemHost key={item.id}
            item={item}
            layout={{top, height, leftPct, widthPct}}
            selected={selection.has(item.id)}
            onMouseDownSelect={onSelectMouseDown}
            renderItem={renderItem}
          />
        );
      })}
      {/* ghost previews follow cursor (non-interactive) */}
      {ghosts?.map(g=>{ const top=minuteToY(minutes(g.start)); const height=Math.max(8, minuteToY(minutes(g.end))-top); return (
        <div key={`ghost-${g.id}`} className={`absolute left-1 right-1 rounded-md pointer-events-none z-30 ${g.selected? 'ring-2 ring-blue-400/70' : ''}`}
             style={{top, height, background:'transparent', outline:'2px dashed rgba(59,130,246,0.6)', outlineOffset:'-2px'}}>
          <div className="absolute inset-0 bg-blue-400/10" />
          <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[10px] text-blue-200/90 bg-blue-900/40 backdrop-blur-sm">{g.title} • {fmtTime(g.start)} – {fmtTime(g.end)}</div>
        </div>
      );})}
      {/* live lasso preview (snapped), per-day */}
      {rubber?.map((r,idx)=>{ const top=minuteToY(minutes(r.start)); const h=Math.max(6, minuteToY(minutes(r.end))-top); return (
        <div key={`rub-${idx}`} className="absolute left-0 right-0 bg-sky-400/20 border-y-2 border-dashed border-sky-400 z-0" style={{top, height:h}}/>
      );})}
      {/* persisted range highlights */}
      {highlights?.map((r,idx)=>{ const top=minuteToY(minutes(r.start)); const h=Math.max(6, minuteToY(minutes(r.end))-top); return (
        <div key={idx}
             className="absolute left-0 right-0 bg-blue-500/10 border-y-2 border-blue-400 cursor-pointer z-10"
             style={{top, height:h}}
             onMouseDown={(e)=> onHighlightMouseDown?.(dayIndex, r, e)}
        />
      );})}
    </div>
  );
}

// ==========================================================
// Main host with: dnd-kit move+resize, auto-scroll, RANGE hotzones, cross-day rubber
// ==========================================================
export default function CalendarDemo(){
  const sensors = useSensors(
    // Drag starts only after the pointer travels a small distance; no press delay.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // --- Range-paging model (consecutive by default; swap pager for non-consecutive) ---
  const pager = {
    next(days: Date[]) { if (!days.length) return days; const len=days.length; const anchor=startOfDay(days[0]); return Array.from({length:len}).map((_,i)=> addDays(anchor, len+i)); },
    prev(days: Date[]) { if (!days.length) return days; const len=days.length; const anchor=startOfDay(days[0]); return Array.from({length:len}).map((_,i)=> addDays(anchor, -len+i)); }
  };

  const [days, setDays] = useState<Date[]>(()=> { const a=startOfDay(new Date()); const len=7; return Array.from({length:len}).map((_,i)=> addDays(a,i)); });
  const dayStarts = days;

  // Timezone columns (demo). Label can be any 3-char tag; timeZone is IANA; hour12 controls 12/24h per column.
  const [tzColumns] = useState<Array<{label:string; timeZone:string; hour12:boolean}>>([
    { label: 'PST', timeZone: 'America/Los_Angeles', hour12: true },
    { label: 'HST', timeZone: 'Pacific/Honolulu', hour12: true },
  ]);
  const GUTTERS_W = tzColumns.length * GUTTER_W;

  // Expanded day UX (click header to expand/squish others)
  const [expandedDay, setExpandedDay] = useState<number|null>(null);
  const columnPercents = useMemo(()=>{
    const n = dayStarts.length; if (n===0) return [] as number[];
    const weights = Array.from({length:n}, (_,i)=> expandedDay===null ? 1 : (i===expandedDay ? 4 : 0.8));
    const sum = weights.reduce((a,b)=>a+b,0);
    return weights.map(w=> (w/sum)*100);
  },[dayStarts, expandedDay]);

  // demo items across multiple days, heterogeneous kinds
  const [items, setItems] = useState<TimeItem[]>(()=>{
    const make = (d: Date, h1:number,m1:number,h2:number,m2:number, id:string, title:string): TimeItem => ({ id, kind:'event', title, start_time:addMinutes(startOfDay(d), h1*60+m1), end_time:addMinutes(startOfDay(d), h2*60+m2) });
    const makeTask = (d: Date, h:number,m:number, id:string, label:string): TimeItem => ({ id, kind:'task', label, start_time:addMinutes(startOfDay(d), h*60+m), end_time:addMinutes(startOfDay(d), h*60+m+15) });
    return [
      make(days[0],9,30,10,30,'a','Design review'),
      make(days[0],9,45,11,0,'a2','Parallel planning'), // overlaps with 'a'
      make(days[0],13,0,14,15,'b','1:1'),
      make(days[1],11,0,12,0,'c','Docs pass'),
      make(days[3],15,0,16,0,'d','Interview'),
      make(days[6],8,0,9,0,'e','Standup'),
      makeTask(days[2],10,0,'t1','Ship PR #8123')
    ];
  });

  const [selection, setSelection]=useState<Set<string>>(new Set());
  const [preview, setPreview]=useState<Record<string,{start:Date; end:Date}>>({});

  // build per-day ghost lists from preview so real items don't move; ghosts do
  const ghostsByDay = useMemo(()=>{
    const map: Record<number, Array<{id:string; title:string; start:Date; end:Date; selected?: boolean}>> = {};
    for (const [id, range] of Object.entries(preview)){
      const it = items.find(x=> x.id === id); if (!it) continue;
      const idx = findDayIndexForDate(new Date(range.start)); if (idx < 0) continue;
      (map[idx] ||= []).push({ id, title: getTitle(it), start: new Date(range.start), end: new Date(range.end), selected: selection.has(id) });
    }
    return map;
  }, [preview, items, dayStarts, selection]);

  // rubber highlights persisted (ctrl+drag adds)
  const [highlightsByDay, setHighlightsByDay] = useState<Record<number, Array<{start:Date; end:Date}>>>({});

  const containerRef = useRef<HTMLDivElement|null>(null);
  const gridRef = useRef<HTMLDivElement|null>(null);
  const columnRefs = useRef<Array<HTMLDivElement|null>>([]);
  const hotzoneCooldown = useRef(0);
  const [overlayItem, setOverlayItem] = useState<TimeItem | null>(null);

  // keyboard: Esc/SelectAll
  const clearAllSelections = () => {
    setSelection(new Set());
    setHighlightsByDay({});
    setRubberPreviewByDay({});
    setPreview({});
    setLasso(null);
    setOverlayItem(null);
    dragRef.current = null;
  };

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const tgt = e.target as HTMLElement | null;
      const isTyping = !!tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
      if (isTyping) return;

      if(e.key==='Escape'){
        // Cancel any in-progress lasso/drag and clear ALL selections (time + items)
        clearAllSelections();
      }
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='a'){
        e.preventDefault();
        // Select all items (cards) but clear time selections for clarity
        setHighlightsByDay({});
        setRubberPreviewByDay({});
        setLasso(null);
        setSelection(new Set(items.map(i=>i.id)));
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[items]);

  const onSelectMouseDown=(e:React.MouseEvent,id:string)=>{
    const multi = e.ctrlKey || e.metaKey;
    // If clicking a card WITHOUT Ctrl/Cmd: clear all time selections and other card selections
    if (!multi){
      setHighlightsByDay({});
      setRubberPreviewByDay({});
      setLasso(null);
    }
    setSelection(prev=>{
      const next = new Set(prev);
      if (multi){ next.has(id) ? next.delete(id) : next.add(id); }
      else { next.clear(); next.add(id); }
      return next;
    });
  };

  const itemsForDay=(day:Date)=> items.filter(it=> startOfDay(toDate(it.start_time)).getTime()===startOfDay(day).getTime());

  // ---------------- dnd state ----------------
  const dragRef = useRef<{kind:'move'|'resize'; edge?:'start'|'end'; id:string; anchorDayIdx:number} | null>(null);

  function findDayIndexForDate(date: Date){
    const t = startOfDay(date).getTime();
    return dayStarts.findIndex(d=> startOfDay(d).getTime()===t);
  }

  function onDragStart(e:DragStartEvent){
    const id = String(e.active.id);
    if (id.startsWith('resize:')){
      const [, edge, itemId] = id.split(':');
      const anchor = items.find(i=> i.id===itemId);
      const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time)) : 0;
      dragRef.current = { kind:'resize', edge: edge as 'start'|'end', id: itemId, anchorDayIdx: idx };
      setOverlayItem(anchor ?? null);
    } else if (id.startsWith('move:')){
      const itemId = id.split(':')[1];
      const anchor = items.find(i=> i.id===itemId);
      const idx = anchor ? findDayIndexForDate(toDate(anchor.start_time)) : 0;
      dragRef.current = { kind:'move', id: itemId, anchorDayIdx: idx } as any;
      setOverlayItem(anchor ?? null);
    }
  }

  function onDragMove(e:DragMoveEvent){
    const drag = dragRef.current; if (!drag) return;
    // --- Autoscroll + RANGE hotzones ---
    if (containerRef.current){
      const r=containerRef.current.getBoundingClientRect(); const M=48, speed=20;
      if(e.activatorEvent && 'clientY' in e.activatorEvent){
        const y = (e.activatorEvent as any).clientY;
        if (y < r.top+M) containerRef.current.scrollTop -= speed;
        if (y > r.bottom-M) containerRef.current.scrollTop += speed;
        const now=Date.now(); const threshold=Math.max(16, r.width*0.02); const x=(e.activatorEvent as any).clientX;
        if(now>hotzoneCooldown.current+400){
          if(x <= r.left+threshold){ setDays(prev => pager.prev(prev)); hotzoneCooldown.current=now; }
          else if(x >= r.right-threshold){ setDays(prev => pager.next(prev)); hotzoneCooldown.current=now; }
        }
      }
    }

    // --- Compute day offset via droppable id ---
    let dayOffset = 0;
    const overId = e.over?.id ? String(e.over.id) : null;
    if (overId && overId.startsWith('day-')){
      const overIdx = parseInt(overId.split('-')[1],10);
      dayOffset = overIdx - drag.anchorDayIdx;
    }

    // Pixel delta → minutes delta (snap)
    const deltaY = (e.delta?.y ?? 0);
    const deltaMinutes = snap(Math.round(deltaY / GEO.minuteHeight));
    const dayMinuteDelta = dayOffset * 1440;

    if (drag.kind === 'move'){
      const activeId = drag.id; const ids = selection.has(activeId) ? Array.from(selection) : [activeId];
      const p: Record<string,{start:Date; end:Date}> = {};
      ids.forEach(iid=>{
        const it = items.find(x=>x.id===iid); if (!it) return;
        p[iid] = { start: addMinutes(toDate(it.start_time), deltaMinutes + dayMinuteDelta), end: addMinutes(toDate(it.end_time), deltaMinutes + dayMinuteDelta) };
      });
      setPreview(p);
    } else {
      const it = items.find(x=>x.id===drag.id); if (!it) return;
      const s = toDate(it.start_time), en = toDate(it.end_time);
      if (drag.edge==='start'){
        const nextStart = addMinutes(s, deltaMinutes);
        if (nextStart < en) setPreview({ [it.id]: { start: nextStart, end: en } });
      } else {
        const nextEnd = addMinutes(en, deltaMinutes);
        if (nextEnd > s) setPreview({ [it.id]: { start: s, end: nextEnd } });
      }
    }
  }

  function onDragEnd(e:DragEndEvent){
    const drag = dragRef.current; dragRef.current = null;
    if (!drag){ setPreview({}); setOverlayItem(null); return; }

    // Compute final day offset
    let dayOffset = 0;
    const overId = e.over?.id ? String(e.over.id) : null;
    if (overId && overId.startsWith('day-')){
      const overIdx = parseInt(overId.split('-')[1],10);
      dayOffset = overIdx - drag.anchorDayIdx;
    }

    const deltaY = (e.delta?.y ?? 0);
    const deltaMinutes = snap(Math.round(deltaY / GEO.minuteHeight));
    const dayMinuteDelta = dayOffset * 1440;

    if (drag.kind==='move'){
      const activeId = drag.id; const ids = selection.has(activeId) ? Array.from(selection) : [activeId];
      setItems(prev => prev.map(it => ids.includes(it.id)
        ? ({...it, start_time: addMinutes(toDate(it.start_time), deltaMinutes + dayMinuteDelta), end_time: addMinutes(toDate(it.end_time), deltaMinutes + dayMinuteDelta)})
        : it));
    } else {
      setItems(prev => prev.map(it => {
        if (it.id !== drag.id) return it;
        const s = toDate(it.start_time), en = toDate(it.end_time);
        if (drag.edge==='start'){
          const ns = addMinutes(s, deltaMinutes);
          return ns < en ? {...it, start_time: ns} : it;
        } else {
          const ne = addMinutes(en, deltaMinutes);
          return ne > s ? {...it, end_time: ne} : it;
        }
      }));
    }
    setPreview({});
    setOverlayItem(null);
  }

  // ---------------- Cross-day rubber selection on the whole grid ----------------
  const [lasso, setLasso] = useState<null | {x0:number;y0:number;x1:number;y1:number;sx0:number;sx1:number;sy0:number;sy1:number; additive:boolean}>(null);
  // live snapped (per-day) preview while dragging
  const [rubberPreviewByDay, setRubberPreviewByDay] = useState<Record<number, Array<{start:Date; end:Date}>>>({});

  function beginLasso(e: React.MouseEvent){
    if ((e.target as HTMLElement).closest('.calendar-item')) return; // don't start on cards
    const additive = e.ctrlKey || e.metaKey;
    // Clear any selected event cards when starting a canvas drag without Ctrl/Cmd
    if (!additive) setSelection(new Set());
    const gr = gridRef.current!.getBoundingClientRect();
    const rx = e.clientX - gr.left; const ry = e.clientY - gr.top;
    // snap horizontal edges to the column we start in & compute vertical snap baseline
    let sx0 = rx, sx1 = rx, firstTop = 0;
    for (let idx=0; idx<dayStarts.length; idx++){
      const col = columnRefs.current[idx]; if (!col) continue;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left; const right = cr.right - gr.left;
      if (rx >= left && rx <= right){ sx0 = left; sx1 = right; firstTop = cr.top - gr.top; break; }
    }
    // snap vertical start to 5-minute grid relative to first column's top
    const m0 = snapTo(yToMinute(ry - firstTop), RUBBER_SNAP_MIN);
    const sy = firstTop + minuteToY(m0);
    setLasso({ x0: rx, y0: ry, x1: rx, y1: ry, sx0, sx1, sy0: sy, sy1: sy, additive });
    setRubberPreviewByDay({});
  }
  function moveLasso(e: React.MouseEvent){
    if (!lasso) return;
    const gr = gridRef.current!.getBoundingClientRect();
    const x1 = e.clientX - gr.left; const y1 = e.clientY - gr.top;
    // compute box extents
    const xlo = Math.min(lasso.x0, x1), xhi = Math.max(lasso.x0, x1);
    const ylo = Math.min(lasso.y0, y1), yhi = Math.max(lasso.y0, y1);

    // determine snapped left/right to column edges spanned by the box and the first-top for vertical snapping
    let snappedLeft = lasso.sx0, snappedRight = lasso.sx1;
    let any = false; let firstTop = 0;
    const raw: Record<number, Array<{start:Date; end:Date}>> = {};
    dayStarts.forEach((day, idx) => {
      const col = columnRefs.current[idx]; if (!col) return;
      const cr = col.getBoundingClientRect();
      const left = cr.left - gr.left, right = cr.right - gr.left;
      const top = cr.top - gr.top, bottom = cr.bottom - gr.top;
      const intersectX = !(xhi < left || xlo > right);
      const intersectY = !(yhi < top || ylo > bottom);
      if (!intersectX || !intersectY) return;
      if (!any){ snappedLeft = left; snappedRight = right; firstTop = top; any = true; }
      else { snappedLeft = Math.min(snappedLeft, left); snappedRight = Math.max(snappedRight, right); }
      // vertical snap for this column's preview band (5-minute increments)
      const y0 = Math.max(ylo, top), y1c = Math.min(yhi, bottom);
      const m0 = snapTo(yToMinute(y0 - top), RUBBER_SNAP_MIN);
      const m1 = snapTo(yToMinute(y1c - top), RUBBER_SNAP_MIN);
      const s = new Date(startOfDay(day)); s.setMinutes(m0);
      const e2 = new Date(startOfDay(day)); e2.setMinutes(Math.max(m1, m0 + RUBBER_SNAP_MIN));
      (raw[idx] ||= []).push({ start: s, end: e2 });
    });
    // Merge overlaps within the drag preview, and with existing highlights if additive
    const mergedPreview = lasso.additive ? mergeMaps(highlightsByDay, raw, RUBBER_SNAP_MIN)
                                         : Object.fromEntries(Object.entries(raw).map(([k, v])=> [Number(k), mergeRanges(v, RUBBER_SNAP_MIN)]));

    // compute snapped rectangle verticals using first intersected column's top; fallback to previous
    let sy0 = lasso.sy0; let sy1 = lasso.sy1;
    if (any){
      const mTop = snapTo(yToMinute(Math.min(ylo, yhi) - firstTop), RUBBER_SNAP_MIN);
      const mBot = snapTo(yToMinute(Math.max(ylo, yhi) - firstTop), RUBBER_SNAP_MIN);
      sy0 = firstTop + minuteToY(mTop);
      sy1 = firstTop + minuteToY(mBot);
    }

    setLasso(ls => ls ? { ...ls, x1, y1, sx0: snappedLeft, sx1: snappedRight, sy0, sy1 } : ls);
    setRubberPreviewByDay(mergedPreview);
  }
  function endLasso(){
    if (!lasso) return;
    // commit merged preview (already merged live), but ensure a final merge just in case
    let merged = lasso.additive ? mergeMaps(highlightsByDay, rubberPreviewByDay, RUBBER_SNAP_MIN)
                                : Object.fromEntries(Object.entries(rubberPreviewByDay).map(([k,v])=> [Number(k), mergeRanges(v, RUBBER_SNAP_MIN)]));

    setHighlightsByDay(merged);
    setRubberPreviewByDay({});
    setLasso(null);
  }

  // --------- Per-day band toggle (Ctrl/Cmd-click to remove a single day) ---------
  const eqRange = (a:{start:Date; end:Date}, b:{start:Date; end:Date})=> a.start.getTime()===b.start.getTime() && a.end.getTime()===b.end.getTime();
  const onHighlightMouseDown = (dayIndex:number, r:{start:Date; end:Date}, e:React.MouseEvent)=>{
    if (!(e.ctrlKey || e.metaKey)) return; // only toggle on Ctrl/Cmd
    e.stopPropagation();
    setHighlightsByDay(prev => {
      const cur = prev[dayIndex] || [];
      const next = cur.filter(x => !eqRange(x, r));
      return { ...prev, [dayIndex]: next };
    });
  };

  return (
    <div className="w-full h-[720px] overflow-auto overflow-x-hidden bg-gray-900 text-white rounded-xl shadow-inner" ref={containerRef} style={{ userSelect: lasso ? 'none' : undefined }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-800/80 backdrop-blur border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Range: {fmtDay(dayStarts[0])} → {fmtDay(dayStarts[dayStarts.length-1])}</div>
          <div className="flex items-center gap-2 text-xs">
            <button className="px-2 py-1 bg-gray-700 rounded" onClick={()=> setDays(prev => pager.prev(prev))}>Prev</button>
            <button className="px-2 py-1 bg-gray-700 rounded" onClick={()=> setDays(()=> Array.from({length: dayStarts.length}).map((_,i)=> addDays(startOfDay(new Date()), i)))}>Today</button>
            <button className="px-2 py-1 bg-gray-700 rounded" onClick={()=> setDays(prev => pager.next(prev))}>Next</button>
          </div>
        </div>
        {/* Header row: timezone labels + animated day headers */}
        <div className="flex items-stretch mt-1 select-none">
          {/* Timezone labels block */}
          <div className="flex" style={{width: GUTTERS_W}}>
            {tzColumns.map((tz, i)=> (
              <div key={i} className="flex items-center justify-center text-[11px] text-white/80 tracking-wide border-r border-white/10" style={{width: GUTTER_W}}>
                {tz.label}
              </div>
            ))}
          </div>
          {/* Day header buttons */}
          <div className="flex-1 flex gap-[1px]">
            {dayStarts.map((d,i)=> (
              <motion.button key={i}
                onClick={()=> setExpandedDay(cur=> cur===i ? null : i)}
                className={`text-center text-xs py-1 text-white/80 bg-transparent hover:bg-white/5 rounded-sm`}
                style={{border: '1px solid rgba(255,255,255,0.08)'}}
                animate={{ width: `${columnPercents[i] ?? (100/dayStarts.length)}%` }}
                transition={{ type:'spring', stiffness:260, damping:26 }}
              >{fmtDay(d)}</motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
        {/* Body row: timezone gutters + animated day columns */}
        <div className="relative flex" ref={gridRef as any} onMouseDown={(e)=>{ if((e.target as HTMLElement).closest('.calendar-item')) return; if(!(e.ctrlKey||e.metaKey)) setSelection(new Set()); e.preventDefault(); beginLasso(e); }} onMouseMove={moveLasso} onMouseUp={endLasso}>
          {/* Time gutters (multiple time zones) */}
          <div className="flex" style={{width: GUTTERS_W}}>
            {tzColumns.map((tz, i)=> (
              <TimeGutter key={i} label={tz.label} timeZone={tz.timeZone} hour12={tz.hour12} />
            ))}
          </div>
          {/* Day columns container */}
          <div className="flex-1 flex gap-[1px] relative">
            {dayStarts.map((day,i)=> (
              <motion.div key={i}
                className="relative"
                animate={{ width: `${columnPercents[i] ?? (100/dayStarts.length)}%` }}
                transition={{ type:'spring', stiffness:260, damping:26 }}
              >
                <DayColumn id={`day-${i}`} dayStart={day} dayIndex={i}
                  items={itemsForDay(day)} selection={selection}
                  onSelectMouseDown={onSelectMouseDown}
                  highlights={highlightsByDay[i]}
                  setColumnRef={(el)=> (columnRefs.current[i]=el)}
                  ghosts={ghostsByDay[i]}
                  rubber={rubberPreviewByDay[i]}
                  onHighlightMouseDown={onHighlightMouseDown}
                  renderItem={({item, layout, selected, onMouseDownSelect, drag})=>{
                    if (item.kind === 'task') return (
                      <DefaultTaskChip item={item} top={layout.top} height={layout.height} leftPct={layout.leftPct} widthPct={layout.widthPct} selected={selected} onMouseDownSelect={onMouseDownSelect} drag={drag} />
                    );
                    return (
                      <DefaultEventCard item={item} top={layout.top} height={layout.height} leftPct={layout.leftPct} widthPct={layout.widthPct} selected={selected} onMouseDownSelect={onMouseDownSelect} drag={drag} />
                    );
                  }}
                />
              </motion.div>
            ))}
            {/* lasso rectangle */}
            {lasso && (
              <div className="absolute bg-blue-400/10 border border-blue-400 pointer-events-none z-0"
                   style={{left: Math.min(lasso.sx0, lasso.sx1), top: Math.min(lasso.sy0, lasso.sy1), width: Math.abs(lasso.sx1-lasso.sx0), height: Math.abs(lasso.sy1-lasso.sy0)}} />
            )}
          </div>
        </div>
        {/* Global drag overlay so pointer remains captured across re-renders/paging */}
        <DragOverlay dropAnimation={null} style={{pointerEvents:'none'}}>
          {overlayItem ? (
            (() => {
              const s = toDate(overlayItem.start_time);
              const e = toDate(overlayItem.end_time);
              const top = minuteToY(minutes(s));
              const height = Math.max(8, minuteToY(minutes(e)) - top);
              if (overlayItem.kind === 'task') {
                return (
                  <div className={`absolute left-2 right-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 backdrop-blur-sm calendar-item z-20 ring-2 ring-emerald-400`}
                       style={{top:0, height: Math.max(18,height), display:'flex', alignItems:'center', padding:'0 6px'}}>
                    <div className="text-[11px] text-emerald-200 truncate select-none">✓ {getTitle(overlayItem)} <span className="opacity-70">({fmtTime(overlayItem.start_time)})</span></div>
                  </div>
                );
              } else {
                return (
                  <div className={`absolute rounded-md shadow-sm calendar-item event-card z-20 ring-2 ring-blue-500`}
                       style={{top:0, height, width:'100%', background:"#1f2937", color:"white"}}>
                    <div className="p-1 text-xs select-none">
                      <div className="font-semibold truncate">{getTitle(overlayItem)}</div>
                      <div className="opacity-80">{fmtTime(overlayItem.start_time)} – {fmtTime(overlayItem.end_time)}</div>
                    </div>
                  </div>
                );
              }
            })()
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ==========================================================
// Lightweight unit tests (dev-only) for merge & placement utilities
// ==========================================================
function assert(cond: boolean, msg: string){ if(!cond) throw new Error("Test failed: "+msg); }
function runUnitTests(){
  // touching/overlap merge at 5-minute tolerance
  const d = startOfDay(new Date());
  const r1 = { start: addMinutes(d, 60), end: addMinutes(d, 90) };
  const r2 = { start: addMinutes(d, 90), end: addMinutes(d, 120) }; // touching
  const r3 = { start: addMinutes(d, 121), end: addMinutes(d, 140) }; // 1 min gap beyond tolerance
  const out1 = mergeRanges([r1, r2], 5);
  assert(out1.length === 1 && out1[0].start.getTime()===r1.start.getTime() && out1[0].end.getTime()===r2.end.getTime(), "merge touching ranges");
  const out2 = mergeRanges([r1, r3], 0);
  assert(out2.length === 2, "no-merge when gap > 0 with 0 tolerance");
  const map1: Record<number, Range[]> = { 0: [r1] };
  const map2: Record<number, Range[]> = { 0: [r2], 1: [r3] };
  const merged = mergeMaps(map1, map2, 5);
  assert(merged[0].length===1 && merged[1].length===1, "mergeMaps merges per-day and preserves others");
  // additional: overlapping three-way merge within tolerance
  const r4 = { start: addMinutes(d, 140), end: addMinutes(d, 150) };
  const r5 = { start: addMinutes(d, 150), end: addMinutes(d, 165) };
  const r6 = { start: addMinutes(d, 166), end: addMinutes(d, 180) };
  const out3 = mergeRanges([r4, r5, r6], 5);
  assert(out3.length === 1 && out3[0].start.getTime()===r4.start.getTime() && out3[0].end.getTime()===r6.end.getTime(), "mergeRanges chains touching+nearby intervals");
  // placement: two overlapping items should split 50/50, non-overlap should be full width
  const fakeItems: TimeItem[] = [
    { id:'x', kind:'event', start_time: addMinutes(d, 60), end_time: addMinutes(d, 120) },
    { id:'y', kind:'event', start_time: addMinutes(d, 90), end_time: addMinutes(d, 150) },
    { id:'z', kind:'event', start_time: addMinutes(d, 200), end_time: addMinutes(d, 240) },
  ];
  const plc = computePlacements(fakeItems);
  assert(plc['x'].lanes===2 && plc['y'].lanes===2, "overlap lanes should be 2");
  assert(plc['z'].lanes===1 && plc['z'].lane===0, "non-overlap should be single lane width");
}
try { if (typeof window !== 'undefined') { runUnitTests(); console.debug('[CalendarDemo] unit tests passed'); } } catch(e){ console.error(e); }
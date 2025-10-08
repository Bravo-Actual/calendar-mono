'use client';

import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Video, PersonStanding } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';
import type { TimeItem } from '../cal-grid/types';

// Category colors - simplified for horizontal cards
const getCategoryColors = (colorString?: string) => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case 'neutral':
      return 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700';
    case 'slate':
      return 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700';
    case 'orange':
      return 'bg-orange-100 dark:bg-amber-900 text-orange-900 dark:text-amber-100 border-orange-200 dark:border-amber-800';
    case 'yellow':
      return 'bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-800';
    case 'green':
      return 'bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-300 dark:border-green-800';
    case 'blue':
      return 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-800';
    case 'indigo':
      return 'bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 border-indigo-300 dark:border-indigo-800';
    case 'violet':
      return 'bg-violet-200 dark:bg-violet-900 text-violet-900 dark:text-violet-100 border-violet-300 dark:border-violet-800';
    case 'fuchsia':
      return 'bg-fuchsia-200 dark:bg-fuchsia-900 text-fuchsia-900 dark:text-fuchsia-100 border-fuchsia-300 dark:border-fuchsia-800';
    case 'rose':
      return 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 border-rose-300 dark:border-rose-800';
    default:
      return 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700';
  }
};

interface ScheduleItemHostProps<T extends TimeItem> {
  item: T;
  left: number;
  width: number;
  top: number;
  height: number;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
}

// Horizontal resize handle component
function HorizontalResizeHandle({ id, edge }: { id: string; edge: 'start' | 'end' }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize:${edge}:${id}`,
    data: { kind: 'resize', edge, id },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      suppressHydrationWarning
      className={cn(
        'absolute top-0 bottom-0 w-1.5 cursor-ew-resize z-10',
        edge === 'start' ? 'left-0' : 'right-0'
      )}
    />
  );
}

// Horizontal schedule event card
function ScheduleEventCard<T extends TimeItem>({
  item,
  left,
  width,
  top,
  height,
  selected,
  onMouseDownSelect,
  moveRef,
  moveAttributes,
  moveListeners,
}: {
  item: T;
  left: number;
  width: number;
  top: number;
  height: number;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  moveRef: (element: HTMLElement | null) => void;
  moveAttributes: Record<string, any>;
  moveListeners: Record<string, any>;
}) {
  const title = (item as any).title || (item as any).label || '(untitled)';
  const color = (item as any).color;
  const onlineEvent = (item as any).online_event;
  const inPerson = (item as any).in_person;

  const colorClasses = getCategoryColors(color);
  const showIcons = width > 100; // Show icons when there's room

  return (
    <div
      ref={moveRef}
      {...moveAttributes}
      {...(moveListeners || {})}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDownSelect(e, item.id);
      }}
      className={cn(
        'absolute rounded-lg shadow-sm calendar-item event-card z-20 group',
        'hover:shadow-md transition-all duration-200',
        colorClasses,
        selected && 'ring-2 ring-violet-500 dark:ring-violet-400'
      )}
      style={{
        left,
        width,
        top,
        height,
      }}
    >
      <HorizontalResizeHandle id={item.id} edge="start" />

      <div className="px-2 py-1 text-xs select-none h-full overflow-hidden flex items-center gap-1.5">
        {showIcons && (onlineEvent || inPerson) && (
          <div className="flex gap-1 flex-shrink-0">
            {onlineEvent && <Video className="w-3.5 h-3.5" />}
            {inPerson && <PersonStanding className="w-3.5 h-3.5" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{title}</div>
        </div>
      </div>

      <HorizontalResizeHandle id={item.id} edge="end" />
    </div>
  );
}

export function ScheduleItemHost<T extends TimeItem>({
  item,
  left,
  width,
  top,
  height,
  selected,
  onMouseDownSelect,
}: ScheduleItemHostProps<T>) {
  const move = useDraggable({
    id: `move:${item.id}`,
    data: { kind: 'move', id: item.id },
  });

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'absolute',
        left: left + 2,
        width: width - 4,
        top: top + 2,
        height: height - 4,
      }}
    >
      <ScheduleEventCard
        item={item}
        left={0}
        width={width - 4}
        top={0}
        height={height - 4}
        selected={selected}
        onMouseDownSelect={onMouseDownSelect}
        moveRef={move.setNodeRef}
        moveAttributes={move.attributes}
        moveListeners={move.listeners || {}}
      />
    </motion.div>
  );
}

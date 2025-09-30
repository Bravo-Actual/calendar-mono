'use client';

import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import type React from 'react';
import { cn } from '@/lib/utils';
import type { DragHandlers, ItemLayout, RenderItem, TimeItem } from './types';
import { fmtTime } from './utils';

interface ItemHostProps<T extends TimeItem> {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  renderItem?: RenderItem<T>;
  highlight?: {
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
  };
}

// Resize handle component
function ResizeHandle({ id, edge }: { id: string; edge: 'start' | 'end' }) {
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
        'absolute left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity',
        'bg-primary/60 hover:bg-primary/80',
        edge === 'start' ? 'top-0 rounded-t-md' : 'bottom-0 rounded-b-md'
      )}
    />
  );
}

// Default event card renderer
function DefaultEventCard<T extends TimeItem>({
  item,
  layout,
  selected,
  onMouseDownSelect,
  drag,
  highlight,
}: {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
  highlight?: { emoji_icon?: string | null; title?: string | null; message?: string | null };
}) {
  const title = (item as any).title || (item as any).label || '(untitled)';
  const startTime = fmtTime(item.start_time);
  const endTime = fmtTime(item.end_time);

  return (
    <div
      ref={drag.move.setNodeRef}
      {...drag.move.attributes}
      {...(drag.move.listeners || {})}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDownSelect(e, item.id);
      }}
      className={cn(
        'absolute rounded-md shadow-sm calendar-item event-card z-20 group',
        'bg-card text-card-foreground',
        highlight
          ? 'border-[3px] border-yellow-500 dark:border-yellow-400'
          : 'border border-border',
        'hover:shadow-md transition-shadow',
        selected && 'ring-2 ring-ring'
      )}
      style={{
        top: layout.top,
        height: layout.height,
        left: `${layout.leftPct}%`,
        width: `${layout.widthPct}%`,
      }}
    >
      <ResizeHandle id={item.id} edge="start" />

      <div className="p-2 text-xs select-none h-full overflow-hidden">
        <div className="font-medium truncate">{title}</div>
        <div className="text-muted-foreground">
          {startTime} – {endTime}
        </div>
        {layout.height > 48 && (item as any).description && (
          <div className="text-muted-foreground/80 mt-1 text-[10px] leading-tight">
            {(item as any).description}
          </div>
        )}
      </div>

      <ResizeHandle id={item.id} edge="end" />
    </div>
  );
}

export function ItemHost<T extends TimeItem>({
  item,
  layout,
  selected,
  onMouseDownSelect,
  renderItem,
  highlight,
}: ItemHostProps<T>) {
  const move = useDraggable({
    id: `move:${item.id}`,
    data: { kind: 'move', id: item.id },
  });

  const drag: DragHandlers = {
    move: {
      setNodeRef: move.setNodeRef,
      attributes: move.attributes,
      listeners: move.listeners || {},
    },
  };

  const content = renderItem ? (
    renderItem({ item, layout, selected, onMouseDownSelect, drag, highlight })
  ) : (
    <DefaultEventCard
      item={item}
      layout={layout}
      selected={selected}
      onMouseDownSelect={onMouseDownSelect}
      drag={drag}
      highlight={highlight}
    />
  );

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {content}
    </motion.div>
  );
}

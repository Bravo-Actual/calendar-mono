'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';

import type {
  TimeItem,
  RenderItem,
  ItemLayout,
  DragHandlers,
} from './types';
import { fmtTime, toDate } from './utils';
import { cn } from '@/lib/utils';

interface ItemHostProps<T extends TimeItem> {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  renderItem?: RenderItem<T>;
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
}: {
  item: T;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
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
        'bg-card text-card-foreground border border-border',
        'hover:shadow-md transition-shadow cursor-pointer',
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
        <div className="text-muted-foreground">{startTime} – {endTime}</div>
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
    }
  };

  // Use custom renderer if provided, otherwise use default
  if (renderItem) {
    return <>{renderItem({ item, layout, selected, onMouseDownSelect, drag })}</>;
  }

  return (
    <DefaultEventCard
      item={item}
      layout={layout}
      selected={selected}
      onMouseDownSelect={onMouseDownSelect}
      drag={drag}
    />
  );
}
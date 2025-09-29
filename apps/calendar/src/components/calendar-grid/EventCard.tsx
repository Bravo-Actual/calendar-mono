'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Video, PersonStanding } from "lucide-react";

import type {
  ItemLayout,
  DragHandlers,
} from './types';
import { fmtTime } from './utils';
import { cn } from '@/lib/utils';

// Show time as indicators
const getShowTimeAsIcon = (showTimeAs?: string) => {
  switch (showTimeAs) {
    case "tentative": return "?";
    case "free": return "○";
    case "busy": return "✓";
    case "oof": return "✗";
    case "working_elsewhere": return "↗";
    default: return "✓"; // busy is default
  }
};

// Meeting type icons
const getMeetingTypeIcons = (item: EventItem) => {
  const icons = [];

  if (item.online_event) {
    icons.push(<Video key="video" className="w-3 h-3" />);
  }

  if (item.in_person) {
    icons.push(<PersonStanding key="person" className="w-3 h-3" />);
  }

  return icons;
};

// Event-specific interface for our event cards
interface EventItem {
  id: string;
  title: string;
  start_time: Date | string | number;
  end_time: Date | string | number;
  description?: string;
  color?: string;
  // Meeting type properties
  online_event?: boolean;
  in_person?: boolean;
  // Show time as property
  show_time_as?: string;
  // Category for theming
  category?: string;
  // Private event indicator
  private?: boolean;
  // Calendar for dot indicator
  calendar?: {
    color?: string;
  };
}

interface EventCardProps {
  item: EventItem;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
}

// Resize handle component
function ResizeHandle({ id, edge }: { id: string; edge: 'start' | 'end' }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize:${edge}:${id}`,
    data: { kind: 'resize', edge, id },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'absolute left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity',
        'bg-primary/60 hover:bg-primary/80',
        edge === 'start' ? 'top-0 rounded-t-md' : 'bottom-0 rounded-b-md'
      )}
      layout={false} // Prevent layout animation from affecting resize handles
    />
  );
}

export function EventCard({
  item,
  layout,
  selected,
  onMouseDownSelect,
  drag,
}: EventCardProps) {
  const startTime = fmtTime(item.start_time);
  const endTime = fmtTime(item.end_time);

  // Get meeting icons and show time as icon
  const meetingIcons = getMeetingTypeIcons(item);
  const showTimeAsIcon = getShowTimeAsIcon(item.show_time_as);

  return (
    <motion.div
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
        top: layout.top + 1,
        height: layout.height - 2,
        left: `calc(${layout.leftPct}% + 4px)`,
        width: `calc(${layout.widthPct}% - 8px)`,
      }}
      // Entry animation - no scaling to avoid text size changes
      initial={{
        opacity: 0,
        y: -20
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      exit={{
        opacity: 0,
        y: -20,
        transition: { duration: 0.2 }
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 0.3
      }}
      layout // Smooth layout changes when position updates
    >
      <ResizeHandle id={item.id} edge="start" />

      <motion.div
        className="p-2 text-xs select-none h-full overflow-hidden"
        layout={false} // Prevent text content from being affected by layout animations
      >
        <div className="font-medium truncate flex items-center gap-2">
          {item.private && <span>🔒</span>}
          {item.title}
          <div className="ml-auto flex items-center gap-1">
            <span title={item.show_time_as || 'busy'}>{showTimeAsIcon}</span>
            {meetingIcons}
          </div>
        </div>
        <div className="text-muted-foreground">{startTime} – {endTime}</div>
        {layout.height > 48 && item.description && (
          <div className="text-muted-foreground/80 mt-1 text-[10px] leading-tight">
            {item.description}
          </div>
        )}
      </motion.div>

      {/* Calendar dot indicator */}
      {item.calendar?.color && (
        <div
          className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-${item.calendar.color}-500 border border-background`}
        />
      )}

      <ResizeHandle id={item.id} edge="end" />
    </motion.div>
  );
}
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

// Category colors with dark mode support
const getCategoryColors = (colorString?: string) => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case "neutral": return { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-900 dark:text-neutral-100", border: "border-neutral-300 dark:border-neutral-600" };
    case "slate": return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", border: "border-slate-300 dark:border-slate-600" };
    case "orange": return { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-900 dark:text-orange-100", border: "border-orange-300 dark:border-orange-600" };
    case "yellow": return { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-900 dark:text-yellow-100", border: "border-yellow-300 dark:border-yellow-600" };
    case "green": return { bg: "bg-green-100 dark:bg-green-900", text: "text-green-900 dark:text-green-100", border: "border-green-300 dark:border-green-600" };
    case "blue": return { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-900 dark:text-blue-100", border: "border-blue-300 dark:border-blue-600" };
    case "indigo": return { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-900 dark:text-indigo-100", border: "border-indigo-300 dark:border-indigo-600" };
    case "violet": return { bg: "bg-violet-100 dark:bg-violet-900", text: "text-violet-900 dark:text-violet-100", border: "border-violet-300 dark:border-violet-600" };
    case "fuchsia": return { bg: "bg-fuchsia-100 dark:bg-fuchsia-900", text: "text-fuchsia-900 dark:text-fuchsia-100", border: "border-fuchsia-300 dark:border-fuchsia-600" };
    case "rose": return { bg: "bg-rose-100 dark:bg-rose-900", text: "text-rose-900 dark:text-rose-100", border: "border-rose-300 dark:border-rose-600" };
    default: return { bg: "bg-card dark:bg-neutral-800", text: "text-card-foreground", border: "border-border" };
  }
};

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
const getMeetingTypeIcons = (item: TestEventItem) => {
  const icons = [];

  if (item.online_event) {
    icons.push(<Video key="video" className="w-3 h-3" />);
  }

  if (item.in_person) {
    icons.push(<PersonStanding key="person" className="w-3 h-3" />);
  }

  return icons;
};

// Test Event-specific interface
interface TestEventItem {
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
}

interface TestEventCardProps {
  item: TestEventItem;
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

export function TestEventCard({
  item,
  layout,
  selected,
  onMouseDownSelect,
  drag,
}: TestEventCardProps) {
  const startTime = fmtTime(item.start_time);
  const endTime = fmtTime(item.end_time);

  // Get category colors for theming
  const categoryColors = getCategoryColors(item.color || item.category);
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
        'transition-all duration-200 cursor-pointer overflow-hidden',
        categoryColors.bg,
        categoryColors.text,
        categoryColors.border,
        'border',
        'hover:shadow-lg hover:scale-[1.02]',
        selected && 'ring-2 ring-ring ring-offset-1',
        item.private && 'opacity-75'
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
        className="p-2 text-xs select-none h-full overflow-hidden flex flex-col"
        layout={false} // Prevent text content from being affected by layout animations
      >
        {/* Header with title and indicators */}
        <div className="flex items-start justify-between gap-1 min-h-[16px]">
          <div className="font-medium truncate flex-1">
            {item.private && <span className="mr-1">🔒</span>}
            {item.title}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Show time as indicator */}
            <span className="text-[10px] font-mono opacity-70" title={item.show_time_as || 'busy'}>
              {showTimeAsIcon}
            </span>
            {/* Meeting type icons */}
            {meetingIcons.length > 0 && (
              <div className="flex gap-0.5 opacity-70">
                {meetingIcons}
              </div>
            )}
          </div>
        </div>

        {/* Time range */}
        <div className="text-muted-foreground/80 mt-0.5 text-[10px]">
          {startTime} – {endTime}
        </div>

        {/* Description for taller cards */}
        {layout.height > 64 && item.description && (
          <div className="text-muted-foreground/70 mt-1 text-[10px] leading-tight flex-1 overflow-hidden">
            {item.description}
          </div>
        )}
      </motion.div>

      <ResizeHandle id={item.id} edge="end" />
    </motion.div>
  );
}
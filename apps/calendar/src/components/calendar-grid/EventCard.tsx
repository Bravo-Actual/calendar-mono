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
import { EventContextMenu } from '../calendar-view/event-context-menu';
import type { ClientCategory } from '@/lib/data-v2';

// Category colors - only background, border, and text
const getCategoryColors = (colorString?: string) => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case "neutral": return { bg: "bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700", text: "text-neutral-900 dark:text-neutral-100", border: "border-neutral-400 dark:border-neutral-600" };
    case "slate": return { bg: "bg-slate-200 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700", text: "text-slate-900 dark:text-slate-100", border: "border-slate-400 dark:border-slate-600" };
    case "orange": return { bg: "bg-orange-200 dark:bg-orange-900 hover:bg-orange-100 dark:hover:bg-orange-800", text: "text-orange-900 dark:text-orange-100", border: "border-orange-400 dark:border-orange-600" };
    case "yellow": return { bg: "bg-yellow-200 dark:bg-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-800", text: "text-yellow-900 dark:text-yellow-100", border: "border-yellow-400 dark:border-yellow-600" };
    case "green": return { bg: "bg-green-200 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800", text: "text-green-900 dark:text-green-100", border: "border-green-400 dark:border-green-600" };
    case "blue": return { bg: "bg-blue-200 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800", text: "text-blue-900 dark:text-blue-100", border: "border-blue-400 dark:border-blue-600" };
    case "indigo": return { bg: "bg-indigo-200 dark:bg-indigo-900 hover:bg-indigo-100 dark:hover:bg-indigo-800", text: "text-indigo-900 dark:text-indigo-100", border: "border-indigo-400 dark:border-indigo-600" };
    case "violet": return { bg: "bg-violet-200 dark:bg-violet-900 hover:bg-violet-100 dark:hover:bg-violet-800", text: "text-violet-900 dark:text-violet-100", border: "border-violet-400 dark:border-violet-600" };
    case "fuchsia": return { bg: "bg-fuchsia-200 dark:bg-fuchsia-900 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-800", text: "text-fuchsia-900 dark:text-fuchsia-100", border: "border-fuchsia-400 dark:border-fuchsia-600" };
    case "rose": return { bg: "bg-rose-200 dark:bg-rose-900 hover:bg-rose-100 dark:hover:bg-rose-800", text: "text-rose-900 dark:text-rose-100", border: "border-rose-400 dark:border-rose-600" };
    default: return { bg: "bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700", text: "text-neutral-900 dark:text-neutral-100", border: "border-neutral-400 dark:border-neutral-600" };
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
const getMeetingTypeIcons = (item: EventItem) => {
  const icons = [];

  if (item.online_event) {
    icons.push(<Video key="video" className="w-3.5 h-3.5" />);
  }

  if (item.in_person) {
    icons.push(<PersonStanding key="person" className="w-3.5 h-3.5" />);
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

type ShowTimeAs = 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';

interface EventCardProps {
  item: EventItem;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;

  // Context menu props
  selectedEventCount: number;
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;
  userCategories?: ClientCategory[];
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;
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
        'absolute left-0 right-0 h-1.5 cursor-ns-resize opacity-0 hover:opacity-50 transition-opacity',
        'bg-white',
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
  // Context menu props
  selectedEventCount,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  userCategories = [],
  onUpdateShowTimeAs,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  onDeleteSelected,
  onRenameSelected,
}: EventCardProps) {
  const startTime = fmtTime(item.start_time);
  const endTime = fmtTime(item.end_time);

  // Check if event is in the past (using same logic as old calendar)
  const isPastEvent = new Date(item.end_time).getTime() < Date.now();


  // Get meeting icons and show time as icon
  const meetingIcons = getMeetingTypeIcons(item);
  const showTimeAsIcon = getShowTimeAsIcon(item.show_time_as);

  // Get category colors for theming
  const categoryColors = getCategoryColors(item.color || item.category);

  return (
    <EventContextMenu
      selectedEventCount={selectedEventCount}
      selectedIsOnlineMeeting={selectedIsOnlineMeeting}
      selectedIsInPerson={selectedIsInPerson}
      userCategories={userCategories}
      onUpdateShowTimeAs={onUpdateShowTimeAs}
      onUpdateCategory={onUpdateCategory}
      onUpdateIsOnlineMeeting={onUpdateIsOnlineMeeting}
      onUpdateIsInPerson={onUpdateIsInPerson}
      onDeleteSelected={onDeleteSelected}
      onRenameSelected={onRenameSelected}
    >
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
          categoryColors.bg,
          categoryColors.text,
          categoryColors.border,
          'border',
          'hover:shadow-lg transition-all duration-200',
          selected && 'ring-2 ring-ring',
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
          opacity: isPastEvent ? 0.6 : 1,
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
            {item.title}
            <div className="ml-auto flex items-center gap-1">
              {item.private && <span>🔒</span>}
              {meetingIcons}
              <span title={item.show_time_as || 'busy'}>{showTimeAsIcon}</span>
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
    </EventContextMenu>
  );
}
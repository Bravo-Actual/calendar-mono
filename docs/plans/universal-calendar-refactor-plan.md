# Universal Calendar Refactor Plan

## Overview

Transform the current calendar from an event-specific system into a universal time-based object host that can position and display any temporal data using regular React components styled with Tailwind CSS.

## Goals

1. **Universal Time Host**: Calendar can display any time-based object (events, tasks, notes, placeholders, etc.)
2. **Component-First**: All calendar items are regular React components with full Tailwind styling
3. **Data Layer Integration**: Seamless binding to existing data layer with proper reactivity
4. **Extensible**: Easy to add new object types and components
5. **Backward Compatible**: Maintain existing functionality while adding new capabilities

## Architecture Overview

```
Data Layer (Dexie + Supabase)
    ↓
Calendar Items (Transform/Adapter)
    ↓
Universal Calendar (Positioning Host)
    ↓
Component Registry (event-card, task-card, etc.)
    ↓
Styled Components (Tailwind CSS)
```

## Phase 1: Core Infrastructure

### 1.1 Create Core Types (`src/components/calendar-view/universal-types.ts`)

```typescript
// Core time positioning interface
export interface TimePositionable {
  id: string;
  start_time_ms: number;
  end_time_ms: number;
  type: 'event' | 'ai_event' | 'task' | 'note' | 'placeholder';
}

// Calendar item wrapper
export interface CalendarItem<T = any> extends TimePositionable {
  data: T; // Original object data
  metadata: {
    priority: number;
    layer: number;
    allowOverlap: boolean;
    minHeight: number;
    maxHeight?: number;
  };
}

// Component props contract
export interface CalendarItemProps {
  position: {
    top: number;
    left: string;
    width: string;
    height: number;
  };
  isSelected?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDrag?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onResizeStart?: (e: React.PointerEvent, handle: 'top' | 'bottom') => void;
  onResize?: (e: React.PointerEvent) => void;
  onResizeEnd?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  [key: string]: any;
}

// Universal calendar props
export interface UniversalCalendarProps {
  items: CalendarItem[];
  components: Record<string, React.ComponentType<CalendarItemProps>>;
  timeRange: { start: number; end: number };
  timezone: string;
  className?: string;
  onItemClick?: (item: CalendarItem) => void;
  onItemDrag?: (item: CalendarItem, newTime: { start: number; end: number }) => void;
  onItemResize?: (item: CalendarItem, newTime: { start: number; end: number }) => void;
  onTimeSelect?: (range: { start: number; end: number }) => void;
}
```

### 1.2 Create Data Adapters (`src/components/calendar-view/adapters/`)

**`event-adapter.ts`**
```typescript
import type { AssembledEvent } from '@/lib/data/base/client-types';
import type { CalendarItem } from '../universal-types';

export function eventToCalendarItem(event: AssembledEvent): CalendarItem<AssembledEvent> {
  return {
    id: event.id,
    type: event.ai_suggested ? 'ai_event' : 'event',
    start_time_ms: event.start_time_ms,
    end_time_ms: event.end_time_ms,
    data: event,
    metadata: {
      priority: 1,
      layer: 1,
      allowOverlap: false,
      minHeight: 20,
      maxHeight: undefined,
    },
  };
}
```

**`task-adapter.ts`**
```typescript
import type { Task } from '@/lib/data/base/client-types';
import type { CalendarItem } from '../universal-types';

export function taskToCalendarItem(task: Task): CalendarItem<Task> {
  return {
    id: task.id,
    type: 'task',
    start_time_ms: task.due_time_ms,
    end_time_ms: task.due_time_ms + (30 * 60 * 1000), // 30 min slot
    data: task,
    metadata: {
      priority: 2,
      layer: 2,
      allowOverlap: true,
      minHeight: 24,
      maxHeight: 48,
    },
  };
}
```

**`note-adapter.ts`**
```typescript
import type { Note } from '@/lib/data/base/client-types';
import type { CalendarItem } from '../universal-types';

export function noteToCalendarItem(note: Note): CalendarItem<Note> {
  return {
    id: note.id,
    type: 'note',
    start_time_ms: note.pinned_time_ms,
    end_time_ms: note.pinned_time_ms + (15 * 60 * 1000), // 15 min slot
    data: note,
    metadata: {
      priority: 3,
      layer: 3,
      allowOverlap: true,
      minHeight: 16,
      maxHeight: 80,
    },
  };
}
```

### 1.3 Create Universal Calendar Component (`src/components/calendar-view/universal-calendar.tsx`)

```typescript
'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { UniversalCalendarProps, CalendarItem } from './universal-types';
import { useCalendarPositioning } from './hooks/use-calendar-positioning';
import { CalendarGrid } from './calendar-grid';

export function UniversalCalendar({
  items,
  components,
  timeRange,
  timezone,
  className,
  onItemClick,
  onItemDrag,
  onItemResize,
  onTimeSelect,
}: UniversalCalendarProps) {
  // Calculate positions for all items
  const positionedItems = useCalendarPositioning(items, timeRange, timezone);

  // Sort items by priority and layer for proper stacking
  const sortedItems = useMemo(
    () => positionedItems.sort((a, b) => {
      if (a.metadata.layer !== b.metadata.layer) {
        return a.metadata.layer - b.metadata.layer;
      }
      return a.metadata.priority - b.metadata.priority;
    }),
    [positionedItems]
  );

  return (
    <div className={cn("relative bg-white overflow-hidden", className)}>
      {/* Time grid background */}
      <CalendarGrid
        timeRange={timeRange}
        timezone={timezone}
        onTimeSelect={onTimeSelect}
      />

      {/* Render calendar items */}
      {sortedItems.map((item) => {
        const Component = components[item.type];
        if (!Component) {
          console.warn(`No component registered for type: ${item.type}`);
          return null;
        }

        return (
          <Component
            key={item.id}
            position={item.position}
            isSelected={item.isSelected}
            isDragging={item.isDragging}
            isResizing={item.isResizing}
            onClick={() => onItemClick?.(item)}
            onDragStart={(e) => handleDragStart(e, item)}
            onDrag={(e) => handleDrag(e, item)}
            onDragEnd={(e) => handleDragEnd(e, item)}
            onResizeStart={(e, handle) => handleResizeStart(e, item, handle)}
            onResize={(e) => handleResize(e, item)}
            onResizeEnd={(e) => handleResizeEnd(e, item)}
            // Pass through the original data
            {...item.data}
          />
        );
      })}
    </div>
  );
}
```

## Phase 2: Calendar Item Components

### 2.1 Event Card Component (`src/components/calendar-view/items/event-card.tsx`)

```typescript
'use client';

import React from 'react';
import { Video, PersonStanding } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarItemProps } from '../universal-types';
import type { AssembledEvent } from '@/lib/data/base/client-types';
import { formatTimeRangeLabel } from '../utils';

export interface EventCardProps extends CalendarItemProps {
  // Event data passed from adapter
  id: string;
  title: string;
  start_time_ms: number;
  end_time_ms: number;
  category: { id: string; name: string; color: string } | null;
  online_event?: boolean;
  in_person?: boolean;
  show_time_as?: 'free' | 'tentative' | 'busy';
  private?: boolean;
  timezone: string;
}

export function EventCard({
  position,
  isSelected,
  isDragging,
  isResizing,
  onDragStart,
  onResizeStart,
  onClick,
  onDoubleClick,
  // Event data
  title,
  start_time_ms,
  end_time_ms,
  category,
  online_event,
  in_person,
  show_time_as,
  private: isPrivate,
  timezone,
  className,
  ...props
}: EventCardProps) {
  const timeLabel = formatTimeRangeLabel(start_time_ms, end_time_ms, timezone);
  const categoryColor = category?.color || 'neutral';

  return (
    <div
      className={cn(
        // Base positioning and behavior
        "absolute cursor-pointer select-none transition-all duration-150",

        // Event card styling with Tailwind
        "rounded-lg shadow-sm border-2 p-2",
        "hover:shadow-md hover:scale-[1.02]",

        // Category colors
        categoryColor === 'blue' && "bg-blue-50 border-blue-200 text-blue-900",
        categoryColor === 'green' && "bg-green-50 border-green-200 text-green-900",
        categoryColor === 'orange' && "bg-orange-50 border-orange-200 text-orange-900",
        categoryColor === 'red' && "bg-red-50 border-red-200 text-red-900",
        categoryColor === 'purple' && "bg-purple-50 border-purple-200 text-purple-900",
        !category && "bg-neutral-50 border-neutral-200 text-neutral-900",

        // State styling
        isSelected && "ring-2 ring-blue-500 border-blue-500 shadow-lg",
        isDragging && "opacity-50 rotate-1 shadow-xl z-50",
        isResizing && "ring-1 ring-blue-300",
        isPrivate && "opacity-80",

        // Show time as styling
        show_time_as === 'tentative' && "border-dashed",
        show_time_as === 'free' && "opacity-60",

        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: Math.max(position.height, 24),
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      draggable={!isResizing}
      {...props}
    >
      {/* Resize handles */}
      <div
        className="absolute inset-x-0 top-0 h-1 cursor-n-resize hover:bg-black/10 transition-colors z-10"
        onPointerDown={(e) => onResizeStart?.(e, 'top')}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1 cursor-s-resize hover:bg-black/10 transition-colors z-10"
        onPointerDown={(e) => onResizeStart?.(e, 'bottom')}
      />

      {/* Content */}
      <div className="flex items-start justify-between h-full gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate leading-tight">
            {title}
          </div>
          {position.height > 32 && (
            <div className="text-xs opacity-75 truncate mt-1">
              {timeLabel}
            </div>
          )}
        </div>

        {/* Meeting type icons */}
        <div className="flex-shrink-0 flex items-center gap-1 text-xs opacity-70">
          {online_event && <Video className="w-3 h-3" />}
          {in_person && <PersonStanding className="w-3 h-3" />}
          <span>
            {show_time_as === 'tentative' ? '?' :
             show_time_as === 'free' ? '○' : '●'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### 2.2 AI Event Card Component (`src/components/calendar-view/items/ai-event-card.tsx`)

```typescript
'use client';

import React from 'react';
import { Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarItemProps } from '../universal-types';
import { formatTimeRangeLabel } from '../utils';

export interface AIEventCardProps extends CalendarItemProps {
  id: string;
  title: string;
  start_time_ms: number;
  end_time_ms: number;
  ai_instructions?: string;
  confidence_score?: number;
  timezone: string;
}

export function AIEventCard({
  position,
  isSelected,
  isDragging,
  onDragStart,
  onResizeStart,
  onClick,
  title,
  start_time_ms,
  end_time_ms,
  ai_instructions,
  confidence_score = 0.8,
  timezone,
  className,
  ...props
}: AIEventCardProps) {
  const timeLabel = formatTimeRangeLabel(start_time_ms, end_time_ms, timezone);

  return (
    <div
      className={cn(
        "absolute cursor-pointer select-none transition-all duration-150",

        // AI event special styling - gradient border effect
        "rounded-lg p-[1px] shadow-md",
        "bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500",
        "hover:shadow-lg hover:scale-[1.02]",

        isSelected && "ring-2 ring-purple-400 shadow-xl",
        isDragging && "opacity-50 rotate-1 shadow-2xl z-50",

        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: Math.max(position.height, 28),
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable
      {...props}
    >
      {/* Inner content with white background */}
      <div className="bg-white rounded-lg h-full w-full relative p-2">
        {/* Resize handles */}
        <div
          className="absolute inset-x-0 top-0 h-1 cursor-n-resize hover:bg-purple-100 transition-colors z-10"
          onPointerDown={(e) => onResizeStart?.(e, 'top')}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1 cursor-s-resize hover:bg-purple-100 transition-colors z-10"
          onPointerDown={(e) => onResizeStart?.(e, 'bottom')}
        />

        {/* Content */}
        <div className="flex items-start justify-between h-full gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
              <div className="font-medium text-sm truncate leading-tight text-purple-900">
                {title}
              </div>
            </div>
            {position.height > 40 && (
              <div className="text-xs text-purple-600 truncate">
                {timeLabel}
              </div>
            )}
            {position.height > 56 && ai_instructions && (
              <div className="text-xs text-gray-600 truncate mt-1">
                {ai_instructions}
              </div>
            )}
          </div>

          {/* Confidence indicator */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <Brain className="w-3 h-3 text-purple-500" />
            <div className="text-xs text-purple-600">
              {Math.round(confidence_score * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 Task Card Component (`src/components/calendar-view/items/task-card.tsx`)

```typescript
'use client';

import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarItemProps } from '../universal-types';

export interface TaskCardProps extends CalendarItemProps {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_time_ms: number;
  project?: string;
}

export function TaskCard({
  position,
  isSelected,
  isDragging,
  onClick,
  title,
  completed,
  priority,
  due_time_ms,
  project,
  className,
  ...props
}: TaskCardProps) {
  const isOverdue = due_time_ms < Date.now() && !completed;

  return (
    <div
      className={cn(
        "absolute cursor-pointer select-none transition-all duration-150",

        // Task card styling - chip-like appearance
        "rounded-full px-3 py-1 text-xs font-medium shadow-sm border",
        "hover:shadow-md hover:scale-105",
        "flex items-center gap-2",

        // Priority colors
        priority === 'high' && !completed && "bg-red-50 border-red-200 text-red-800",
        priority === 'medium' && !completed && "bg-yellow-50 border-yellow-200 text-yellow-800",
        priority === 'low' && !completed && "bg-green-50 border-green-200 text-green-800",

        // Completion state
        completed && "bg-gray-100 border-gray-200 text-gray-600 opacity-75",

        // Overdue state
        isOverdue && "bg-red-100 border-red-300 text-red-900 animate-pulse",

        isSelected && "ring-2 ring-blue-400 shadow-md",
        isDragging && "opacity-50 shadow-lg z-50",

        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: 28, // Fixed height for tasks
        minWidth: '120px',
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onClick={onClick}
      {...props}
    >
      {/* Completion checkbox */}
      {completed ? (
        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
      ) : (
        <Circle className="w-3 h-3 flex-shrink-0" />
      )}

      {/* Task title */}
      <span className={cn(
        "truncate flex-1",
        completed && "line-through"
      )}>
        {title}
      </span>

      {/* Overdue indicator */}
      {isOverdue && <Clock className="w-3 h-3 text-red-500 flex-shrink-0" />}

      {/* Project tag */}
      {project && !completed && position.width > 180 && (
        <span className="text-xs px-1 py-0.5 bg-black/10 rounded text-black/60 truncate max-w-[60px]">
          {project}
        </span>
      )}
    </div>
  );
}
```

### 2.4 Note Card Component (`src/components/calendar-view/items/note-card.tsx`)

```typescript
'use client';

import React from 'react';
import { StickyNote, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarItemProps } from '../universal-types';

export interface NoteCardProps extends CalendarItemProps {
  id: string;
  title: string;
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  pinned: boolean;
}

export function NoteCard({
  position,
  isSelected,
  isDragging,
  onClick,
  title,
  content,
  color,
  pinned,
  className,
  ...props
}: NoteCardProps) {
  return (
    <div
      className={cn(
        "absolute cursor-pointer select-none transition-all duration-150",

        // Note styling - sticky note appearance
        "rounded-lg shadow-sm border-0 p-2 text-xs",
        "hover:shadow-md hover:rotate-1",
        "font-handwritten", // Custom font for notes

        // Note colors
        color === 'yellow' && "bg-yellow-100 text-yellow-900",
        color === 'blue' && "bg-blue-100 text-blue-900",
        color === 'green' && "bg-green-100 text-green-900",
        color === 'pink' && "bg-pink-100 text-pink-900",
        color === 'purple' && "bg-purple-100 text-purple-900",

        isSelected && "ring-2 ring-amber-400 shadow-lg rotate-1",
        isDragging && "opacity-50 rotate-3 shadow-xl z-50",

        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: Math.max(position.height, 48),
        transform: `rotate(${Math.random() * 4 - 2}deg)`, // Slight random rotation
        zIndex: isDragging ? 1000 : pinned ? 100 : 'auto',
      }}
      onClick={onClick}
      {...props}
    >
      {/* Pin indicator */}
      {pinned && (
        <Pin className="absolute -top-1 -right-1 w-4 h-4 text-red-500 rotate-45" />
      )}

      {/* Note icon */}
      <StickyNote className="w-3 h-3 mb-1 opacity-60" />

      {/* Note content */}
      <div>
        {title && (
          <div className="font-semibold truncate mb-1 text-sm">
            {title}
          </div>
        )}
        <div className="text-xs leading-relaxed line-clamp-3">
          {content}
        </div>
      </div>
    </div>
  );
}
```

### 2.5 Placeholder Card Component (`src/components/calendar-view/items/placeholder-card.tsx`)

```typescript
'use client';

import React from 'react';
import { Plus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarItemProps } from '../universal-types';

export interface PlaceholderCardProps extends CalendarItemProps {
  id: string;
  placeholder_type: 'new_event' | 'time_block' | 'break' | 'focus_time';
  duration_minutes: number;
  suggested?: boolean;
}

export function PlaceholderCard({
  position,
  isSelected,
  isDragging,
  onClick,
  placeholder_type,
  duration_minutes,
  suggested,
  className,
  ...props
}: PlaceholderCardProps) {
  const getPlaceholderContent = () => {
    switch (placeholder_type) {
      case 'new_event':
        return { icon: Plus, text: 'New Event', color: 'blue' };
      case 'time_block':
        return { icon: Clock, text: 'Time Block', color: 'purple' };
      case 'break':
        return { icon: Clock, text: 'Break', color: 'green' };
      case 'focus_time':
        return { icon: Clock, text: 'Focus Time', color: 'orange' };
      default:
        return { icon: Plus, text: 'Available', color: 'gray' };
    }
  };

  const { icon: Icon, text, color } = getPlaceholderContent();

  return (
    <div
      className={cn(
        "absolute cursor-pointer select-none transition-all duration-150",

        // Placeholder styling - dashed border, semi-transparent
        "rounded-lg border-2 border-dashed p-2 text-xs",
        "hover:bg-white hover:shadow-sm",
        "flex items-center justify-center gap-2",

        // Color variants
        color === 'blue' && "border-blue-300 bg-blue-50/50 text-blue-700",
        color === 'purple' && "border-purple-300 bg-purple-50/50 text-purple-700",
        color === 'green' && "border-green-300 bg-green-50/50 text-green-700",
        color === 'orange' && "border-orange-300 bg-orange-50/50 text-orange-700",
        color === 'gray' && "border-gray-300 bg-gray-50/50 text-gray-700",

        // Suggested placeholders
        suggested && "bg-white border-solid shadow-sm",

        isSelected && "ring-2 ring-blue-400 bg-white shadow-md",
        isDragging && "opacity-50 shadow-lg z-50",

        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: Math.max(position.height, 32),
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onClick={onClick}
      {...props}
    >
      <Icon className="w-4 h-4 opacity-75" />
      <span className="font-medium">{text}</span>
      <span className="text-xs opacity-60">({duration_minutes}m)</span>
    </div>
  );
}
```

## Phase 3: Data Integration

### 3.1 Create Calendar Data Hook (`src/components/calendar-view/hooks/use-calendar-data.ts`)

```typescript
import { useMemo } from 'react';
import { useEventsRange } from '@/lib/data/domains/events';
import { useTasks } from '@/lib/data/domains/tasks'; // Assuming this exists
import { useNotes } from '@/lib/data/domains/notes'; // Assuming this exists
import type { CalendarItem } from '../universal-types';
import { eventToCalendarItem } from '../adapters/event-adapter';
import { taskToCalendarItem } from '../adapters/task-adapter';
import { noteToCalendarItem } from '../adapters/note-adapter';

export interface UseCalendarDataProps {
  userId: string | undefined;
  timeRange: { start: number; end: number };
  enabledTypes: {
    events?: boolean;
    tasks?: boolean;
    notes?: boolean;
    placeholders?: boolean;
  };
}

export function useCalendarData({
  userId,
  timeRange,
  enabledTypes = { events: true, tasks: true, notes: true, placeholders: false }
}: UseCalendarDataProps) {
  // Fetch data from different sources
  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError
  } = useEventsRange(userId, timeRange);

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError
  } = useTasks(userId, timeRange);

  const {
    data: notes = [],
    isLoading: notesLoading,
    error: notesError
  } = useNotes(userId, timeRange);

  // Transform data into calendar items
  const calendarItems: CalendarItem[] = useMemo(() => {
    const items: CalendarItem[] = [];

    // Add events
    if (enabledTypes.events) {
      events.forEach(event => {
        items.push(eventToCalendarItem(event));
      });
    }

    // Add tasks
    if (enabledTypes.tasks) {
      tasks.forEach(task => {
        items.push(taskToCalendarItem(task));
      });
    }

    // Add notes
    if (enabledTypes.notes) {
      notes.forEach(note => {
        items.push(noteToCalendarItem(note));
      });
    }

    // Add placeholders if enabled
    if (enabledTypes.placeholders) {
      const placeholders = generatePlaceholders(timeRange, items);
      items.push(...placeholders);
    }

    return items;
  }, [events, tasks, notes, enabledTypes, timeRange]);

  const isLoading = eventsLoading || tasksLoading || notesLoading;
  const error = eventsError || tasksError || notesError;

  return {
    items: calendarItems,
    isLoading,
    error,
    refetch: () => {
      // Trigger refetch for all data sources
      // This would need to be implemented based on your data fetching setup
    }
  };
}

function generatePlaceholders(
  timeRange: { start: number; end: number },
  existingItems: CalendarItem[]
): CalendarItem[] {
  // Logic to generate placeholder items in empty time slots
  // This would analyze existing items and create placeholders for available time
  return [];
}
```

### 3.2 Update Main Calendar Page (`src/app/calendar/page.tsx`)

```typescript
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UniversalCalendar } from '@/components/calendar-view/universal-calendar';
import { useCalendarData } from '@/components/calendar-view/hooks/use-calendar-data';
import { EventCard } from '@/components/calendar-view/items/event-card';
import { AIEventCard } from '@/components/calendar-view/items/ai-event-card';
import { TaskCard } from '@/components/calendar-view/items/task-card';
import { NoteCard } from '@/components/calendar-view/items/note-card';
import { PlaceholderCard } from '@/components/calendar-view/items/placeholder-card';
import { CalendarHeader } from '@/components/calendar-view/calendar-header';
import { ActionBar } from '@/components/action-bar';
import type { CalendarItem } from '@/components/calendar-view/universal-types';

export default function CalendarPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState({
    start: Date.now() - 7 * 24 * 60 * 60 * 1000, // Week ago
    end: Date.now() + 7 * 24 * 60 * 60 * 1000,   // Week ahead
  });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch calendar data
  const { items, isLoading, error } = useCalendarData({
    userId: user?.id,
    timeRange,
    enabledTypes: {
      events: true,
      tasks: true,
      notes: true,
      placeholders: false, // Enable when ready
    }
  });

  // Component registry
  const components = {
    event: EventCard,
    ai_event: AIEventCard,
    task: TaskCard,
    note: NoteCard,
    placeholder: PlaceholderCard,
  };

  // Event handlers
  const handleItemClick = (item: CalendarItem) => {
    // Handle item selection logic
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      return newSet;
    });
  };

  const handleItemDrag = (item: CalendarItem, newTime: { start: number; end: number }) => {
    // Handle drag operations based on item type
    switch (item.type) {
      case 'event':
      case 'ai_event':
        // Update event time
        break;
      case 'task':
        // Update task due time
        break;
      case 'note':
        // Update note pinned time
        break;
    }
  };

  const handleTimeSelect = (range: { start: number; end: number }) => {
    // Handle time range selection for creating new items
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-600">Error loading calendar</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <CalendarHeader
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      <div className="flex-1 relative">
        <UniversalCalendar
          items={items.map(item => ({
            ...item,
            isSelected: selectedItems.has(item.id),
          }))}
          components={components}
          timeRange={timeRange}
          timezone="America/New_York" // Get from user preferences
          onItemClick={handleItemClick}
          onItemDrag={handleItemDrag}
          onTimeSelect={handleTimeSelect}
          className="h-full"
        />

        {selectedItems.size > 0 && (
          <ActionBar
            selectedItemCount={selectedItems.size}
            onClearSelection={() => setSelectedItems(new Set())}
            // Other action bar props...
          />
        )}
      </div>
    </div>
  );
}
```

## Phase 4: Supporting Infrastructure

### 4.1 Calendar Positioning Hook (`src/components/calendar-view/hooks/use-calendar-positioning.ts`)

```typescript
import { useMemo } from 'react';
import type { CalendarItem } from '../universal-types';

export function useCalendarPositioning(
  items: CalendarItem[],
  timeRange: { start: number; end: number },
  timezone: string
) {
  return useMemo(() => {
    const timeSlots = calculateTimeSlots(timeRange, timezone);
    const positionedItems = items.map(item => {
      const position = calculateItemPosition(item, timeSlots, timeRange);
      return {
        ...item,
        position,
      };
    });

    // Handle overlapping items
    return resolveOverlaps(positionedItems);
  }, [items, timeRange, timezone]);
}

function calculateTimeSlots(
  timeRange: { start: number; end: number },
  timezone: string
) {
  // Calculate time slot grid based on range and timezone
  const SLOT_HEIGHT = 60; // pixels per hour
  const totalHours = (timeRange.end - timeRange.start) / (60 * 60 * 1000);

  return {
    slotHeight: SLOT_HEIGHT,
    totalHeight: totalHours * SLOT_HEIGHT,
    startTime: timeRange.start,
    endTime: timeRange.end,
  };
}

function calculateItemPosition(
  item: CalendarItem,
  timeSlots: any,
  timeRange: { start: number; end: number }
) {
  const startOffset = (item.start_time_ms - timeRange.start) / (60 * 60 * 1000);
  const duration = (item.end_time_ms - item.start_time_ms) / (60 * 60 * 1000);

  return {
    top: startOffset * timeSlots.slotHeight,
    left: '0%', // Will be calculated based on day column
    width: '100%', // Will be adjusted for overlaps
    height: Math.max(duration * timeSlots.slotHeight, item.metadata.minHeight),
  };
}

function resolveOverlaps(items: Array<CalendarItem & { position: any }>) {
  // Algorithm to adjust positioning for overlapping items
  // This is complex and would need detailed implementation
  return items;
}
```

### 4.2 Data Layer Extensions

Create new data domains for tasks and notes if they don't exist:

**`src/lib/data/domains/tasks.ts`**
```typescript
// Similar pattern to events.ts but for tasks
export function useTasks(uid: string | undefined, timeRange: { from: number; to: number }) {
  // Implementation for fetching tasks in time range
}

export function useCreateTask(uid?: string) {
  // Implementation for creating tasks
}

export function useUpdateTask(uid?: string) {
  // Implementation for updating tasks
}
```

**`src/lib/data/domains/notes.ts`**
```typescript
// Similar pattern to events.ts but for notes
export function useNotes(uid: string | undefined, timeRange: { from: number; to: number }) {
  // Implementation for fetching notes in time range
}
```

### 4.3 Database Schema Updates

Add new tables for tasks and notes:

```sql
-- Tasks table
CREATE TABLE tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  completed boolean DEFAULT false,
  priority task_priority DEFAULT 'medium',
  due_time timestamptz NOT NULL,
  due_time_ms bigint NOT NULL,
  project text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- Notes table
CREATE TABLE notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  color note_color DEFAULT 'yellow',
  pinned boolean DEFAULT false,
  pinned_time timestamptz,
  pinned_time_ms bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TYPE note_color AS ENUM ('yellow', 'blue', 'green', 'pink', 'purple');
```

## Phase 5: Migration Strategy

### 5.1 Gradual Migration Approach

1. **Week 1-2**: Implement core infrastructure (types, universal calendar, positioning)
2. **Week 3**: Implement event card components (maintain existing functionality)
3. **Week 4**: Add task and note components with basic functionality
4. **Week 5**: Integrate data layer and test thoroughly
5. **Week 6**: Add placeholder functionality and polish
6. **Week 7**: Performance optimization and bug fixes

### 5.2 Feature Flags

Use feature flags to gradually roll out the new system:

```typescript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  UNIVERSAL_CALENDAR: process.env.NEXT_PUBLIC_ENABLE_UNIVERSAL_CALENDAR === 'true',
  TASK_CARDS: process.env.NEXT_PUBLIC_ENABLE_TASK_CARDS === 'true',
  NOTE_CARDS: process.env.NEXT_PUBLIC_ENABLE_NOTE_CARDS === 'true',
  PLACEHOLDER_CARDS: process.env.NEXT_PUBLIC_ENABLE_PLACEHOLDER_CARDS === 'true',
};

// Conditional rendering based on flags
export default function CalendarPage() {
  if (FEATURE_FLAGS.UNIVERSAL_CALENDAR) {
    return <UniversalCalendarView />;
  }
  return <LegacyCalendarView />;
}
```

### 5.3 Testing Strategy

1. **Unit Tests**: Test each component in isolation with different props
2. **Integration Tests**: Test data flow from data layer to components
3. **Visual Regression Tests**: Ensure styling consistency
4. **Performance Tests**: Measure rendering performance with large datasets
5. **User Acceptance Tests**: Validate that existing functionality still works

## Success Metrics

1. **Functionality**: All existing calendar features work with new system
2. **Performance**: No regression in rendering performance
3. **Extensibility**: Easy to add new object types (< 1 hour for new type)
4. **Maintainability**: Components can be styled independently
5. **User Experience**: Seamless transition for existing users

## Benefits Delivered

1. **Universal Time Host**: Calendar can display any time-based data
2. **Component Flexibility**: Full Tailwind styling control for each component
3. **Type Safety**: Strong typing throughout the system
4. **Extensible Architecture**: Easy to add new object types
5. **Performance**: Efficient positioning and rendering
6. **Developer Experience**: Clean, maintainable component-based architecture

This plan transforms the calendar from a rigid event-only system into a flexible, universal time-based object host while maintaining backward compatibility and providing a smooth migration path.
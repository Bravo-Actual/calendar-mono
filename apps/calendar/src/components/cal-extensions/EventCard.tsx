'use client';

import { Person20Regular, SignOut20Regular, Sparkle20Regular, Video20Regular } from '@fluentui/react-icons';
import { motion } from 'framer-motion';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useAuth } from '@/contexts/AuthContext';
import type { ClientCategory } from '@/lib/data-v2';
import { deleteAnnotation, deleteAnnotationsByType } from '@/lib/data-v2';
import { cn } from '@/lib/utils';
import type { ShowTimeAs } from '@/types';
import type { DragHandlers, ItemLayout } from '../cal-grid/types';
import { fmtTime, fmtTimeInTimezone } from '../cal-grid/utils';
import { EventContextMenu } from './event-context-menu';

// Category colors using Fluent design tokens - automatically adapts to light/dark mode
const getCategoryColorVar = (colorString?: string): string => {
  const category = colorString?.toLowerCase();

  switch (category) {
    case 'neutral':
      return 'var(--colorNeutralStroke1)';
    case 'slate':
      return 'var(--colorPaletteSlateBackground)';
    case 'orange':
      return 'var(--colorPaletteOrangeBackground)';
    case 'yellow':
      return 'var(--colorPaletteYellowBackground)';
    case 'green':
      return 'var(--colorPaletteGreenBackground)';
    case 'blue':
      return 'var(--colorPaletteBlueBackground)';
    case 'indigo':
      return 'var(--colorPaletteIndigoBackground)';
    case 'violet':
      return 'var(--colorPaletteVioletBackground)';
    case 'fuchsia':
      return 'var(--colorPaletteFuchsiaBackground)';
    case 'rose':
      return 'var(--colorPaletteRoseBackground)';
    default:
      return 'var(--colorNeutralStroke1)';
  }
};

// Get initials from display name
const _getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Show time as indicators
const getShowTimeAsIcon = (showTimeAs?: string) => {
  switch (showTimeAs) {
    case 'tentative':
      return '?';
    case 'free':
      return '○';
    case 'busy':
      return '✓';
    case 'oof':
      return <SignOut20Regular className="w-3.5 h-3.5" />;
    case 'working_elsewhere':
      return '↗';
    default:
      return '✓'; // busy is default
  }
};

// Meeting type icons
const getMeetingTypeIcons = (item: EventItem) => {
  const icons = [];

  if (item.online_event) {
    icons.push(<Video20Regular key="video" className="w-3.5 h-3.5" />);
  }

  if (item.in_person) {
    icons.push(<Person20Regular key="person" className="w-3.5 h-3.5" />);
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
  // Owner information
  owner_id?: string;
  owner_display_name?: string | null;
  owner_avatar_url?: string | null;
  role?: 'owner' | 'attendee' | 'viewer' | 'contributor' | 'delegate_full';
  // Attendees (for events where user is owner)
  attendees?: Array<{
    user_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
    role?: string;
  }>;
}

interface EventCardProps {
  item: EventItem;
  layout: ItemLayout;
  selected: boolean;
  onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
  drag: DragHandlers;
  highlight?: {
    id: string;
    emoji_icon?: string | null;
    title?: string | null;
    message?: string | null;
  };
  timeZone?: string;

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
  onDoubleClick?: (e: React.MouseEvent) => void;
}

// Resize handle component that uses handlers from ItemHost
function ResizeHandle({
  edge,
  dragHandlers,
}: {
  edge: 'start' | 'end';
  dragHandlers: DragHandlers['move'];
}) {
  return (
    <div
      ref={dragHandlers.setNodeRef}
      {...dragHandlers.attributes}
      {...dragHandlers.listeners}
      className={cn(
        'absolute left-0 right-0 h-1.5 z-10',
        edge === 'start' ? '-top-[3px]' : '-bottom-[3px]'
      )}
      style={{ cursor: 'ns-resize' }}
    />
  );
}

export function EventCard({
  item,
  layout,
  selected,
  onMouseDownSelect,
  drag,
  highlight,
  timeZone,
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
  onDoubleClick,
}: EventCardProps) {
  const { user } = useAuth();

  const startTime = timeZone
    ? fmtTimeInTimezone(item.start_time, timeZone)
    : fmtTime(item.start_time);
  const endTime = timeZone ? fmtTimeInTimezone(item.end_time, timeZone) : fmtTime(item.end_time);

  // Get meeting icons and show time as icon
  const meetingIcons = getMeetingTypeIcons(item);
  const showTimeAsIcon = getShowTimeAsIcon(item.show_time_as);

  // Get category color for theming (Fluent design tokens)
  const categoryColor = getCategoryColorVar(item.color || item.category);

  // Determine border style based on show_time_as state
  const getBorderStyle = () => {
    switch (item.show_time_as) {
      case 'free':
        return 'border-0'; // No border for free
      case 'tentative':
        return 'border border-dashed'; // Dashed border for tentative (same width as solid)
      default:
        return 'border'; // Solid border for busy, oof, working_elsewhere
    }
  };

  const handleDeleteHighlight = async () => {
    if (!user?.id || !highlight?.id) return;

    try {
      await deleteAnnotation(user.id, highlight.id);
    } catch (_error) {
      // Silently handle error
    }
  };

  const handleClearAllHighlights = async () => {
    if (!user?.id) return;

    try {
      await deleteAnnotationsByType(user.id, 'ai_event_highlight');
    } catch (_error) {
      // Silently handle error
    }
  };

  const cardContent = (
    <motion.div
      ref={drag.move.setNodeRef}
      {...drag.move.attributes}
      {...(drag.move.listeners || {})}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDownSelect(e, item.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      className={cn(
        'absolute rounded calendar-item event-card z-20 group',
        '@container',
        highlight
          ? 'border-0 ring-2 ring-blue-400 dark:ring-indigo-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)] animate-pulse-glow'
          : cn(getBorderStyle(), 'shadow-sm'),
        'hover:shadow-md transition-all duration-200',
        selected && 'ring-2 ring-ring'
      )}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: `color-mix(in oklch, ${categoryColor} 25%, var(--colorNeutralBackground2))`,
        borderColor: categoryColor,
        color: 'var(--colorNeutralForeground1)',
      }}
    >
      <ResizeHandle edge="start" dragHandlers={drag.resizeStart} />

      <motion.div
        className="px-2 py-1 text-xs select-none h-full overflow-hidden @[64px]:block hidden relative"
        layout={false} // Prevent text content from being affected by layout animations
      >
        {layout.height >= 20 && (
          <div className="font-medium truncate flex items-center gap-2 leading-tight">
            <span className="truncate">{item.title}</span>
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              {item.private && <span>🔒</span>}
              {meetingIcons}
              <span title={item.show_time_as || 'busy'}>{showTimeAsIcon}</span>
              {highlight && (
                <HoverCard openDelay={100}>
                  <HoverCardTrigger asChild>
                    <button
                      className="flex items-center justify-center w-5 h-5 rounded-sm bg-blue-600 dark:bg-indigo-600 hover:bg-blue-700 dark:hover:bg-indigo-700 transition-colors shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Sparkle20Regular className="size-3 text-white" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start" className="w-80">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        {highlight.emoji_icon && (
                          <div className="text-2xl flex-shrink-0">{highlight.emoji_icon}</div>
                        )}
                        <div className="flex-1 space-y-1">
                          {highlight.title && (
                            <h4 className="text-sm font-semibold leading-tight">
                              {highlight.title}
                            </h4>
                          )}
                          {highlight.message && (
                            <p className="text-sm text-muted-foreground leading-tight">
                              {highlight.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteHighlight}
                          className="h-7 text-xs px-2"
                        >
                          Clear
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearAllHighlights}
                          className="h-7 text-xs px-2"
                        >
                          Clear all
                        </Button>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          </div>
        )}
        {layout.height >= 32 && (
          <div className="text-muted-foreground truncate leading-tight flex items-center gap-1.5">
            {/* Show owner name when user is NOT the owner */}
            {item.owner_display_name && item.role !== 'owner' && (
              <span>{item.owner_display_name} · </span>
            )}
            <span>
              {startTime} – {endTime}
            </span>
          </div>
        )}
      </motion.div>

      <ResizeHandle edge="end" dragHandlers={drag.resizeEnd} />
    </motion.div>
  );

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
      {cardContent}
    </EventContextMenu>
  );
}

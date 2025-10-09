'use client';

import { Sparkles } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useAuth } from '@/contexts/AuthContext';
import type { ClientAnnotation } from '@/lib/data-v2';
import { deleteAnnotation, deleteAnnotationsByType } from '@/lib/data-v2';
import { cn } from '@/lib/utils';
import type { RangeLayout } from '../cal-grid/types';

interface TimeHighlightProps {
  annotation: ClientAnnotation;
  layout: RangeLayout;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
}

/**
 * TimeHighlight - Custom renderer for AI time highlights
 * Displays AI-generated time range annotations on the calendar grid
 */
export function TimeHighlight({ annotation, layout, onMouseDown }: TimeHighlightProps) {
  const { emoji_icon, title, message } = annotation;
  const { user } = useAuth();

  const handleDeleteHighlight = async () => {
    if (!user?.id || !annotation.id) return;

    try {
      await deleteAnnotation(user.id, annotation.id);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const handleClearAllHighlights = async () => {
    if (!user?.id) return;

    try {
      await deleteAnnotationsByType(user.id, 'ai_time_highlight');
    } catch (error) {
      console.error('Failed to clear all highlights:', error);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'absolute',
        'bg-blue-400/5 dark:bg-indigo-400/5',
        'border-t border-b border-blue-400 dark:border-indigo-400',
        'drop-shadow-[0_0_12px_rgba(59,130,246,0.7)] dark:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]',
        'transition-all duration-200',
        'cursor-default group',
        'select-none'
      )}
      style={{
        top: layout.top,
        height: layout.height,
        left: 0,
        right: 0,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown?.(e, annotation.id);
      }}
    >
      <HoverCard openDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-sm bg-blue-600 dark:bg-indigo-600 hover:bg-blue-700 dark:hover:bg-indigo-700 transition-colors shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Sparkles className="w-3 h-3 text-white" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" className="w-80">
          <div className="space-y-3">
            <div className="flex gap-3">
              {emoji_icon && <div className="text-2xl flex-shrink-0">{emoji_icon}</div>}
              <div className="flex-1 space-y-1">
                {title && <h4 className="text-sm font-semibold leading-tight">{title}</h4>}
                {message && (
                  <p className="text-sm text-muted-foreground leading-tight">{message}</p>
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
    </div>
  );
}

'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import type { RangeLayout } from '../cal-grid/types';
import type { ClientAnnotation } from '@/lib/data-v2';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'absolute left-0 right-0 rounded-md',
            // Light mode - yellow background with low opacity
            'bg-yellow-500/5',
            'hover:bg-yellow-500/10',
            // Dark mode - yellow background with low opacity
            'dark:bg-yellow-400/10',
            'dark:hover:bg-yellow-400/15',
            // Border
            'border-[3px] border-yellow-500 dark:border-yellow-400',
            'hover:border-yellow-600 dark:hover:border-yellow-300',
            'transition-all duration-200',
            'cursor-default group',
            'backdrop-blur-sm',
            'select-none'
          )}
          style={{
            top: layout.top,
            height: layout.height,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDown?.(e, annotation.id);
          }}
        />
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={8}
        className="max-w-xs cursor-default"
      >
        <div className="space-y-1">
          {(emoji_icon || title) && (
            <div className="flex items-center gap-2">
              {emoji_icon && <span className="text-base">{emoji_icon}</span>}
              {title && <span className="font-semibold text-sm">{title}</span>}
            </div>
          )}
          {message && <p className="text-xs opacity-80">{message}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

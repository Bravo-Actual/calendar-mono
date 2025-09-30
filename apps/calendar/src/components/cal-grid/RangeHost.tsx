'use client';

import { motion } from 'framer-motion';
import type React from 'react';
import { cn } from '@/lib/utils';
import type { RangeLayout, RenderRange, TimeItem } from './types';

interface RangeHostProps<T extends TimeItem> {
  item: T;
  layout: RangeLayout;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
  renderRange?: RenderRange<T>;
}

// Default range renderer - simple colored overlay
function DefaultRange<T extends TimeItem>({
  item,
  layout,
  onMouseDown,
}: {
  item: T;
  layout: RangeLayout;
  onMouseDown?: (e: React.MouseEvent, id: string) => void;
}) {
  const title = (item as any).title || (item as any).label || '';
  const message = (item as any).message || '';

  return (
    <div
      className={cn(
        'absolute left-0 right-0 rounded-sm',
        'bg-primary/10 border-l-4 border-primary',
        'hover:bg-primary/20 transition-colors',
        'cursor-pointer',
        'backdrop-blur-[2px]'
      )}
      style={{
        top: layout.top,
        height: layout.height,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown?.(e, item.id);
      }}
    >
      {(title || message) && layout.height > 24 && (
        <div className="px-2 py-1 text-xs select-none overflow-hidden">
          {title && <div className="font-medium truncate text-primary">{title}</div>}
          {message && layout.height > 40 && (
            <div className="text-muted-foreground/80 text-[10px] leading-tight line-clamp-2">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RangeHost<T extends TimeItem>({
  item,
  layout,
  onMouseDown,
  renderRange,
}: RangeHostProps<T>) {
  const content = renderRange ? (
    renderRange({ item, layout, onMouseDown })
  ) : (
    <DefaultRange item={item} layout={layout} onMouseDown={onMouseDown} />
  );

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ position: 'absolute', inset: 0, zIndex: 5 }}
    >
      {content}
    </motion.div>
  );
}

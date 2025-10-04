'use client';

import * as React from 'react';

interface SimpleResizableProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  storageKey?: string;
}

export function SimpleResizable({
  children,
  defaultWidth = 400,
  minWidth = 300,
  maxWidth = 800,
  onWidthChange,
  storageKey,
}: SimpleResizableProps) {
  const [width, setWidth] = React.useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) {
          return Math.max(minWidth, Math.min(maxWidth, parsed));
        }
      }
    }
    return defaultWidth;
  });
  const [isDragging, setIsDragging] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Persist width changes
  React.useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [width, storageKey]);

  React.useEffect(() => {
    if (!isDragging) return;

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      setWidth(clampedWidth);
      onWidthChange?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, minWidth, maxWidth, onWidthChange]);

  return (
    <>
      {/* Drag Handle */}
      <div
        className="w-px cursor-col-resize relative group flex-shrink-0 bg-border transition-colors hover:bg-primary"
        onMouseDown={() => setIsDragging(true)}
      >
        {/* Invisible hit area */}
        <div className="absolute inset-y-0 -left-1 -right-1 w-3" />
        {/* Hover effect - grows on both sides without layout shift */}
        <div
          className={`absolute inset-y-0 left-0 w-0 bg-primary transition-all ${
            isDragging || 'opacity-0 group-hover:opacity-100 group-hover:w-1 group-hover:-translate-x-[1.5px]'
          } ${isDragging ? 'opacity-100 w-1 -translate-x-[1.5px]' : ''}`}
        />
      </div>

      {/* Panel */}
      <div
        ref={panelRef}
        style={{ width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
        className="h-full flex-shrink-0 overflow-hidden"
      >
        {children}
      </div>
    </>
  );
}

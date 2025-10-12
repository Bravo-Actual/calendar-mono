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
        if (!Number.isNaN(parsed)) {
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
      {/* Drag Handle - 8px wide area with hover effect */}
      <div
        className="w-2 cursor-col-resize flex-shrink-0 transition-colors hover:bg-border/50"
        onMouseDown={() => setIsDragging(true)}
      />

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

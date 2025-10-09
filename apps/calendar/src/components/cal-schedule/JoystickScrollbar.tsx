'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface JoystickScrollbarProps {
  onScroll: (delta: number) => void;
  className?: string;
}

export function JoystickScrollbar({ onScroll, className }: JoystickScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [handlePosition, setHandlePosition] = useState(50); // Center position (0-100%)
  const dragStartX = useRef<number>(0);
  const animationFrameId = useRef<number>();

  // Handle mouse down on the handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
  }, []);

  // Handle mouse move - calculate delta and scroll
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;

      const track = trackRef.current;
      const trackRect = track.getBoundingClientRect();
      const trackWidth = trackRect.width;
      const centerX = trackRect.left + trackWidth / 2;

      // Calculate position relative to center
      const deltaX = e.clientX - centerX;
      const maxDelta = trackWidth / 2;

      // Normalize to 0-100 range (50 = center)
      const normalizedPosition = 50 + (deltaX / maxDelta) * 50;
      const clampedPosition = Math.max(0, Math.min(100, normalizedPosition));

      setHandlePosition(clampedPosition);

      // Calculate scroll delta based on distance from center
      // Exponential curve for faster scrolling farther from center
      const distanceFromCenter = (clampedPosition - 50) / 50; // -1 to 1
      const scrollSpeed = Math.sign(distanceFromCenter) * Math.abs(distanceFromCenter) ** 2 * 50;

      // Cancel previous frame
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      // Smooth scrolling with requestAnimationFrame
      const scroll = () => {
        if (isDragging) {
          onScroll(scrollSpeed);
          animationFrameId.current = requestAnimationFrame(scroll);
        }
      };
      scroll();
    },
    [isDragging, onScroll]
  );

  // Handle mouse up - reset to center
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setHandlePosition(50); // Snap back to center

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }
  }, [isDragging]);

  // Set up global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div
      className={cn('absolute bottom-16 left-[calc(50%+96px)] -translate-x-1/2 z-30', className)}
    >
      {/* Floating joystick bar */}
      <div className="bg-background/90 backdrop-blur border border-border rounded-full shadow-lg px-6 py-3">
        <div ref={trackRef} className="relative w-[300px] h-2 bg-muted rounded-full cursor-pointer">
          {/* Center indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-border" />

          {/* Draggable handle */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary shadow-md transition-all cursor-grab active:cursor-grabbing',
              isDragging && 'scale-110 shadow-lg'
            )}
            style={{
              left: `calc(${handlePosition}% - 12px)`, // 12px = half of handle width
              transition: isDragging ? 'none' : 'left 0.2s ease-out',
            }}
            onMouseDown={handleMouseDown}
          />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { TimeZoneConfig, GeometryConfig } from './types';
import { minuteToY, startOfDay, addMinutes, fmtTime } from './utils';
import { cn } from '@/lib/utils';

interface TimeGutterProps {
  config: TimeZoneConfig;
  geometry: GeometryConfig;
  width: number;
  className?: string;
}

export function TimeGutter({ config, geometry, width, className }: TimeGutterProps) {
  const totalHeight = minuteToY(24 * 60, geometry);
  const base = startOfDay(new Date());

  const formatHour = (hour: number) => {
    const date = addMinutes(base, hour * 60);
    if (config.hour12) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return fmtTime(date);
    }
  };

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width, height: totalHeight }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={`line-${h}`}
          className="absolute left-0 right-0 border-t border-border/80"
          style={{ top: minuteToY(h * 60, geometry) }}
        />
      ))}

      {/* Time labels */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute right-3 text-xs text-muted-foreground select-none font-mono"
          style={{
            top: minuteToY(h * 60, geometry) + 6,
          }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );
}
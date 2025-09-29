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
    return fmtTime(date);
  };

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width, height: totalHeight }}
    >
      {/* Time labels */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute right-3 text-xs text-muted-foreground select-none font-mono"
          style={{
            top: minuteToY(h * 60, geometry) + 4,
          }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );
}
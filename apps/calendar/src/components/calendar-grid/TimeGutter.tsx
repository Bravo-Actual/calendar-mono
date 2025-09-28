import React from 'react';
import type { TimeZoneConfig, GeometryConfig } from './types';
import { minuteToY, startOfDay, addMinutes } from './utils';
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
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: config.hour12,
      timeZone: config.timeZone,
    }).format(date);
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
          className="absolute right-2 text-xs text-muted-foreground select-none font-mono"
          style={{
            top: minuteToY(h * 60, geometry) - 8,
          }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );
}
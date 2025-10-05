'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface InputGroupTimeProps {
  label: string;
  icon?: React.ReactNode;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  onClick?: () => void;
}

export function InputGroupTime({
  label,
  icon,
  startTime,
  endTime,
  allDay = false,
  onClick,
}: InputGroupTimeProps) {
  // Format display value
  const displayValue = React.useMemo(() => {
    if (allDay) {
      return startTime.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    const datePart = startTime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const startTimePart = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const endTimePart = endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${datePart}, ${startTimePart} - ${endTimePart}`;
  }, [startTime, endTime, allDay]);

  return (
    <div onClick={onClick} className={cn(onClick && 'cursor-pointer')}>
      <InputGroup className="h-9 items-center">
        <InputGroupAddon align="inline-start">
          {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
          <Label className={cn('text-sm text-muted-foreground', onClick && 'cursor-pointer')}>
            {label}:
          </Label>
        </InputGroupAddon>
        <div className="flex flex-1 items-center justify-between px-2 min-w-0">
          <span className="text-sm truncate">{displayValue}</span>
          {onClick && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
        </div>
      </InputGroup>
    </div>
  );
}

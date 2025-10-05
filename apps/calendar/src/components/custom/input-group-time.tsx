'use client';

import { ChevronDown, Target } from 'lucide-react';
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface InputGroupTimeProps {
  label: string;
  icon?: React.ReactNode;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  onClick?: () => void;
  onChange?: (startTime: Date, endTime: Date) => void;
}

export function InputGroupTime({
  label,
  icon,
  startTime,
  endTime,
  allDay = false,
  onClick,
  onChange,
}: InputGroupTimeProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date>(startTime);
  const [startTimeStr, setStartTimeStr] = React.useState('');
  const [endTimeStr, setEndTimeStr] = React.useState('');
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (!triggerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(triggerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize time strings when startTime/endTime change
  React.useEffect(() => {
    const formatTime = (date: Date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    setStartTimeStr(formatTime(startTime));
    setEndTimeStr(formatTime(endTime));
    setSelectedDate(startTime);
  }, [startTime, endTime]);

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

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleApply = () => {
    if (onChange && selectedDate) {
      // Parse time strings
      const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
      const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

      const newStart = new Date(selectedDate);
      newStart.setHours(startHours, startMinutes, 0, 0);

      const newEnd = new Date(selectedDate);
      newEnd.setHours(endHours, endMinutes, 0, 0);

      onChange(newStart, newEnd);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <InputGroup ref={triggerRef} className="h-9 items-center cursor-pointer">
          <InputGroupAddon align="inline-start">
            {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
            <Label className="text-sm text-muted-foreground cursor-pointer">{label}:</Label>
          </InputGroupAddon>
          <div className="flex flex-1 items-center justify-between px-2 min-w-0">
            <span className="text-sm truncate">{displayValue}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          </div>
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Target className="h-4 w-4" />
            </button>
          </InputGroupAddon>
        </InputGroup>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="p-0"
        style={{ width: width > 0 ? `${width}px` : 'auto' }}
        sideOffset={4}
      >
        <div className="p-3 space-y-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            initialFocus
          />
          <div className="space-y-2 border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                  Start Time
                </Label>
                <input
                  id="start-time"
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                  End Time
                </Label>
                <input
                  id="end-time"
                  type="time"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <button
              onClick={handleApply}
              className="w-full h-9 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

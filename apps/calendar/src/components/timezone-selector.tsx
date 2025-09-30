'use client';

import { Temporal } from '@js-temporal/polyfill';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimezoneSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  timeFormat?: '12_hour' | '24_hour';
}

export function TimezoneSelector({
  value,
  onValueChange,
  placeholder = 'Select your timezone...',
  className,
  timeFormat = '24_hour',
}: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');

  // Get all available timezones from Temporal
  const allTimezones = Intl.supportedValuesOf('timeZone');

  // Group timezones by region
  const timezonesByRegion = allTimezones.reduce(
    (acc, tz) => {
      const [region] = tz.split('/');
      if (!acc[region]) acc[region] = [];
      acc[region].push(tz);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // Get filtered timezones based on selected region
  const getTimezonesByRegion = (region: string) => {
    if (region === 'all') return allTimezones;
    return timezonesByRegion[region] || [];
  };

  // Format timezone for display
  const formatTimezone = (tz: string) => {
    const [_region, city] = tz.split('/');
    if (!city) return tz;
    return city.replace(/_/g, ' ');
  };

  // Get current time in timezone using Temporal
  const getCurrentTimeInTimezone = (tz: string) => {
    try {
      const now = Temporal.Now.zonedDateTimeISO(tz);

      if (timeFormat === '12_hour') {
        const hour12 = now.hour === 0 ? 12 : now.hour > 12 ? now.hour - 12 : now.hour;
        const ampm = now.hour >= 12 ? 'PM' : 'AM';
        return `${hour12}:${String(now.minute).padStart(2, '0')} ${ampm}`;
      } else {
        return `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
      }
    } catch {
      return null;
    }
  };

  // Get UTC offset for timezone using Temporal
  const getTimezoneOffset = (tz: string) => {
    try {
      const now = Temporal.Now.zonedDateTimeISO(tz);
      const offsetMinutes = now.offsetNanoseconds / 1_000_000 / 1000 / 60;
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  // Get current timezone info
  const currentTimezone = value
    ? {
        id: value,
        region: value.split('/')[0],
        city: formatTimezone(value),
      }
    : null;

  // Get major regions for filter buttons
  const majorRegions = ['America', 'Europe', 'Asia', 'Africa', 'Australia', 'Pacific'];
  const availableRegions = Object.keys(timezonesByRegion)
    .filter((region) => majorRegions.includes(region))
    .sort();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
        >
          {currentTimezone ? (
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{currentTimezone.city}</span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {currentTimezone.region}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search timezones by city name..." className="h-9" />

          {/* Region Filter Buttons */}
          <div className="flex flex-wrap gap-1 p-2 border-b">
            <Button
              variant={selectedRegion === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedRegion('all')}
            >
              All
            </Button>
            {availableRegions.map((region) => (
              <Button
                key={region}
                variant={selectedRegion === region ? 'default' : 'outline'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedRegion(region)}
              >
                {region}
              </Button>
            ))}
          </div>

          <CommandList className="max-h-[300px]">
            <CommandEmpty>No timezones found.</CommandEmpty>

            {/* Filtered Timezones */}
            <CommandGroup>
              {getTimezonesByRegion(selectedRegion).map((tz) => {
                const [region, _city] = tz.split('/');
                const displayCity = formatTimezone(tz);
                const currentTime = getCurrentTimeInTimezone(tz);
                const offset = getTimezoneOffset(tz);

                return (
                  <CommandItem
                    key={tz}
                    value={`${displayCity} ${tz} ${region}`}
                    onSelect={() => {
                      onValueChange(tz);
                      setOpen(false);
                    }}
                    className="flex items-center py-3"
                  >
                    <Check
                      className={cn(
                        'mr-3 h-4 w-4 flex-shrink-0',
                        value === tz ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayCity}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{region}</span>
                        {currentTime && (
                          <span className="text-xs text-blue-600 font-mono">{currentTime}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{tz}</span>
                        {offset && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-1 py-0.5 rounded">
                            {offset}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface InputGroupDropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface InputGroupDropdownProps {
  label: string;
  icon?: React.ReactNode;
  options: InputGroupDropdownOption[];
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function InputGroupDropdown({
  label,
  icon,
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
}: InputGroupDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (triggerRef.current) {
      setWidth(triggerRef.current.offsetWidth);
    }
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || placeholder;
  const displayIcon = selectedOption?.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div ref={triggerRef} className="w-full">
          <InputGroup className="h-9 items-center cursor-pointer">
            <InputGroupAddon align="inline-start">
              {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
              <Label className="text-sm text-muted-foreground cursor-pointer">{label}:</Label>
            </InputGroupAddon>
            <div className="flex flex-1 items-center justify-between px-2 cursor-pointer min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {displayIcon && <span className="shrink-0 [&>*]:size-3">{displayIcon}</span>}
                <span
                  className={cn(
                    'text-sm truncate min-w-0',
                    !selectedOption && 'text-muted-foreground'
                  )}
                >
                  {displayValue}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
            </div>
          </InputGroup>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="p-2"
        style={{ width: width > 0 ? `${width}px` : 'auto' }}
        sideOffset={4}
      >
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                'hover:bg-accent hover:text-accent-foreground',
                value === option.value && 'bg-accent text-accent-foreground'
              )}
            >
              {option.icon && <span className="shrink-0 [&>*]:size-3">{option.icon}</span>}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

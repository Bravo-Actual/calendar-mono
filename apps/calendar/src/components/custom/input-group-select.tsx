'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface InputGroupSelectOption {
  value: string;
  label: string;
  checked: boolean;
}

export interface InputGroupSelectProps {
  label: string;
  icon?: React.ReactNode;
  options: InputGroupSelectOption[];
  onOptionChange: (value: string, checked: boolean) => void;
  placeholder?: string;
}

export function InputGroupSelect({
  label,
  icon,
  options,
  onOptionChange,
  placeholder = 'Select options...',
}: InputGroupSelectProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (triggerRef.current) {
      setWidth(triggerRef.current.offsetWidth);
    }
  }, []);

  const selectedLabels = options
    .filter((opt) => opt.checked)
    .map((opt) => opt.label)
    .join(', ');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div ref={triggerRef}>
          <InputGroup className="h-9 items-center cursor-pointer">
            <InputGroupAddon align="inline-start">
              {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
              <Label className="text-sm text-muted-foreground cursor-pointer">{label}:</Label>
            </InputGroupAddon>
            <div className="flex flex-1 items-center justify-between px-2 cursor-pointer min-w-0">
              <span className={cn('text-sm truncate', !selectedLabels && 'text-muted-foreground')}>
                {selectedLabels || placeholder}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
            </div>
          </InputGroup>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="p-4" style={{ width: width > 0 ? `${width}px` : 'auto' }} sideOffset={4}>
        <div className="space-y-3">
          <div className="text-sm font-medium">{label}</div>
          <div className="space-y-2.5">
            {options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={option.value}
                  checked={option.checked}
                  onCheckedChange={(checked) =>
                    onOptionChange(option.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={option.value}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

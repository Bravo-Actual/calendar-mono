import type { ComponentProps, HTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SuggestionsProps = HTMLAttributes<HTMLDivElement>;

export const Suggestions = ({ className, ...props }: SuggestionsProps) => (
  <div className={cn('flex flex-wrap gap-2', className)} {...props} />
);

export type SuggestionProps = ComponentProps<typeof Button> & {
  suggestion: string;
  onClick: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = 'outline',
  size = 'sm',
  ...props
}: SuggestionProps) => (
  <Button
    variant={variant}
    size={size}
    onClick={() => onClick(suggestion)}
    className={cn('text-xs', className)}
    {...props}
  >
    {suggestion}
  </Button>
);

import { AlertTriangle, X } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorAlertProps extends HTMLAttributes<HTMLDivElement> {
  error: string | Error;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, onDismiss, className, ...props }: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4',
        'animate-in slide-in-from-bottom-2 duration-300',
        className
      )}
      role="alert"
      {...props}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-destructive">Error</p>
        <p className="text-sm text-destructive/90 break-words whitespace-pre-wrap overflow-wrap-anywhere">
          {errorMessage}
        </p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 hover:bg-destructive/10"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

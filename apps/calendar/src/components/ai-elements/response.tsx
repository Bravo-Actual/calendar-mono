'use client';

import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
        'prose-headings:mb-2 prose-headings:mt-4',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';

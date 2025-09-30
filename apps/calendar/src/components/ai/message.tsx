import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-start gap-3 py-2',
      from === 'user' ? 'is-user' : 'is-assistant',
      // Ensure proper width constraints and overflow handling - prevent expansion of chat canvas
      // Adjusted for 48px avatar + 12px gap
      '[&>div:last-child]:max-w-[calc(100%-60px)] [&>div:last-child]:min-w-0',
      // Critical: prevent the message from expanding the parent container
      'min-w-0 max-w-full overflow-hidden',
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-lg px-4 py-3 text-foreground',
      'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground',
      'group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground',
      // Critical: prevent expanding parent container while allowing internal scroll
      'min-w-0 max-w-full flex-shrink-0',
      // Allow embedded content to scroll horizontally within the bubble boundaries
      'overflow-hidden', // This prevents expansion, children can still scroll
      // Basic text wrapping for regular text content
      'break-words overflow-wrap-anywhere',
      // Ensure minimum height for single line of text plus padding (py-3 = 24px total)
      'min-h-[calc(1.5rem+1.5rem)]', // line-height + py-3 padding
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({ src, name, className, ...props }: MessageAvatarProps) => (
  <Avatar className={cn('w-12 h-12 ring ring-1 ring-border', className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
  </Avatar>
);

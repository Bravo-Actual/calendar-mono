'use client';

import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type ConversationProps = {
  className?: string;
  children: React.ReactNode;
  isStreaming?: boolean;
};

const ConversationContext = React.createContext<{
  isAtBottom: boolean;
  scrollToBottom: () => void;
} | null>(null);

export const useConversationContext = () => {
  const context = React.useContext(ConversationContext);
  if (!context) {
    throw new Error('Conversation components must be used within a Conversation');
  }
  return context;
};

export const Conversation = ({ className, children, isStreaming = false }: ConversationProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getViewport = useCallback(() => {
    if (scrollAreaRef.current) {
      return scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLDivElement;
    }
    return null;
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [getViewport]);

  const handleScroll = useCallback(() => {
    // Clear any pending scroll detection updates
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll detection during streaming to prevent false negatives
    const delay = isStreaming ? 150 : 0;

    scrollTimeoutRef.current = setTimeout(() => {
      const viewport = getViewport();
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        // Use more lenient threshold during streaming
        const threshold = isStreaming ? 50 : 10;
        const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
        setIsAtBottom(atBottom);
      }
    }, delay);
  }, [getViewport, isStreaming]);

  // Auto-scroll when streaming or when explicitly at bottom
  useEffect(() => {
    // Always scroll during streaming, or when at bottom during normal chat
    if (isAtBottom || isStreaming) {
      // Small delay to ensure content has rendered
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [isAtBottom, isStreaming, scrollToBottom]);

  // Set up scroll listener
  useEffect(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => {
        viewport.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll, getViewport]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ConversationContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <ScrollArea ref={scrollAreaRef} className={cn('h-full flex flex-col', className)}>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </ScrollArea>
    </ConversationContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<'div'>;

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => (
  <div className={cn('flex flex-col gap-4', className)} {...props}>
    {children}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationContext();

  if (isAtBottom) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('absolute bottom-4 right-4 z-10 rounded-full shadow-md', className)}
      onClick={scrollToBottom}
      {...props}
    >
      <ArrowDownIcon className="h-4 w-4" />
    </Button>
  );
};

"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Context for sharing scroll state between components
const ConversationScrollContext = createContext<{
  isAtBottom: boolean;
  scrollToBottom: (behavior?: "smooth" | "instant") => void;
} | null>(null);

const useConversationScrollContext = () => {
  const context = useContext(ConversationScrollContext);
  if (!context) {
    throw new Error("Conversation components must be used within a Conversation");
  }
  return context;
};

// Main Conversation component props matching AI Elements interface
export type ConversationProps = Omit<ComponentProps<"div">, "children"> & {
  children?: React.ReactNode;
  /**
   * Scroll behavior when content is initially rendered
   * @default "smooth"
   */
  initial?: "smooth" | "instant";
  /**
   * Scroll behavior when content resizes (new messages, etc.)
   * @default "smooth"
   */
  resize?: "smooth" | "instant";
};

/**
 * Conversation container with auto-scroll to bottom behavior.
 * Compatible with AI Elements but uses shadcn ScrollArea instead of StickToBottom.
 */
export const Conversation = ({
  className,
  children,
  initial = "smooth",
  resize = "smooth",
  ...props
}: ConversationProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  const getViewport = useCallback(() => {
    if (scrollAreaRef.current) {
      return scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLDivElement;
    }
    return null;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: "smooth" | "instant" = "smooth") => {
      const viewport = getViewport();
      if (viewport) {
        if (behavior === "smooth") {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "smooth",
          });
        } else {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    },
    [getViewport]
  );

  const handleScroll = useCallback(() => {
    // Clear any pending scroll detection updates
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll detection slightly to prevent jitter
    scrollTimeoutRef.current = setTimeout(() => {
      const viewport = getViewport();
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        // Use lenient threshold to account for sub-pixel rendering
        const threshold = 10;
        const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
        setIsAtBottom(atBottom);
      }
    }, 50);
  }, [getViewport]);

  // Auto-scroll when at bottom and content changes
  useEffect(() => {
    if (isAtBottom) {
      // Use initial behavior on first render, resize behavior after
      const behavior = isInitialMount.current ? initial : resize;

      // Use requestAnimationFrame to ensure content has rendered
      requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });

      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
    }
  }, [children, isAtBottom, initial, resize, scrollToBottom]);

  // Set up scroll listener
  useEffect(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll);
      // Initial check
      handleScroll();
      return () => {
        viewport.removeEventListener("scroll", handleScroll);
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
    <ConversationScrollContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <ScrollArea
        ref={scrollAreaRef}
        className={cn("relative flex-1", className)}
        role="log"
        {...props}
      >
        {children}
      </ScrollArea>
    </ConversationScrollContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<"div">;

/**
 * Content wrapper for Conversation messages.
 * Provides consistent padding and spacing.
 */
export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div className={cn("p-4", className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

/**
 * Empty state component for when there are no messages.
 */
export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

/**
 * Scroll to bottom button that appears when user scrolls up.
 */
export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationScrollContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};

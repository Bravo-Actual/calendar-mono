"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface SpringAnimation {
  /**
   * A value from 0 to 1, on how much to damp the animation.
   * 0 means no damping, 1 means full damping.
   * @default 0.7
   */
  damping?: number;
  /**
   * The stiffness of how fast/slow the animation gets up to speed.
   * @default 0.05
   */
  stiffness?: number;
  /**
   * The inertial mass associated with the animation.
   * Higher numbers make the animation slower.
   * @default 1.25
   */
  mass?: number;
}

export type Animation = ScrollBehavior | SpringAnimation;

export interface ScrollElements {
  scrollElement: HTMLElement;
  contentElement: HTMLElement;
}

export type GetTargetScrollTop = (targetScrollTop: number, context: ScrollElements) => number;

export type ScrollToBottomOptions = ScrollBehavior | {
  animation?: Animation;
  /**
   * Whether to wait for any existing scrolls to finish before
   * performing this one. Or if a millisecond is passed,
   * it will wait for that duration before performing the scroll.
   * @default false
   */
  wait?: boolean | number;
  /**
   * Whether to prevent the user from escaping the scroll,
   * by scrolling up with their mouse.
   */
  ignoreEscapes?: boolean;
  /**
   * Only scroll to the bottom if we're already at the bottom.
   * @default false
   */
  preserveScrollPosition?: boolean;
  /**
   * The extra duration in ms that this scroll event should persist for.
   * (in addition to the time that it takes to get to the bottom)
   * @default 0
   */
  duration?: number | Promise<void>;
};

export type ScrollToBottom = (scrollOptions?: ScrollToBottomOptions) => Promise<boolean> | boolean;
export type StopScroll = () => void;

interface ScrollState {
  scrollTop: number;
  lastScrollTop?: number;
  targetScrollTop: number;
  velocity: number;
  accumulated: number;
  isAnimating: boolean;
  animationBehavior?: "instant" | SpringAnimation;
  animationStartTime?: number;
  animationPromise?: Promise<boolean>;
  animationResolve?: (value: boolean) => void;
  ignoreEscapes?: boolean;
  lastFrameTime?: number;
  ignoreScrollToTop?: number;
  resizeDifference?: number;
  escapedFromLock: boolean;
  isAtBottom: boolean;
}

// Context for sharing scroll state between components
interface ConversationScrollContextValue {
  isAtBottom: boolean;
  isNearBottom: boolean;
  escapedFromLock: boolean;
  scrollToBottom: ScrollToBottom;
  stopScroll: StopScroll;
}

const ConversationScrollContext = createContext<ConversationScrollContextValue | null>(null);

const useConversationScrollContext = () => {
  const context = useContext(ConversationScrollContext);
  if (!context) {
    throw new Error("Conversation components must be used within a Conversation");
  }
  return context;
};

// ============================================================================
// Main Conversation Component
// ============================================================================

export type ConversationProps = Omit<ComponentProps<"div">, "children" | "dir"> & {
  children?: React.ReactNode;
  /**
   * Scroll behavior when content is initially rendered
   * @default "smooth"
   */
  initial?: Animation | boolean;
  /**
   * Scroll behavior when content resizes (new messages, etc.)
   * @default "smooth"
   */
  resize?: Animation;
  /**
   * Callback to customize where "bottom" is
   */
  targetScrollTop?: GetTargetScrollTop;
  /**
   * Spring animation damping (0-1)
   * @default 0.7
   */
  damping?: number;
  /**
   * Spring animation stiffness
   * @default 0.05
   */
  stiffness?: number;
  /**
   * Spring animation mass
   * @default 1.25
   */
  mass?: number;
};

const DEFAULT_SPRING: Required<SpringAnimation> = {
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
};

const STICK_TO_BOTTOM_OFFSET_PX = 70; // px - matches use-stick-to-bottom
const RETAIN_ANIMATION_DURATION_MS = 350;
const SIXTY_FPS_INTERVAL_MS = 1000 / 60;

// Animation cache for performance (from use-stick-to-bottom)
const animationCache = new Map<string, Required<SpringAnimation>>();

// Merge multiple animations into one (from use-stick-to-bottom)
function mergeAnimations(...animations: (Animation | boolean | undefined)[]): Animation {
  const result = { ...DEFAULT_SPRING };
  let instant = false;

  for (const animation of animations) {
    if (animation === "instant") {
      instant = true;
      continue;
    }
    if (typeof animation !== "object" || !animation) {
      continue;
    }
    instant = false;
    result.damping = animation.damping ?? result.damping;
    result.stiffness = animation.stiffness ?? result.stiffness;
    result.mass = animation.mass ?? result.mass;
  }

  const key = JSON.stringify(result);
  if (!animationCache.has(key)) {
    animationCache.set(key, Object.freeze(result));
  }

  return instant ? "instant" : animationCache.get(key)!;
}

// Global mouse tracking for text selection detection (from use-stick-to-bottom)
let mouseDown = false;
if (typeof globalThis.document !== 'undefined') {
  globalThis.document.addEventListener("mousedown", () => {
    mouseDown = true;
  });
  globalThis.document.addEventListener("mouseup", () => {
    mouseDown = false;
  });
  globalThis.document.addEventListener("click", () => {
    mouseDown = false;
  });
}

/**
 * Conversation container with auto-scroll to bottom behavior.
 * Full use-stick-to-bottom implementation using shadcn ScrollArea.
 */
export const Conversation = ({
  className,
  children,
  initial = "smooth",
  resize = "smooth",
  targetScrollTop: customTargetScrollTop,
  damping = DEFAULT_SPRING.damping,
  stiffness = DEFAULT_SPRING.stiffness,
  mass = DEFAULT_SPRING.mass,
  ...props
}: ConversationProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [escapedFromLock, setEscapedFromLock] = useState(false);

  const scrollStateRef = useRef<ScrollState>({
    scrollTop: 0,
    targetScrollTop: 0,
    velocity: 0,
    accumulated: 0,
    isAnimating: false,
    escapedFromLock: false,
    isAtBottom: initial !== false,
  });

  const animationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitialMount = useRef(true);

  const getViewport = useCallback(() => {
    if (scrollAreaRef.current) {
      return scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLDivElement;
    }
    return null;
  }, []);

  // isSelecting - checks if user is selecting text (from use-stick-to-bottom)
  const isSelecting = useCallback(() => {
    if (!mouseDown) {
      return false;
    }
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }
    const range = selection.getRangeAt(0);
    const viewport = getViewport();
    if (!viewport) return false;

    return (
      range.commonAncestorContainer.contains(viewport) ||
      viewport.contains(range.commonAncestorContainer)
    );
  }, [getViewport]);

  const getTargetScrollTop = useCallback(() => {
    const viewport = getViewport();
    if (!viewport || !contentRef.current) return 0;

    const baseTarget = viewport.scrollHeight - viewport.clientHeight;

    if (customTargetScrollTop) {
      return customTargetScrollTop(baseTarget, {
        scrollElement: viewport,
        contentElement: contentRef.current,
      });
    }

    return baseTarget;
  }, [getViewport, customTargetScrollTop]);

  // Compute scroll state properties (like use-stick-to-bottom)
  const computeScrollState = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const scrollTop = viewport.scrollTop;
    const targetScrollTop = getTargetScrollTop();
    const scrollDifference = targetScrollTop - scrollTop;
    const isNear = scrollDifference <= STICK_TO_BOTTOM_OFFSET_PX;

    scrollStateRef.current.scrollTop = scrollTop;
    scrollStateRef.current.targetScrollTop = targetScrollTop;

    return { scrollTop, targetScrollTop, scrollDifference, isNear };
  }, [getViewport, getTargetScrollTop]);

  const stopScroll = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (scrollStateRef.current.animationResolve) {
      scrollStateRef.current.animationResolve(false);
    }

    scrollStateRef.current.isAnimating = false;
    scrollStateRef.current.velocity = 0;
    scrollStateRef.current.accumulated = 0;
    scrollStateRef.current.animationBehavior = undefined;
    scrollStateRef.current.animationPromise = undefined;
    scrollStateRef.current.animationResolve = undefined;
  }, []);

  const animateScroll = useCallback((timestamp: number) => {
    const viewport = getViewport();
    if (!viewport || !scrollStateRef.current.isAnimating) return;

    const state = scrollStateRef.current;
    const springConfig = state.animationBehavior as SpringAnimation;

    if (!state.animationStartTime) {
      state.animationStartTime = timestamp;
      state.lastFrameTime = timestamp;
    }

    const deltaTime = Math.min((timestamp - (state.lastFrameTime || timestamp)) / 1000, 0.1);
    state.lastFrameTime = timestamp;

    const currentScroll = viewport.scrollTop;
    const target = state.targetScrollTop;
    const distance = target - currentScroll;

    // Check if we've reached the target (within 1px)
    if (Math.abs(distance) < 1 && Math.abs(state.velocity) < 0.5) {
      viewport.scrollTop = target;
      stopScroll();
      return;
    }

    // Spring physics
    const springDamping = springConfig.damping ?? DEFAULT_SPRING.damping;
    const springStiffness = springConfig.stiffness ?? DEFAULT_SPRING.stiffness;
    const springMass = springConfig.mass ?? DEFAULT_SPRING.mass;

    const acceleration = (springStiffness * distance - springDamping * state.velocity) / springMass;
    state.velocity += acceleration * deltaTime * 1000; // Scale for frame rate
    state.accumulated += state.velocity * deltaTime * 1000;

    const newScroll = currentScroll + state.velocity * deltaTime * 1000;
    viewport.scrollTop = Math.max(0, Math.min(target, newScroll));

    animationFrameRef.current = requestAnimationFrame(animateScroll);
  }, [getViewport, stopScroll]);

  const scrollToBottom: ScrollToBottom = useCallback((options) => {
    const viewport = getViewport();
    if (!viewport) return false;

    // Parse options
    const opts = typeof options === "string" ? { animation: options } : (options || {});
    const {
      animation = resize,
      wait = false,
      ignoreEscapes = false,
      preserveScrollPosition = false,
      duration = 0,
    } = opts;

    // If preserveScrollPosition and user has escaped from lock, don't scroll
    if (preserveScrollPosition && escapedFromLock) {
      return false;
    }

    // Handle wait option
    if (wait) {
      if (scrollStateRef.current.isAnimating) {
        const waitTime = typeof wait === "number" ? wait : 0;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(scrollToBottom({ ...opts, wait: false }));
          }, waitTime);
        });
      }
    }

    const targetScrollTop = getTargetScrollTop();
    scrollStateRef.current.targetScrollTop = targetScrollTop;
    scrollStateRef.current.ignoreEscapes = ignoreEscapes;
    setEscapedFromLock(false);

    // Handle instant scroll
    if (animation === "instant") {
      viewport.scrollTop = targetScrollTop;
      scrollStateRef.current.ignoreScrollToTop = viewport.scrollTop;
      return true;
    }

    // Handle native smooth scroll
    if (animation === "smooth") {
      viewport.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });
      return true;
    }

    // Handle spring animation
    const springConfig = animation as SpringAnimation;
    stopScroll(); // Stop any existing animation

    scrollStateRef.current.isAnimating = true;
    scrollStateRef.current.animationBehavior = springConfig;
    scrollStateRef.current.animationStartTime = undefined;
    scrollStateRef.current.velocity = 0;
    scrollStateRef.current.accumulated = 0;

    const promise = new Promise<boolean>((resolve) => {
      scrollStateRef.current.animationResolve = resolve;
    });
    scrollStateRef.current.animationPromise = promise;

    animationFrameRef.current = requestAnimationFrame(animateScroll);

    // Handle duration
    if (duration) {
      const durationMs = typeof duration === "number" ? duration : 0;
      Promise.race([
        promise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), durationMs)),
      ]).then(() => {
        if (scrollStateRef.current.animationResolve) {
          scrollStateRef.current.animationResolve(true);
        }
      });
    }

    return promise;
  }, [getViewport, getTargetScrollTop, resize, isAtBottom, stopScroll, animateScroll]);

  // Track user scrolling (matches use-stick-to-bottom implementation)
  const handleScroll = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const state = scrollStateRef.current;
    const scrollTop = viewport.scrollTop;
    const { ignoreScrollToTop } = state;
    let { lastScrollTop = scrollTop } = state;

    state.scrollTop = scrollTop;
    state.lastScrollTop = scrollTop;
    state.ignoreScrollToTop = undefined;

    // Handle ignored scroll events during animation
    if (ignoreScrollToTop && ignoreScrollToTop > scrollTop) {
      lastScrollTop = ignoreScrollToTop;
    }

    const scrollState = computeScrollState();
    if (!scrollState) return;

    setIsNearBottom(scrollState.isNear);

    // Timeout to handle resize/scroll race conditions (from use-stick-to-bottom)
    setTimeout(() => {
      // Ignore if resize is happening
      if (state.resizeDifference || scrollTop === ignoreScrollToTop) {
        return;
      }

      // Check if user is selecting text
      if (isSelecting()) {
        state.escapedFromLock = true;
        state.isAtBottom = false;
        setEscapedFromLock(true);
        setIsAtBottom(false);
        return;
      }

      const isScrollingDown = scrollTop > lastScrollTop;
      const isScrollingUp = scrollTop < lastScrollTop;

      // Don't allow escape if ignoreEscapes is set
      if (state.ignoreEscapes) {
        if (viewport) {
          viewport.scrollTop = lastScrollTop;
        }
        return;
      }

      // User scrolled up - escape from lock only if beyond threshold
      if (isScrollingUp) {
        // Only escape if we're beyond the threshold (not near bottom)
        if (!scrollState.isNear) {
          state.escapedFromLock = true;
          setEscapedFromLock(true);
        }
        state.isAtBottom = false;
        setIsAtBottom(false);
      }

      // User scrolled down - clear escape
      if (isScrollingDown) {
        state.escapedFromLock = false;
        setEscapedFromLock(false);
      }

      // Set isAtBottom if not escaped and near bottom
      if (!state.escapedFromLock && scrollState.isNear) {
        state.isAtBottom = true;
        setIsAtBottom(true);
      }
    }, 1);
  }, [getViewport, computeScrollState, isSelecting]);

  // Handle wheel scrolling (from use-stick-to-bottom)
  const handleWheel = useCallback((event: WheelEvent) => {
    let element = event.target as HTMLElement | null;
    if (!element) return;

    // Find the scrollable element
    while (element && !["scroll", "auto"].includes(getComputedStyle(element).overflow)) {
      if (!element.parentElement) {
        return;
      }
      element = element.parentElement;
    }

    const viewport = getViewport();
    const state = scrollStateRef.current;

    // If scrolling up with mouse wheel, escape from lock
    if (
      element === viewport &&
      event.deltaY < 0 &&
      viewport &&
      viewport.scrollHeight > viewport.clientHeight &&
      !state.ignoreEscapes
    ) {
      state.escapedFromLock = true;
      state.isAtBottom = false;
      setEscapedFromLock(true);
      setIsAtBottom(false);
    }
  }, [getViewport]);

  // Auto-scroll when content changes (matches use-stick-to-bottom behavior)
  useEffect(() => {
    // Only auto-scroll if near/at bottom AND user hasn't escaped from lock
    if ((isAtBottom || isNearBottom) && !escapedFromLock) {
      const behavior = isInitialMount.current ? initial : resize;

      // Convert boolean initial to animation
      const animation = typeof behavior === "boolean"
        ? (behavior ? "instant" : undefined)
        : behavior;

      if (animation) {
        requestAnimationFrame(() => {
          scrollToBottom({ animation });
        });
      }

      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
    }
  }, [children, isAtBottom, isNearBottom, escapedFromLock, initial, resize, scrollToBottom]);

  // Setup scroll and wheel listeners (from use-stick-to-bottom)
  useEffect(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      viewport.addEventListener("wheel", handleWheel as any, { passive: true });
      // Initial state computation
      const scrollState = computeScrollState();
      if (scrollState) {
        setIsNearBottom(scrollState.isNear);
      }
      return () => {
        viewport.removeEventListener("scroll", handleScroll);
        viewport.removeEventListener("wheel", handleWheel as any);
      };
    }
  }, [handleScroll, handleWheel, computeScrollState, getViewport]);

  // Setup ResizeObserver for content changes (from use-stick-to-bottom)
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport || !contentRef.current) return;

    let previousHeight: number | undefined;
    const state = scrollStateRef.current;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { height } = entry.contentRect;
      const difference = height - (previousHeight ?? height);
      state.resizeDifference = difference;

      // Sometimes the browser can overscroll past the target
      if (state.scrollTop > state.targetScrollTop) {
        if (viewport) {
          viewport.scrollTop = state.targetScrollTop;
          state.scrollTop = state.targetScrollTop;
        }
      }

      const scrollState = computeScrollState();
      if (scrollState) {
        setIsNearBottom(scrollState.isNear);
      }

      if (difference >= 0) {
        // Positive resize (content growing) - scroll to bottom if already at bottom
        const animation = mergeAnimations(
          { damping, stiffness, mass },
          previousHeight ? resize : initial
        );
        scrollToBottom({
          animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === "instant" ? undefined : RETAIN_ANIMATION_DURATION_MS,
        });
      } else {
        // Negative resize (content shrinking) - un-escape if near bottom
        if (scrollState?.isNear) {
          state.escapedFromLock = false;
          state.isAtBottom = true;
          setEscapedFromLock(false);
          setIsAtBottom(true);
        }
      }

      previousHeight = height;

      // Reset resize difference after scroll event
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (state.resizeDifference === difference) {
            state.resizeDifference = 0;
          }
        }, 1);
      });
    });

    resizeObserver.observe(contentRef.current);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, [getViewport, computeScrollState, resize, initial, damping, stiffness, mass, scrollToBottom]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopScroll();
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [stopScroll]);

  return (
    <ConversationScrollContext.Provider
      value={{
        isAtBottom: isAtBottom || isNearBottom, // Combined like use-stick-to-bottom
        isNearBottom,
        escapedFromLock,
        scrollToBottom,
        stopScroll
      }}
    >
      <ScrollArea
        ref={scrollAreaRef}
        className={cn("relative flex-1", className)}
        role="log"
        {...props}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </ScrollArea>
    </ConversationScrollContext.Provider>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

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

"use client"

import React from "react"
import { motion } from "framer-motion"
import type { CalEvent, EventId, EventCategory, ShowTimeAs } from "./types"
import { MIN_SLOT_PX } from "./utils"
import { cn } from "../lib/utils"

interface HorizontalEventCardProps {
  event: CalEvent
  selected: boolean
  highlighted: boolean
  isDragging: boolean
  tz: string
  onSelect: (id: EventId, multi: boolean) => void
  onPointerDownMove: (e: React.PointerEvent) => void
  onPointerMoveColumn: (e: React.PointerEvent) => void
  onPointerUpColumn: (e: React.PointerEvent) => void
  onDoubleClick?: (eventId: EventId) => void
  width: number
  height: number
}

const getCategoryColors = (colorString?: string) => {
  // Map database color string to EventCategory enum values (force lowercase)
  const category = colorString?.toLowerCase() as EventCategory;

  switch (category) {
    case "neutral": return { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-900 dark:text-neutral-100", border: "border-neutral-300 dark:border-neutral-600" };
    case "slate": return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", border: "border-slate-300 dark:border-slate-600" };
    case "orange": return { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-900 dark:text-orange-100", border: "border-orange-300 dark:border-orange-600" };
    case "yellow": return { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-900 dark:text-yellow-100", border: "border-yellow-300 dark:border-yellow-600" };
    case "green": return { bg: "bg-green-100 dark:bg-green-900", text: "text-green-900 dark:text-green-100", border: "border-green-300 dark:border-green-600" };
    case "blue": return { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-900 dark:text-blue-100", border: "border-blue-300 dark:border-blue-600" };
    case "indigo": return { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-900 dark:text-indigo-100", border: "border-indigo-300 dark:border-indigo-600" };
    case "violet": return { bg: "bg-violet-100 dark:bg-violet-900", text: "text-violet-900 dark:text-violet-100", border: "border-violet-300 dark:border-violet-600" };
    case "fuchsia": return { bg: "bg-fuchsia-100 dark:bg-fuchsia-900", text: "text-fuchsia-900 dark:text-fuchsia-100", border: "border-fuchsia-300 dark:border-fuchsia-600" };
    case "rose": return { bg: "bg-rose-100 dark:bg-rose-900", text: "text-rose-900 dark:text-rose-100", border: "border-rose-300 dark:border-rose-600" };
    default: return { bg: "bg-card dark:bg-neutral-800", text: "text-card-foreground", border: "border-border" };
  }
};

const getShowTimeAsIcon = (showTimeAs?: ShowTimeAs) => {
  switch (showTimeAs) {
    case "tentative": return "?";
    case "free": return "○";
    case "busy": return "✓";
    default: return "✓"; // busy is default
  }
};

const getMeetingTypeIcons = (event: CalEvent) => {
  const icons = [];

  if (event.online_event) {
    icons.push(<Video key="video" className="w-3 h-3" />);
  }

  if (event.in_person) {
    icons.push(<PersonStanding key="person" className="w-3 h-3" />);
  }

  return icons;
};

export function HorizontalEventCard({
  event,
  selected,
  highlighted,
  isDragging,
  tz,
  onSelect,
  onPointerDownMove,
  onPointerMoveColumn,
  onPointerUpColumn,
  onDoubleClick,
  width,
  height
}: HorizontalEventCardProps) {

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(event.id, e.ctrlKey || e.metaKey)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (onDoubleClick) {
      onDoubleClick(event.id)
    }
  }

  // Use same category color system as original EventCard
  const categoryColors = getCategoryColors(event.user_category_name)
  const isPastEvent = event.end < Date.now()

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`Event: ${event.title}`}
      aria-selected={selected}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-150 rounded-sm group",
        "shadow-sm hover:shadow-md p-0 m-0",
        event.aiSuggested ? "" : "border-2",
        event.aiSuggested ? "" : categoryColors.border,
        categoryColors.bg,
        isPastEvent && "opacity-50",
        selected && "ring-2 ring-ring border-ring shadow-lg",
        highlighted && "ring-2 ring-yellow-400 shadow-lg",
        isDragging && "opacity-35 shadow-xl"
      )}
      style={{
        width: Math.max(50, width),
        height: Math.max(MIN_SLOT_PX, height),
        padding: event.aiSuggested ? "1px" : "0 !important",
        margin: "0 !important",
        ...(event.aiSuggested && {
          background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
        }),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={onPointerDownMove}
      onPointerMove={onPointerMoveColumn}
      onPointerUp={onPointerUpColumn}
      initial={false}
      animate={{
        scale: isDragging ? 1 : [1, 1.02, 1],
      }}
      transition={{
        scale: {
          duration: 0.3,
          times: [0, 0.5, 1],
          ease: "easeInOut"
        }
      }}
    >
      <div className="h-full w-full px-1 pt-1 pb-1 flex flex-col justify-start items-start overflow-hidden">
        <div className={cn(
          "font-medium truncate text-sm leading-none w-full text-left",
          event.aiSuggested ? "text-white" : categoryColors.text
        )}>
          {event.title}
        </div>
      </div>

    </motion.div>
  )
}
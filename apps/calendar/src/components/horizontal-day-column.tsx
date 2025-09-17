"use client"

import React, { useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type {
  CalEvent,
  EventId,
  DragState,
  Rubber,
  SelectedTimeRange,
  TimeHighlight,
  SystemSlot,
} from "./types"
import { DAY_MS, DEFAULT_COLORS, clamp, MIN_SLOT_PX, toZDT } from "./utils"
import type { PositionedEvent } from "./utils"
import { HorizontalEventCard } from "./horizontal-event-card"

export function HorizontalDayColumn(props: {
  dates: Date[]
  dayWidth: number
  laneHeight: number
  yPosition: number
  tz: string
  events: CalEvent[]
  positioned: PositionedEvent[]
  highlightedEventIds: Set<EventId>
  selectedEventIds: Set<EventId>
  setSelectedEventIds: (s: Set<EventId>) => void
  drag: DragState | null
  setDrag: React.Dispatch<React.SetStateAction<DragState | null>>
  onCommit: (next: CalEvent[]) => void
  rubber: Rubber
  setRubber: React.Dispatch<React.SetStateAction<Rubber>>
  xToLocalMs: (x: number, step?: number) => number
  localMsToX: (msInDay: number) => number
  snapStep: number
  dragSnapMs: number
  minDurMs: number
  timeRanges?: SelectedTimeRange[]
  commitRanges?: (next: SelectedTimeRange[]) => void
  aiHighlights: TimeHighlight[]
  systemSlots: SystemSlot[]
  onClearAllSelections?: () => void
  shouldAnimateEntry: boolean
  onEventDoubleClick?: (eventId: EventId) => void
  calendarName: string
  calendarColor: string
}) {
  const {
    dates,
    dayWidth,
    laneHeight,
    yPosition,
    tz,
    events,
    positioned,
    highlightedEventIds,
    selectedEventIds,
    setSelectedEventIds,
    drag,
    setDrag,
    onCommit,
    rubber,
    setRubber,
    xToLocalMs,
    localMsToX,
    snapStep,
    dragSnapMs,
    minDurMs,
    timeRanges,
    commitRanges,
    aiHighlights,
    systemSlots,
    onClearAllSelections,
    shouldAnimateEntry,
    onEventDoubleClick,
    calendarName,
    calendarColor
  } = props

  const laneRef = useRef<HTMLDivElement>(null)

  // Calculate timeline properties
  const timelineStart = dates[0]
  const timelineEnd = dates[dates.length - 1]
  const totalWidth = dates.length * dayWidth

  // Track if we're actually rubber banding (not just clicking)
  const [isRubberBanding, setIsRubberBanding] = React.useState(false)
  const [rubberStartPos, setRubberStartPos] = React.useState<{x: number, y: number} | null>(null)

  // Mouse event handlers for rubber band selection
  function onPointerDownEmpty(e: React.PointerEvent) {
    // Only start rubber band on background, not on events
    const target = e.target as HTMLElement
    if (target.closest('[role="button"]')) return

    e.preventDefault()
    e.stopPropagation()

    if (!laneRef.current) return
    const rect = laneRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    // Clamp x to valid range
    const clampedX = Math.max(0, Math.min(x, totalWidth))
    const dayIdx = Math.floor(clampedX / dayWidth)
    const xInDay = clampedX % dayWidth
    const msInDay = xToLocalMs(xInDay, snapStep)

    // Clamp to valid day range
    const clampedDayIdx = Math.max(0, Math.min(dayIdx, dates.length - 1))

    // Store the start position for distance calculation
    setRubberStartPos({ x: e.clientX, y: e.clientY })
    setIsRubberBanding(false)

    // Capture pointer to ensure we get all subsequent events
    if (laneRef.current.setPointerCapture) {
      laneRef.current.setPointerCapture(e.pointerId)
    }

    setRubber({
      startDayIdx: clampedDayIdx,
      startMsInDay: msInDay,
      endDayIdx: clampedDayIdx,
      endMsInDay: msInDay,
      mode: e.shiftKey ? "clone" : "span",
      multi: e.ctrlKey || e.metaKey,
    })
  }

  function onPointerMoveEmpty(e: React.PointerEvent) {
    if (!rubber || !laneRef.current || !rubberStartPos) return

    // Check if we've moved far enough to start rubber banding (10px threshold)
    const distance = Math.sqrt(
      Math.pow(e.clientX - rubberStartPos.x, 2) + Math.pow(e.clientY - rubberStartPos.y, 2)
    )

    if (distance > 10) {
      setIsRubberBanding(true)
    }

    if (!isRubberBanding) return // Don't show rubber band until we've moved enough

    e.preventDefault()
    const rect = laneRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    // Clamp x to valid range
    const clampedX = Math.max(0, Math.min(x, totalWidth))
    const dayIdx = Math.floor(clampedX / dayWidth)
    const xInDay = clampedX % dayWidth
    const msInDay = xToLocalMs(xInDay, snapStep)

    // Clamp to valid day range
    const clampedDayIdx = Math.max(0, Math.min(dayIdx, dates.length - 1))

    setRubber({
      ...rubber,
      endDayIdx: clampedDayIdx,
      endMsInDay: msInDay,
    })
  }

  function onPointerUpEmpty(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()

    // Release pointer capture
    if (laneRef.current?.releasePointerCapture) {
      laneRef.current.releasePointerCapture(e.pointerId)
    }

    // Reset rubber band state
    setRubberStartPos(null)

    if (!rubber || !isRubberBanding) {
      // Just a click, not a drag - clear rubber state
      setRubber({
        startDayIdx: 0,
        startMsInDay: 0,
        endDayIdx: 0,
        endMsInDay: 0,
        mode: "span",
        multi: false,
      })
      setIsRubberBanding(false)
      return
    }

    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx)
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx)
    const newRanges: SelectedTimeRange[] = []

    if (rubber.mode === "span") {
      // One continuous block sliced by day boundaries
      for (let i = a; i <= b; i++) {
        const baseDate = dates[i]
        if (!baseDate) continue
        const base = baseDate.getTime()
        let segStart: number
        let segEnd: number

        if (a === b) {
          segStart = Math.min(rubber.startMsInDay, rubber.endMsInDay)
          segEnd = Math.max(rubber.startMsInDay, rubber.endMsInDay)
        } else {
          // Handle cross-day selection properly considering drag direction
          if (rubber.startDayIdx <= rubber.endDayIdx) {
            // Normal left-to-right selection
            if (i === rubber.startDayIdx) {
              segStart = rubber.startMsInDay
              segEnd = DAY_MS
            } else if (i === rubber.endDayIdx) {
              segStart = 0
              segEnd = rubber.endMsInDay
            } else {
              segStart = 0
              segEnd = DAY_MS
            }
          } else {
            // Right-to-left selection (backwards drag)
            if (i === rubber.endDayIdx) {
              segStart = rubber.endMsInDay
              segEnd = DAY_MS
            } else if (i === rubber.startDayIdx) {
              segStart = 0
              segEnd = rubber.startMsInDay
            } else {
              segStart = 0
              segEnd = DAY_MS
            }
          }
        }

        segStart = clamp(segStart, 0, DAY_MS)
        segEnd = clamp(segEnd, 0, DAY_MS)

        if (segEnd - segStart >= snapStep) {
          newRanges.push({
            id: `rng_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            startAbs: base + segStart,
            endAbs: base + segEnd,
          })
        }
      }
    } else {
      // Clone mode: same start/end on each day
      const s = Math.min(rubber.startMsInDay, rubber.endMsInDay)
      const eMs = Math.max(rubber.startMsInDay, rubber.endMsInDay)

      if (eMs - s >= snapStep) {
        for (let i = a; i <= b; i++) {
          const baseDate = dates[i]
          if (!baseDate) continue
          const base = baseDate.getTime()
          newRanges.push({
            id: `rng_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            startAbs: base + s,
            endAbs: base + eMs,
          })
        }
      }
    }

    if (newRanges.length === 0) {
      setRubber({
        startDayIdx: 0,
        startMsInDay: 0,
        endDayIdx: 0,
        endMsInDay: 0,
        mode: "span",
        multi: false,
      })
      return
    }

    const existing = (timeRanges ?? []).slice()
    const next = rubber.multi ? [...existing, ...newRanges] : newRanges
    commitRanges?.(next)

    setRubber({
      startDayIdx: 0,
      startMsInDay: 0,
      endDayIdx: 0,
      endMsInDay: 0,
      mode: "span",
      multi: false,
    })
    setIsRubberBanding(false)
  }

  function onPointerCancel(e: React.PointerEvent) {
    // Clean up rubber band selection if pointer is cancelled
    setRubber({
      startDayIdx: 0,
      startMsInDay: 0,
      endDayIdx: 0,
      endMsInDay: 0,
      mode: "span",
      multi: false,
    })

    // Release pointer capture
    if (laneRef.current?.releasePointerCapture) {
      laneRef.current.releasePointerCapture(e.pointerId)
    }
  }

  // Event selection handlers
  function toggleSelect(id: EventId, multi: boolean) {
    const next = new Set(selectedEventIds)
    if (multi) {
      next.has(id) ? next.delete(id) : next.add(id)
    } else {
      next.clear()
      next.add(id)
    }
    setSelectedEventIds(next)
  }

  // Event drag handlers
  function onPointerDownMove(eventId: EventId, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()

    const event = events.find(ev => ev.id === eventId)
    if (!event || !laneRef.current) return

    const rect = laneRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    // Find which day this drag started in
    const startDayIdx = Math.floor(x / dayWidth)

    setDrag({
      id: eventId,
      kind: "move",
      origStart: event.start,
      origEnd: event.end,
      startDayIdx,
      targetDayIdx: startDayIdx,
      hoverStart: event.start,
      hoverEnd: event.end,
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      isCopyMode: e.altKey
    })

    // Capture pointer
    if (laneRef.current.setPointerCapture) {
      laneRef.current.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMoveColumn(e: React.PointerEvent) {
    if (!drag || !laneRef.current) return

    e.preventDefault()

    // Check if we've moved far enough to start dragging (5px dead zone)
    const deltaX = Math.abs(e.clientX - drag.startX)
    const deltaY = Math.abs(e.clientY - drag.startY)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (!drag.isDragging && distance < 5) {
      return // Stay in dead zone
    }

    // Mark as actively dragging
    if (!drag.isDragging) {
      setDrag({ ...drag, isDragging: true })
    }

    // Get coordinates relative to the entire timeline (not just this lane)
    const containerRect = laneRef.current.getBoundingClientRect()
    const x = e.clientX - containerRect.left

    // Calculate target day and time across the entire timeline
    const targetDayIdx = Math.floor(x / dayWidth)
    const msInDay = xToLocalMs(x % dayWidth, dragSnapMs)

    if (drag.kind === "move") {
      const dur = drag.origEnd - drag.origStart

      // Allow cross-day movement - calculate absolute timeline position
      const timelineStartTime = dates[0]?.getTime() || 0
      const absoluteTargetTime = timelineStartTime + xToLocalMs(x, dragSnapMs)

      let nextStart = absoluteTargetTime
      let nextEnd = nextStart + dur

      // Only constrain to timeline bounds, not day boundaries
      const timelineEnd = dates[dates.length - 1]?.getTime() + DAY_MS || timelineStartTime + DAY_MS
      if (nextStart < timelineStartTime) {
        nextStart = timelineStartTime
        nextEnd = nextStart + dur
      }
      if (nextEnd > timelineEnd) {
        nextEnd = timelineEnd
        nextStart = nextEnd - dur
      }

      // Find which day the start falls into for display purposes
      const actualTargetDayIdx = Math.floor((nextStart - timelineStartTime) / DAY_MS)
      const clampedDayIdx = Math.max(0, Math.min(actualTargetDayIdx, dates.length - 1))

      setDrag({ ...drag, targetDayIdx: clampedDayIdx, hoverStart: nextStart, hoverEnd: nextEnd })
    }
  }

  function onPointerUpColumn(e: React.PointerEvent) {
    if (!drag) return

    e.preventDefault()
    e.stopPropagation()

    // Release pointer capture
    if (laneRef.current?.releasePointerCapture) {
      laneRef.current.releasePointerCapture(e.pointerId)
    }

    if (!drag.isDragging) {
      setDrag(null)
      return
    }

    // Find the event and update it
    const eventIndex = events.findIndex(e => e.id === drag.id)
    if (eventIndex === -1) {
      setDrag(null)
      return
    }

    const event = events[eventIndex]
    const nextStart = drag.hoverStart ?? event.start
    const nextEnd = drag.hoverEnd ?? event.end

    if (nextStart !== event.start || nextEnd !== event.end) {
      if (drag.isCopyMode) {
        // Create a copy of the event at the new position
        const copiedEvent = {
          ...event,
          id: `copy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          start: nextStart,
          end: nextEnd
        }
        onCommit([...events, copiedEvent])
      } else {
        // Move the original event
        const updatedEvents = [...events]
        updatedEvents[eventIndex] = { ...event, start: nextStart, end: nextEnd }
        onCommit(updatedEvents)
      }
    }

    setDrag(null)
  }

  // Calculate rubber band visual
  const rubberSegment = useMemo(() => {
    if (!rubber) return null
    const a = Math.min(rubber.startDayIdx, rubber.endDayIdx)
    const b = Math.max(rubber.startDayIdx, rubber.endDayIdx)

    let startX: number
    let endX: number

    if (rubber.mode === "span") {
      if (a === b) {
        // Same day selection
        startX = a * dayWidth + localMsToX(Math.min(rubber.startMsInDay, rubber.endMsInDay))
        endX = a * dayWidth + localMsToX(Math.max(rubber.startMsInDay, rubber.endMsInDay))
      } else {
        // Cross-day selection: need to determine which is start and which is end
        if (rubber.startDayIdx <= rubber.endDayIdx) {
          // Normal left-to-right selection
          startX = rubber.startDayIdx * dayWidth + localMsToX(rubber.startMsInDay)
          endX = rubber.endDayIdx * dayWidth + localMsToX(rubber.endMsInDay)
        } else {
          // Right-to-left selection (user dragged backwards)
          startX = rubber.endDayIdx * dayWidth + localMsToX(rubber.endMsInDay)
          endX = rubber.startDayIdx * dayWidth + localMsToX(rubber.startMsInDay)
        }
      }
    } else {
      // Clone mode
      const segStartX = localMsToX(Math.min(rubber.startMsInDay, rubber.endMsInDay))
      const segEndX = localMsToX(Math.max(rubber.startMsInDay, rubber.endMsInDay))
      startX = a * dayWidth + segStartX
      endX = b * dayWidth + segEndX
    }

    return { startX, endX }
  }, [rubber, dayWidth, localMsToX])

  return (
    <div className="relative">
      {/* Lane Header */}
      <div
        className="absolute left-0 top-0 z-10 bg-background border-r border-border flex items-center px-3"
        style={{
          width: 200,
          height: laneHeight,
          transform: `translateY(${yPosition}px)`
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: calendarColor }}
          />
          <div className="font-medium text-sm truncate">
            {calendarName}
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {events.length}
          </div>
        </div>
      </div>

      {/* Lane Background */}
      <div
        className="absolute inset-x-0 bg-background/50 border-b border-border/30"
        style={{
          top: yPosition,
          height: laneHeight
        }}
      />

      {/* Interactive Area */}
      <div
        ref={laneRef}
        className="absolute cursor-crosshair"
        style={{
          left: 200,
          top: yPosition,
          width: totalWidth,
          height: laneHeight
        }}
        onPointerDown={onPointerDownEmpty}
        onPointerMove={onPointerMoveEmpty}
        onPointerUp={onPointerUpEmpty}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        {/* Day Separator Lines */}
        {dates.map((date, dayIdx) => (
          <div
            key={`day-${dayIdx}`}
            className="absolute top-0 bottom-0 w-px bg-border/30"
            style={{
              left: dayIdx * dayWidth
            }}
          />
        ))}

        {/* Rubber Band Selection */}
        {rubberSegment && isRubberBanding && (
          <div
            className="absolute top-0 bottom-0 rounded border pointer-events-none"
            style={{
              left: rubberSegment.startX,
              width: rubberSegment.endX - rubberSegment.startX,
              background: DEFAULT_COLORS.selection,
              borderColor: DEFAULT_COLORS.selectionBorder,
            }}
          />
        )}

        {/* Selected Time Ranges */}
        <AnimatePresence>
          {(timeRanges ?? []).map((r) => {
            const startDate = new Date(r.startAbs)
            const endDate = new Date(r.endAbs)

            // Find which days this range spans
            const rangeSegments: Array<{dayIdx: number; startX: number; width: number}> = []

            dates.forEach((date, dayIdx) => {
              const dayStart = date.getTime()
              const dayEnd = dayStart + DAY_MS

              if (r.endAbs > dayStart && r.startAbs < dayEnd) {
                const segStart = Math.max(r.startAbs, dayStart) - dayStart
                const segEnd = Math.min(r.endAbs, dayEnd) - dayStart
                const startX = dayIdx * dayWidth + localMsToX(segStart)
                const width = localMsToX(segEnd) - localMsToX(segStart)
                rangeSegments.push({ dayIdx, startX, width })
              }
            })

            return rangeSegments.map((seg, segIdx) => (
              <motion.div
                key={`${r.id}-${seg.dayIdx}`}
                className="absolute top-1 bottom-1 rounded border pointer-events-none"
                style={{
                  left: seg.startX,
                  width: seg.width,
                  background: DEFAULT_COLORS.selection,
                  borderColor: DEFAULT_COLORS.selectionBorder,
                  opacity: 0.6,
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0 }}
                transition={{ duration: 0.2 }}
              />
            ))
          })}
        </AnimatePresence>

        {/* Drag Ghost */}
        {drag && drag.isDragging && drag.hoverStart != null && drag.hoverEnd != null && (() => {
          const draggedEvent = events.find(e => e.id === drag.id)
          if (!draggedEvent) return null

          // Calculate ghost position
          const targetDayStart = dates[drag.targetDayIdx]?.getTime() || dates[0].getTime()
          const msInDay = drag.hoverStart - targetDayStart
          const duration = drag.hoverEnd - drag.hoverStart

          const ghostX = drag.targetDayIdx * dayWidth + localMsToX(msInDay)
          const ghostWidth = Math.max(50, localMsToX(duration))

          return (
            <div
              className="absolute rounded border pointer-events-none opacity-75"
              style={{
                left: ghostX,
                top: 10,
                width: ghostWidth,
                height: 20,
                backgroundColor: `${calendarColor}40`,
                borderColor: calendarColor,
                borderStyle: 'dashed'
              }}
            >
              <div className="p-1 h-full flex items-center overflow-hidden">
                <div className="text-xs font-medium truncate" style={{ color: calendarColor }}>
                  {draggedEvent.title}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Events */}
        <AnimatePresence>
          {positioned.map((p, index) => {
            const e = events.find((x) => x.id === p.id)!
            const selected = selectedEventIds.has(e.id)
            const highlighted = highlightedEventIds.has(e.id)
            const isDragging = drag?.id === e.id && drag.isDragging

            return (
              <div
                key={e.id}
                className="absolute"
                style={{
                  left: p.x - 200, // Adjust for lane header offset
                  top: p.y - yPosition,
                }}
              >
                <HorizontalEventCard
                  event={e}
                  selected={selected}
                  highlighted={highlighted}
                  isDragging={isDragging}
                  tz={tz}
                  onSelect={toggleSelect}
                  onPointerDownMove={(pointerEvent) => onPointerDownMove(e.id, pointerEvent)}
                  onPointerMoveColumn={onPointerMoveColumn}
                  onPointerUpColumn={onPointerUpColumn}
                  onDoubleClick={onEventDoubleClick}
                  calendarColor={calendarColor}
                  width={p.width}
                  height={p.height}
                />
              </div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
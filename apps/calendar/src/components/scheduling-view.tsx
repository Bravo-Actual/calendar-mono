"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays, startOfDay, endOfDay, differenceInDays, isToday } from 'date-fns'
import type { CalEvent, SelectedTimeRange, DragState, Rubber, EventId } from './types'
import { HorizontalDayColumn } from './horizontal-day-column'
import { DAY_MS, getTZ, toZDT, layoutDay, PositionedEvent } from './utils'

export interface Calendar {
  id: string
  name: string
  color: string
  visible: boolean
  events: CalEvent[]
}

export interface SchedulingViewProps {
  calendars: Calendar[]
  onEventSelect?: (eventId: string, isMultiSelect: boolean) => void
  onEventUpdate?: (eventId: string, updates: Partial<CalEvent>) => void
  onTimeRangeChange?: (startDate: Date, endDate: Date) => void
  onCreateEvents?: (ranges: SelectedTimeRange[]) => void
  selectedEventIds?: Set<string>
  className?: string
}

const DAYS_TO_LOAD = 30 // Number of days to load at once
const DAY_WIDTH = 600 // Width of each day column in pixels - much wider for better visibility
const MIN_SWIM_LANE_HEIGHT = 60 // Minimum height of each swim lane
const EVENT_HEIGHT = 32 // Height of each event card
const EVENT_VERTICAL_SPACING = 4 // Vertical spacing between stacked events
const HEADER_HEIGHT = 60 // Height of timeline header

export function SchedulingView({
  calendars,
  onEventSelect,
  onEventUpdate,
  onTimeRangeChange,
  onCreateEvents,
  selectedEventIds = new Set(),
  className = ''
}: SchedulingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const tz = getTZ()

  // Current visible time range
  const [timeRange, setTimeRange] = useState(() => {
    const today = startOfDay(new Date())
    return {
      start: addDays(today, -DAYS_TO_LOAD / 2),
      end: addDays(today, DAYS_TO_LOAD / 2)
    }
  })

  // Calendar state (similar to CalendarWeek)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [rubber, setRubber] = useState<Rubber>({
    startDayIdx: 0,
    startMsInDay: 0,
    endDayIdx: 0,
    endMsInDay: 0,
    mode: "span",
    multi: false,
  })
  const [selectedTimeRanges, setSelectedTimeRanges] = useState<SelectedTimeRange[]>([])
  const [selectedEventIdsSet, setSelectedEventIdsSet] = useState<Set<EventId>>(new Set())
  const [highlightedEventIds] = useState<Set<EventId>>(new Set())

  // Scroll position state
  const [scrollLeft, setScrollLeft] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  // Expanded day state
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  // Handle scroll sync between content and header
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft
    setScrollLeft(newScrollLeft)
  }

  // Handle day header click for expansion
  const handleDayClick = (dayIndex: number) => {
    setExpandedDay(expandedDay === dayIndex ? null : dayIndex)
  }

  // Calculate total timeline width (accounting for expanded day)
  const totalDays = differenceInDays(timeRange.end, timeRange.start)
  const expandedWidth = expandedDay !== null ? DAY_WIDTH * (totalDays - 1) : 0 // When expanded, other days get minimal width
  const timelineWidth = expandedDay !== null ? 200 + expandedWidth + DAY_WIDTH : totalDays * DAY_WIDTH

  // Generate date array for timeline
  const dates = useMemo(() => {
    const dateArray: Date[] = []
    let currentDate = new Date(timeRange.start)

    while (currentDate <= timeRange.end) {
      dateArray.push(new Date(currentDate))
      currentDate = addDays(currentDate, 1)
    }

    return dateArray
  }, [timeRange])

  // Utility functions for DayColumn compatibility
  const getDayStartMs = (dayIndex: number) => {
    return addDays(timeRange.start, dayIndex).getTime()
  }

  const pxPerHour = 64
  const slotMinutes = 30
  const gridHeight = 720
  const pxPerMs = pxPerHour / (60 * 60 * 1000)

  const yToLocalMs = (y: number, step = slotMinutes * 60 * 1000) => {
    const rawMs = y / pxPerMs
    return Math.round(rawMs / step) * step
  }

  const localMsToY = (msInDay: number) => {
    return msInDay * pxPerMs
  }

  // Horizontal positioning within each day (0-24 hours)
  const HOURS_PER_DAY = 24
  const pxPerHourHorizontal = DAY_WIDTH / HOURS_PER_DAY // pixels per hour horizontally
  const pxPerMsHorizontal = pxPerHourHorizontal / (60 * 60 * 1000) // pixels per millisecond horizontally

  const xToLocalMs = (x: number, step = slotMinutes * 60 * 1000) => {
    const rawMs = x / pxPerMsHorizontal
    return Math.round(rawMs / step) * step
  }

  const localMsToX = (msInDay: number) => {
    return msInDay * pxPerMsHorizontal
  }

  const commitRanges = (ranges: SelectedTimeRange[]) => {
    setSelectedTimeRanges(ranges)
    // Don't auto-create events in scheduling view - only store the ranges
    // User needs to manually click "Create Event" button to create events
  }

  const onCommit = (nextEvents: CalEvent[]) => {
    // Handle event updates
    console.log('Events updated:', nextEvents)
  }

  // Filter visible calendars
  const visibleCalendars = calendars.filter(calendar => calendar.visible)

  // Get all events from all calendars
  const allEvents = useMemo(() => {
    return visibleCalendars.flatMap(cal => cal.events || [])
  }, [visibleCalendars])

  // Calculate swim lane heights based on maximum overlapping events per calendar
  const swimLaneHeights = useMemo(() => {
    const heights = new Map<string, number>()

    visibleCalendars.forEach(calendar => {
      let maxOverlap = 1
      const calendarEvents = calendar.events || []

      // Filter events that fall within our date range
      const relevantEvents = calendarEvents.filter(event => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)
        return eventEnd >= timeRange.start && eventStart <= timeRange.end
      })

      // Group events by day and find maximum overlap
      const eventsByDay = new Map<number, CalEvent[]>()

      relevantEvents.forEach(event => {
        const eventStart = new Date(event.start)

        dates.forEach((date, idx) => {
          const dayStart = startOfDay(date).getTime()
          const dayEnd = endOfDay(date).getTime()

          if (eventStart.getTime() >= dayStart && eventStart.getTime() <= dayEnd) {
            if (!eventsByDay.has(idx)) {
              eventsByDay.set(idx, [])
            }
            eventsByDay.get(idx)!.push(event)
          }
        })
      })

      // Find maximum overlap across all days
      eventsByDay.forEach((dayEvents) => {
        const sortedEvents = [...dayEvents].sort((a, b) => a.start - b.start || a.end - b.end)

        // Group overlapping events into clusters
        const clusters: CalEvent[][] = []
        let current: CalEvent[] = []
        let currentEnd = -Infinity

        for (const e of sortedEvents) {
          if (current.length === 0 || e.start < currentEnd) {
            current.push(e)
            currentEnd = Math.max(currentEnd, e.end)
          } else {
            clusters.push(current)
            current = [e]
            currentEnd = e.end
          }
        }
        if (current.length) clusters.push(current)

        // Find maximum columns in any cluster
        for (const cluster of clusters) {
          const cols: CalEvent[][] = []
          for (const e of cluster) {
            let placed = false
            for (const col of cols) {
              if (col[col.length - 1].end <= e.start) {
                col.push(e)
                placed = true
                break
              }
            }
            if (!placed) cols.push([e])
          }
          maxOverlap = Math.max(maxOverlap, cols.length)
        }
      })

      const calculatedHeight = Math.max(
        MIN_SWIM_LANE_HEIGHT,
        EVENT_HEIGHT * maxOverlap + EVENT_VERTICAL_SPACING * (maxOverlap + 1)
      )
      heights.set(calendar.id, calculatedHeight)
    })

    return heights
  }, [visibleCalendars, timeRange, dates])

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Select all events in the current view
        const allEventIds = new Set(allEvents.map(event => event.id));
        setSelectedEventIdsSet(allEventIds);
        // Notify parent of selection change if handler exists
        if (onEventSelect) {
          allEvents.forEach(event => onEventSelect(event.id, false));
        }
      }
      if (e.key === "Escape") {
        // Clear all selections
        setSelectedEventIdsSet(new Set());
        setSelectedTimeRanges([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allEvents, onEventSelect])

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const today = new Date()
      const daysSinceStart = differenceInDays(today, timeRange.start)
      const scrollPosition = daysSinceStart * DAY_WIDTH - containerWidth / 2
      scrollRef.current.scrollLeft = Math.max(0, scrollPosition)
    }
  }, [timeRange.start, containerWidth])

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-background ${className}`}
    >
      {/* Timeline Header */}
      <div className="flex-shrink-0 h-16 bg-background border-b border-border flex items-center overflow-hidden">
        <div className="w-[200px] px-4 font-medium text-sm flex-shrink-0">Calendars</div>
        {/* Date Headers Container */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="flex"
            style={{
              transform: `translateX(-${scrollLeft}px)`,
              width: totalDays * DAY_WIDTH
            }}
          >
            {dates.map((date, dayIndex) => {
              const dayWidth = expandedDay === null
                ? DAY_WIDTH
                : expandedDay === dayIndex
                  ? DAY_WIDTH
                  : DAY_WIDTH / totalDays * 2 // Collapsed days get minimal width

              return (
                <motion.div
                  key={date.toISOString()}
                  className={`flex-shrink-0 text-center py-2 border-r border-border/30 cursor-pointer hover:bg-muted/50 transition-colors ${
                    isToday(date) ? 'bg-primary/10 font-medium' : ''
                  } ${expandedDay === dayIndex ? 'bg-primary/20' : ''}`}
                  style={{ width: dayWidth }}
                  onClick={() => handleDayClick(dayIndex)}
                  animate={{ width: dayWidth }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(date, 'EEE')}
                  </div>
                  <div className="text-sm font-medium">
                    {format(date, 'MMM d')}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Swim Lanes Container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-x-auto overflow-y-auto"
          style={{ scrollbarGutter: 'stable' }}
          onScroll={handleScroll}
        >
          <div
            className="relative"
            style={{
              width: 200 + totalDays * DAY_WIDTH,
              height: Array.from(swimLaneHeights.values()).reduce((sum, height) => sum + height, 0)
            }}
          >
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none">
              {dates.map((date, index) => {
                const dayWidth = expandedDay === null
                  ? DAY_WIDTH
                  : expandedDay === index
                    ? DAY_WIDTH
                    : DAY_WIDTH / totalDays * 2

                const leftOffset = expandedDay === null
                  ? 200 + index * DAY_WIDTH
                  : expandedDay === index
                    ? 200 + index * (DAY_WIDTH / totalDays * 2)
                    : index < expandedDay
                      ? 200 + index * (DAY_WIDTH / totalDays * 2)
                      : 200 + index * (DAY_WIDTH / totalDays * 2) + DAY_WIDTH - (DAY_WIDTH / totalDays * 2)

                return (
                  <motion.div
                    key={date.toISOString()}
                    className={`absolute top-0 bottom-0 border-r ${
                      isToday(date)
                        ? 'border-primary bg-primary/5'
                        : 'border-border/30'
                    }`}
                    style={{
                      left: leftOffset,
                      width: dayWidth
                    }}
                    animate={{
                      left: leftOffset,
                      width: dayWidth
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )
              })}
            </div>

            {/* Horizontal Swim Lanes */}
            {visibleCalendars.map((calendar, laneIndex) => {
              // Calculate cumulative Y position for this swim lane
              let cumulativeY = 0
              for (let i = 0; i < laneIndex; i++) {
                cumulativeY += swimLaneHeights.get(visibleCalendars[i].id) || MIN_SWIM_LANE_HEIGHT
              }
              const currentLaneHeight = swimLaneHeights.get(calendar.id) || MIN_SWIM_LANE_HEIGHT
              // Get all positioned events for this calendar across all days
              const allPositionedEvents: PositionedEvent[] = []

              // Layout events with proper stacking for this calendar
              const calendarEvents = calendar.events || []

              // Filter events that fall within our date range
              const relevantEvents = calendarEvents.filter(event => {
                const eventStart = new Date(event.start)
                const eventEnd = new Date(event.end)
                return eventEnd >= timeRange.start && eventStart <= timeRange.end
              })

              // Use the same clustering algorithm as layoutDay for proper horizontal stacking
              // Group events by day first
              const eventsByDay = new Map<number, CalEvent[]>()

              relevantEvents.forEach(event => {
                const eventStart = new Date(event.start)

                // Find the day this event belongs to
                dates.forEach((date, idx) => {
                  const dayStart = startOfDay(date).getTime()
                  const dayEnd = endOfDay(date).getTime()

                  if (eventStart.getTime() >= dayStart && eventStart.getTime() <= dayEnd) {
                    if (!eventsByDay.has(idx)) {
                      eventsByDay.set(idx, [])
                    }
                    eventsByDay.get(idx)!.push(event)
                  }
                })
              })

              // Layout events for each day using clustering algorithm
              eventsByDay.forEach((dayEvents, dayIdx) => {
                const dayStartTime = startOfDay(dates[dayIdx]).getTime()

                // Sort events by start time
                const sortedEvents = [...dayEvents].sort((a, b) => a.start - b.start || a.end - b.end)

                console.log(`Processing ${sortedEvents.length} events for day ${dayIdx}:`,
                  sortedEvents.map(e => ({
                    title: e.title,
                    start: new Date(e.start).toTimeString().slice(0, 8),
                    end: new Date(e.end).toTimeString().slice(0, 8)
                  })))

                // Group overlapping events into clusters
                const clusters: CalEvent[][] = []
                let current: CalEvent[] = []
                let currentEnd = -Infinity

                for (const e of sortedEvents) {
                  // Check if this event overlaps with the current cluster
                  // An event overlaps if it starts before the current cluster ends
                  if (current.length === 0 || e.start < currentEnd) {
                    current.push(e)
                    currentEnd = Math.max(currentEnd, e.end)
                    console.log(`Added "${e.title}" to cluster. Cluster end now: ${new Date(currentEnd).toTimeString().slice(0, 8)}`)
                  } else {
                    // No overlap, start a new cluster
                    console.log(`"${e.title}" doesn't overlap (starts ${new Date(e.start).toTimeString().slice(0, 8)} >= ends ${new Date(currentEnd).toTimeString().slice(0, 8)}), starting new cluster`)
                    if (current.length) clusters.push(current)
                    current = [e]
                    currentEnd = e.end
                  }
                }
                if (current.length) clusters.push(current)

                console.log(`Calendar ${calendar.name} Day ${dayIdx}: ${sortedEvents.length} events, ${clusters.length} clusters`, clusters.map(c => c.length))

                // Layout each cluster - place conflicting events in separate columns
                for (const cluster of clusters) {
                  const cols: CalEvent[][] = []
                  for (const e of cluster) {
                    let placed = false
                    for (const col of cols) {
                      // Check if this event can go in this column (no time conflict)
                      if (col[col.length - 1].end <= e.start) {
                        col.push(e)
                        placed = true
                        break
                      }
                    }
                    // If it can't fit in any existing column, create a new column (stack)
                    if (!placed) cols.push([e])
                  }

                  const colCount = cols.length
                  const colIdx = new Map<string, number>()
                  cols.forEach((col, i) => col.forEach((e) => colIdx.set(e.id, i)))

                  console.log(`Cluster with ${cluster.length} events -> ${colCount} columns (stacks):`, cluster.map(e => e.title), cols.map(col => col.map(e => e.title)))

                  for (const event of cluster) {
                    const eventStart = new Date(event.start)
                    const eventEnd = new Date(event.end)

                    const msInDay = eventStart.getTime() - dayStartTime
                    const duration = eventEnd.getTime() - eventStart.getTime()

                    // For horizontal view with vertical stacking, use percentage-based positioning like DayColumn
                    const columnIndex = colIdx.get(event.id)!

                    // Calculate horizontal position and width based on time (like DayColumn uses for vertical position)
                    const leftPct = (msInDay / DAY_MS) * 100 // Position based on time of day
                    const widthPct = (duration / DAY_MS) * 100 // Width based on duration

                    // For vertical stacking: same horizontal position, different vertical positions
                    const stackHeight = EVENT_HEIGHT
                    const stackTop = columnIndex * (EVENT_HEIGHT + EVENT_VERTICAL_SPACING) + EVENT_VERTICAL_SPACING

                    const positionedEvent: PositionedEvent = {
                      id: event.id,
                      rect: {
                        top: stackTop, // Relative to the swim lane
                        height: stackHeight,
                        leftPct: leftPct,
                        widthPct: widthPct
                      },
                      dayIdx: dayIdx
                    }

                    console.log(`Event "${event.title}": time ${new Date(event.start).toTimeString().slice(0, 8)}-${new Date(event.end).toTimeString().slice(0, 8)}, top=${stackTop} (stack ${columnIndex}/${colCount}), leftPct=${leftPct.toFixed(1)}%, widthPct=${widthPct.toFixed(1)}%`)

                    allPositionedEvents.push(positionedEvent)
                  }
                }
              })

              return (
                <HorizontalDayColumn
                  key={calendar.id}
                  dates={dates}
                  dayWidth={DAY_WIDTH}
                  laneHeight={currentLaneHeight}
                  yPosition={cumulativeY}
                  tz={tz}
                  events={calendar.events || []}
                  positioned={allPositionedEvents}
                  selectedEventIds={selectedEventIdsSet}
                  setSelectedEventIds={setSelectedEventIdsSet}
                  highlightedEventIds={highlightedEventIds}
                  drag={drag}
                  setDrag={setDrag}
                  onCommit={onCommit}
                  rubber={rubber}
                  setRubber={setRubber}
                  xToLocalMs={xToLocalMs}
                  localMsToX={localMsToX}
                  snapStep={slotMinutes * 60 * 1000}
                  dragSnapMs={5 * 60 * 1000}
                  minDurMs={15 * 60 * 1000}
                  timeRanges={selectedTimeRanges}
                  commitRanges={commitRanges}
                  aiHighlights={[]}
                  systemSlots={[]}
                  onClearAllSelections={() => setSelectedTimeRanges([])}
                  shouldAnimateEntry={false}
                  onEventDoubleClick={onEventSelect ? (id) => onEventSelect(id, false) : undefined}
                  calendarName={calendar.name}
                  calendarColor={calendar.color}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
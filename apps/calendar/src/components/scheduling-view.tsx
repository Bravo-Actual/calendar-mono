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
const DAY_WIDTH = 400 // Width of each day column in pixels - much wider for better visibility
const SWIM_LANE_HEIGHT = 80 // Height of each swim lane
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

  // Handle scroll sync between content and header
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollLeft = e.currentTarget.scrollLeft
    setScrollLeft(newScrollLeft)
  }

  // Calculate total timeline width
  const totalDays = differenceInDays(timeRange.end, timeRange.start)
  const timelineWidth = totalDays * DAY_WIDTH

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

  // Horizontal equivalents for the horizontal swim lanes
  const xToLocalMs = (x: number, step = slotMinutes * 60 * 1000) => {
    const rawMs = x / pxPerMs
    return Math.round(rawMs / step) * step
  }

  const localMsToX = (msInDay: number) => {
    return msInDay * pxPerMs
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
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className={`flex-shrink-0 text-center py-2 border-r border-border/30 ${
                  isToday(date) ? 'bg-primary/10 font-medium' : ''
                }`}
                style={{ width: DAY_WIDTH }}
              >
                <div className="text-xs text-muted-foreground">
                  {format(date, 'EEE')}
                </div>
                <div className="text-sm font-medium">
                  {format(date, 'MMM d')}
                </div>
              </div>
            ))}
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
              height: visibleCalendars.length * SWIM_LANE_HEIGHT
            }}
          >
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none">
              {dates.map((date, index) => (
                <div
                  key={date.toISOString()}
                  className={`absolute top-0 bottom-0 border-r ${
                    isToday(date)
                      ? 'border-primary bg-primary/5'
                      : 'border-border/30'
                  }`}
                  style={{
                    left: 200 + index * DAY_WIDTH,
                    width: DAY_WIDTH
                  }}
                />
              ))}
            </div>

            {/* Horizontal Swim Lanes */}
            {visibleCalendars.map((calendar, laneIndex) => {
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

              // Sort events by start time for proper stacking
              const sortedEvents = [...relevantEvents].sort((a, b) => a.start - b.start)

              // Track occupied lanes for stacking
              const occupiedLanes: Array<{event: CalEvent, endTime: number, lane: number}> = []
              const maxLanes = Math.floor((SWIM_LANE_HEIGHT - 20) / 25) // 25px per stacked event

              sortedEvents.forEach(event => {
                const eventStart = new Date(event.start)
                const eventEnd = new Date(event.end)

                // Find the day this event belongs to
                let dayIdx = -1
                let dayStartTime = 0

                dates.forEach((date, idx) => {
                  const dayStart = startOfDay(date).getTime()
                  const dayEnd = endOfDay(date).getTime()

                  if (eventStart.getTime() >= dayStart && eventStart.getTime() <= dayEnd) {
                    dayIdx = idx
                    dayStartTime = dayStart
                  }
                })

                if (dayIdx === -1) return // Event doesn't fall on any visible day

                // Calculate position within the day
                const msInDay = eventStart.getTime() - dayStartTime
                const duration = eventEnd.getTime() - eventStart.getTime()

                // Find available lane (for stacking)
                const currentTime = eventStart.getTime()

                // Clean up expired lanes
                for (let i = occupiedLanes.length - 1; i >= 0; i--) {
                  if (occupiedLanes[i].endTime <= currentTime) {
                    occupiedLanes.splice(i, 1)
                  }
                }

                // Find lowest available lane
                let availableLane = 0
                const occupiedLaneNumbers = occupiedLanes.map(ol => ol.lane)
                while (occupiedLaneNumbers.includes(availableLane) && availableLane < maxLanes) {
                  availableLane++
                }

                if (availableLane >= maxLanes) return // Too many overlapping events

                // Add to occupied lanes
                occupiedLanes.push({
                  event,
                  endTime: eventEnd.getTime(),
                  lane: availableLane
                })

                const positionedEvent = {
                  ...event,
                  x: 200 + dayIdx * DAY_WIDTH + localMsToX(msInDay),
                  y: laneIndex * SWIM_LANE_HEIGHT + 10 + (availableLane * 25), // Stack vertically
                  width: Math.max(50, localMsToX(duration)),
                  height: 20,
                  stackLevel: availableLane
                }

                allPositionedEvents.push(positionedEvent)
              })

              return (
                <HorizontalDayColumn
                  key={calendar.id}
                  dates={dates}
                  dayWidth={DAY_WIDTH}
                  laneHeight={SWIM_LANE_HEIGHT}
                  yPosition={laneIndex * SWIM_LANE_HEIGHT}
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
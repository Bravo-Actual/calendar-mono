"use client"

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { differenceInDays, startOfDay, format } from 'date-fns'
import type { CalEvent } from './types'
import { EventCard } from './event-card'
import type { Calendar } from './scheduling-view'

interface SwimLaneProps {
  calendar: Calendar
  dates: Date[]
  dayWidth: number
  laneHeight: number
  yPosition: number
  onEventSelect?: (eventId: string, isMultiSelect: boolean) => void
  onEventUpdate?: (eventId: string, updates: Partial<CalEvent>) => void
  selectedEventIds: Set<string>
}

interface PositionedEvent extends CalEvent {
  x: number
  y: number
  width: number
  height: number
  stackLevel: number
}

const EVENT_HEIGHT = 20
const EVENT_MARGIN = 2
const LANE_PADDING = 4

export function SwimLane({
  calendar,
  dates,
  dayWidth,
  laneHeight,
  yPosition,
  onEventSelect,
  onEventUpdate,
  selectedEventIds
}: SwimLaneProps) {
  // Calculate event positions with stacking
  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    if (!calendar.events?.length || !dates.length) return []

    const timelineStart = dates[0]
    const timelineEnd = dates[dates.length - 1]

    // Filter events that overlap with our timeline
    const relevantEvents = calendar.events.filter(event => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      return eventEnd >= timelineStart && eventStart <= timelineEnd
    })

    // Sort events by start time
    const sortedEvents = [...relevantEvents].sort((a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    // Position events with stacking logic
    const positioned: PositionedEvent[] = []
    const stackLevels: Array<{ endTime: number; level: number }> = []

    for (const event of sortedEvents) {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)

      // Calculate horizontal position
      const daysSinceStart = differenceInDays(eventStart, timelineStart)
      const startHour = eventStart.getHours() + eventStart.getMinutes() / 60
      const endHour = eventEnd.getHours() + eventEnd.getMinutes() / 60

      // Handle events spanning multiple days
      const durationHours = Math.max(0.5, (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60))
      const durationDays = durationHours / 24

      const x = daysSinceStart * dayWidth + (startHour / 24) * dayWidth
      const width = Math.max(dayWidth / 4, durationDays * dayWidth)

      // Find available stack level
      const eventEndTime = eventEnd.getTime()
      let availableLevel = 0

      // Clean up expired stack levels
      const currentTime = eventStart.getTime()
      for (let i = stackLevels.length - 1; i >= 0; i--) {
        if (stackLevels[i].endTime <= currentTime) {
          stackLevels.splice(i, 1)
        }
      }

      // Find the lowest available level
      const occupiedLevels = new Set(stackLevels.map(s => s.level))
      while (occupiedLevels.has(availableLevel)) {
        availableLevel++
      }

      // Add this event to the stack tracking
      stackLevels.push({
        endTime: eventEndTime,
        level: availableLevel
      })

      // Calculate vertical position within the lane
      const eventY = LANE_PADDING + availableLevel * (EVENT_HEIGHT + EVENT_MARGIN)
      const maxEventsInLane = Math.floor((laneHeight - LANE_PADDING * 2) / (EVENT_HEIGHT + EVENT_MARGIN))

      // Skip if event would overflow the lane
      if (availableLevel >= maxEventsInLane) continue

      positioned.push({
        ...event,
        x,
        y: yPosition + eventY,
        width,
        height: EVENT_HEIGHT,
        stackLevel: availableLevel
      })
    }

    return positioned
  }, [calendar.events, dates, dayWidth, laneHeight, yPosition])

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
            style={{ backgroundColor: calendar.color }}
          />
          <div className="font-medium text-sm truncate">
            {calendar.name}
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {calendar.events?.length || 0}
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

      {/* Events */}
      {positionedEvents.map((event) => (
        <motion.div
          key={event.id}
          className="absolute cursor-pointer"
          style={{
            left: event.x + 200, // Offset for lane header
            top: event.y,
            width: event.width,
            height: event.height
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => onEventSelect?.(event.id, e.ctrlKey || e.metaKey)}
        >
          <div
            className={`h-full rounded px-2 py-1 text-xs font-medium border transition-all ${
              selectedEventIds.has(event.id)
                ? 'ring-2 ring-primary ring-offset-1'
                : 'hover:shadow-sm'
            }`}
            style={{
              backgroundColor: `${calendar.color}20`,
              borderColor: calendar.color,
              color: calendar.color
            }}
            title={`${event.title}\n${format(new Date(event.start), 'MMM d, h:mm a')} - ${format(new Date(event.end), 'h:mm a')}`}
          >
            <div className="truncate">
              {event.title}
            </div>
            {event.width > dayWidth / 2 && (
              <div className="text-xs opacity-70 truncate">
                {format(new Date(event.start), 'h:mm a')}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
"use client"

import React from 'react'
import { format, isToday, isWeekend } from 'date-fns'

interface TimelineHeaderProps {
  dates: Date[]
  dayWidth: number
  height: number
  scrollLeft: number
}

export function TimelineHeader({ dates, dayWidth, height, scrollLeft }: TimelineHeaderProps) {
  return (
    <div
      className="relative bg-muted/30 border-b border-border"
      style={{ height }}
    >
      {/* Date Headers */}
      <div
        className="relative h-full"
        style={{
          marginLeft: 200,
          transform: `translateX(-${scrollLeft}px)`
        }}
      >
        {dates.map((date, index) => {
          const isCurrentDay = isToday(date)
          const isWeekendDay = isWeekend(date)

          return (
            <div
              key={date.toISOString()}
              className={`absolute top-0 flex flex-col items-center justify-center text-xs border-r border-border/30 ${
                isCurrentDay
                  ? 'bg-primary text-primary-foreground font-medium'
                  : isWeekendDay
                  ? 'bg-muted/50 text-muted-foreground'
                  : 'bg-background text-foreground'
              }`}
              style={{
                left: index * dayWidth,
                width: dayWidth,
                height: '100%'
              }}
            >
              {/* Day of week */}
              <div className="font-medium">
                {format(date, 'EEE')}
              </div>

              {/* Date */}
              <div className={`text-lg ${isCurrentDay ? 'font-bold' : ''}`}>
                {format(date, 'd')}
              </div>

              {/* Month (only show on 1st of month or if it's different from previous) */}
              {(date.getDate() === 1 || index === 0 ||
                format(date, 'MMM') !== format(dates[index - 1] || date, 'MMM')) && (
                <div className="text-xs opacity-70">
                  {format(date, 'MMM')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Current time indicator for today */}
      {(() => {
        const now = new Date()
        const todayIndex = dates.findIndex(date => isToday(date))

        if (todayIndex >= 0) {
          const hours = now.getHours()
          const minutes = now.getMinutes()
          const timeProgress = (hours * 60 + minutes) / (24 * 60) // 0-1 through the day
          const leftPosition = (todayIndex * dayWidth) + (timeProgress * dayWidth)

          return (
            <div
              className="absolute top-0 bottom-0 w-px bg-primary z-10"
              style={{ left: leftPosition }}
            >
              <div className="absolute top-1 left-0 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
            </div>
          )
        }
        return null
      })()}
    </div>
  )
}
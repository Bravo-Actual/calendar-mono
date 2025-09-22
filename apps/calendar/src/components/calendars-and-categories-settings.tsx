'use client'

import { UserCalendarsSettings } from './user-calendars-settings'
import { EventCategoriesSettings } from './event-categories-settings'

export function CalendarsAndCategoriesSettings() {
  return (
    <div className="space-y-8">
      <UserCalendarsSettings />
      <div className="border-t pt-8">
        <EventCategoriesSettings />
      </div>
    </div>
  )
}
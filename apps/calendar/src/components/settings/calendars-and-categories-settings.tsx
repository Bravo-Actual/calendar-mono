'use client';

import { EventCategoriesSettings } from './event-categories-settings';
import { UserCalendarsSettings } from './user-calendars-settings';

export function CalendarsAndCategoriesSettings() {
  return (
    <div className="space-y-8">
      <UserCalendarsSettings />
      <div className="border-t pt-8">
        <EventCategoriesSettings />
      </div>
    </div>
  );
}

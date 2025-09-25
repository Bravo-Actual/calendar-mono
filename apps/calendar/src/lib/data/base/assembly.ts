// base/assembly.ts
import { db } from './dexie';
import type { AssembledEvent, ClientEvent } from './client-types';

export async function assembleEvent(ev: ClientEvent, userId: string): Promise<AssembledEvent> {
  const edp = await db.event_details_personal.get([ev.id, userId]);
  const calendar = edp?.calendar_id ? await db.user_calendars.get(edp.calendar_id) : null;
  const category = edp?.category_id ? await db.user_categories.get(edp.category_id) : null;

  return {
    ...ev,
    show_time_as: edp?.show_time_as ?? 'busy',
    time_defense_level: edp?.time_defense_level ?? 'normal',
    ai_managed: edp?.ai_managed ?? false,
    ai_instructions: edp?.ai_instructions ?? null,
    calendar: calendar ? { id: calendar.id, name: calendar.name, color: calendar.color ?? 'neutral' } : null,
    category: category ? { id: category.id, name: category.name, color: category.color ?? 'neutral' } : null,
    role: ev.owner_id === userId ? 'owner' : 'viewer',
    following: false,
  };
}

export async function assembleEvents(events: ClientEvent[], userId: string): Promise<AssembledEvent[]> {
  return Promise.all(events.map((e) => assembleEvent(e, userId)));
}
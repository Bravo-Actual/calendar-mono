// data-v2/domains/events-resolved.ts - Resolved events combining all related tables
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { generateUUID } from '../../data/base/utils';
import type { ClientEvent, ClientEDP, ClientEventUser, ClientEventRsvp, EventResolved } from '../../data/base/client-types';
import { createEvent, updateEvent, deleteEvent } from './events';
import { createEventDetailPersonal, updateEventDetailPersonal } from './event-details-personal';
import { createEventUser } from './event-users';
import { createEventRsvp } from './event-rsvps';

// Resolution utilities
async function resolveEvent(event: ClientEvent, uid: string): Promise<EventResolved> {
  // Get personal details
  const personalDetails = await db.event_details_personal.get([event.id, uid]);

  // Get user role for this event
  const userRole = await db.event_users
    .where('event_id')
    .equals(event.id)
    .and(eu => eu.user_id === uid)
    .first();

  // Get RSVP for this event
  const rsvp = await db.event_rsvps
    .where('event_id')
    .equals(event.id)
    .and(er => er.user_id === uid)
    .first();

  // Get calendar and category lookups if personal details exist
  let calendar = null;
  let category = null;

  if (personalDetails?.calendar_id) {
    const cal = await db.user_calendars.get(personalDetails.calendar_id);
    if (cal) {
      calendar = {
        id: cal.id,
        name: cal.name,
        color: cal.color || 'blue'
      };
    }
  }

  if (personalDetails?.category_id) {
    const cat = await db.user_categories.get(personalDetails.category_id);
    if (cat) {
      category = {
        id: cat.id,
        name: cat.name,
        color: cat.color || 'neutral'
      };
    }
  }

  // Determine role and following status
  const role = event.owner_id === uid ? 'owner' : (userRole?.role || 'viewer');
  const following = rsvp?.following || false;

  return {
    ...event,
    personal_details: personalDetails || null,
    user_role: userRole || null,
    rsvp: rsvp || null,
    calendar,
    category,
    role,
    following
  };
}

async function resolveEvents(events: ClientEvent[], uid: string): Promise<EventResolved[]> {
  return Promise.all(events.map(event => resolveEvent(event, uid)));
}

// Read hooks for resolved events
export function useEventsResolved(uid: string | undefined) {
  return useLiveQuery(async (): Promise<EventResolved[]> => {
    if (!uid) return [];

    const events = await db.events
      .where('owner_id')
      .equals(uid)
      .sortBy('start_time_ms');

    return resolveEvents(events, uid);
  }, [uid]);
}

export function useEventResolved(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<EventResolved | undefined> => {
    if (!uid || !eventId) return undefined;

    const event = await db.events.get(eventId);
    if (!event || event.owner_id !== uid) return undefined;

    return resolveEvent(event, uid);
  }, [uid, eventId]);
}

// Get events in a time range for calendar display
export function useEventsResolvedRange(uid: string | undefined, range: { from: number; to: number }) {
  return useLiveQuery(async (): Promise<EventResolved[]> => {
    if (!uid) return [];

    const events = await db.events
      .where('owner_id')
      .equals(uid)
      .and(event => event.start_time_ms < range.to && event.end_time_ms > range.from)
      .sortBy('start_time_ms');

    return resolveEvents(events, uid);
  }, [uid, range.from, range.to]);
}

// Resolved mutations - coordinate across all event tables
export async function createEventResolved(
  uid: string,
  input: {
    // Event fields
    title: string;
    start_time: string;
    end_time: string;
    series_id?: ClientEvent['series_id'];
    agenda?: ClientEvent['agenda'];
    online_event?: boolean;
    online_join_link?: ClientEvent['online_join_link'];
    online_chat_link?: ClientEvent['online_chat_link'];
    in_person?: boolean;
    all_day?: boolean;
    private?: boolean;
    request_responses?: boolean;
    allow_forwarding?: boolean;
    allow_reschedule_request?: boolean;
    hide_attendees?: boolean;
    discovery?: ClientEvent['discovery'];
    join_model?: ClientEvent['join_model'];

    // Personal details
    calendar_id?: string;
    category_id?: string;
    show_time_as?: ClientEDP['show_time_as'];
    time_defense_level?: ClientEDP['time_defense_level'];
    ai_managed?: boolean;
    ai_instructions?: string;

    // Additional users to invite
    invite_users?: Array<{
      user_id: string;
      role?: ClientEventUser['role'];
      rsvp_status?: ClientEventRsvp['rsvp_status'];
    }>;
  }
): Promise<EventResolved> {
  console.log(`🚀 [DEBUG] createEventResolved called for user ${uid}:`, JSON.stringify(input, null, 2));

  // 1. Create the main event
  const event = await createEvent(uid, {
    title: input.title,
    start_time: input.start_time,
    end_time: input.end_time,
    series_id: input.series_id,
    agenda: input.agenda,
    online_event: input.online_event,
    online_join_link: input.online_join_link,
    online_chat_link: input.online_chat_link,
    in_person: input.in_person,
    all_day: input.all_day,
    private: input.private,
    request_responses: input.request_responses,
    allow_forwarding: input.allow_forwarding,
    allow_reschedule_request: input.allow_reschedule_request,
    hide_attendees: input.hide_attendees,
    discovery: input.discovery,
    join_model: input.join_model,
  });

  // 2. Create personal details for the owner
  if (input.calendar_id || input.category_id || input.show_time_as || input.time_defense_level || input.ai_managed || input.ai_instructions) {
    await createEventDetailPersonal(uid, {
      event_id: event.id,
      calendar_id: input.calendar_id,
      category_id: input.category_id,
      show_time_as: input.show_time_as,
      time_defense_level: input.time_defense_level,
      ai_managed: input.ai_managed,
      ai_instructions: input.ai_instructions,
    });
  }

  // 3. Add owner as event user
  await createEventUser(uid, {
    event_id: event.id,
    user_id: uid,
    role: 'owner',
  });

  // 4. Add owner RSVP
  await createEventRsvp(uid, {
    event_id: event.id,
    user_id: uid,
    rsvp_status: 'accepted',
    attendance_type: 'unknown',
  });

  // 5. Invite additional users if specified
  if (input.invite_users?.length) {
    for (const inviteUser of input.invite_users) {
      await createEventUser(uid, {
        event_id: event.id,
        user_id: inviteUser.user_id,
        role: inviteUser.role || 'attendee',
      });

      await createEventRsvp(uid, {
        event_id: event.id,
        user_id: inviteUser.user_id,
        rsvp_status: inviteUser.rsvp_status || 'tentative',
        attendance_type: 'unknown',
      });
    }
  }

  // 6. Return resolved event
  return resolveEvent(event, uid);
}

export async function updateEventResolved(
  uid: string,
  eventId: string,
  input: {
    // Event fields
    title?: string;
    start_time?: Date;
    end_time?: Date;
    series_id?: ClientEvent['series_id'];
    agenda?: ClientEvent['agenda'];
    online_event?: boolean;
    online_join_link?: ClientEvent['online_join_link'];
    online_chat_link?: ClientEvent['online_chat_link'];
    in_person?: boolean;
    all_day?: boolean;
    private?: boolean;
    request_responses?: boolean;
    allow_forwarding?: boolean;
    allow_reschedule_request?: boolean;
    hide_attendees?: boolean;
    discovery?: ClientEvent['discovery'];
    join_model?: ClientEvent['join_model'];

    // Personal details
    calendar_id?: string;
    category_id?: string;
    show_time_as?: ClientEDP['show_time_as'];
    time_defense_level?: ClientEDP['time_defense_level'];
    ai_managed?: boolean;
    ai_instructions?: string;
  }
): Promise<void> {
  // Extract event fields vs personal fields
  const eventFields = {
    title: input.title,
    start_time: input.start_time,
    end_time: input.end_time,
    series_id: input.series_id,
    agenda: input.agenda,
    online_event: input.online_event,
    online_join_link: input.online_join_link,
    online_chat_link: input.online_chat_link,
    in_person: input.in_person,
    all_day: input.all_day,
    private: input.private,
    request_responses: input.request_responses,
    allow_forwarding: input.allow_forwarding,
    allow_reschedule_request: input.allow_reschedule_request,
    hide_attendees: input.hide_attendees,
    discovery: input.discovery,
    join_model: input.join_model,
  };

  const personalFields = {
    calendar_id: input.calendar_id,
    category_id: input.category_id,
    show_time_as: input.show_time_as,
    time_defense_level: input.time_defense_level,
    ai_managed: input.ai_managed,
    ai_instructions: input.ai_instructions,
  };

  // Update event if any event fields changed
  const hasEventChanges = Object.values(eventFields).some(v => v !== undefined);
  if (hasEventChanges) {
    await updateEvent(uid, eventId, eventFields);
  }

  // Update personal details if any personal fields changed
  const hasPersonalChanges = Object.values(personalFields).some(v => v !== undefined);
  if (hasPersonalChanges) {
    await updateEventDetailPersonal(uid, eventId, personalFields);
  }
}

export async function deleteEventResolved(uid: string, eventId: string): Promise<void> {
  // The database cascade deletes will handle related records
  await deleteEvent(uid, eventId);
}
// data-v2/domains/events-resolved.ts - Resolved events combining all related tables
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../base/dexie';
import { supabase } from '../base/client';
import { mapEventFromServer, mapEventUserFromServer, mapEventRsvpFromServer, mapEDPFromServer, mapEventResolvedToServer } from '../../data/base/mapping';
import { generateUUID, nowISO } from '../../data/base/utils';
import type { ClientEvent, ClientEDP, ClientEventUser, ClientEventRsvp, EventResolved } from '../../data/base/client-types';

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

// Resolved mutations - use edge functions for server-side coordination
export async function createEventResolved(
  uid: string,
  input: {
    // Event fields
    title: string;
    start_time: Date;
    end_time: Date;
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

    // Additional users to invite (TODO: handle separately later)
    invite_users?: Array<{
      user_id: string;
      role?: ClientEventUser['role'];
      rsvp_status?: ClientEventRsvp['rsvp_status'];
    }>;
  }
): Promise<EventResolved> {
  console.log(`🚀 [DEBUG] createEventResolved called for user ${uid}:`, JSON.stringify(input, null, 2));

  // Extract personal details for edge function payload
  const { calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions, invite_users, ...eventFields } = input;

  // Prepare personal details payload
  const personal_details = (calendar_id || category_id || show_time_as || time_defense_level || ai_managed || ai_instructions) ? {
    calendar_id,
    category_id,
    show_time_as,
    time_defense_level,
    ai_managed,
    ai_instructions,
  } : undefined;

  // TODO: Handle invite_users separately when we implement role management
  if (invite_users?.length) {
    console.warn('invite_users not yet implemented - will be handled in separate role management');
  }

  // 1. Generate ID for new event
  const eventId = generateUUID();
  const now = new Date();

  // 2. Create event object for optimistic update
  const event: ClientEvent = {
    id: eventId,
    owner_id: uid,
    series_id: input.series_id || null,
    title: input.title,
    agenda: input.agenda || null,
    online_event: input.online_event || false,
    online_join_link: input.online_join_link || null,
    online_chat_link: input.online_chat_link || null,
    in_person: input.in_person || false,
    start_time: input.start_time,
    end_time: input.end_time,
    start_time_ms: input.start_time.getTime(),
    end_time_ms: input.end_time.getTime(),
    all_day: input.all_day || false,
    private: input.private || false,
    request_responses: input.request_responses ?? true,
    allow_forwarding: input.allow_forwarding ?? true,
    allow_reschedule_request: input.allow_reschedule_request ?? true,
    hide_attendees: input.hide_attendees || false,
    history: [],
    discovery: input.discovery || 'audience_only',
    join_model: input.join_model || 'invite_only',
    created_at: now,
    updated_at: now,
  };

  // 3. Write to Dexie first (instant optimistic update for all affected tables)
  await db.events.put(event);

  // Also add related records to Dexie for optimistic updates (matching database triggers)

  // Add personal details if provided
  if (personal_details) {
    await db.event_details_personal.put({
      event_id: eventId,
      user_id: uid,
      calendar_id: personal_details.calendar_id || null,
      category_id: personal_details.category_id || null,
      show_time_as: personal_details.show_time_as || 'busy',
      time_defense_level: personal_details.time_defense_level || 'normal',
      ai_managed: personal_details.ai_managed || false,
      ai_instructions: personal_details.ai_instructions || null,
      created_at: now,
      updated_at: now,
    });
  }

  // Add event_users record for owner (matching database trigger)
  await db.event_users.put({
    event_id: eventId,
    user_id: uid,
    role: 'owner',
    created_at: now,
    updated_at: now,
  });

  // Add event_rsvps record for owner (matching database trigger)
  await db.event_rsvps.put({
    event_id: eventId,
    user_id: uid,
    rsvp_status: 'accepted',
    attendance_type: 'unknown',
    following: false,
    note: null,
    created_at: now,
    updated_at: now,
  });

  // 4. Enqueue in outbox for eventual server sync via edge function
  const serverPayload = mapEventResolvedToServer(event, personal_details);
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'events',
    op: 'insert',
    payload: serverPayload,
    created_at: nowISO(),
    attempts: 0,
  });

  // 5. Return resolved event
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
  // Extract personal details from input
  const { calendar_id, category_id, show_time_as, time_defense_level, ai_managed, ai_instructions, start_time, end_time, ...eventFields } = input;

  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing || existing.owner_id !== uid) {
    throw new Error('Event not found or access denied');
  }

  const now = new Date();

  // 2. Create updated event with Date objects for Dexie (following offline-first pattern)
  const updated: ClientEvent = {
    ...existing,
    ...eventFields,
    updated_at: now,
  };

  // Handle Date objects and computed millisecond fields
  if (start_time) {
    updated.start_time = start_time;
    updated.start_time_ms = start_time.getTime();
  }
  if (end_time) {
    updated.end_time = end_time;
    updated.end_time_ms = end_time.getTime();
  }

  // 3. Update in Dexie first (instant optimistic update for all affected tables)
  await db.events.put(updated);

  // Also update personal details in Dexie for optimistic updates
  if (calendar_id !== undefined || category_id !== undefined || show_time_as !== undefined || time_defense_level !== undefined || ai_managed !== undefined || ai_instructions !== undefined) {
    // Get existing personal details to merge with updates
    const existingEDP = await db.event_details_personal.get([eventId, uid]);

    await db.event_details_personal.put({
      event_id: eventId,
      user_id: uid,
      calendar_id: calendar_id !== undefined ? calendar_id : (existingEDP?.calendar_id || null),
      category_id: category_id !== undefined ? category_id : (existingEDP?.category_id || null),
      show_time_as: show_time_as !== undefined ? show_time_as : (existingEDP?.show_time_as || 'busy'),
      time_defense_level: time_defense_level !== undefined ? time_defense_level : (existingEDP?.time_defense_level || 'normal'),
      ai_managed: ai_managed !== undefined ? ai_managed : (existingEDP?.ai_managed || false),
      ai_instructions: ai_instructions !== undefined ? ai_instructions : (existingEDP?.ai_instructions || null),
      created_at: existingEDP?.created_at || now,
      updated_at: now,
    });
  }

  // 4. Prepare server payload - only include fields that are actually being updated
  const serverEventPayload: any = {};

  // Include all explicitly provided event fields
  Object.keys(eventFields).forEach(key => {
    const value = eventFields[key as keyof typeof eventFields];
    if (value !== undefined) {
      // Convert Date objects to ISO strings for server
      if (value instanceof Date) {
        serverEventPayload[key] = value.toISOString();
      } else {
        serverEventPayload[key] = value;
      }
    }
  });

  // Add time fields if provided (convert Date objects to ISO strings)
  if (start_time !== undefined) {
    serverEventPayload.start_time = start_time.toISOString();
  }
  if (end_time !== undefined) {
    serverEventPayload.end_time = end_time.toISOString();
  }

  // Prepare personal details payload if any personal details are provided
  const personal_details = (calendar_id !== undefined || category_id !== undefined || show_time_as !== undefined || time_defense_level !== undefined || ai_managed !== undefined || ai_instructions !== undefined) ? {
    ...(calendar_id !== undefined && { calendar_id }),
    ...(category_id !== undefined && { category_id }),
    ...(show_time_as !== undefined && { show_time_as }),
    ...(time_defense_level !== undefined && { time_defense_level }),
    ...(ai_managed !== undefined && { ai_managed }),
    ...(ai_instructions !== undefined && { ai_instructions }),
  } : undefined;

  // 5. Enqueue in outbox for eventual server sync via edge function
  const finalPayload = {
    id: eventId,
    ...serverEventPayload,
    ...(personal_details && { personal_details }),
  };

  console.log('🔍 [DEBUG] updateEventResolved input eventFields:', eventFields);
  console.log('🔍 [DEBUG] updateEventResolved serverEventPayload:', serverEventPayload);
  console.log('🔍 [DEBUG] updateEventResolved finalPayload to outbox:', JSON.stringify(finalPayload, null, 2));

  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'events',
    op: 'update',
    payload: finalPayload,
    created_at: now.toISOString(),
    attempts: 0,
  });
}

export async function deleteEventResolved(uid: string, eventId: string): Promise<void> {
  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing || existing.owner_id !== uid) {
    throw new Error('Event not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.events.delete(eventId);

  // 3. Enqueue in outbox for eventual server sync via edge function
  await db.outbox.add({
    id: generateUUID(),
    user_id: uid,
    table: 'events',
    op: 'delete',
    payload: { id: eventId },
    created_at: nowISO(),
    attempts: 0,
  });
}
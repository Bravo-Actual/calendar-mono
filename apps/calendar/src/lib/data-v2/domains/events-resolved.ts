// data-v2/domains/events-resolved.ts - Resolved events combining all related tables
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  ClientEDP,
  ClientEvent,
  ClientEventRsvp,
  ClientEventUser,
  EventResolved,
} from '../base/client-types';
import { db } from '../base/dexie';
import { mapEventResolvedToServer } from '../base/mapping';
import { addToOutboxWithMerging } from '../base/outbox-utils';
import { generateUUID } from '../base/utils';

// Resolution utilities
async function resolveEvent(event: ClientEvent, uid: string): Promise<EventResolved> {
  // Get personal details
  const personalDetails = await db.event_details_personal.get([event.id, uid]);

  // Get user role for this event
  const userRole = await db.event_users
    .where('event_id')
    .equals(event.id)
    .and((eu) => eu.user_id === uid)
    .first();

  // Get RSVP for this event
  const rsvp = await db.event_rsvps
    .where('event_id')
    .equals(event.id)
    .and((er) => er.user_id === uid)
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
        color: cal.color || 'blue',
      };
    }
  }

  if (personalDetails?.category_id) {
    const cat = await db.user_categories.get(personalDetails.category_id);
    if (cat) {
      category = {
        id: cat.id,
        name: cat.name,
        color: cat.color || 'neutral',
      };
    }
  }

  // Determine role and following status
  const role = event.owner_id === uid ? 'owner' : userRole?.role || 'viewer';
  const following = rsvp?.following || false;

  return {
    ...event,
    personal_details: personalDetails || null,
    user_role: userRole || null,
    rsvp: rsvp || null,
    calendar,
    category,
    role,
    following,
  };
}

async function resolveEvents(events: ClientEvent[], uid: string): Promise<EventResolved[]> {
  return Promise.all(events.map((event) => resolveEvent(event, uid)));
}

// Read hooks for resolved events
export function useEventsResolved(uid: string | undefined): EventResolved[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      // Get all event IDs where user has a role (owner or attendee)
      const eventUsers = await db.event_users.where('user_id').equals(uid).toArray();
      const eventIds = eventUsers.map((eu) => eu.event_id);

      // Get all events for these IDs and sort by start time
      const events = await db.events.bulkGet(eventIds);
      const validEvents = events.filter((e): e is ClientEvent => e !== undefined);
      validEvents.sort((a, b) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

      return resolveEvents(validEvents, uid);
    },
    [uid],
    [] // Default value prevents undefined
  ) as EventResolved[];
}

export function useEventResolved(uid: string | undefined, eventId: string | undefined) {
  return useLiveQuery(async (): Promise<EventResolved | undefined> => {
    if (!uid || !eventId) return undefined;

    const event = await db.events.get(eventId);
    if (!event) return undefined;

    // Check if user has access (is owner or has a role in event_users)
    const hasAccess =
      event.owner_id === uid ||
      (await db.event_users
        .where('event_id')
        .equals(eventId)
        .and((eu) => eu.user_id === uid)
        .count()) > 0;

    if (!hasAccess) return undefined;

    return resolveEvent(event, uid);
  }, [uid, eventId]);
}

// Get events in a time range for calendar display
export function useEventsResolvedRange(
  uid: string | undefined,
  range: { from: number; to: number }
): EventResolved[] {
  return useLiveQuery(
    async () => {
      if (!uid) return [];

      // Get all event IDs where user has a role (owner or attendee)
      const eventUsers = await db.event_users.where('user_id').equals(uid).toArray();
      const eventIds = eventUsers.map((eu) => eu.event_id);

      // Get all events for these IDs that fall within the range
      const events = await db.events.bulkGet(eventIds);
      const validEvents = events
        .filter((e): e is ClientEvent => e !== undefined)
        .filter((event) => event.start_time_ms < range.to && event.end_time_ms > range.from)
        .sort((a, b) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

      return resolveEvents(validEvents, uid);
    },
    [uid, range.from, range.to],
    [] // Default value prevents undefined
  ) as EventResolved[];
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
  // Extract personal details for edge function payload
  const {
    calendar_id,
    category_id,
    show_time_as,
    time_defense_level,
    ai_managed,
    ai_instructions,
    invite_users,
    ...eventFields
  } = input;

  // Prepare personal details payload
  const personal_details =
    calendar_id ||
    category_id ||
    show_time_as ||
    time_defense_level ||
    ai_managed ||
    ai_instructions
      ? {
          calendar_id,
          category_id,
          show_time_as,
          time_defense_level,
          ai_managed,
          ai_instructions,
        }
      : undefined;

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

  // Add invited users to event_users and event_rsvps tables
  if (invite_users?.length) {
    for (const invitee of invite_users) {
      // Add to event_users
      await db.event_users.put({
        event_id: eventId,
        user_id: invitee.user_id,
        role: invitee.role || 'attendee',
        created_at: now,
        updated_at: now,
      });

      // Add to event_rsvps
      await db.event_rsvps.put({
        event_id: eventId,
        user_id: invitee.user_id,
        rsvp_status: invitee.rsvp_status || 'tentative',
        attendance_type: 'unknown',
        following: false,
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // 4. Enqueue in outbox for eventual server sync via edge function
  const serverPayload = mapEventResolvedToServer(event, personal_details, invite_users);
  await addToOutboxWithMerging(uid, 'events', 'insert', serverPayload, event.id);

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

    // Attendee management
    invite_users?: Array<{ userId: string; role: ClientEventUser['role'] }>;
    update_users?: Array<{ userId: string; role: ClientEventUser['role'] }>;
    remove_users?: string[];
  }
): Promise<void> {
  // Extract personal details and attendee changes from input
  const {
    calendar_id,
    category_id,
    show_time_as,
    time_defense_level,
    ai_managed,
    ai_instructions,
    start_time,
    end_time,
    invite_users,
    update_users,
    remove_users,
    ...eventFields
  } = input;

  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing) {
    throw new Error('Event not found');
  }

  const now = new Date();
  const isOwner = existing.owner_id === uid;

  // Check if user has access to this event (either owner or attendee)
  if (!isOwner) {
    const hasAccess =
      (await db.event_users
        .where('event_id')
        .equals(eventId)
        .and((eu) => eu.user_id === uid)
        .count()) > 0;

    if (!hasAccess) {
      throw new Error('Event not found or access denied');
    }
  }

  // 2. Create updated event with Date objects for Dexie (only if owner)
  let updated: ClientEvent = existing;
  let hasEventUpdates = false;

  if (isOwner && (Object.keys(eventFields).length > 0 || start_time || end_time)) {
    updated = {
      ...existing,
      ...eventFields,
      updated_at: now,
    };

    // Handle Date objects and computed millisecond fields
    if (start_time) {
      updated.start_time = start_time;
      updated.start_time_ms = start_time.getTime();
      hasEventUpdates = true;
    }
    if (end_time) {
      updated.end_time = end_time;
      updated.end_time_ms = end_time.getTime();
      hasEventUpdates = true;
    }

    if (Object.keys(eventFields).length > 0) {
      hasEventUpdates = true;
    }

    // 3. Update in Dexie first (instant optimistic update for all affected tables)
    if (hasEventUpdates) {
      await db.events.put(updated);
    }
  }

  // Also update personal details in Dexie for optimistic updates
  if (
    calendar_id !== undefined ||
    category_id !== undefined ||
    show_time_as !== undefined ||
    time_defense_level !== undefined ||
    ai_managed !== undefined ||
    ai_instructions !== undefined
  ) {
    // Get existing personal details to merge with updates
    const existingEDP = await db.event_details_personal.get([eventId, uid]);

    await db.event_details_personal.put({
      event_id: eventId,
      user_id: uid,
      calendar_id: calendar_id !== undefined ? calendar_id : existingEDP?.calendar_id || null,
      category_id: category_id !== undefined ? category_id : existingEDP?.category_id || null,
      show_time_as: show_time_as !== undefined ? show_time_as : existingEDP?.show_time_as || 'busy',
      time_defense_level:
        time_defense_level !== undefined
          ? time_defense_level
          : existingEDP?.time_defense_level || 'normal',
      ai_managed: ai_managed !== undefined ? ai_managed : existingEDP?.ai_managed || false,
      ai_instructions:
        ai_instructions !== undefined ? ai_instructions : existingEDP?.ai_instructions || null,
      created_at: existingEDP?.created_at || now,
      updated_at: now,
    });
  }

  // Handle attendee changes
  if (invite_users?.length || update_users?.length || remove_users?.length) {
    // Remove users first (server will handle RSVP cleanup via triggers)
    if (remove_users?.length) {
      for (const userId of remove_users) {
        await db.event_users.where({ event_id: eventId, user_id: userId }).delete();
      }
    }

    // Update existing users
    if (update_users?.length) {
      for (const { userId, role } of update_users) {
        const existingUser = await db.event_users.get([eventId, userId]);
        if (existingUser) {
          await db.event_users.put({
            ...existingUser,
            role,
            updated_at: now,
          });
        }
      }
    }

    // Add new users
    if (invite_users?.length) {
      for (const { userId, role } of invite_users) {
        // Add event_users record (server will handle RSVP and personal_details via triggers)
        await db.event_users.put({
          event_id: eventId,
          user_id: userId,
          role: role || 'attendee',
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  // 4. Prepare server payload - only include fields that are actually being updated
  const serverEventPayload: any = {};

  // Only include event fields if user is the owner
  if (isOwner) {
    // Include all explicitly provided event fields
    Object.keys(eventFields).forEach((key) => {
      const value = eventFields[key as keyof typeof eventFields];
      if (value !== undefined) {
        // Convert Date objects to ISO strings for server
        if (value && typeof value === 'object' && (value as any) instanceof Date) {
          serverEventPayload[key] = (value as Date).toISOString();
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
  }

  // Prepare personal details payload if any personal details are provided
  const personal_details =
    calendar_id !== undefined ||
    category_id !== undefined ||
    show_time_as !== undefined ||
    time_defense_level !== undefined ||
    ai_managed !== undefined ||
    ai_instructions !== undefined
      ? {
          ...(calendar_id !== undefined && { calendar_id }),
          ...(category_id !== undefined && { category_id }),
          ...(show_time_as !== undefined && { show_time_as }),
          ...(time_defense_level !== undefined && { time_defense_level }),
          ...(ai_managed !== undefined && { ai_managed }),
          ...(ai_instructions !== undefined && { ai_instructions }),
        }
      : undefined;

  // Prepare attendee changes payload if any attendee operations were performed
  const attendee_changes =
    invite_users?.length || update_users?.length || remove_users?.length
      ? {
          ...(invite_users?.length && { invite_users }),
          ...(update_users?.length && { update_users }),
          ...(remove_users?.length && { remove_users }),
        }
      : undefined;

  // 5. Enqueue in outbox for eventual server sync via edge function
  const finalPayload = {
    id: eventId,
    ...serverEventPayload,
    ...(personal_details && { personal_details }),
    ...(attendee_changes && { attendee_changes }),
  };

  await addToOutboxWithMerging(uid, 'events', 'update', finalPayload, eventId);
}

export async function deleteEventResolved(uid: string, eventId: string): Promise<void> {
  // 1. Get existing event from Dexie
  const existing = await db.events.get(eventId);
  if (!existing || existing.owner_id !== uid) {
    throw new Error('Event not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  // Also delete related records since Dexie doesn't support CASCADE
  await db.events.delete(eventId);

  // Delete related tables using composite keys
  await db.event_details_personal.where('event_id').equals(eventId).delete();
  await db.event_users.where('event_id').equals(eventId).delete();
  await db.event_rsvps.where('event_id').equals(eventId).delete();

  // 3. Enqueue in outbox for eventual server sync via edge function
  await addToOutboxWithMerging(uid, 'events', 'delete', { id: eventId }, eventId);
}

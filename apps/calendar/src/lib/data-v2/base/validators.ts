// data-v2/base/validators.ts - Zod schemas for validation before outbox enqueue
import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid();
const isoDateSchema = z.date(); // Validate Date objects directly for early error detection

// Color enum schema
const colorSchema = z.enum([
  'neutral',
  'slate',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'rose',
]);

// Categories validation
export const CategorySchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(120),
  color: colorSchema.nullable(),
  is_default: z.boolean(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// User Profiles validation
export const UserProfileSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  email: z.string().email(),
  slug: z.string().nullable(),
  first_name: z.string().max(100).nullable(),
  last_name: z.string().max(100).nullable(),
  display_name: z.string().max(200).nullable(),
  title: z.string().max(200).nullable(),
  organization: z.string().max(200).nullable(),
  avatar_url: z.string().nullable(),
  timezone: z.string().max(50).nullable(),
  time_format: z.enum(['12_hour', '24_hour']).nullable(),
  week_start_day: z.enum(['0', '1', '2', '3', '4', '5', '6']).nullable(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// AI Personas validation
export const PersonaSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(120),
  avatar_url: z.string().nullable(),
  traits: z.string().max(5000).nullable(),
  instructions: z.string().max(5000).nullable(),
  greeting: z.string().max(1000).nullable(),
  agent_id: z.string().max(100).nullable(),
  model_id: z.string().max(100).nullable(),
  temperature: z.number().min(0).max(2).nullable(),
  top_p: z.number().min(0).max(1).nullable(),
  is_default: z.boolean().nullable(),
  properties_ext: z.any().nullable(), // Json type - recursive structure
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Calendars validation
export const CalendarSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(120),
  color: colorSchema.nullable(),
  type: z.enum(['default', 'archive', 'user']),
  visible: z.boolean(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Events validation
export const EventSchema = z.object({
  id: uuidSchema,
  owner_id: uuidSchema,
  series_id: uuidSchema.nullable(),
  title: z.string().min(1).max(500),
  agenda: z.string().nullable(),
  online_event: z.boolean(),
  online_join_link: z.string().url().nullable(),
  online_chat_link: z.string().url().nullable(),
  in_person: z.boolean(),
  start_time: isoDateSchema,
  end_time: isoDateSchema,
  start_time_ms: z.number(),
  end_time_ms: z.number(),
  all_day: z.boolean(),
  private: z.boolean(),
  request_responses: z.boolean(),
  allow_forwarding: z.boolean(),
  allow_reschedule_request: z.boolean(),
  hide_attendees: z.boolean(),
  history: z.any().nullable(),
  discovery: z.enum(['audience_only', 'tenant_only', 'public']),
  join_model: z.enum(['invite_only', 'request_to_join', 'open_join']),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Event Details Personal validation
export const EventPersonalSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  calendar_id: uuidSchema.nullable(),
  category_id: uuidSchema.nullable(),
  show_time_as: z.enum(['free', 'tentative', 'busy', 'oof', 'working_elsewhere']),
  time_defense_level: z.enum(['flexible', 'normal', 'high', 'hard_block']),
  ai_managed: z.boolean(),
  ai_instructions: z.string().nullable(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Event Users validation (composite key: event_id + user_id)
export const EventUserSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  role: z.enum(['viewer', 'contributor', 'owner', 'delegate_full', 'attendee']),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Event RSVPs validation (composite key: event_id + user_id)
export const EventRsvpSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  rsvp_status: z.enum(['tentative', 'accepted', 'declined']),
  attendance_type: z.enum(['in_person', 'virtual', 'unknown']),
  note: z.string().nullable(),
  following: z.boolean(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Annotations validation
export const AnnotationSchema = z
  .object({
    id: uuidSchema,
    user_id: uuidSchema,
    type: z.enum(['ai_event_highlight', 'ai_time_highlight']),
    event_id: uuidSchema.nullable(),
    start_time: isoDateSchema,
    end_time: isoDateSchema,
    start_time_ms: z.number().nullable(), // Generated column, nullable in DB
    end_time_ms: z.number().nullable(), // Generated column, nullable in DB
    emoji_icon: z.string().nullable(),
    title: z.string().nullable(),
    message: z.string().nullable(),
    visible: z.boolean().nullable(), // Nullable in DB
    created_at: isoDateSchema,
    updated_at: isoDateSchema,
  })
  .refine(
    (data) => {
      // Business rule: ai_event_highlight must have event_id
      if (data.type === 'ai_event_highlight') {
        return data.event_id !== null;
      }
      // Business rule: ai_time_highlight must NOT have event_id
      if (data.type === 'ai_time_highlight') {
        return data.event_id === null;
      }
      return true;
    },
    {
      message:
        'ai_event_highlight requires event_id, ai_time_highlight requires event_id to be null',
      path: ['event_id'],
    }
  );

// User Work Periods validation
export const UserWorkPeriodSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  weekday: z.number().min(0).max(6),
  start_time: z.string(), // time format HH:MM
  end_time: z.string(), // time format HH:MM
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Generic validation function
export function validateBeforeEnqueue<T>(schema: z.ZodSchema<T>, data: T): T {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('❌ [VALIDATION] Validation failed before outbox enqueue');
    console.error('❌ [VALIDATION] Schema:', schema._def);
    console.error('❌ [VALIDATION] Data being validated:', JSON.stringify(data, null, 2));
    if (error instanceof z.ZodError) {
      console.error('❌ [VALIDATION] Zod errors:', error.issues);
      console.error('❌ [VALIDATION] Error message:', error.message);
    } else {
      console.error('❌ [VALIDATION] Unknown error:', error);
    }
    throw new Error(
      `Validation failed: ${error instanceof z.ZodError ? error.message : 'Unknown validation error'}`
    );
  }
}

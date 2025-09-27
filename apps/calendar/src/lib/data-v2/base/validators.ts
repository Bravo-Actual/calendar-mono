// data-v2/base/validators.ts - Zod schemas for validation before outbox enqueue
import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().datetime();

// Color enum schema
const colorSchema = z.enum([
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
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
  creator_id: uuidSchema.nullable(),
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
  invite_allow_reschedule_proposals: z.boolean(),
  hide_attendees: z.boolean(),
  history: z.array(z.unknown()),
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

// Event User Roles validation
export const EventUserRoleSchema = z.object({
  id: uuidSchema,
  event_id: uuidSchema,
  user_id: uuidSchema,
  invite_type: z.enum(['required', 'optional']),
  rsvp: z.enum(['tentative', 'accepted', 'declined']).nullable(),
  rsvp_timestamp: isoDateSchema.nullable(),
  attendance_type: z.enum(['in_person', 'virtual']).nullable(),
  following: z.boolean(),
  role: z.enum(['viewer', 'contributor', 'owner', 'delegate_full']).nullable(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Annotations validation
export const AnnotationSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  type: z.enum(['ai_event_highlight', 'ai_time_highlight']),
  event_id: uuidSchema.nullable(),
  start_time: isoDateSchema,
  end_time: isoDateSchema,
  start_time_ms: z.number(),
  end_time_ms: z.number(),
  emoji_icon: z.string().nullable(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  visible: z.boolean(),
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// User Work Periods validation
export const UserWorkPeriodSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  weekday: z.number().min(0).max(6),
  start_time: z.string(), // time format HH:MM
  end_time: z.string(),   // time format HH:MM
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});

// Generic validation function
export function validateBeforeEnqueue<T>(schema: z.ZodSchema<T>, data: T): T {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('Validation failed before outbox enqueue:', error);
    throw new Error(`Validation failed: ${error instanceof z.ZodError ? error.message : 'Unknown validation error'}`);
  }
}
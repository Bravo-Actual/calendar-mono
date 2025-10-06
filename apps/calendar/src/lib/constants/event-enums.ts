// Event and related table enum display labels
import type {
  AttendanceType,
  CalendarType,
  EventCategory,
  EventDiscoveryType,
  EventJoinModelType,
  InviteType,
  RsvpStatus,
  ShowTimeAs,
  TimeDefenseLevel,
  UserRole,
} from '@/types';

export const COLORS: Array<{ value: EventCategory; label: string }> = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'slate', label: 'Slate' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'violet', label: 'Violet' },
  { value: 'fuchsia', label: 'Fuchsia' },
  { value: 'rose', label: 'Rose' },
] as const;

export const SHOW_TIME_AS: Array<{ value: ShowTimeAs; label: string }> = [
  { value: 'free', label: 'Free' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'busy', label: 'Busy' },
  { value: 'oof', label: 'Out of Office' },
  { value: 'working_elsewhere', label: 'Working Elsewhere' },
] as const;

export const TIME_DEFENSE_LEVEL: Array<{ value: TimeDefenseLevel; label: string }> = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'hard_block', label: 'Hard Block' },
] as const;

export const INVITE_TYPE: Array<{ value: InviteType; label: string }> = [
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
] as const;

export const RSVP_STATUS: Array<{ value: RsvpStatus; label: string }> = [
  { value: 'no_response', label: 'No Response' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
] as const;

export const ATTENDANCE_TYPE: Array<{ value: AttendanceType; label: string }> = [
  { value: 'in_person', label: 'In Person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'unknown', label: 'Unknown' },
] as const;

export const USER_ROLE: Array<{ value: UserRole; label: string }> = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'owner', label: 'Owner' },
  { value: 'delegate_full', label: 'Delegate (Full)' },
  { value: 'attendee', label: 'Attendee' },
] as const;

export const EVENT_DISCOVERY_TYPES: Array<{ value: EventDiscoveryType; label: string }> = [
  { value: 'audience_only', label: 'Audience Only' },
  { value: 'tenant_only', label: 'Organization Only' },
  { value: 'public', label: 'Public' },
] as const;

export const EVENT_JOIN_MODEL_TYPES: Array<{ value: EventJoinModelType; label: string }> = [
  { value: 'invite_only', label: 'Invite Only' },
  { value: 'request_to_join', label: 'Request to Join' },
  { value: 'open_join', label: 'Open Join' },
] as const;

export const CALENDAR_TYPE: Array<{ value: CalendarType; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'archive', label: 'Archive' },
  { value: 'user', label: 'User' },
] as const;

// Helper to get Tailwind color class from color enum
export function getColorClass(color: string): string {
  switch (color) {
    case 'neutral':
      return 'bg-neutral-500';
    case 'slate':
      return 'bg-slate-500';
    case 'orange':
      return 'bg-orange-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'green':
      return 'bg-green-500';
    case 'blue':
      return 'bg-blue-500';
    case 'indigo':
      return 'bg-indigo-500';
    case 'violet':
      return 'bg-violet-500';
    case 'fuchsia':
      return 'bg-fuchsia-500';
    case 'rose':
      return 'bg-rose-500';
    default:
      return 'bg-neutral-500';
  }
}

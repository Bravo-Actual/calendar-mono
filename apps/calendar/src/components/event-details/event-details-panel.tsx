'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Calendar,
  ChevronDown,
  Clock,
  Lock,
  MapPin,
  Plus,
  Send,
  Shield,
  Star,
  Tag,
  Undo2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { InputGroupOnline } from '@/components/custom/input-group-online';
import { InputGroupSelect } from '@/components/custom/input-group-select';
import { InputGroupTime } from '@/components/custom/input-group-time';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupButton } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import 'overlayscrollbars/styles/overlayscrollbars.css';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfileServer } from '@/hooks/use-user-profile-server';
import { getAvatarUrl } from '@/lib/avatar-utils';
import {
  EVENT_DISCOVERY_TYPES,
  EVENT_JOIN_MODEL_TYPES,
  getColorClass,
  SHOW_TIME_AS,
  TIME_DEFENSE_LEVEL,
} from '@/lib/constants/event-enums';
import type { ClientEventUser, ClientUserProfile, EventResolved } from '@/lib/data-v2';
import { useEventUsersWithProfiles } from '@/lib/data-v2/domains/event-users';
import { useUserProfileSearch } from '@/lib/data-v2/domains/user-profiles';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app';
import { EventAttendees } from './event-attendees';

// Helper component to fetch and display attendee card with live profile data
function AttendeeCard({
  userId,
  state,
  tempProfile,
  isOwner,
  ownerId,
  canEdit,
  onRoleChange,
  onRemove,
}: {
  userId: string;
  state: { role: string; changeType: 'none' | 'added' | 'updated' | 'removed'; isFromDb: boolean };
  tempProfile?: { email?: string; displayName?: string; avatarUrl?: string | null };
  isOwner: boolean;
  ownerId?: string;
  canEdit?: boolean;
  onRoleChange: (newRole: string) => void;
  onRemove: () => void;
}) {
  // Fetch profile from server with TanStack Query
  const { data: profile } = useUserProfileServer(userId);

  // Use DB profile if available, otherwise temp profile
  const displayName = profile?.display_name || tempProfile?.displayName;
  const email = profile?.email || tempProfile?.email;
  const avatarUrl = getAvatarUrl(profile?.avatar_url || tempProfile?.avatarUrl);

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : email?.[0]?.toUpperCase() || '?';

  const changeTypeBadge =
    state.changeType !== 'none' ? (
      <Badge
        variant={
          state.changeType === 'removed'
            ? 'destructive'
            : state.changeType === 'added'
              ? 'default'
              : 'secondary'
        }
        className="capitalize shrink-0 text-xs"
      >
        {state.changeType === 'removed'
          ? 'Removing'
          : state.changeType === 'added'
            ? 'Adding'
            : 'Updated'}
      </Badge>
    ) : null;

  return (
    <Card key={userId} className={cn('py-3 gap-0', state.changeType === 'removed' && 'opacity-50')}>
      <CardContent className="py-0">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{displayName || email || 'Unknown User'}</div>
            {displayName && email && (
              <div className="text-xs text-muted-foreground truncate">{email}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner ? (
              <Badge variant="outline" className="capitalize">
                Owner
              </Badge>
            ) : canEdit ? (
              <>
                <Select value={state.role} onValueChange={onRoleChange}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendee">Attendee</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="delegate_full">Delegate</SelectItem>
                  </SelectContent>
                </Select>
                {changeTypeBadge}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Badge variant="secondary" className="capitalize">
                {state.role === 'delegate_full' ? 'Delegate' : state.role}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface EventDetailsPanelProps {
  selectedEvent: EventResolved | undefined;
  selectedEventPrimary: string | null;
  eventDetailsPanelOpen: boolean;
  userCalendars: Array<{ id: string; name: string; color: string }>;
  userCategories: Array<{ id: string; name: string; color: string }>;
  onSave?: (updates: {
    title?: string;
    agenda?: string;
    private?: boolean;
    online_event?: boolean;
    online_join_link?: string;
    online_chat_link?: string;
    in_person?: boolean;
    all_day?: boolean;
    start_time?: Date;
    end_time?: Date;
    request_responses?: boolean;
    allow_forwarding?: boolean;
    allow_reschedule_request?: boolean;
    hide_attendees?: boolean;
    discovery?: 'audience_only' | 'tenant_only' | 'public';
    join_model?: 'invite_only' | 'request_to_join' | 'open_join';
    calendar_id?: string;
    category_id?: string;
    show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';
    time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block';
    ai_managed?: boolean;
    ai_instructions?: string;
    invite_users?: Array<{ userId: string; role: ClientEventUser['role'] }>;
    update_users?: Array<{ userId: string; role: ClientEventUser['role'] }>;
    remove_users?: string[];
  }) => void;
  onClose?: () => void;
}

export function EventDetailsPanel({
  selectedEvent,
  selectedEventPrimary,
  eventDetailsPanelOpen,
  userCalendars,
  userCategories,
  onSave,
  onClose,
}: EventDetailsPanelProps) {
  // Auth context
  const { user } = useAuth();

  // App store for time selection mode and timezone
  const enableTimeSelectionMode = useAppStore((s) => s.enableTimeSelectionMode);
  const disableTimeSelectionMode = useAppStore((s) => s.disableTimeSelectionMode);
  const timezone = useAppStore((s) => s.timezone);

  // Fetch event users with profiles
  const eventUsers = useEventUsersWithProfiles(user?.id, selectedEvent?.id);

  // Fetch owner profile separately
  const { data: ownerProfile } = useUserProfileServer(selectedEvent?.owner_id);

  // Alert dialog state for unsaved changes
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // Local state for editing
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showTimeAs, setShowTimeAs] = useState('busy');
  const [timeDefenseLevel, setTimeDefenseLevel] = useState('normal');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [aiManaged, setAiManaged] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [onlineEvent, setOnlineEvent] = useState(false);
  const [onlineJoinLink, setOnlineJoinLink] = useState('');
  const [onlineChatLink, setOnlineChatLink] = useState('');
  const [inPerson, setInPerson] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [requestResponses, setRequestResponses] = useState(true);
  const [allowForwarding, setAllowForwarding] = useState(true);
  const [allowRescheduleRequest, setAllowRescheduleRequest] = useState(true);
  const [hideAttendees, setHideAttendees] = useState(false);
  const [discovery, setDiscovery] = useState<'audience_only' | 'tenant_only' | 'public'>(
    'audience_only'
  );
  const [joinModel, setJoinModel] = useState<'invite_only' | 'request_to_join' | 'open_join'>(
    'invite_only'
  );

  // Single source of truth: Map of userId -> attendee with change status
  // Profile data comes from useUserProfile hook, not stored here
  type AttendeeState = {
    userId: string;
    role: string;
    changeType: 'none' | 'added' | 'updated' | 'removed';
    isFromDb: boolean; // true if originally from database
  };

  const [attendeeStates, setAttendeeStates] = useState<Map<string, AttendeeState>>(new Map());

  // Temporary profile storage for newly added users (not yet in DB)
  // This gets cleared when users are saved and reloaded from DB
  const [tempProfiles, setTempProfiles] = useState<
    Map<string, { email?: string; displayName?: string; avatarUrl?: string | null }>
  >(new Map());

  // Attendee search state for Attendees tab
  const [attendeeSearchInput, setAttendeeSearchInput] = useState('');
  const [attendeeSearchRole, setAttendeeSearchRole] = useState<
    'attendee' | 'contributor' | 'delegate_full'
  >('attendee');
  const [showAttendeeSearch, setShowAttendeeSearch] = useState(false);
  const [selectedAttendeeFromSearch, setSelectedAttendeeFromSearch] =
    useState<ClientUserProfile | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Use the search hook for attendee tab
  const attendeeSearchResults = useUserProfileSearch(attendeeSearchInput);

  // Reset suggestion index when results change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, []);

  // Initialize attendee states from eventUsers when event changes
  useEffect(() => {
    if (eventUsers && selectedEvent) {
      setAttendeeStates((prev) => {
        const next = new Map<string, AttendeeState>();

        // Add all users from the database
        eventUsers.forEach((eu) => {
          const existing = prev.get(eu.user_id);
          // Only preserve role/changeType if there are pending changes
          const hasPendingChanges = existing && existing.changeType !== 'none';

          next.set(eu.user_id, {
            userId: eu.user_id,
            role: hasPendingChanges ? existing.role : eu.role,
            changeType: hasPendingChanges ? existing.changeType : 'none',
            isFromDb: true,
          });
        });

        // Keep any pending additions that aren't in the DB yet
        for (const [userId, state] of prev.entries()) {
          if (!next.has(userId) && state.changeType === 'added') {
            next.set(userId, state);
          }
        }

        return next;
      });

      // Clear temp profiles for users that are now in the database
      setTempProfiles((prev) => {
        const next = new Map(prev);
        eventUsers.forEach((eu) => {
          next.delete(eu.user_id);
        });
        return next;
      });
    }
  }, [eventUsers, selectedEvent?.id, selectedEvent]);

  // Compute merged attendee list for display
  const _mergedAttendees = useMemo(() => {
    if (!eventUsers) return [];

    const attendees = [];

    for (const [userId, state] of attendeeStates.entries()) {
      if (state.changeType === 'removed') continue; // Skip removed

      // Find original eventUser data
      const eventUser = eventUsers.find((eu) => eu.user_id === userId);

      if (eventUser) {
        // Existing user - use their full data but with potentially updated role
        attendees.push({
          ...eventUser,
          role: state.role as any,
        });
      } else {
        // New user - get profile from temp storage
        const tempProfile = tempProfiles.get(userId);
        attendees.push({
          event_id: selectedEvent?.id || '',
          user_id: state.userId,
          role: state.role as any,
          profile: {
            user_id: state.userId,
            email: tempProfile?.email || '',
            display_name: tempProfile?.displayName || null,
            first_name: null,
            last_name: null,
            title: null,
            organization: null,
            avatar_url: tempProfile?.avatarUrl || null,
            timezone: null,
            time_format: null,
            week_start_day: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    return attendees;
  }, [eventUsers, attendeeStates, tempProfiles, selectedEvent?.id]);

  // Generate unique IDs for form elements
  const inPersonId = useId();

  // Reset form when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title);
      setAgenda(selectedEvent.agenda || '');
      setCalendarId(selectedEvent.calendar?.id || '');
      setCategoryId(selectedEvent.category?.id || '');
      setShowTimeAs(selectedEvent.personal_details?.show_time_as || 'busy');
      setTimeDefenseLevel(selectedEvent.personal_details?.time_defense_level || 'normal');
      setIsPrivate(selectedEvent.private);
      setIsFollowing(selectedEvent.following);
      setAiManaged(selectedEvent.personal_details?.ai_managed || false);
      setAiInstructions(selectedEvent.personal_details?.ai_instructions || '');
      setOnlineEvent(selectedEvent.online_event);
      setOnlineJoinLink(selectedEvent.online_join_link || '');
      setOnlineChatLink(selectedEvent.online_chat_link || '');
      setInPerson(selectedEvent.in_person);
      setAllDay(selectedEvent.all_day);
      setStartTime(new Date(selectedEvent.start_time));
      setEndTime(new Date(selectedEvent.end_time));
      setRequestResponses(selectedEvent.request_responses);
      setAllowForwarding(selectedEvent.allow_forwarding);
      setAllowRescheduleRequest(selectedEvent.allow_reschedule_request);
      setHideAttendees(selectedEvent.hide_attendees);
      setDiscovery(selectedEvent.discovery);
      setJoinModel(selectedEvent.join_model);
    }
  }, [selectedEvent]);

  // Cleanup time selection mode on unmount
  useEffect(() => {
    return () => {
      disableTimeSelectionMode();
    };
  }, [disableTimeSelectionMode]);

  const handleUndo = () => {
    if (selectedEvent) {
      setTitle(selectedEvent.title);
      setAgenda(selectedEvent.agenda || '');
      setCalendarId(selectedEvent.calendar?.id || '');
      setCategoryId(selectedEvent.category?.id || '');
      setShowTimeAs(selectedEvent.personal_details?.show_time_as || 'busy');
      setIsPrivate(selectedEvent.private);
      setIsFollowing(selectedEvent.following);
      setOnlineEvent(selectedEvent.online_event);
      setOnlineJoinLink(selectedEvent.online_join_link || '');
      setOnlineChatLink(selectedEvent.online_chat_link || '');
      setInPerson(selectedEvent.in_person);
      setAllDay(selectedEvent.all_day);
      setStartTime(new Date(selectedEvent.start_time));
      setEndTime(new Date(selectedEvent.end_time));
      setRequestResponses(selectedEvent.request_responses);
      setAllowForwarding(selectedEvent.allow_forwarding);
      setAllowRescheduleRequest(selectedEvent.allow_reschedule_request);
      setHideAttendees(selectedEvent.hide_attendees);
      setTimeDefenseLevel(selectedEvent.personal_details?.time_defense_level || 'normal');
      setAiManaged(selectedEvent.personal_details?.ai_managed || false);
      setAiInstructions(selectedEvent.personal_details?.ai_instructions || '');
      setDiscovery(selectedEvent.discovery);
      setJoinModel(selectedEvent.join_model);
      // Attendee states are reset in their own useEffect
    }
  };

  const handleTimeSelectionClick = () => {
    enableTimeSelectionMode((start, end) => {
      setStartTime(start);
      setEndTime(end);
      disableTimeSelectionMode();
    });
  };

  const handleTimeChange = (start: Date, end: Date) => {
    setStartTime(start);
    setEndTime(end);
  };

  const handleAddAttendeeFromSearch = () => {
    if (!selectedAttendeeFromSearch) return;

    const userId = selectedAttendeeFromSearch.user_id;
    const role = attendeeSearchRole;

    setAttendeeStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId);

      if (existing) {
        // User exists - if removed, unmark as removed; otherwise update role
        if (existing.changeType === 'removed') {
          next.set(userId, { ...existing, role, changeType: existing.isFromDb ? 'none' : 'added' });
        } else {
          next.set(userId, {
            ...existing,
            role,
            changeType: existing.isFromDb ? 'updated' : 'added',
          });
        }
      } else {
        // New user - add to map
        next.set(userId, {
          userId,
          role,
          changeType: 'added',
          isFromDb: false,
        });
      }
      return next;
    });

    // Store profile data temporarily for newly added users (not yet in DB)
    if (!eventUsers?.find((eu) => eu.user_id === userId)) {
      setTempProfiles((prev) => {
        const next = new Map(prev);
        next.set(userId, {
          email: selectedAttendeeFromSearch.email ?? undefined,
          displayName: selectedAttendeeFromSearch.display_name ?? undefined,
          avatarUrl: selectedAttendeeFromSearch.avatar_url ?? undefined,
        });
        return next;
      });
    }

    // Clear search
    setAttendeeSearchInput('');
    setSelectedAttendeeFromSearch(null);
    setShowAttendeeSearch(false);
  };

  const handleAttendeeSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow keys for suggestion navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showAttendeeSearch && attendeeSearchResults && attendeeSearchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev < attendeeSearchResults.length - 1 ? prev + 1 : prev
        );
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showAttendeeSearch && attendeeSearchResults && attendeeSearchResults.length > 0) {
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
      return;
    }

    // Handle Enter to select suggestion or add current user
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showAttendeeSearch && attendeeSearchResults && attendeeSearchResults.length > 0) {
        const selected = attendeeSearchResults[selectedSuggestionIndex];
        if (selected) {
          setSelectedAttendeeFromSearch(selected);
          setAttendeeSearchInput(selected.display_name || selected.email || '');
          setShowAttendeeSearch(false);
        }
      } else if (selectedAttendeeFromSearch) {
        // Popover not present but user is selected - add them
        handleAddAttendeeFromSearch();
      }
      return;
    }

    // Handle Escape to close suggestions
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowAttendeeSearch(false);
      setSelectedSuggestionIndex(0);
    }
  };

  const handleSave = () => {
    if (onSave) {
      // Calculate attendee changes from attendeeStates
      const invite_users: Array<{ userId: string; role: ClientEventUser['role'] }> = [];
      const update_users: Array<{ userId: string; role: ClientEventUser['role'] }> = [];
      const remove_users: string[] = [];

      for (const [userId, state] of attendeeStates.entries()) {
        if (state.changeType === 'added') {
          invite_users.push({ userId, role: state.role as ClientEventUser['role'] });
        } else if (state.changeType === 'updated') {
          update_users.push({ userId, role: state.role as ClientEventUser['role'] });
        } else if (state.changeType === 'removed') {
          remove_users.push(userId);
        }
      }

      console.log('Saving attendee changes:', { invite_users, update_users, remove_users });

      onSave({
        title,
        agenda,
        private: isPrivate,
        online_event: onlineEvent,
        online_join_link: onlineJoinLink,
        online_chat_link: onlineChatLink,
        in_person: inPerson,
        all_day: allDay,
        start_time: startTime,
        end_time: endTime,
        request_responses: requestResponses,
        allow_forwarding: allowForwarding,
        allow_reschedule_request: allowRescheduleRequest,
        hide_attendees: hideAttendees,
        discovery,
        join_model: joinModel,
        calendar_id: calendarId || undefined,
        category_id: categoryId || undefined,
        show_time_as: showTimeAs as any,
        time_defense_level: timeDefenseLevel as any,
        ai_managed: aiManaged,
        ai_instructions: aiInstructions || undefined,
        invite_users: invite_users.length > 0 ? invite_users : undefined,
        update_users: update_users.length > 0 ? update_users : undefined,
        remove_users: remove_users.length > 0 ? remove_users : undefined,
      });

      // Clear pending changes - the DB write is optimistic so eventUsers will update
      // and the useEffect will merge the new data while clearing changeType
      setAttendeeStates((prev) => {
        const next = new Map(prev);
        for (const [userId, state] of next.entries()) {
          if (state.changeType === 'removed') {
            next.delete(userId);
          } else if (state.changeType !== 'none') {
            next.set(userId, { ...state, changeType: 'none' });
          }
        }
        return next;
      });
    }
  };

  const hasChanges =
    selectedEvent &&
    (title !== selectedEvent.title ||
      agenda !== (selectedEvent.agenda || '') ||
      calendarId !== (selectedEvent.calendar?.id || '') ||
      categoryId !== (selectedEvent.category?.id || '') ||
      showTimeAs !== (selectedEvent.personal_details?.show_time_as || 'busy') ||
      timeDefenseLevel !== (selectedEvent.personal_details?.time_defense_level || 'normal') ||
      aiManaged !== (selectedEvent.personal_details?.ai_managed || false) ||
      aiInstructions !== (selectedEvent.personal_details?.ai_instructions || '') ||
      isPrivate !== selectedEvent.private ||
      isFollowing !== selectedEvent.following ||
      onlineEvent !== selectedEvent.online_event ||
      onlineJoinLink !== (selectedEvent.online_join_link || '') ||
      onlineChatLink !== (selectedEvent.online_chat_link || '') ||
      inPerson !== selectedEvent.in_person ||
      allDay !== selectedEvent.all_day ||
      new Date(startTime).getTime() !== new Date(selectedEvent.start_time).getTime() ||
      new Date(endTime).getTime() !== new Date(selectedEvent.end_time).getTime() ||
      requestResponses !== selectedEvent.request_responses ||
      allowForwarding !== selectedEvent.allow_forwarding ||
      allowRescheduleRequest !== selectedEvent.allow_reschedule_request ||
      hideAttendees !== selectedEvent.hide_attendees ||
      discovery !== selectedEvent.discovery ||
      joinModel !== selectedEvent.join_model ||
      Array.from(attendeeStates.values()).some((state) => state.changeType !== 'none'));

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Content */}
      {selectedEvent ? (
        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          {/* Header with Tabs */}
          <div className="h-16 shrink-0 px-4 border-b border-border flex items-center gap-2">
            <div className="flex-1 flex justify-center">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="attendees">Attendees</TabsTrigger>
              </TabsList>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasChanges) {
                  setShowCloseDialog(true);
                } else {
                  onClose?.();
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <TabsContent value="details" className="flex-1 min-h-0 m-0 p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key="details-content"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  ease: 'easeOut',
                }}
                className="h-full"
              >
                <OverlayScrollbarsComponent
                  defer
                  options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 800 } }}
                  className="h-full"
                >
                  <div className="p-4 space-y-6 min-w-0 max-w-full box-border">
                    {/* Title, Time, Owner */}
                    <div className="space-y-2">
                      {/* Title */}
                      <div>
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Event title"
                          className="!text-lg font-semibold h-11 px-4"
                        />
                      </div>

                      {/* Time */}
                      <div className="min-w-0">
                        <InputGroupTime
                          label="Time"
                          icon={<Clock />}
                          startTime={startTime}
                          endTime={endTime}
                          allDay={allDay}
                          onClick={handleTimeSelectionClick}
                          onChange={handleTimeChange}
                          timeZone={timezone}
                        />
                      </div>

                      {/* Owner */}
                      <div className="min-w-0">
                        <InputGroup className="min-h-9">
                          <div className="flex items-center gap-3 px-3 py-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Label className="text-sm font-medium text-muted-foreground shrink-0">
                              Owner
                            </Label>
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar className="size-6">
                                <AvatarImage
                                  src={
                                    getAvatarUrl(ownerProfile?.avatar_url ?? undefined) ?? undefined
                                  }
                                />
                                <AvatarFallback className="text-[10px]">
                                  {ownerProfile?.display_name
                                    ?.split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase() ||
                                    ownerProfile?.email?.[0]?.toUpperCase() ||
                                    '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {ownerProfile?.display_name || ownerProfile?.email || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </InputGroup>
                      </div>

                      {/* Attendees & Guests */}
                      <EventAttendees
                        eventId={selectedEvent.id}
                        isOwner={selectedEvent.role === 'owner'}
                        icon={<Users className="h-4 w-4" />}
                        attendees={Array.from(attendeeStates.entries())
                          .filter(([_, state]) => state.changeType !== 'removed')
                          .map(([userId, state]) => {
                            // Look up user data from eventUsers
                            const eventUser = eventUsers?.find((eu) => eu.user_id === userId);
                            return {
                              user_id: userId,
                              email:
                                eventUser?.profile?.email || tempProfiles.get(userId)?.email || '',
                              name:
                                eventUser?.profile?.display_name ||
                                tempProfiles.get(userId)?.displayName ||
                                '',
                              avatarUrl:
                                eventUser?.profile?.avatar_url ||
                                tempProfiles.get(userId)?.avatarUrl ||
                                null,
                              role: state.role as any,
                              rsvp_status: eventUser?.profile ? undefined : undefined, // RSVP data not needed for draft state
                            };
                          })}
                        onAddAttendee={(userId, role, profileData) => {
                          setAttendeeStates((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(userId);

                            if (existing) {
                              // User exists - if removed, unmark as removed; otherwise update role
                              if (existing.changeType === 'removed') {
                                next.set(userId, {
                                  ...existing,
                                  changeType: existing.isFromDb ? 'none' : 'added',
                                });
                              } else {
                                next.set(userId, {
                                  ...existing,
                                  role,
                                  changeType: existing.isFromDb ? 'updated' : 'added',
                                });
                              }
                            } else {
                              // New user - add to map
                              next.set(userId, {
                                userId,
                                role,
                                changeType: 'added',
                                isFromDb: false,
                              });
                            }
                            return next;
                          });

                          // Store profile data temporarily for newly added users (not yet in DB)
                          if (!eventUsers?.find((eu) => eu.user_id === userId)) {
                            setTempProfiles((prev) => {
                              const next = new Map(prev);
                              next.set(userId, {
                                email: profileData?.email,
                                displayName: profileData?.displayName,
                                avatarUrl: profileData?.avatarUrl,
                              });
                              return next;
                            });
                          }
                        }}
                        onUpdateAttendee={(userId, updates) => {
                          setAttendeeStates((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(userId);
                            if (existing) {
                              const newRole = updates.role || existing.role;
                              next.set(userId, {
                                ...existing,
                                role: newRole,
                                changeType: existing.isFromDb ? 'updated' : 'added',
                              });
                            }
                            return next;
                          });
                        }}
                        onRemoveAttendee={(userId) => {
                          setAttendeeStates((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(userId);

                            if (existing) {
                              if (existing.isFromDb) {
                                // From DB - mark as removed
                                next.set(userId, { ...existing, changeType: 'removed' });
                              } else {
                                // Not from DB (newly added) - just delete from map
                                next.delete(userId);
                                // Also clean up temp profile
                                setTempProfiles((prevProfiles) => {
                                  const nextProfiles = new Map(prevProfiles);
                                  nextProfiles.delete(userId);
                                  return nextProfiles;
                                });
                              }
                            }
                            return next;
                          });
                        }}
                      />
                    </div>

                    <Separator />

                    {/* Agenda */}
                    <div>
                      <Textarea
                        value={agenda}
                        onChange={(e) => setAgenda(e.target.value)}
                        placeholder="Agenda"
                        className="min-h-48"
                      />
                    </div>

                    <Separator />

                    {/* Calendar, Category, Show Time As, Time Defense */}
                    <div className="space-y-2">
                      {/* Calendar */}
                      <Select value={calendarId} onValueChange={setCalendarId}>
                        <SelectTrigger className="h-9 w-full">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {userCalendars.map((calendar) => (
                            <SelectItem key={calendar.id} value={calendar.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded-sm ${getColorClass(calendar.color)}`}
                                />
                                {calendar.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Category */}
                      <Select value={categoryId || ''} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-9 w-full">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                            <SelectValue placeholder="Category" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {userCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded ${getColorClass(category.color)}`}
                                />
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Show Time As */}
                      <Select value={showTimeAs} onValueChange={setShowTimeAs}>
                        <SelectTrigger className="h-9 w-full">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {SHOW_TIME_AS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Time Defense */}
                      <Select value={timeDefenseLevel} onValueChange={setTimeDefenseLevel}>
                        <SelectTrigger className="h-9 w-full">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_DEFENSE_LEVEL.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Toggle Buttons */}
                    <div className="space-y-3">
                      {/* Private & Following Toggle Group */}
                      <div className="flex gap-2">
                        <ToggleGroup
                          type="multiple"
                          className="w-full justify-start"
                          variant="outline"
                          value={[
                            ...(isPrivate ? ['private'] : []),
                            ...(isFollowing ? ['following'] : []),
                          ]}
                          onValueChange={(value) => {
                            setIsPrivate(value.includes('private'));
                            setIsFollowing(value.includes('following'));
                          }}
                        >
                          <ToggleGroupItem
                            value="private"
                            aria-label="Toggle private"
                            className="h-9 flex-1"
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            Private
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="following"
                            aria-label="Toggle following"
                            className="h-9 flex-1"
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Following
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>

                    <Separator />

                    {/* Online Meeting & Invite Options */}
                    <div className="space-y-2">
                      {/* Online Meeting */}
                      <InputGroupOnline
                        isOnline={onlineEvent}
                        joinLink={onlineJoinLink}
                        chatLink={onlineChatLink}
                        onOnlineChange={setOnlineEvent}
                        onJoinLinkChange={setOnlineJoinLink}
                        onChatLinkChange={setOnlineChatLink}
                      />

                      {/* Invite Options */}
                      <InputGroupSelect
                        label="Invite options"
                        icon={<Send />}
                        options={[
                          {
                            value: 'request-responses',
                            label: 'Request responses',
                            checked: requestResponses,
                          },
                          {
                            value: 'allow-forwarding',
                            label: 'Allow forwarding',
                            checked: allowForwarding,
                          },
                          {
                            value: 'allow-reschedule-request',
                            label: 'Allow reschedule requests',
                            checked: allowRescheduleRequest,
                          },
                          {
                            value: 'hide-attendees',
                            label: 'Hide attendees',
                            checked: hideAttendees,
                          },
                        ]}
                        onOptionChange={(value, checked) => {
                          if (value === 'request-responses') setRequestResponses(checked);
                          if (value === 'allow-forwarding') setAllowForwarding(checked);
                          if (value === 'allow-reschedule-request')
                            setAllowRescheduleRequest(checked);
                          if (value === 'hide-attendees') setHideAttendees(checked);
                        }}
                      >
                        {/* Access & Visibility */}
                        <div className="space-y-3 pt-3 border-t">
                          <div className="text-sm font-medium">Access & Visibility</div>

                          <div className="flex gap-2">
                            {/* Discovery */}
                            <div className="space-y-1.5 flex-1">
                              <Label className="text-xs text-muted-foreground">Discovery</Label>
                              <Select
                                value={discovery}
                                onValueChange={(v) => setDiscovery(v as typeof discovery)}
                              >
                                <SelectTrigger className="h-9 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVENT_DISCOVERY_TYPES.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Join Model */}
                            <div className="space-y-1.5 flex-1">
                              <Label className="text-xs text-muted-foreground">Join Model</Label>
                              <Select
                                value={joinModel}
                                onValueChange={(v) => setJoinModel(v as typeof joinModel)}
                              >
                                <SelectTrigger className="h-9 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVENT_JOIN_MODEL_TYPES.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </InputGroupSelect>
                    </div>

                    <Separator />

                    {/* AI Management */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="ai-managed"
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <Bot className="h-4 w-4" />
                          AI Managed
                        </Label>
                        <Switch
                          id="ai-managed"
                          checked={aiManaged}
                          onCheckedChange={setAiManaged}
                        />
                      </div>

                      {aiManaged && (
                        <div>
                          <Textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="Instructions for AI to manage this event..."
                            rows={3}
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Location Type */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={inPersonId}
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <MapPin className="h-4 w-4" />
                          In person
                        </Label>
                        <Switch id={inPersonId} checked={inPerson} onCheckedChange={setInPerson} />
                      </div>
                    </div>
                  </div>
                </OverlayScrollbarsComponent>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="attendees" className="flex-1 min-h-0 m-0 p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key="attendees-content"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  ease: 'easeOut',
                }}
                className="h-full"
              >
                <OverlayScrollbarsComponent
                  defer
                  options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 800 } }}
                  className="h-full"
                >
                  <div className="p-4 space-y-3">
                    {/* Add attendee input - only for owners */}
                    {selectedEvent?.role === 'owner' && (
                      <div className="space-y-2 relative">
                        <InputGroup className="min-w-0">
                          <div className="flex-1 flex items-center gap-2 py-1.5 pl-3 pr-2 min-w-0">
                            <input
                              placeholder="Search by name or email..."
                              value={attendeeSearchInput}
                              onChange={(e) => {
                                setAttendeeSearchInput(e.target.value);
                                setShowAttendeeSearch(e.target.value.length >= 2);
                              }}
                              onKeyDown={handleAttendeeSearchKeyDown}
                              onFocus={() => setShowAttendeeSearch(attendeeSearchInput.length >= 2)}
                              className="flex-1 bg-transparent outline-none text-sm min-w-0"
                              autoComplete="off"
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs capitalize gap-1"
                                >
                                  {attendeeSearchRole === 'delegate_full'
                                    ? 'Delegate'
                                    : attendeeSearchRole}
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setAttendeeSearchRole('attendee')}>
                                  Attendee
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAttendeeSearchRole('contributor')}
                                >
                                  Contributor
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAttendeeSearchRole('delegate_full')}
                                >
                                  Delegate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <InputGroupButton
                              size="xs"
                              onClick={handleAddAttendeeFromSearch}
                              disabled={!selectedAttendeeFromSearch}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </InputGroupButton>
                          </div>
                        </InputGroup>

                        {/* Search suggestions */}
                        {showAttendeeSearch && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                            <Command>
                              <CommandList>
                                {attendeeSearchResults && attendeeSearchResults.length > 0 ? (
                                  <CommandGroup heading="Suggestions">
                                    {attendeeSearchResults.map((profile, index) => {
                                      const avatarUrl = getAvatarUrl(profile.avatar_url);
                                      return (
                                        <CommandItem
                                          key={profile.user_id}
                                          onSelect={() => {
                                            setSelectedAttendeeFromSearch(profile);
                                            setAttendeeSearchInput(
                                              profile.display_name || profile.email || ''
                                            );
                                            setShowAttendeeSearch(false);
                                          }}
                                          className={cn(
                                            'flex items-center gap-2 cursor-pointer',
                                            index === selectedSuggestionIndex && 'bg-accent'
                                          )}
                                        >
                                          <Avatar className="size-6">
                                            <AvatarImage src={avatarUrl || undefined} />
                                            <AvatarFallback className="text-[10px]">
                                              {profile.display_name?.[0] ||
                                                profile.email?.[0] ||
                                                '?'}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">
                                              {profile.display_name || profile.email}
                                            </div>
                                            {profile.display_name && profile.email && (
                                              <div className="text-xs text-muted-foreground truncate">
                                                {profile.email}
                                              </div>
                                            )}
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                ) : (
                                  <CommandEmpty>
                                    <div className="text-sm text-muted-foreground">
                                      {attendeeSearchInput.length >= 2
                                        ? 'No users found.'
                                        : 'Type to search users...'}
                                    </div>
                                  </CommandEmpty>
                                )}
                              </CommandList>
                            </Command>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Owner card - always shown first */}
                    {selectedEvent?.owner_id && (
                      <Card className="py-3 gap-0">
                        <CardContent className="py-0">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage
                                src={
                                  getAvatarUrl(ownerProfile?.avatar_url ?? undefined) ?? undefined
                                }
                              />
                              <AvatarFallback>
                                {ownerProfile?.display_name
                                  ?.split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase() ||
                                  ownerProfile?.email?.[0]?.toUpperCase() ||
                                  '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {ownerProfile?.display_name ||
                                  ownerProfile?.email ||
                                  'Unknown User'}
                              </div>
                              {ownerProfile?.display_name && ownerProfile?.email && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {ownerProfile.email}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="capitalize shrink-0">
                              Owner
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {attendeeStates.size > 0 ? (
                      Array.from(attendeeStates.entries())
                        .filter(
                          ([userId, state]) =>
                            state.changeType !== 'removed' && userId !== selectedEvent?.owner_id
                        )
                        .map(([userId, state]) => (
                          <AttendeeCard
                            key={userId}
                            userId={userId}
                            state={state}
                            tempProfile={tempProfiles.get(userId)}
                            isOwner={selectedEvent?.owner_id === userId}
                            ownerId={selectedEvent?.owner_id}
                            canEdit={selectedEvent?.role === 'owner'}
                            onRoleChange={(newRole) => {
                              setAttendeeStates((prev) => {
                                const next = new Map(prev);
                                const existing = next.get(userId);
                                if (existing) {
                                  next.set(userId, {
                                    ...existing,
                                    role: newRole,
                                    changeType: existing.isFromDb ? 'updated' : 'added',
                                  });
                                }
                                return next;
                              });
                            }}
                            onRemove={() => {
                              setAttendeeStates((prev) => {
                                const next = new Map(prev);
                                const existing = next.get(userId);
                                if (existing) {
                                  if (existing.changeType === 'removed') {
                                    // Already marked for removal - undo it
                                    next.set(userId, { ...existing, changeType: 'none' });
                                  } else if (existing.isFromDb) {
                                    // From DB - mark as removed
                                    next.set(userId, { ...existing, changeType: 'removed' });
                                  } else {
                                    // Not from DB (newly added) - just delete
                                    next.delete(userId);
                                    // Also clean up temp profile
                                    setTempProfiles((prevProfiles) => {
                                      const nextProfiles = new Map(prevProfiles);
                                      nextProfiles.delete(userId);
                                      return nextProfiles;
                                    });
                                  }
                                }
                                return next;
                              });
                            }}
                          />
                        ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No attendees</div>
                    )}
                  </div>
                </OverlayScrollbarsComponent>
              </motion.div>
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="h-16 shrink-0 px-4 border-b border-border flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onClose?.()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-sm text-muted-foreground">Double click an event for details</div>
          </div>
        </>
      )}

      {/* Toolbar */}
      {selectedEvent && (
        <div className="h-14 shrink-0 px-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!hasChanges}>
            <Undo2 className="h-4 w-4 mr-2" />
            Undo
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            Save
          </Button>
        </div>
      )}

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCloseDialog(false);
                onClose?.();
              }}
            >
              Close Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

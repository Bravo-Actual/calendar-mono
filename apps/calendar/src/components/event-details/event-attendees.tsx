'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { InputGroup } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { useUserProfileServer } from '@/hooks/use-user-profile-server';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useUserProfileSearch } from '@/lib/data-v2/domains/user-profiles';
import { cn } from '@/lib/utils';
import type { AttendanceType, RsvpStatus, UserRole } from '@/types';

// Component that fetches and displays attendee with live profile data
function AttendeePillInline({
  userId,
  tempProfile,
  onRemove,
  canRemove,
}: {
  userId: string;
  tempProfile?: { email?: string; displayName?: string; avatarUrl?: string | null };
  onRemove: () => void;
  canRemove?: boolean;
}) {
  const { data: profile } = useUserProfileServer(userId);

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

  return (
    <Badge variant="secondary" className="flex items-center gap-1.5 h-7">
      <Avatar className="size-6">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{displayName || email || 'Unknown'}</span>
      {canRemove && (
        <button type="button" onClick={onRemove} className="hover:bg-muted rounded-full">
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

export interface ResolvedAttendee {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface UnresolvedAttendee {
  email: string;
}

export type PendingAttendee =
  | { type: 'resolved'; data: ResolvedAttendee }
  | { type: 'unresolved'; data: UnresolvedAttendee };

export interface EventAttendeesProps {
  eventId: string;
  isOwner: boolean;
  icon?: React.ReactNode;
  // TODO: Add attendees data from Dexie
  attendees?: Array<{
    user_id: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
    role: UserRole;
    rsvp_status?: RsvpStatus;
    attendance_type?: AttendanceType;
    note?: string;
  }>;
  onAddAttendee?: (
    userId: string,
    role: UserRole,
    profileData?: { email?: string; displayName?: string; avatarUrl?: string | null }
  ) => void;
  onUpdateAttendee?: (userId: string, updates: { role?: UserRole }) => void;
  onRemoveAttendee?: (userId: string) => void;
}

type RoleType = 'attendee' | 'contributor' | 'delegate_full';

const ROLE_LABELS: Record<RoleType, string> = {
  attendee: 'To',
  contributor: 'Cc',
  delegate_full: 'Delegate',
};

export function EventAttendees({
  eventId,
  isOwner,
  icon,
  attendees = [],
  onAddAttendee,
  onUpdateAttendee,
  onRemoveAttendee,
}: EventAttendeesProps) {
  // Separate state for each role type
  const [attendeeInput, setAttendeeInput] = useState('');
  const [contributorInput, setContributorInput] = useState('');
  const [delegateInput, setDelegateInput] = useState('');

  const [pendingAttendees, setPendingAttendees] = useState<PendingAttendee[]>([]);
  const [pendingContributors, setPendingContributors] = useState<PendingAttendee[]>([]);
  const [pendingDelegates, setPendingDelegates] = useState<PendingAttendee[]>([]);

  const [activeInput, setActiveInput] = useState<RoleType | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showAllFields, setShowAllFields] = useState(false);

  const attendeeInputRef = useRef<HTMLInputElement>(null);
  const contributorInputRef = useRef<HTMLInputElement>(null);
  const delegateInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get active input value based on which field is focused
  const activeInputValue =
    activeInput === 'attendee'
      ? attendeeInput
      : activeInput === 'contributor'
        ? contributorInput
        : activeInput === 'delegate_full'
          ? delegateInput
          : '';

  // Search for matching user profiles
  const searchResults = useUserProfileSearch(activeInputValue);

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, []);

  // Initialize pending attendees from existing attendees, grouped by role
  // Re-sync when eventId changes OR when attendees list changes (after save)
  useEffect(() => {
    const attendeeList: PendingAttendee[] = [];
    const contributorList: PendingAttendee[] = [];
    const delegateList: PendingAttendee[] = [];

    attendees.forEach((attendee) => {
      const pendingAttendee: PendingAttendee = {
        type: 'resolved' as const,
        data: {
          userId: attendee.user_id,
          email: attendee.email || '',
          displayName: attendee.name,
          avatarUrl: attendee.avatarUrl || null,
        },
      };

      if (attendee.role === 'attendee') {
        attendeeList.push(pendingAttendee);
      } else if (attendee.role === 'contributor') {
        contributorList.push(pendingAttendee);
      } else if (attendee.role === 'delegate_full') {
        delegateList.push(pendingAttendee);
      }
    });

    setPendingAttendees(attendeeList);
    setPendingContributors(contributorList);
    setPendingDelegates(delegateList);

    // Show all fields if there are contributors or delegates
    if (contributorList.length > 0 || delegateList.length > 0) {
      setShowAllFields(true);
    }
  }, [attendees]);

  // Email validation regex
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getPendingForRole = (role: RoleType) => {
    if (role === 'attendee') return pendingAttendees;
    if (role === 'contributor') return pendingContributors;
    return pendingDelegates;
  };

  const setPendingForRole = (role: RoleType, pending: PendingAttendee[]) => {
    if (role === 'attendee') setPendingAttendees(pending);
    else if (role === 'contributor') setPendingContributors(pending);
    else setPendingDelegates(pending);
  };

  const getInputValue = (role: RoleType) => {
    if (role === 'attendee') return attendeeInput;
    if (role === 'contributor') return contributorInput;
    return delegateInput;
  };

  const setInputValue = (role: RoleType, value: string) => {
    if (role === 'attendee') setAttendeeInput(value);
    else if (role === 'contributor') setContributorInput(value);
    else setDelegateInput(value);
  };

  const getInputRef = (role: RoleType) => {
    if (role === 'attendee') return attendeeInputRef;
    if (role === 'contributor') return contributorInputRef;
    return delegateInputRef;
  };

  const handleSelectUser = (
    userId: string,
    email: string,
    displayName?: string,
    avatarUrl?: string | null
  ) => {
    if (!activeInput) return;

    const attendee: PendingAttendee = {
      type: 'resolved',
      data: {
        userId,
        email,
        displayName,
        avatarUrl,
      },
    };

    const current = getPendingForRole(activeInput);
    setPendingForRole(activeInput, [...current, attendee]);
    setInputValue(activeInput, '');
    setActiveInput(null);
    getInputRef(activeInput).current?.focus();

    // Call parent callback to track changes with profile data
    onAddAttendee?.(userId, activeInput, { email, displayName, avatarUrl });
  };

  const handleKeyDown = (role: RoleType) => (e: KeyboardEvent<HTMLInputElement>) => {
    const inputValue = getInputValue(role);
    const showSuggestions = activeInput === role && activeInputValue.length >= 2;

    // Handle arrow keys for suggestion navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && searchResults && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && searchResults && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
      return;
    }

    // Handle Enter to select suggestion or add email
    if (e.key === 'Enter') {
      e.preventDefault();

      // If suggestions are showing and we have results, select the highlighted one
      if (showSuggestions && searchResults && searchResults.length > 0) {
        const selected = searchResults[selectedSuggestionIndex];
        if (selected) {
          handleSelectUser(
            selected.id,
            selected.email,
            selected.display_name || undefined,
            selected.avatar_url
          );
          return;
        }
      }

      // Otherwise, try to add as email
      if (inputValue.trim()) {
        const email = inputValue.trim();
        if (isValidEmail(email)) {
          const attendee: PendingAttendee = {
            type: 'unresolved',
            data: { email },
          };
          const current = getPendingForRole(role);
          setPendingForRole(role, [...current, attendee]);
          setInputValue(role, '');
          setActiveInput(null);
        }
      }
      return;
    }

    // Handle comma to add email
    if (e.key === ',') {
      e.preventDefault();
      const email = inputValue.trim();

      if (email && isValidEmail(email)) {
        const attendee: PendingAttendee = {
          type: 'unresolved',
          data: { email },
        };
        const current = getPendingForRole(role);
        setPendingForRole(role, [...current, attendee]);
        setInputValue(role, '');
        setActiveInput(null);
      }
      return;
    }

    // Handle backspace to remove last attendee
    const current = getPendingForRole(role);
    if (e.key === 'Backspace' && inputValue === '' && current.length > 0) {
      setPendingForRole(role, current.slice(0, -1));
      return;
    }

    // Close suggestions on Escape
    if (e.key === 'Escape') {
      setActiveInput(null);
      return;
    }
  };

  const handleRemovePending = (role: RoleType, index: number) => {
    const current = getPendingForRole(role);
    const attendeeToRemove = current[index];

    setPendingForRole(
      role,
      current.filter((_, i) => i !== index)
    );

    // Notify parent if this is a resolved attendee
    if (attendeeToRemove?.type === 'resolved' && onRemoveAttendee) {
      onRemoveAttendee(attendeeToRemove.data.userId);
    }

    // Retain focus on the input field for this role
    setTimeout(() => {
      if (role === 'attendee') {
        attendeeInputRef.current?.focus();
      } else if (role === 'contributor') {
        contributorInputRef.current?.focus();
      } else if (role === 'delegate_full') {
        delegateInputRef.current?.focus();
      }
    }, 0);
  };

  const handleInputChange = (role: RoleType, value: string) => {
    setInputValue(role, value);
    setActiveInput(value.length >= 2 ? role : null);
  };

  const getInitials = (displayName?: string, email?: string) => {
    if (displayName) {
      return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || '?';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveInput(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render a role-based input row (not a separate InputGroup)
  const renderRoleRow = (role: RoleType, isFirst: boolean) => {
    const pending = getPendingForRole(role);
    const inputValue = getInputValue(role);
    const inputRef = getInputRef(role);

    return (
      <div key={role} className={cn('flex min-h-9', !isFirst && 'border-t')}>
        <div className="flex items-center gap-2 pl-3 py-1.5 shrink-0">
          {isFirst && icon && <div className="text-muted-foreground">{icon}</div>}
          <Label className="text-sm text-muted-foreground cursor-text">
            {ROLE_LABELS[role]}:
          </Label>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5 items-center py-1.5 pl-2 min-w-0">
          {pending.map((attendee, index) =>
            attendee.type === 'resolved' ? (
              <AttendeePillInline
                key={index}
                userId={attendee.data.userId}
                tempProfile={{
                  email: attendee.data.email,
                  displayName: attendee.data.displayName,
                  avatarUrl: attendee.data.avatarUrl,
                }}
                onRemove={() => handleRemovePending(role, index)}
                canRemove={isOwner}
              />
            ) : (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1.5 h-7 border-dashed"
              >
                <span className="text-sm">{attendee.data.email}</span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemovePending(role, index)}
                    className="hover:bg-muted rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            )
          )}
          {isOwner && (
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(role, e.target.value)}
              onKeyDown={handleKeyDown(role)}
              onFocus={() => inputValue.length >= 2 && setActiveInput(role)}
              placeholder={pending.length === 0 ? 'Add people by name or email' : ''}
              className="flex-1 min-w-48 bg-transparent outline-none text-sm"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore
            />
          )}
        </div>
        {isFirst && (
          <div className="flex items-center pr-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowAllFields(!showAllFields)}
            >
              {showAllFields ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const showSuggestions = activeInput !== null && activeInputValue.length >= 2;

  return (
      <div className="relative" ref={containerRef}>
        <InputGroup className="min-h-9 h-auto overflow-hidden flex-col items-stretch">
          {renderRoleRow('attendee', true)}
          <AnimatePresence>
            {showAllFields && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {renderRoleRow('contributor', false)}
                {renderRoleRow('delegate_full', false)}
              </motion.div>
            )}
          </AnimatePresence>
        </InputGroup>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
            <Command>
              <CommandList>
                {searchResults && searchResults.length > 0 ? (
                  <CommandGroup heading="Suggestions">
                    {searchResults.map((profile, index) => {
                      const avatarUrl = getAvatarUrl(profile.avatar_url);
                      return (
                        <CommandItem
                          key={profile.id}
                          onSelect={() =>
                            handleSelectUser(
                              profile.id,
                              profile.email,
                              profile.display_name || undefined,
                              profile.avatar_url
                            )
                          }
                          className={cn(
                            'flex items-center gap-2 cursor-pointer',
                            index === selectedSuggestionIndex && 'bg-accent'
                          )}
                        >
                          <Avatar className="size-6">
                            <AvatarImage src={avatarUrl || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(profile.display_name || undefined, profile.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {profile.display_name || profile.email}
                            </div>
                            {profile.display_name && (
                              <div className="text-xs text-muted-foreground truncate">
                                {profile.email}
                              </div>
                            )}
                          </div>
                          <Check className="h-4 w-4 opacity-0" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : (
                  <CommandEmpty>
                    {isValidEmail(activeInputValue.trim()) ? (
                      <div className="text-sm">
                        Press <kbd className="px-1.5 py-0.5 text-xs border rounded">Enter</kbd> to
                        add <span className="font-medium">{activeInputValue.trim()}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {activeInputValue.length >= 2
                          ? 'No users found. Enter a valid email address.'
                          : 'Type to search users...'}
                      </div>
                    )}
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        )}
      </div>
  );
}

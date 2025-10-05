'use client';

import { Check, MoreHorizontal, UserX, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { ATTENDANCE_TYPE, RSVP_STATUS, USER_ROLE } from '@/lib/constants/event-enums';
import { useUserProfileSearch } from '@/lib/data-v2/domains/user-profiles';
import type { AttendanceType, RsvpStatus, UserRole } from '@/types';
import { cn } from '@/lib/utils';

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
    role: UserRole;
    rsvp_status?: RsvpStatus;
    attendance_type?: AttendanceType;
    note?: string;
  }>;
  onAddAttendee?: (email: string, role: UserRole) => void;
  onUpdateAttendee?: (userId: string, updates: { role?: UserRole }) => void;
  onRemoveAttendee?: (userId: string) => void;
}

export function EventAttendees({
  eventId: _eventId,
  isOwner,
  icon,
  attendees = [],
  onAddAttendee,
  onUpdateAttendee,
  onRemoveAttendee,
}: EventAttendeesProps) {
  const [inputValue, setInputValue] = useState('');
  const [pendingAttendees, setPendingAttendees] = useState<PendingAttendee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search for matching user profiles
  const searchResults = useUserProfileSearch(inputValue);

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [searchResults]);

  // Email validation regex
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSelectUser = (userId: string, email: string, displayName?: string, avatarUrl?: string | null) => {
    const attendee: PendingAttendee = {
      type: 'resolved',
      data: {
        userId,
        email,
        displayName,
        avatarUrl,
      },
    };
    setPendingAttendees([...pendingAttendees, attendee]);
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow keys for suggestion navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && searchResults && searchResults.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
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
          setPendingAttendees([...pendingAttendees, attendee]);
          setInputValue('');
          setShowSuggestions(false);
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
        setPendingAttendees([...pendingAttendees, attendee]);
        setInputValue('');
        setShowSuggestions(false);
      }
      return;
    }

    // Handle backspace to remove last attendee
    if (e.key === 'Backspace' && inputValue === '' && pendingAttendees.length > 0) {
      setPendingAttendees(pendingAttendees.slice(0, -1));
      return;
    }

    // Close suggestions on Escape
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
  };

  const handleRemovePending = (index: number) => {
    setPendingAttendees(pendingAttendees.filter((_, i) => i !== index));
  };

  const handleAddAll = () => {
    pendingAttendees.forEach((attendee) => {
      const email = attendee.type === 'resolved' ? attendee.data.email : attendee.data.email;
      onAddAttendee?.(email, 'attendee');
    });
    setPendingAttendees([]);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setShowSuggestions(value.length >= 2);
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
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOwner) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-medium">Attendees</div>
        {attendees.length > 0 ? (
          <div className="space-y-2">
            {attendees.map((attendee) => (
              <div
                key={attendee.user_id}
                className="flex items-center justify-between p-2 rounded-md border"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {attendee.name || attendee.email || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {attendee.rsvp_status &&
                      RSVP_STATUS.find((s) => s.value === attendee.rsvp_status)?.label}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {USER_ROLE.find((r) => r.value === attendee.role)?.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No attendees</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Email-style "To" line with autocomplete */}
      <div className="space-y-2 relative" ref={containerRef}>
        <InputGroup className="min-h-9 h-auto items-center">
          <InputGroupAddon align="inline-start">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            <Label className="text-sm text-muted-foreground cursor-text">To:</Label>
          </InputGroupAddon>
          <div className="flex flex-1 flex-wrap gap-1.5 items-center py-1.5 px-2">
            {pendingAttendees.map((attendee, index) => (
              <Badge
                key={index}
                variant="secondary"
                className={cn(
                  'flex items-center gap-1.5 h-6',
                  attendee.type === 'unresolved' && 'border-dashed'
                )}
              >
                {attendee.type === 'resolved' ? (
                  <>
                    <Avatar className="size-4">
                      <AvatarImage src={getAvatarUrl(attendee.data.avatarUrl) || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(attendee.data.displayName, attendee.data.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">
                      {attendee.data.displayName || attendee.data.email}
                    </span>
                  </>
                ) : (
                  <span className="text-xs">{attendee.data.email}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePending(index)}
                  className="hover:bg-muted rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
              placeholder={pendingAttendees.length === 0 ? 'Add people by name or email' : ''}
              className="flex-1 bg-transparent outline-none text-sm"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore
              data-slot="input-group-control"
            />
          </div>
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
                    {isValidEmail(inputValue.trim()) ? (
                      <div className="text-sm">
                        Press <kbd className="px-1.5 py-0.5 text-xs border rounded">Enter</kbd> to add{' '}
                        <span className="font-medium">{inputValue.trim()}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {inputValue.length >= 2
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

        {pendingAttendees.length > 0 && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddAll}>
              Add {pendingAttendees.length} attendee{pendingAttendees.length > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>

      {attendees.length > 0 && (
        <div className="space-y-2">
          {attendees.map((attendee) => (
            <div
              key={attendee.user_id}
              className="flex items-center justify-between p-2 rounded-md border"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {attendee.name || attendee.email || 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {attendee.rsvp_status &&
                    RSVP_STATUS.find((s) => s.value === attendee.rsvp_status)?.label}
                  {attendee.attendance_type &&
                    attendee.attendance_type !== 'unknown' &&
                    ` • ${ATTENDANCE_TYPE.find((t) => t.value === attendee.attendance_type)?.label}`}
                </div>
                {attendee.note && (
                  <div className="text-xs text-muted-foreground italic">{attendee.note}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {USER_ROLE.find((r) => r.value === attendee.role)?.label}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {USER_ROLE.map((role) => (
                      <DropdownMenuItem
                        key={role.value}
                        onClick={() => onUpdateAttendee?.(attendee.user_id, { role: role.value })}
                      >
                        Set as {role.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onRemoveAttendee?.(attendee.user_id)}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

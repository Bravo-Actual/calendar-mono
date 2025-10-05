'use client';

import { MoreHorizontal, UserX, X } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { ATTENDANCE_TYPE, RSVP_STATUS, USER_ROLE } from '@/lib/constants/event-enums';
import type { AttendanceType, RsvpStatus, UserRole } from '@/types';

export interface EventAttendeesProps {
  eventId: string;
  isOwner: boolean;
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
  attendees = [],
  onAddAttendee,
  onUpdateAttendee,
  onRemoveAttendee,
}: EventAttendeesProps) {
  const [inputValue, setInputValue] = useState('');
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const email = inputValue.trim();
      if (email && !pendingEmails.includes(email)) {
        setPendingEmails([...pendingEmails, email]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && pendingEmails.length > 0) {
      setPendingEmails(pendingEmails.slice(0, -1));
    }
  };

  const handleRemovePending = (email: string) => {
    setPendingEmails(pendingEmails.filter((e) => e !== email));
  };

  const handleAddAll = () => {
    pendingEmails.forEach((email) => {
      onAddAttendee?.(email, 'attendee');
    });
    setPendingEmails([]);
  };

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
      {/* Email-style "To" line */}
      <div className="space-y-2">
        <InputGroup className="min-h-9 h-auto items-center">
          <InputGroupAddon align="inline-start">
            <Label className="text-sm text-muted-foreground cursor-text">To:</Label>
          </InputGroupAddon>
          <div className="flex flex-1 flex-wrap gap-1.5 items-center py-1.5 px-2">
            {pendingEmails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1">
                {email}
                <button
                  type="button"
                  onClick={() => handleRemovePending(email)}
                  className="hover:bg-muted rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingEmails.length === 0 ? 'Add people by name or email' : ''}
              className="flex-1 min-w-[200px] bg-transparent outline-none text-sm"
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
        {pendingEmails.length > 0 && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddAll}>
              Add {pendingEmails.length} attendee{pendingEmails.length > 1 ? 's' : ''}
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

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, Clock, Lock, MapPin, Send, Undo2, UserCheck, Video } from 'lucide-react';
import type { EventResolved } from '@/lib/data-v2';
import { SHOW_TIME_AS, getColorClass } from '@/lib/constants/event-enums';
import { EventAttendees } from './event-attendees';
import { InputGroupSelect } from '@/components/custom/input-group-select';

export interface EventDetailsPanelProps {
  selectedEvent: EventResolved | undefined;
  selectedEventPrimary: string | null;
  userCalendars: Array<{ id: string; name: string; color: string }>;
  userCategories: Array<{ id: string; name: string; color: string }>;
  onSave?: (updates: Partial<EventResolved>) => void;
}

export function EventDetailsPanel({
  selectedEvent,
  selectedEventPrimary,
  userCalendars,
  userCategories,
  onSave,
}: EventDetailsPanelProps) {
  // Local state for editing
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showTimeAs, setShowTimeAs] = useState('busy');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [onlineEvent, setOnlineEvent] = useState(false);
  const [onlineJoinLink, setOnlineJoinLink] = useState('');
  const [onlineChatLink, setOnlineChatLink] = useState('');
  const [inPerson, setInPerson] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [requestResponses, setRequestResponses] = useState(true);
  const [allowForwarding, setAllowForwarding] = useState(true);
  const [hideAttendees, setHideAttendees] = useState(false);

  // Reset form when selected event changes
  useEffect(() => {
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
      setRequestResponses(selectedEvent.request_responses);
      setAllowForwarding(selectedEvent.allow_forwarding);
      setHideAttendees(selectedEvent.hide_attendees);
    }
  }, [selectedEvent]);

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
      setRequestResponses(selectedEvent.request_responses);
      setAllowForwarding(selectedEvent.allow_forwarding);
      setHideAttendees(selectedEvent.hide_attendees);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        title,
        agenda,
        private: isPrivate,
        online_event: onlineEvent,
        online_join_link: onlineJoinLink,
        online_chat_link: onlineChatLink,
        in_person: inPerson,
        all_day: allDay,
        request_responses: requestResponses,
        allow_forwarding: allowForwarding,
        hide_attendees: hideAttendees,
        // TODO: calendar_id, category_id, show_time_as, following updates
      });
    }
  };

  const hasChanges = selectedEvent && (
    title !== selectedEvent.title ||
    agenda !== (selectedEvent.agenda || '') ||
    calendarId !== (selectedEvent.calendar?.id || '') ||
    categoryId !== (selectedEvent.category?.id || '') ||
    showTimeAs !== (selectedEvent.personal_details?.show_time_as || 'busy') ||
    isPrivate !== selectedEvent.private ||
    isFollowing !== selectedEvent.following ||
    onlineEvent !== selectedEvent.online_event ||
    onlineJoinLink !== (selectedEvent.online_join_link || '') ||
    onlineChatLink !== (selectedEvent.online_chat_link || '') ||
    inPerson !== selectedEvent.in_person ||
    allDay !== selectedEvent.all_day ||
    requestResponses !== selectedEvent.request_responses ||
    allowForwarding !== selectedEvent.allow_forwarding ||
    hideAttendees !== selectedEvent.hide_attendees
  );

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center gap-2">
        <div className="flex-1">
          <div className="font-medium text-sm">Event Details</div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!hasChanges}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
          Save
        </Button>
      </div>
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border">
        <div className="h-12 px-4 flex items-center gap-2">
          {/* Calendar */}
          <Select value={calendarId} onValueChange={setCalendarId}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Calendar" />
            </SelectTrigger>
            <SelectContent>
              {userCalendars.map((calendar) => (
                <SelectItem key={calendar.id} value={calendar.id}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${getColorClass(calendar.color)}`} />
                    {calendar.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {userCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${getColorClass(category.color)}`} />
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show Time As */}
          <Select value={showTimeAs} onValueChange={setShowTimeAs}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Show Time As" />
            </SelectTrigger>
            <SelectContent>
              {SHOW_TIME_AS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Private & Following Toggle Group */}
          <ToggleGroup
            type="multiple"
            className="ml-auto"
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
            <ToggleGroupItem value="private" aria-label="Toggle private" className="h-8">
              <Lock className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="following" aria-label="Toggle following" className="h-8">
              <UserCheck className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {/* Content */}
      <ScrollArea className="flex-1 h-full">
        <div className="p-4">
          {selectedEvent ? (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
                  className="!text-lg font-semibold h-11 px-4"
                />
              </div>

              {/* Attendees & Guests */}
              <EventAttendees
                eventId={selectedEvent.id}
                isOwner={selectedEvent.role === 'owner'}
                attendees={[]}
                onAddAttendee={(email, role) => {
                  // TODO: Implement add attendee
                  console.log('Add attendee:', email, role);
                }}
                onUpdateAttendee={(userId, updates) => {
                  // TODO: Implement update attendee
                  console.log('Update attendee:', userId, updates);
                }}
                onRemoveAttendee={(userId) => {
                  // TODO: Implement remove attendee
                  console.log('Remove attendee:', userId);
                }}
              />

              {/* Agenda */}
              <div>
                <Textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Agenda"
                  rows={4}
                />
              </div>

              <Separator />

              {/* Time */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Time
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedEvent.start_time).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {', '}
                  {new Date(selectedEvent.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  -{' '}
                  {new Date(selectedEvent.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={allDay}
                    onCheckedChange={setAllDay}
                    id="all-day"
                  />
                  <Label htmlFor="all-day" className="text-sm font-normal cursor-pointer">
                    All day
                  </Label>
                </div>
              </div>

              <Separator />

              {/* Location & Meeting Type */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Location & Meeting Type</div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={onlineEvent}
                    onCheckedChange={setOnlineEvent}
                    id="online-event"
                  />
                  <Label htmlFor="online-event" className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                    <Video className="h-4 w-4" />
                    Online meeting
                  </Label>
                </div>

                {onlineEvent && (
                  <div className="space-y-2 ml-6">
                    <Input
                      value={onlineJoinLink}
                      onChange={(e) => setOnlineJoinLink(e.target.value)}
                      placeholder="Join link"
                      className="h-9"
                    />
                    <Input
                      value={onlineChatLink}
                      onChange={(e) => setOnlineChatLink(e.target.value)}
                      placeholder="Chat link (optional)"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={inPerson}
                    onCheckedChange={setInPerson}
                    id="in-person"
                  />
                  <Label htmlFor="in-person" className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                    <MapPin className="h-4 w-4" />
                    In person
                  </Label>
                </div>
              </div>

              <Separator />

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
                    value: 'hide-attendees',
                    label: 'Hide attendees',
                    checked: hideAttendees,
                  },
                ]}
                onOptionChange={(value, checked) => {
                  if (value === 'request-responses') setRequestResponses(checked);
                  if (value === 'allow-forwarding') setAllowForwarding(checked);
                  if (value === 'hide-attendees') setHideAttendees(checked);
                }}
              />
            </div>
          ) : selectedEventPrimary ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="text-sm text-muted-foreground">No event selected</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

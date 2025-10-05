'use client';

import { Bot, Clock, Lock, MapPin, Send, Shield, Undo2, UserCheck, Users } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { InputGroupOnline } from '@/components/custom/input-group-online';
import { InputGroupSelect } from '@/components/custom/input-group-select';
import { InputGroupTime } from '@/components/custom/input-group-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
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
import {
  EVENT_DISCOVERY_TYPES,
  EVENT_JOIN_MODEL_TYPES,
  getColorClass,
  SHOW_TIME_AS,
  TIME_DEFENSE_LEVEL,
} from '@/lib/constants/event-enums';
import type { EventResolved } from '@/lib/data-v2';
import { useAppStore } from '@/store/app';
import { EventAttendees } from './event-attendees';

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
  // App store for time selection mode
  const enableTimeSelectionMode = useAppStore((s) => s.enableTimeSelectionMode);
  const disableTimeSelectionMode = useAppStore((s) => s.disableTimeSelectionMode);

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
  const [discovery, setDiscovery] = useState('audience_only');
  const [joinModel, setJoinModel] = useState('invite_only');

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
    }
  };

  const handleTimeSelectionClick = () => {
    enableTimeSelectionMode((start, end) => {
      setStartTime(start);
      setEndTime(end);
      disableTimeSelectionMode();
    });
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
        start_time: startTime,
        end_time: endTime,
        request_responses: requestResponses,
        allow_forwarding: allowForwarding,
        allow_reschedule_request: allowRescheduleRequest,
        hide_attendees: hideAttendees,
        discovery,
        join_model: joinModel,
        // TODO: calendar_id, category_id, show_time_as, following, personal_details updates
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
      joinModel !== selectedEvent.join_model);

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
      {/* Content */}
      {selectedEvent ? (
        <Tabs defaultValue="details" className="flex-1 flex flex-col h-full">
          <div className="shrink-0 px-4 pt-3 pb-3 flex justify-center">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="attendees">Attendees</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="flex-1 basis-0 mt-0 min-w-0 overflow-hidden">
            <OverlayScrollbarsComponent
              defer
              options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 800 } }}
              className="h-full"
            >
              <div className="p-4 space-y-6 min-w-0 max-w-full box-border">
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
                  />
                </div>

                {/* Attendees & Guests */}
                <EventAttendees
                  eventId={selectedEvent.id}
                  isOwner={selectedEvent.role === 'owner'}
                  icon={<Users className="h-4 w-4" />}
                  attendees={[]}
                  onAddAttendee={() => {
                    // TODO: Implement add attendee
                  }}
                  onUpdateAttendee={() => {
                    // TODO: Implement update attendee
                  }}
                  onRemoveAttendee={() => {
                    // TODO: Implement remove attendee
                  }}
                />

                {/* Online Meeting */}
                <div className="min-w-0">
                  <InputGroupOnline
                    isOnline={onlineEvent}
                    joinLink={onlineJoinLink}
                    chatLink={onlineChatLink}
                    onOnlineChange={setOnlineEvent}
                    onJoinLinkChange={setOnlineJoinLink}
                    onChatLinkChange={setOnlineChatLink}
                  />
                </div>

                {/* Invite Options */}
                <div className="min-w-0">
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
                      if (value === 'allow-reschedule-request') setAllowRescheduleRequest(checked);
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
                          <Select value={discovery} onValueChange={setDiscovery}>
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
                          <Select value={joinModel} onValueChange={setJoinModel}>
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

                {/* Agenda */}
                <div>
                  <Textarea
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="Agenda"
                    className="min-h-32"
                  />
                </div>

                <Separator />

                {/* Calendar, Category, Show Time As, Time Defense */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Calendar */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Calendar</Label>
                    <Select value={calendarId} onValueChange={setCalendarId}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
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
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Select category" />
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
                  </div>

                  {/* Show Time As */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Show Time As</Label>
                    <Select value={showTimeAs} onValueChange={setShowTimeAs}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHOW_TIME_AS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Defense */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Time Defense</Label>
                    <Select value={timeDefenseLevel} onValueChange={setTimeDefenseLevel}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
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
                </div>

                {/* Toggle Buttons */}
                <div className="space-y-3">

                  {/* Private & Following Toggle Group */}
                  <div className="flex gap-2">
                    <ToggleGroup
                      type="multiple"
                      className="w-full justify-start"
                      variant="outline"
                      value={[...(isPrivate ? ['private'] : []), ...(isFollowing ? ['following'] : [])]}
                      onValueChange={(value) => {
                        setIsPrivate(value.includes('private'));
                        setIsFollowing(value.includes('following'));
                      }}
                    >
                      <ToggleGroupItem value="private" aria-label="Toggle private" className="h-9 flex-1">
                        <Lock className="h-4 w-4 mr-2" />
                        Private
                      </ToggleGroupItem>
                      <ToggleGroupItem value="following" aria-label="Toggle following" className="h-9 flex-1">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Following
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                <Separator />

                {/* AI Management */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ai-managed" className="flex items-center gap-2 text-sm font-medium">
                      <Bot className="h-4 w-4" />
                      AI Managed
                    </Label>
                    <Switch id="ai-managed" checked={aiManaged} onCheckedChange={setAiManaged} />
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
                    <Label htmlFor={inPersonId} className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4" />
                      In person
                    </Label>
                    <Switch id={inPersonId} checked={inPerson} onCheckedChange={setInPerson} />
                  </div>
                </div>
              </div>
            </OverlayScrollbarsComponent>
          </TabsContent>

          <TabsContent value="attendees" className="flex-1 basis-0 mt-0 min-w-0 overflow-hidden">
            <OverlayScrollbarsComponent
              defer
              options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 800 } }}
              className="h-full"
            >
              <div className="p-4">
                <div className="text-sm text-muted-foreground">Coming soon...</div>
              </div>
            </OverlayScrollbarsComponent>
          </TabsContent>
        </Tabs>
      ) : selectedEventPrimary ? (
        <div className="flex-1 p-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div className="text-sm text-muted-foreground">No event selected</div>
        </div>
      )}
    </div>
  );
}

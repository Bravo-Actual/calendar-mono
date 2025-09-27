"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, MapPin, Globe, Users, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShowTimeAs, TimeDefenseLevel, EventDiscoveryType, EventJoinModelType } from "@/types";
import type { AssembledEvent } from "@/lib/data/base/client-types";
import { useUpdateEvent } from "@/lib/data/queries";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface EventDetailsPanelProps {
  isOpen: boolean;
  event: AssembledEvent | null;
  onClose: () => void;
}

export function EventDetailsPanel({
  isOpen,
  event,
  onClose
}: EventDetailsPanelProps) {
  const { user } = useAuth();
  const updateEvent = useUpdateEvent(user?.id);
  const [formData, setFormData] = React.useState<Partial<AssembledEvent>>({});

  // Reset form data when event changes
  React.useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        agenda: event.agenda,
        online_event: event.online_event,
        online_join_link: event.online_join_link,
        online_chat_link: event.online_chat_link,
        in_person: event.in_person,
        all_day: event.all_day,
        private: event.private,
        request_responses: event.request_responses,
        allow_forwarding: event.allow_forwarding,
        hide_attendees: event.hide_attendees,
        calendar: event.calendar,
        show_time_as: event.show_time_as,
        category: event.category,
        time_defense_level: event.time_defense_level,
        ai_managed: event.ai_managed,
        ai_instructions: event.ai_instructions,
        discovery: event.discovery || 'audience_only',
        join_model: event.join_model || 'invite_only',
        invite_allow_reschedule_proposals: event.invite_allow_reschedule_proposals,
      });
    }
  }, [event]);

  const handleFieldChange = (field: keyof AssembledEvent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!event || !user) return;

    // Separate event fields from personal fields
    const eventFields: Partial<{
      title: string;
      start_time: Date;
      end_time: Date;
      private: boolean;
      online_event: boolean;
      in_person: boolean;
      agenda: string;
      all_day: boolean;
      request_responses: boolean;
      allow_forwarding: boolean;
      hide_attendees: boolean;
      invite_allow_reschedule_proposals: boolean;
      discovery: EventDiscoveryType;
      join_model: EventJoinModelType;
      online_join_link: string;
      online_chat_link: string;
    }> = {};

    const personalFields: Partial<{
      calendar_id: string;
      category_id: string;
      show_time_as: ShowTimeAs;
      time_defense_level: TimeDefenseLevel;
      ai_managed: boolean;
      ai_instructions: string;
    }> = {};

    // Check for changes and categorize them
    Object.keys(formData).forEach((key) => {
      const field = key as keyof AssembledEvent;
      const formValue = formData[field];
      const eventValue = event[field];

      // Handle special cases for lookup fields (skip for now since UI is read-only)
      if (field === 'calendar' || field === 'category') {
        return;
      }

      // Handle null/undefined comparisons properly
      const hasChanged = formValue !== eventValue &&
        !(formValue == null && eventValue == null);

      if (hasChanged) {
        // Categorize field
        if (['show_time_as', 'time_defense_level', 'ai_managed', 'ai_instructions'].includes(field)) {
          (personalFields as any)[field] = formValue;
        } else {
          (eventFields as any)[field] = formValue;
        }
      }
    });

    try {
      await updateEvent.mutateAsync({
        id: event.id,
        event: Object.keys(eventFields).length > 0 ? eventFields : undefined,
        personal: Object.keys(personalFields).length > 0 ? personalFields : undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!event) return false;
    return Object.keys(formData).some((key) => {
      const field = key as keyof AssembledEvent;
      const formValue = formData[field];
      const eventValue = event[field];

      // Handle null/undefined comparisons properly
      return formValue !== eventValue &&
        !(formValue == null && eventValue == null);
    });
  }, [formData, event]);

  if (!event) return null;

  const startDate = new Date(event.start_time_ms);
  const endDate = new Date(event.end_time_ms);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.95 }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0.0, 0.2, 1],
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 }
          }}
          className="h-full bg-background border-l border-border flex flex-col"
        >
          {/* Header */}
          <div className="h-16 shrink-0 px-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event Details</h2>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-8"
                >
                  Save
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="p-6 space-y-6">
                {/* Basic Information Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title || ''}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        placeholder="Event title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agenda">Description</Label>
                      <Textarea
                        id="agenda"
                        value={formData.agenda || ''}
                        onChange={(e) => handleFieldChange('agenda', e.target.value)}
                        placeholder="Event description or agenda"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Date & Time Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4" />
                      Date & Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <div className="text-sm font-medium">Start: {format(startDate, 'PPP p')}</div>
                      <div className="text-sm font-medium">End: {format(endDate, 'PPP p')}</div>
                      <div className="text-sm text-muted-foreground">Duration: {Math.round((event.end_time_ms - event.start_time_ms) / (1000 * 60))} minutes</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="all-day"
                        checked={formData.all_day || false}
                        onCheckedChange={(checked) => handleFieldChange('all_day', checked)}
                      />
                      <Label htmlFor="all-day" className="text-sm font-medium">All day event</Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Location & Meeting Type Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4" />
                      Meeting Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Switch
                          id="online-event"
                          checked={formData.online_event || false}
                          onCheckedChange={(checked) => handleFieldChange('online_event', checked)}
                        />
                        <Label htmlFor="online-event" className="text-sm font-medium">Online meeting</Label>
                      </div>

                      {formData.online_event && (
                        <div className="ml-6 space-y-3 p-3 rounded-lg bg-muted/30">
                          <div className="space-y-2">
                            <Label htmlFor="join-link" className="text-sm">Join link</Label>
                            <Input
                              id="join-link"
                              value={formData.online_join_link || ''}
                              onChange={(e) => handleFieldChange('online_join_link', e.target.value)}
                              placeholder="https://..."
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="chat-link" className="text-sm">Chat link</Label>
                            <Input
                              id="chat-link"
                              value={formData.online_chat_link || ''}
                              onChange={(e) => handleFieldChange('online_chat_link', e.target.value)}
                              placeholder="https://..."
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <Switch
                          id="in-person"
                          checked={formData.in_person || false}
                          onCheckedChange={(checked) => handleFieldChange('in_person', checked)}
                        />
                        <Label htmlFor="in-person" className="text-sm font-medium">In-person meeting</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy & Settings Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="h-4 w-4" />
                      Privacy & Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="private"
                        checked={formData.private || false}
                        onCheckedChange={(checked) => handleFieldChange('private', checked)}
                      />
                      <Label htmlFor="private" className="text-sm font-medium">Private event</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="request-responses"
                        checked={formData.request_responses || false}
                        onCheckedChange={(checked) => handleFieldChange('request_responses', checked)}
                      />
                      <Label htmlFor="request-responses" className="text-sm font-medium">Request responses</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="allow-forwarding"
                        checked={formData.allow_forwarding || false}
                        onCheckedChange={(checked) => handleFieldChange('allow_forwarding', checked)}
                      />
                      <Label htmlFor="allow-forwarding" className="text-sm font-medium">Allow forwarding</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="hide-attendees"
                        checked={formData.hide_attendees || false}
                        onCheckedChange={(checked) => handleFieldChange('hide_attendees', checked)}
                      />
                      <Label htmlFor="hide-attendees" className="text-sm font-medium">Hide attendees</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="allow-reschedule-proposals"
                        checked={formData.invite_allow_reschedule_proposals !== false}
                        onCheckedChange={(checked) => handleFieldChange('invite_allow_reschedule_proposals', checked)}
                      />
                      <Label htmlFor="allow-reschedule-proposals" className="text-sm font-medium">Allow reschedule proposals</Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Discovery & Sharing Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4" />
                      Discovery & Sharing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="discovery">Who can discover this event</Label>
                      <Select
                        value={formData.discovery || 'audience_only'}
                        onValueChange={(value: EventDiscoveryType) => handleFieldChange('discovery', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="audience_only">Audience only</SelectItem>
                          <SelectItem value="tenant_only">Organization only</SelectItem>
                          <SelectItem value="public">Public</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Controls who can see this event in free/busy calendar sharing
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="join-model">How people can join</Label>
                      <Select
                        value={formData.join_model || 'invite_only'}
                        onValueChange={(value: EventJoinModelType) => handleFieldChange('join_model', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invite_only">Invite only</SelectItem>
                          <SelectItem value="request_to_join">Request to join</SelectItem>
                          <SelectItem value="open_join">Open join</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Controls how people can participate in this event
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* User Preferences Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Your Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="calendar">Calendar</Label>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                          {event.calendar && (
                            <>
                              <div className={`w-3 h-3 rounded-sm bg-${event.calendar.color}-500`} />
                              <span className="text-sm font-medium">{event.calendar.name}</span>
                            </>
                          )}
                          {!event.calendar && (
                            <span className="text-sm text-muted-foreground">No calendar assigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="show-time-as">Show time as</Label>
                      <Select
                        value={formData.show_time_as || 'busy'}
                        onValueChange={(value: ShowTimeAs) => handleFieldChange('show_time_as', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="tentative">Tentative</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                          <SelectItem value="oof">Out of office</SelectItem>
                          <SelectItem value="working_elsewhere">Working elsewhere</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                          {event.category && (
                            <>
                              <div className={`w-3 h-3 rounded bg-${event.category.color}-500`} />
                              <span className="text-sm font-medium">{event.category.name}</span>
                            </>
                          )}
                          {!event.category && (
                            <span className="text-sm text-muted-foreground">No category assigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="time-defense">Time defense level</Label>
                      <Select
                        value={formData.time_defense_level || 'normal'}
                        onValueChange={(value: TimeDefenseLevel) => handleFieldChange('time_defense_level', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flexible">Flexible</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="hard_block">Hard block</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Management Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="h-4 w-4" />
                      AI Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="ai-managed"
                        checked={formData.ai_managed || false}
                        onCheckedChange={(checked) => handleFieldChange('ai_managed', checked)}
                      />
                      <Label htmlFor="ai-managed" className="text-sm font-medium">AI managed</Label>
                    </div>

                    {formData.ai_managed && (
                      <div className="space-y-2">
                        <Label htmlFor="ai-instructions">AI instructions</Label>
                        <Textarea
                          id="ai-instructions"
                          value={formData.ai_instructions || ''}
                          onChange={(e) => handleFieldChange('ai_instructions', e.target.value)}
                          placeholder="Instructions for AI management of this event"
                          rows={3}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>

          {/* Footer */}
          {hasChanges && (
            <div className="p-4 border-t border-border shrink-0">
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setFormData({})}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
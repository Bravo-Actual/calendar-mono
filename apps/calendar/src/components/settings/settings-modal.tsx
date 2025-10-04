'use client';

import {
  Bell,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Plus,
  Tag,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
// App store sync now handled via realtime - no direct import needed
import { useAuth } from '@/contexts/AuthContext';
import { useAIAgents } from '@/hooks/use-ai-agents';
import { getAvatarUrl } from '@/lib/avatar-utils';
import {
  type ClientPersona,
  createAIPersona,
  deleteAIPersona,
  deleteAIPersonaAvatar,
  deleteUserProfileAvatar,
  updateAIPersona,
  updateUserProfile,
  uploadAIPersonaAvatar,
  uploadUserProfileAvatar,
  useAIPersonas,
  useUserProfile,
} from '@/lib/data-v2';
import { AvatarManager } from '../avatar-manager/avatar-manager';
import { CalendarsAndCategoriesSettings } from './calendars-and-categories-settings';
import { ModelSelector } from './model-selector';
import { TimezoneSelector } from './timezone-selector';
import { WorkScheduleSettings } from './work-schedule-settings';

const profileSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  display_name: z.string().max(100, 'Display name must be less than 100 characters').optional(),
  title: z.string().max(100, 'Title must be less than 100 characters').optional(),
  organization: z.string().max(100, 'Organization must be less than 100 characters').optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  time_format: z.enum(['12_hour', '24_hour']),
  week_start_day: z.enum(['0', '1', '2', '3', '4', '5', '6']),
});

// type ProfileFormValues = z.infer<typeof profileSchema>

const personaSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Assistant name is required')
      .max(100, 'Name must be less than 100 characters'),
    traits: z.string().max(2500, 'Traits must be less than 2500 characters').optional(),
    instructions: z.string().max(5000, 'Instructions must be less than 5000 characters').optional(),
    greeting: z.string().max(500, 'Greeting must be less than 500 characters').optional(),
    agent_id: z.string().min(1, 'Agent is required'),
    model_id: z.string().optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    top_p: z.number().min(0).max(1).nullable().optional(),
    is_default: z.boolean().optional(),
    avatar_url: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // Either temperature OR top_p should be set, but not both
      const hasTemp = data.temperature !== null && data.temperature !== undefined;
      const hasTopP = data.top_p !== null && data.top_p !== undefined;
      return hasTemp !== hasTopP; // XOR - exactly one should be true
    },
    {
      message: 'Either temperature OR top_p should be set, but not both',
      path: ['temperature'], // Show error on temperature field
    }
  );

type PersonaFormValues = z.infer<typeof personaSchema>;

const settingsData = {
  nav: [
    { name: 'Profile', icon: User, key: 'profile' },
    { name: 'Dates & Times', icon: Calendar, key: 'dates-times' },
    { name: 'Work Schedule', icon: Clock, key: 'work-schedule' },
    { name: 'Calendars & Categories', icon: Tag, key: 'calendars-categories' },
    { name: 'Notifications', icon: Bell, key: 'notifications' },
    { name: 'Language & region', icon: Globe, key: 'language' },
    { name: 'AI Assistant', icon: Zap, key: 'ai' },
  ],
};

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user } = useAuth();
  const profile = useUserProfile(user?.id);
  const profileLoading = !profile && !!user?.id; // Loading if user exists but no data yet
  // App store sync is now handled automatically via realtime subscriptions
  const [activeSection, setActiveSection] = React.useState('profile');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

  // Profile form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    title: '',
    organization: '',
    timezone: 'UTC',
    time_format: '12_hour' as '12_hour' | '24_hour',
    week_start_day: '0' as '0' | '1' | '2' | '3' | '4' | '5' | '6',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI Personas hooks
  const aiPersonas = useAIPersonas(user?.id) || [];
  const isLoading = !aiPersonas && !!user?.id; // Loading if user exists but no data yet

  // AI Agents hook
  const { data: agents = [], isLoading: agentsLoading } = useAIAgents();

  // Persona editing state
  const [editingPersona, setEditingPersona] = useState<ClientPersona | null>(null);
  const [personaFormData, setPersonaFormData] = useState<PersonaFormValues>({
    name: '',
    traits: '',
    instructions: '',
    greeting: '',
    agent_id: '',
    model_id: '',
    temperature: 0.7,
    top_p: null,
    is_default: false,
  });
  const [personaFormErrors, setPersonaFormErrors] = useState<Record<string, string>>({});
  const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);
  const [isDeletingPersonaAvatar, setIsDeletingPersonaAvatar] = useState(false);

  // Work schedule state
  const [workScheduleHasChanges, setWorkScheduleHasChanges] = useState(false);
  const workScheduleSaveHandlerRef = useRef<(() => void) | null>(null);

  // Stable callbacks for work schedule
  const handleWorkScheduleHasChangesChange = useCallback((hasChanges: boolean) => {
    setWorkScheduleHasChanges(hasChanges);
  }, []);

  const handleWorkScheduleSaveHandlerChange = useCallback((saveHandler: (() => void) | null) => {
    workScheduleSaveHandlerRef.current = saveHandler;
  }, []);

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        title: profile.title || '',
        organization: profile.organization || '',
        timezone: profile.timezone || 'UTC',
        time_format: (profile.time_format as '12_hour' | '24_hour') || '12_hour',
        week_start_day: (profile.week_start_day as '0' | '1' | '2' | '3' | '4' | '5' | '6') || '0',
      });
    }
  }, [profile]);

  // Persona editing functions
  const startEditingPersona = (persona: ClientPersona) => {
    setEditingPersona(persona);
    setPersonaFormData({
      name: persona.name,
      traits: persona.traits || '',
      instructions: persona.instructions || '',
      greeting: persona.greeting || '',
      agent_id: persona.agent_id || '',
      model_id: persona.model_id || '',
      temperature: persona.temperature || 0.7,
      top_p: persona.top_p || null,
      is_default: persona.is_default || false,
    });
    setPersonaFormErrors({});
    setPersonaAvatarPreview(null);
  };

  const cancelEditingPersona = () => {
    setEditingPersona(null);
    setPersonaFormData({
      name: '',
      traits: '',
      instructions: '',
      greeting: '',
      agent_id: '',
      model_id: '',
      temperature: 0.7,
      top_p: null,
      is_default: false,
    });
    setPersonaFormErrors({});
    setPersonaAvatarPreview(null);
  };

  const handlePersonaInputChange = (
    field: keyof PersonaFormValues,
    value: string | number | boolean
  ) => {
    setPersonaFormData((prev) => ({ ...prev, [field]: value }));
    if (personaFormErrors[field]) {
      setPersonaFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handlePersonaAvatarChange = async (imageBlob: Blob) => {
    if (!user?.id) return;

    // Set preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPersonaAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(imageBlob);

    // Check if this is a new persona (not yet created)
    if (!editingPersona?.id || editingPersona.id === 'new') {
      // Show alert dialog for new personas
      setPersonaAvatarPreview(null);
      toast.error('Please create and save the persona first before adding an avatar');
      return;
    }

    // Upload avatar for existing personas using v2 function
    try {
      const avatarUrl = await uploadAIPersonaAvatar(user.id, editingPersona.id, imageBlob);

      // Update the form data with the new avatar URL (relative path)
      setPersonaFormData((prev) => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');

      // Reset preview on error
      setPersonaAvatarPreview(null);
    }
  };

  const validatePersonaForm = () => {
    try {
      personaSchema.parse(personaFormData);
      setPersonaFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setPersonaFormErrors(newErrors);
      }
      return false;
    }
  };

  const savePersona = async () => {
    if (!validatePersonaForm() || !editingPersona) {
      return;
    }

    setSavingPersona(true);

    // Check if this is a new persona
    const isNewPersona = editingPersona.id === 'new';

    // Prepare data - avatar upload is handled separately
    const personaData = { ...personaFormData };

    // Use v2 async functions with try/catch
    try {
      if (!user?.id) return;

      if (isNewPersona) {
        await createAIPersona(user.id, personaData);
      } else {
        await updateAIPersona(user.id, editingPersona.id, personaData);
      }

      cancelEditingPersona();
      setSavingPersona(false);
      toast.success(
        isNewPersona ? 'AI persona created successfully' : 'AI persona updated successfully'
      );
    } catch (error) {
      console.error('Failed to save persona:', error);
      setSavingPersona(false);
      toast.error('Failed to save persona');
    }
  };

  const handleAvatarChange = async (imageBlob: Blob) => {
    if (!user?.id) return;

    try {
      // Set preview immediately for instant UI feedback
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(imageBlob);

      // Upload using v2 function (handles offline-first via outbox)
      await uploadUserProfileAvatar(user.id, imageBlob);
      toast.success('Profile avatar updated');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setAvatarPreview(null); // Reset preview on error
      toast.error('Failed to upload avatar');
    }
  };

  const handleAvatarDelete = async () => {
    if (!user?.id) return;

    try {
      // Set deleting state and clear preview immediately for instant UI feedback
      setIsDeletingAvatar(true);
      setAvatarPreview(null);

      // Delete using v2 function (handles offline-first via outbox)
      await deleteUserProfileAvatar(user.id, profile?.avatar_url);
      toast.success('Profile avatar deleted');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handlePersonaAvatarDelete = async () => {
    if (!user?.id || !editingPersona?.id || editingPersona.id === 'new') return;

    try {
      // Set deleting state and clear preview immediately for instant UI feedback
      setIsDeletingPersonaAvatar(true);
      setPersonaAvatarPreview(null);

      // Delete using v2 function (handles offline-first via outbox)
      await deleteAIPersonaAvatar(user.id, editingPersona.id, editingPersona.avatar_url);

      // Update the form data to clear the avatar URL
      setPersonaFormData((prev) => ({ ...prev, avatar_url: null }));
      toast.success('Avatar deleted successfully');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeletingPersonaAvatar(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    try {
      profileSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleProfileSave = async () => {
    if (!validateForm() || !user?.id) {
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfile(user.id, formData);
      setAvatarPreview(null);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const activeItem = settingsData.nav.find((item) => item.key === activeSection);

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'profile': {
        if (profileLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        // Generate display name and initials
        const firstName = profile?.first_name || '';
        const lastName = profile?.last_name || '';
        const displayName = profile?.display_name || `${firstName} ${lastName}`.trim() || 'User';
        const initials = displayName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const currentAvatar = isDeletingAvatar
          ? null
          : avatarPreview || profile?.avatar_url || null;

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Profile Settings</h3>
              <p className="text-sm text-muted-foreground">
                Update your profile information and avatar.
              </p>
            </div>

            <div className="flex gap-6 items-start">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <AvatarManager
                  src={currentAvatar}
                  fallback={<span className="text-lg">{initials}</span>}
                  size={96}
                  variant="circle"
                  isUploading={isSavingProfile}
                  onImageChange={handleAvatarChange}
                  onImageDelete={handleAvatarDelete}
                  maxSizeMB={5}
                  acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                  alt={displayName}
                />
              </div>

              {/* Form Fields */}
              <div className="flex-1 space-y-6">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      placeholder="John"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                    />
                    {errors.first_name && (
                      <p className="text-sm text-destructive">{errors.first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      placeholder="Doe"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                    />
                    {errors.last_name && (
                      <p className="text-sm text-destructive">{errors.last_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    placeholder="Display name (optional)"
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                  />
                  {errors.display_name && (
                    <p className="text-sm text-destructive">{errors.display_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use your first and last name
                  </p>
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Email address is managed through your account settings
                  </p>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="Software Engineer"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                  {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                </div>

                {/* Organization */}
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    placeholder="Acme Corp"
                    value={formData.organization}
                    onChange={(e) => handleInputChange('organization', e.target.value)}
                  />
                  {errors.organization && (
                    <p className="text-sm text-destructive">{errors.organization}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'dates-times':
        if (profileLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Dates & Times</h3>
              <p className="text-sm text-muted-foreground">
                Configure your calendar view, timezone, and preferences.
              </p>
            </div>

            <div className="space-y-6">
              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <TimezoneSelector
                  value={formData.timezone}
                  onValueChange={(value) => handleInputChange('timezone', value)}
                  placeholder="Select your timezone..."
                  className="w-full"
                  timeFormat={formData.time_format}
                />
                {errors.timezone && <p className="text-sm text-destructive">{errors.timezone}</p>}
                <p className="text-xs text-muted-foreground">
                  This timezone will be used for displaying times and scheduling events
                </p>
              </div>

              {/* Time Format */}
              <div className="space-y-2">
                <Label>Time Format</Label>
                <Select
                  value={formData.time_format}
                  onValueChange={(value) => handleInputChange('time_format', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12_hour">12-hour (1:00 PM)</SelectItem>
                    <SelectItem value="24_hour">24-hour (13:00)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.time_format && (
                  <p className="text-sm text-destructive">{errors.time_format}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose how times are displayed throughout the calendar
                </p>
              </div>

              {/* Week Start Day */}
              <div className="space-y-2">
                <Label>Week starts on</Label>
                <Select
                  value={formData.week_start_day}
                  onValueChange={(value) => handleInputChange('week_start_day', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
                {errors.week_start_day && (
                  <p className="text-sm text-destructive">{errors.week_start_day}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose which day your calendar week begins with
                </p>
              </div>
            </div>
          </div>
        );

      case 'work-schedule':
        return (
          <WorkScheduleSettings
            userId={user?.id || ''}
            timezone={formData.timezone}
            onHasChangesChange={handleWorkScheduleHasChangesChange}
            onSaveHandler={handleWorkScheduleSaveHandlerChange}
          />
        );

      case 'calendars-categories':
        return <CalendarsAndCategoriesSettings />;

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Notification Settings</h3>
              <p className="text-sm text-muted-foreground">
                Control how and when you receive notifications.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Event Reminders</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure default reminders for new events.
                </p>
                <Button variant="outline">Set Reminders</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Email Notifications</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which events trigger email notifications.
                </p>
                <Button variant="outline">Configure Email</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Browser Notifications</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Enable desktop notifications for important events.
                </p>
                <Button variant="outline">Enable Notifications</Button>
              </div>
            </div>
          </div>
        );

      case 'ai':
        if (isLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        // Show edit form if editing a persona
        if (editingPersona) {
          // Get fresh data from live query instead of stale editingPersona
          const livePersona =
            aiPersonas.find((a) => a.id === editingPersona.id) || editingPersona;
          const currentAvatar = isDeletingPersonaAvatar
            ? null
            : personaAvatarPreview || livePersona.avatar_url || null;
          const initials = editingPersona.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Edit Assistant</h3>
                <p className="text-sm text-muted-foreground">
                  Customize your AI assistant&apos;s personality and behavior.
                </p>
              </div>

              {personaFormErrors.general && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{personaFormErrors.general}</p>
                </div>
              )}

              <div className="flex gap-6 items-start">
                {/* Avatar */}
                <div className="flex flex-col items-center">
                  <AvatarManager
                    src={currentAvatar}
                    fallback={<span className="text-lg">{initials}</span>}
                    size={96}
                    variant="circle"
                    disabled={!editingPersona?.id || editingPersona.id === 'new'}
                    disabledMessage="Please create and save the persona first before adding an avatar"
                    isUploading={savingPersona}
                    onImageChange={handlePersonaAvatarChange}
                    onImageDelete={handlePersonaAvatarDelete}
                    maxSizeMB={5}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                    alt={personaFormData.name}
                  />
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-6">
                  {/* Assistant Name */}
                  <div className="space-y-2">
                    <Label>Assistant Name *</Label>
                    <Input
                      placeholder="e.g., Maya the Calendar Expert"
                      value={personaFormData.name}
                      onChange={(e) => handlePersonaInputChange('name', e.target.value)}
                    />
                    {personaFormErrors.name && (
                      <p className="text-sm text-destructive">{personaFormErrors.name}</p>
                    )}
                  </div>

                  {/* AI Agent */}
                  <div className="space-y-2">
                    <Label>AI Agent *</Label>
                    <Select
                      value={personaFormData.agent_id}
                      onValueChange={(value) => handlePersonaInputChange('agent_id', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an AI agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {agentsLoading ? (
                          <SelectItem value="" disabled>
                            Loading agents...
                          </SelectItem>
                        ) : agents.length === 0 ? (
                          <SelectItem value="" disabled>
                            No agents available
                          </SelectItem>
                        ) : (
                          agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} {agent.description && `- ${agent.description}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {personaFormErrors.agent_id && (
                      <p className="text-sm text-destructive">{personaFormErrors.agent_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Choose the Mastra agent that will handle this assistant&apos;s logic
                    </p>
                  </div>

                  {/* AI Model */}
                  <div className="space-y-2">
                    <Label>AI Model</Label>
                    <ModelSelector
                      value={personaFormData.model_id || ''}
                      onValueChange={(value) => handlePersonaInputChange('model_id', value)}
                      placeholder="Select an AI model..."
                      className="w-full"
                    />
                    {personaFormErrors.model_id && (
                      <p className="text-sm text-destructive">{personaFormErrors.model_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Choose the AI model that will power this assistant (optional, can be set by
                      agent)
                    </p>
                  </div>

                  {/* Greeting Message */}
                  <div className="space-y-2">
                    <Label>Greeting Message</Label>
                    <Textarea
                      placeholder="Hi! I'm here to help you manage your calendar effectively..."
                      value={personaFormData.greeting}
                      onChange={(e) => handlePersonaInputChange('greeting', e.target.value)}
                      rows={2}
                    />
                    {personaFormErrors.greeting && (
                      <p className="text-sm text-destructive">{personaFormErrors.greeting}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      How the assistant introduces itself to users
                    </p>
                  </div>

                  {/* Personality Traits */}
                  <div className="space-y-2">
                    <Label>Personality Traits</Label>
                    <Textarea
                      placeholder="Describe your assistant's personality traits, communication style, and approach to helping users..."
                      value={personaFormData.traits}
                      onChange={(e) => handlePersonaInputChange('traits', e.target.value)}
                      rows={4}
                    />
                    {personaFormErrors.traits && (
                      <p className="text-sm text-destructive">{personaFormErrors.traits}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Define how your assistant communicates and interacts with users
                    </p>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <Label>Detailed Instructions</Label>
                    <Textarea
                      placeholder="Provide specific instructions for how this assistant should behave, what it should focus on, and any special guidelines..."
                      value={personaFormData.instructions}
                      onChange={(e) => handlePersonaInputChange('instructions', e.target.value)}
                      rows={6}
                    />
                    {personaFormErrors.instructions && (
                      <p className="text-sm text-destructive">{personaFormErrors.instructions}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Detailed guidelines for how the assistant should operate
                    </p>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <Label>Response Creativity: {personaFormData.temperature?.toFixed(1)}</Label>
                    <Slider
                      value={[personaFormData.temperature || 0.7]}
                      onValueChange={(value) => handlePersonaInputChange('temperature', value[0])}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>More Focused</span>
                      <span>More Creative</span>
                    </div>
                  </div>

                  {/* Default Persona */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-default"
                      checked={personaFormData.is_default || false}
                      onCheckedChange={(checked) =>
                        handlePersonaInputChange('is_default', checked)
                      }
                    />
                    <Label htmlFor="is-default">Set as default persona</Label>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">AI Assistants</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your AI assistants and their personalities.
                </p>
              </div>
              <Button
                onClick={() => {
                  // Start editing with a new persona (not yet created)
                  setEditingPersona({
                    id: 'new', // Temporary ID for new persona
                    name: '',
                    temperature: 0.7,
                    is_default: false,
                  } as ClientPersona);
                  setPersonaFormData({
                    name: '',
                    traits: '',
                    instructions: '',
                    greeting: '',
                    agent_id: '',
                    model_id: '',
                    temperature: 0.7,
                    top_p: null,
                    is_default: false,
                  });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Assistant
              </Button>
            </div>

            {aiPersonas.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No AI assistants yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first AI assistant to get started with personalized calendar
                  management.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    // TODO: Implement create new assistant functionality
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Assistant
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {aiPersonas.map((persona: ClientPersona) => {
                  const initials = persona.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  const traitsPreview = persona.traits
                    ? persona.traits.split('\n').slice(0, 3).join('\n') +
                      (persona.traits.split('\n').length > 3 ? '...' : '')
                    : 'No traits defined';

                  return (
                    <Card
                      key={persona.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        startEditingPersona(persona);
                      }}
                    >
                      <CardContent className="px-4 py-2">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage
                              src={getAvatarUrl(persona.avatar_url) || undefined}
                              alt={persona.name}
                            />
                            <AvatarFallback className="text-sm font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium truncate">{persona.name}</h4>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Memories view disabled for now
                                  }}
                                  title="View memories (disabled)"
                                  disabled
                                >
                                  <Brain className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!user?.id) return;
                                    try {
                                      await deleteAIPersona(user.id, persona.id);
                                      toast.success('AI persona deleted successfully');
                                    } catch (error) {
                                      console.error('Failed to delete persona:', error);
                                      const errorMessage = error instanceof Error ? error.message : 'Failed to delete persona';
                                      toast.error(errorMessage);
                                    }
                                  }}
                                  disabled={aiPersonas.length <= 1}
                                  title={aiPersonas.length <= 1 ? "Cannot delete your last persona" : "Delete persona"}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                              {traitsPreview}
                            </p>
                            {persona.is_default && (
                              <div className="mt-2">
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                  Default
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{activeItem?.name} Settings</h3>
              <p className="text-sm text-muted-foreground">
                Settings for {activeItem?.name.toLowerCase()} will be available soon.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">This settings section is coming soon.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[80vh] md:max-w-[900px] lg:max-w-[1000px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your calendar settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {settingsData.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeSection === item.key}
                          onClick={() => setActiveSection(item.key)}
                        >
                          <button>
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex flex-1 flex-col overflow-hidden min-h-0 h-[80vh]">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-8">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      {editingPersona ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (editingPersona) {
                              cancelEditingPersona();
                            }
                          }}
                        >
                          AI Personas
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{activeItem?.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {editingPersona && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>{editingPersona.name}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col gap-4 p-8 pt-0">{renderSettingsContent()}</div>
            </ScrollArea>
            {(activeSection === 'profile' ||
              activeSection === 'dates-times' ||
              activeSection === 'work-schedule' ||
              activeSection === 'calendar' ||
              editingPersona) && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingPersona) {
                      cancelEditingPersona();
                    } else {
                      onOpenChange(false);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingPersona) {
                      savePersona();
                    } else if (activeSection === 'work-schedule') {
                      workScheduleSaveHandlerRef.current?.();
                    } else if (activeSection === 'dates-times') {
                      handleProfileSave(); // Calendar settings are saved to profile
                    } else {
                      handleProfileSave();
                    }
                  }}
                  disabled={
                    editingPersona
                      ? savingPersona
                      : activeSection === 'work-schedule'
                        ? !workScheduleHasChanges
                        : isSavingProfile
                  }
                >
                  {(editingPersona ? savingPersona : isSavingProfile) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </footer>
            )}
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

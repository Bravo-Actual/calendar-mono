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

const assistantSchema = z
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

type AssistantFormValues = z.infer<typeof assistantSchema>;

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

  // AI Assistants hooks
  const aiAssistants = useAIPersonas(user?.id) || [];
  const isLoading = !aiAssistants && !!user?.id; // Loading if user exists but no data yet

  // AI Agents hook
  const { data: agents = [], isLoading: agentsLoading } = useAIAgents();

  // Assistant editing state
  const [editingAssistant, setEditingAssistant] = useState<ClientPersona | null>(null);
  const [assistantFormData, setAssistantFormData] = useState<AssistantFormValues>({
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
  const [assistantFormErrors, setAssistantFormErrors] = useState<Record<string, string>>({});
  const [assistantAvatarPreview, setAssistantAvatarPreview] = useState<string | null>(null);
  const [savingAssistant, setSavingAssistant] = useState(false);
  const [isDeletingAssistantAvatar, setIsDeletingAssistantAvatar] = useState(false);

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

  // Assistant editing functions
  const startEditingAssistant = (assistant: ClientPersona) => {
    setEditingAssistant(assistant);
    setAssistantFormData({
      name: assistant.name,
      traits: assistant.traits || '',
      instructions: assistant.instructions || '',
      greeting: assistant.greeting || '',
      agent_id: assistant.agent_id || '',
      model_id: assistant.model_id || '',
      temperature: assistant.temperature || 0.7,
      top_p: assistant.top_p || null,
      is_default: assistant.is_default || false,
    });
    setAssistantFormErrors({});
    setAssistantAvatarPreview(null);
  };

  const cancelEditingAssistant = () => {
    setEditingAssistant(null);
    setAssistantFormData({
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
    setAssistantFormErrors({});
    setAssistantAvatarPreview(null);
  };

  const handleAssistantInputChange = (
    field: keyof AssistantFormValues,
    value: string | number | boolean
  ) => {
    setAssistantFormData((prev) => ({ ...prev, [field]: value }));
    if (assistantFormErrors[field]) {
      setAssistantFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleAssistantAvatarChange = async (imageBlob: Blob) => {
    if (!user?.id) return;

    // Set preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setAssistantAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(imageBlob);

    // Check if this is a new persona (not yet created)
    if (!editingAssistant?.id || editingAssistant.id === 'new') {
      // Show alert dialog for new personas
      setAssistantAvatarPreview(null);
      toast.error('Please create and save the persona first before adding an avatar');
      return;
    }

    // Upload avatar for existing personas using v2 function
    try {
      const avatarUrl = await uploadAIPersonaAvatar(user.id, editingAssistant.id, imageBlob);

      // Update the form data with the new avatar URL (relative path)
      setAssistantFormData((prev) => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');

      // Reset preview on error
      setAssistantAvatarPreview(null);
    }
  };

  const validateAssistantForm = () => {
    try {
      assistantSchema.parse(assistantFormData);
      setAssistantFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setAssistantFormErrors(newErrors);
      }
      return false;
    }
  };

  const saveAssistant = async () => {
    if (!validateAssistantForm() || !editingAssistant) {
      return;
    }

    setSavingAssistant(true);

    // Check if this is a new assistant
    const isNewAssistant = editingAssistant.id === 'new';

    // Prepare data - avatar upload is handled separately
    const assistantData = { ...assistantFormData };

    // Use v2 async functions with try/catch
    try {
      if (!user?.id) return;

      if (isNewAssistant) {
        await createAIPersona(user.id, assistantData);
      } else {
        await updateAIPersona(user.id, editingAssistant.id, assistantData);
      }

      cancelEditingAssistant();
      setSavingAssistant(false);
      toast.success(
        isNewAssistant ? 'AI assistant created successfully' : 'AI assistant updated successfully'
      );
    } catch (error) {
      console.error('Failed to save assistant:', error);
      setSavingAssistant(false);
      toast.error('Failed to save assistant');
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

  const handleAssistantAvatarDelete = async () => {
    if (!user?.id || !editingAssistant?.id || editingAssistant.id === 'new') return;

    try {
      // Set deleting state and clear preview immediately for instant UI feedback
      setIsDeletingAssistantAvatar(true);
      setAssistantAvatarPreview(null);

      // Delete using v2 function (handles offline-first via outbox)
      await deleteAIPersonaAvatar(user.id, editingAssistant.id, editingAssistant.avatar_url);

      // Update the form data to clear the avatar URL
      setAssistantFormData((prev) => ({ ...prev, avatar_url: null }));
      toast.success('Avatar deleted successfully');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeletingAssistantAvatar(false);
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
        const currentAvatar = isDeletingAvatar ? null : (avatarPreview || profile?.avatar_url || null);

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

        // Show edit form if editing an assistant
        if (editingAssistant) {
          // Get fresh data from live query instead of stale editingAssistant
          const liveAssistant = aiAssistants.find(a => a.id === editingAssistant.id) || editingAssistant;
          const currentAvatar = isDeletingAssistantAvatar ? null : (assistantAvatarPreview || liveAssistant.avatar_url || null);
          const initials = editingAssistant.name
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

              {assistantFormErrors.general && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{assistantFormErrors.general}</p>
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
                    disabled={!editingAssistant?.id || editingAssistant.id === 'new'}
                    disabledMessage="Please create and save the persona first before adding an avatar"
                    isUploading={savingAssistant}
                    onImageChange={handleAssistantAvatarChange}
                    onImageDelete={handleAssistantAvatarDelete}
                    maxSizeMB={5}
                    acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                    alt={assistantFormData.name}
                  />
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-6">
                  {/* Assistant Name */}
                  <div className="space-y-2">
                    <Label>Assistant Name *</Label>
                    <Input
                      placeholder="e.g., Maya the Calendar Expert"
                      value={assistantFormData.name}
                      onChange={(e) => handleAssistantInputChange('name', e.target.value)}
                    />
                    {assistantFormErrors.name && (
                      <p className="text-sm text-destructive">{assistantFormErrors.name}</p>
                    )}
                  </div>

                  {/* AI Agent */}
                  <div className="space-y-2">
                    <Label>AI Agent *</Label>
                    <Select
                      value={assistantFormData.agent_id}
                      onValueChange={(value) => handleAssistantInputChange('agent_id', value)}
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
                    {assistantFormErrors.agent_id && (
                      <p className="text-sm text-destructive">{assistantFormErrors.agent_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Choose the Mastra agent that will handle this assistant&apos;s logic
                    </p>
                  </div>

                  {/* AI Model */}
                  <div className="space-y-2">
                    <Label>AI Model</Label>
                    <ModelSelector
                      value={assistantFormData.model_id || ''}
                      onValueChange={(value) => handleAssistantInputChange('model_id', value)}
                      placeholder="Select an AI model..."
                      className="w-full"
                    />
                    {assistantFormErrors.model_id && (
                      <p className="text-sm text-destructive">{assistantFormErrors.model_id}</p>
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
                      value={assistantFormData.greeting}
                      onChange={(e) => handleAssistantInputChange('greeting', e.target.value)}
                      rows={2}
                    />
                    {assistantFormErrors.greeting && (
                      <p className="text-sm text-destructive">{assistantFormErrors.greeting}</p>
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
                      value={assistantFormData.traits}
                      onChange={(e) => handleAssistantInputChange('traits', e.target.value)}
                      rows={4}
                    />
                    {assistantFormErrors.traits && (
                      <p className="text-sm text-destructive">{assistantFormErrors.traits}</p>
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
                      value={assistantFormData.instructions}
                      onChange={(e) => handleAssistantInputChange('instructions', e.target.value)}
                      rows={6}
                    />
                    {assistantFormErrors.instructions && (
                      <p className="text-sm text-destructive">{assistantFormErrors.instructions}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Detailed guidelines for how the assistant should operate
                    </p>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <Label>Response Creativity: {assistantFormData.temperature?.toFixed(1)}</Label>
                    <Slider
                      value={[assistantFormData.temperature || 0.7]}
                      onValueChange={(value) => handleAssistantInputChange('temperature', value[0])}
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

                  {/* Default Assistant */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-default"
                      checked={assistantFormData.is_default || false}
                      onCheckedChange={(checked) =>
                        handleAssistantInputChange('is_default', checked)
                      }
                    />
                    <Label htmlFor="is-default">Set as default assistant</Label>
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
                  // Start editing with a new assistant (not yet created)
                  setEditingAssistant({
                    id: 'new', // Temporary ID for new assistant
                    name: '',
                    temperature: 0.7,
                    is_default: false,
                  } as ClientPersona);
                  setAssistantFormData({
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

            {aiAssistants.length === 0 ? (
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
                {aiAssistants.map((assistant: ClientPersona) => {
                  const initials = assistant.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  const traitsPreview = assistant.traits
                    ? assistant.traits.split('\n').slice(0, 3).join('\n') +
                      (assistant.traits.split('\n').length > 3 ? '...' : '')
                    : 'No traits defined';

                  return (
                    <Card
                      key={assistant.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        startEditingAssistant(assistant);
                      }}
                    >
                      <CardContent className="px-4 py-2">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage
                              src={getAvatarUrl(assistant.avatar_url) || undefined}
                              alt={assistant.name}
                            />
                            <AvatarFallback className="text-sm font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium truncate">{assistant.name}</h4>
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
                                      await deleteAIPersona(user.id, assistant.id);
                                      toast.success('AI assistant deleted successfully');
                                    } catch (error) {
                                      console.error('Failed to delete assistant:', error);
                                      toast.error('Failed to delete assistant');
                                    }
                                  }}
                                  title="Delete assistant"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                              {traitsPreview}
                            </p>
                            {assistant.is_default && (
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
                      {editingAssistant ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (editingAssistant) {
                              cancelEditingAssistant();
                            }
                          }}
                        >
                          AI Assistants
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{activeItem?.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {editingAssistant && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>{editingAssistant.name}</BreadcrumbPage>
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
              editingAssistant) && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingAssistant) {
                      cancelEditingAssistant();
                    } else {
                      onOpenChange(false);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingAssistant) {
                      saveAssistant();
                    } else if (activeSection === 'work-schedule') {
                      workScheduleSaveHandlerRef.current?.();
                    } else if (activeSection === 'dates-times') {
                      handleProfileSave(); // Calendar settings are saved to profile
                    } else {
                      handleProfileSave();
                    }
                  }}
                  disabled={
                    editingAssistant
                      ? savingAssistant
                      : activeSection === 'work-schedule'
                        ? !workScheduleHasChanges
                        : isSavingProfile
                  }
                >
                  {(editingAssistant ? savingAssistant : isSavingProfile) && (
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

'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteUserProfileAvatar,
  updateUserProfile,
  uploadUserProfileAvatar,
  useUserProfile,
} from '@/lib/data-v2';
import { AvatarManager } from '../avatar-manager/avatar-manager';

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
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileSettingsProps {
  onHasChanges?: (hasChanges: boolean) => void;
  onSaveHandler?: (saveHandler: (() => void) | null) => void;
}

export function ProfileSettings({ onHasChanges, onSaveHandler }: ProfileSettingsProps) {
  const { user } = useAuth();
  const profile = useUserProfile(user?.id);
  const profileLoading = !profile && !!user?.id;

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

  const [formData, setFormData] = useState<ProfileFormValues>({
    first_name: '',
    last_name: '',
    display_name: '',
    title: '',
    organization: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        title: profile.title || '',
        organization: profile.organization || '',
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    onHasChanges?.(true);
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

  const handleSave = async () => {
    if (!validateForm() || !user?.id) {
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(user.id, formData);
      setAvatarPreview(null);
      onHasChanges?.(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (imageBlob: Blob) => {
    if (!user?.id) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(imageBlob);

      await uploadUserProfileAvatar(user.id, imageBlob);
      toast.success('Profile avatar updated');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setAvatarPreview(null);
      toast.error('Failed to upload avatar');
    }
  };

  const handleAvatarDelete = async () => {
    if (!user?.id) return;

    try {
      setIsDeletingAvatar(true);
      setAvatarPreview(null);

      await deleteUserProfileAvatar(user.id, profile?.avatar_url);
      toast.success('Profile avatar deleted');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  // Expose save handler to parent
  useEffect(() => {
    onSaveHandler?.(handleSave);
    return () => onSaveHandler?.(null);
  }, [handleSave, onSaveHandler]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const displayName = profile?.display_name || `${firstName} ${lastName}`.trim() || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const currentAvatar = isDeletingAvatar ? null : avatarPreview || profile?.avatar_url || null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">Update your profile information and avatar.</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <AvatarManager
            src={currentAvatar}
            fallback={<span className="text-lg">{initials}</span>}
            size={96}
            variant="circle"
            isUploading={isSaving}
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
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                placeholder="Doe"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
              />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
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

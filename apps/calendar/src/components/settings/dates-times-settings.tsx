'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile, useUserProfile } from '@/lib/data-v2';
import { TimezoneSelector } from './timezone-selector';

const datesTimesSchema = z.object({
  timezone: z.string().min(1, 'Timezone is required'),
  time_format: z.enum(['12_hour', '24_hour']),
  week_start_day: z.enum(['0', '1', '2', '3', '4', '5', '6']),
});

type DatesTimesFormValues = z.infer<typeof datesTimesSchema>;

interface DatesTimesSettingsProps {
  onHasChanges?: (hasChanges: boolean) => void;
  onSaveHandler?: (saveHandler: (() => void) | null) => void;
}

export function DatesTimesSettings({ onHasChanges, onSaveHandler }: DatesTimesSettingsProps) {
  const { user } = useAuth();
  const profile = useUserProfile(user?.id);
  const profileLoading = !profile && !!user?.id;

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<DatesTimesFormValues>({
    timezone: 'UTC',
    time_format: '12_hour',
    week_start_day: '0',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        timezone: profile.timezone || 'UTC',
        time_format: (profile.time_format as '12_hour' | '24_hour') || '12_hour',
        week_start_day: (profile.week_start_day as '0' | '1' | '2' | '3' | '4' | '5' | '6') || '0',
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
      datesTimesSchema.parse(formData);
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
      onHasChanges?.(false);
      toast.success('Dates & times updated successfully');
    } catch (error) {
      console.error('Failed to update dates & times:', error);
      toast.error('Failed to update dates & times');
    } finally {
      setIsSaving(false);
    }
  };

  // Expose save handler to parent
  useEffect(() => {
    onSaveHandler?.(handleSave);
    return () => onSaveHandler?.(null);
  }, [formData, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {errors.time_format && <p className="text-sm text-destructive">{errors.time_format}</p>}
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
}

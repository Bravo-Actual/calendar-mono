"use client";

import { useState, useEffect } from "react";
import * as z from "zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useUpdateProfile } from "@/hooks/use-update-profile";
import { useAppStore } from "@/store/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  display_name: z.string().max(100, "Display name must be less than 100 characters").optional(),
  title: z.string().max(100, "Title must be less than 100 characters").optional(),
  organization: z.string().max(100, "Organization must be less than 100 characters").optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileModal() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile(user?.id);
  const { profileModalOpen, setProfileModalOpen } = useAppStore();
  const updateProfile = useUpdateProfile(user?.id || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    title: "",
    organization: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        display_name: profile.display_name || "",
        title: profile.title || "",
        organization: profile.organization || "",
      });
    }
  }, [profile]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
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
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Update optimistically (UI updates immediately)
    updateProfile.mutate({
      ...formData,
      avatarFile: avatarFile || undefined,
    });

    // Reset avatar state
    setAvatarFile(null);
    setAvatarPreview(null);

    // Close modal immediately (optimistic)
    setProfileModalOpen(false);
  };

  // Generate display name and initials (avoid form.watch to prevent re-renders)
  const firstName = profile?.first_name || "";
  const lastName = profile?.last_name || "";
  const displayName = profile?.display_name || `${firstName} ${lastName}`.trim() || "User";
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const currentAvatar = avatarPreview || profile?.avatar_url || "";

  if (isLoading) {
    return (
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          console.log("Pointer down outside modal");
        }}
        onEscapeKeyDown={(e) => {
          console.log("Escape key in modal");
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Your email address cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={currentAvatar} alt={displayName} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <Label
                htmlFor="avatar-upload"
                className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-4 w-4" />
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </Label>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Click the camera icon to upload a new avatar</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email address is managed through your account settings
            </p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                placeholder="John"
                value={formData.first_name}
                onChange={(e) => handleInputChange("first_name", e.target.value)}
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
                onChange={(e) => handleInputChange("last_name", e.target.value)}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              placeholder="Display name (optional)"
              value={formData.display_name}
              onChange={(e) => handleInputChange("display_name", e.target.value)}
            />
            {errors.display_name && (
              <p className="text-sm text-destructive">{errors.display_name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to use your first and last name
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Software Engineer"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <Label>Organization</Label>
            <Input
              placeholder="Acme Corp"
              value={formData.organization}
              onChange={(e) => handleInputChange("organization", e.target.value)}
            />
            {errors.organization && (
              <p className="text-sm text-destructive">{errors.organization}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfileModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  );
}
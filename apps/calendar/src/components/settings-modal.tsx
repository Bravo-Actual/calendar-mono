"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import * as z from "zod"
import {
  Bell,
  Calendar,
  Globe,
  Home,
  Keyboard,
  Palette,
  Settings,
  Shield,
  Tag,
  User,
  Zap,
  Loader2,
} from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EventCategoriesSettings } from "./event-categories-settings"
import { AvatarManager } from "./avatar-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/store/app"
import { useAuth } from "@/contexts/AuthContext"
import { useUserProfile } from "@/hooks/use-user-profile"
import { useUpdateProfile } from "@/hooks/use-update-profile"

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  display_name: z.string().max(100, "Display name must be less than 100 characters").optional(),
  title: z.string().max(100, "Title must be less than 100 characters").optional(),
  organization: z.string().max(100, "Organization must be less than 100 characters").optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const settingsData = {
  nav: [
    { name: "Profile", icon: User, key: "profile" },
    { name: "Calendar", icon: Calendar, key: "calendar" },
    { name: "Categories", icon: Tag, key: "categories" },
    { name: "Notifications", icon: Bell, key: "notifications" },
    { name: "Appearance", icon: Palette, key: "appearance" },
    { name: "Language & region", icon: Globe, key: "language" },
    { name: "Accessibility", icon: Keyboard, key: "accessibility" },
    { name: "AI Assistant", icon: Zap, key: "ai" },
    { name: "Privacy & Security", icon: Shield, key: "privacy" },
    { name: "Advanced", icon: Settings, key: "advanced" },
  ],
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id)
  const updateProfile = useUpdateProfile(user?.id || '')
  const [activeSection, setActiveSection] = React.useState("profile")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Profile form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    title: "",
    organization: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        display_name: profile.display_name || "",
        title: profile.title || "",
        organization: profile.organization || "",
      })
    }
  }, [profile])

  const handleAvatarChange = (imageBlob: Blob) => {
    const file = new File([imageBlob], 'avatar.jpg', { type: 'image/jpeg' })
    setAvatarFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(imageBlob)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    try {
      profileSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleProfileSave = async () => {
    if (!validateForm()) {
      return
    }

    updateProfile.mutate({
      ...formData,
      avatarFile: avatarFile || undefined,
    })

    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const activeItem = settingsData.nav.find(item => item.key === activeSection)

  const renderSettingsContent = () => {
    switch (activeSection) {
      case "profile":
        if (profileLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )
        }

        // Generate display name and initials
        const firstName = profile?.first_name || ""
        const lastName = profile?.last_name || ""
        const displayName = profile?.display_name || `${firstName} ${lastName}`.trim() || "User"
        const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        const currentAvatar = avatarPreview || profile?.avatar_url || ""

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Profile Settings</h3>
              <p className="text-sm text-muted-foreground">
                Update your profile information and avatar.
              </p>
            </div>

            <div className="space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4">
                <AvatarManager
                  src={currentAvatar}
                  fallback={<span className="text-lg">{initials}</span>}
                  size={96}
                  variant="circle"
                  isUploading={updateProfile.isPending}
                  onImageChange={handleAvatarChange}
                  maxSizeMB={5}
                  acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                  alt={displayName}
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Click the avatar or camera icon to upload a new photo</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP up to 5MB</p>
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

            </div>
          </div>
        )

      case "calendar":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Calendar Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure your calendar view, defaults, and behavior.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Default View</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose your preferred calendar view and time range.
                </p>
                <Button variant="outline">Configure View</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Event Categories</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Create and manage custom event categories and colors.
                </p>
                <Button variant="outline">Manage Categories</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Working Hours</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Set your default working hours and availability.
                </p>
                <Button variant="outline">Set Hours</Button>
              </div>
            </div>
          </div>
        )

      case "categories":
        return <EventCategoriesSettings />

      case "notifications":
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
        )

      case "appearance":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Appearance Settings</h3>
              <p className="text-sm text-muted-foreground">
                Customize the look and feel of your calendar.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Theme</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose between light, dark, or system theme.
                </p>
                <Button variant="outline">Change Theme</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Color Scheme</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize accent colors and calendar styling.
                </p>
                <Button variant="outline">Customize Colors</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Density</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust the spacing and density of calendar items.
                </p>
                <Button variant="outline">Adjust Density</Button>
              </div>
            </div>
          </div>
        )

      case "ai":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">AI Assistant Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure your AI assistant preferences and behavior.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Smart Scheduling</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Let AI suggest optimal meeting times and detect conflicts.
                </p>
                <Button variant="outline">Configure AI</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Auto-categorization</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically categorize events based on content and patterns.
                </p>
                <Button variant="outline">Enable Auto-categorization</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Time Suggestions</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Get AI-powered suggestions for free time slots.
                </p>
                <Button variant="outline">Configure Suggestions</Button>
              </div>
            </div>
          </div>
        )

      case "privacy":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Privacy & Security</h3>
              <p className="text-sm text-muted-foreground">
                Manage your privacy settings and security preferences.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Data Sharing</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Control how your calendar data is shared with others.
                </p>
                <Button variant="outline">Manage Sharing</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Calendar Visibility</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Set default privacy levels for new events.
                </p>
                <Button variant="outline">Set Privacy</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Account Security</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your account security and authentication.
                </p>
                <Button variant="outline">Security Settings</Button>
              </div>
            </div>
          </div>
        )

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
              <p className="text-sm text-muted-foreground">
                This settings section is coming soon.
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[900px] lg:max-w-[1000px]">
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
          <main className="flex h-[500px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeItem?.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              {renderSettingsContent()}
            </div>
            {activeSection === "profile" && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProfileSave}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending && (
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
  )
}
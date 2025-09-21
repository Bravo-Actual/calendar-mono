"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import * as z from "zod"
import {
  Bell,
  Calendar,
  Globe,
  Tag,
  User,
  Zap,
  Loader2,
  ChevronRight,
  Plus,
  Trash2,
  Brain,
  ArrowLeft,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModelSelector } from "@/components/model-selector"
import { TimezoneSelector } from "@/components/timezone-selector"
import { EventCategoriesSettings } from "./event-categories-settings"
import { AvatarManager } from "./avatar-manager"
import { useAIPersonas, type AIPersona } from "@/hooks/use-ai-personas"
import { useAIAgents } from "@/hooks/use-ai-agents"
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
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { MemoriesView } from "./memories-view"

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  display_name: z.string().max(100, "Display name must be less than 100 characters").optional(),
  title: z.string().max(100, "Title must be less than 100 characters").optional(),
  organization: z.string().max(100, "Organization must be less than 100 characters").optional(),
  timezone: z.string().min(1, "Timezone is required"),
  time_format: z.enum(["12_hour", "24_hour"]),
  week_start_day: z.enum(["0", "1", "2", "3", "4", "5", "6"]),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const assistantSchema = z.object({
  name: z.string().min(1, "Assistant name is required").max(100, "Name must be less than 100 characters"),
  traits: z.string().max(2500, "Traits must be less than 2500 characters").optional(),
  instructions: z.string().max(5000, "Instructions must be less than 5000 characters").optional(),
  greeting: z.string().max(500, "Greeting must be less than 500 characters").optional(),
  agent_id: z.string().min(1, "Agent is required"),
  model_id: z.string().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  top_p: z.number().min(0).max(1).nullable().optional(),
  is_default: z.boolean().optional(),
  avatar_url: z.string().optional(),
}).refine(
  (data) => {
    // Either temperature OR top_p should be set, but not both
    const hasTemp = data.temperature !== null && data.temperature !== undefined;
    const hasTopP = data.top_p !== null && data.top_p !== undefined;
    return hasTemp !== hasTopP; // XOR - exactly one should be true
  },
  {
    message: "Either temperature OR top_p should be set, but not both",
    path: ["temperature"], // Show error on temperature field
  }
)

type AssistantFormValues = z.infer<typeof assistantSchema>


const settingsData = {
  nav: [
    { name: "Profile", icon: User, key: "profile" },
    { name: "Calendar", icon: Calendar, key: "calendar" },
    { name: "Categories", icon: Tag, key: "categories" },
    { name: "Notifications", icon: Bell, key: "notifications" },
    { name: "Language & region", icon: Globe, key: "language" },
    { name: "AI Assistant", icon: Zap, key: "ai" },
  ],
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id)
  const updateProfile = useUpdateProfile(user?.id || '')
  const { setWeekStartDay, setTimezone, setTimeFormat } = useAppStore()
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
    timezone: "UTC",
    time_format: "12_hour" as "12_hour" | "24_hour",
    week_start_day: "0" as "0" | "1" | "2" | "3" | "4" | "5" | "6",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // AI Assistants hook
  const {
    personas: aiAssistants,
    isLoading: assistantsLoading,
    error: assistantsError,
    updatePersona,
    createPersona,
    deletePersona,
    uploadAvatar,
    isDeleting
  } = useAIPersonas()

  // AI Agents hook
  const { data: agents = [], isLoading: agentsLoading } = useAIAgents()

  // Assistant editing state
  const [editingAssistant, setEditingAssistant] = useState<AIPersona | null>(null)
  // Assistant memories state
  const [viewingMemories, setViewingMemories] = useState<AIPersona | null>(null)
  const [assistantFormData, setAssistantFormData] = useState<AssistantFormValues>({
    name: "",
    traits: "",
    instructions: "",
    greeting: "",
    agent_id: "",
    model_id: "",
    temperature: 0.7,
    top_p: null,
    is_default: false,
  })
  const [assistantFormErrors, setAssistantFormErrors] = useState<Record<string, string>>({})
  const [assistantAvatarFile, setAssistantAvatarFile] = useState<File | null>(null)
  const [assistantAvatarPreview, setAssistantAvatarPreview] = useState<string | null>(null)
  const [savingAssistant, setSavingAssistant] = useState(false)

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        display_name: profile.display_name || "",
        title: profile.title || "",
        organization: profile.organization || "",
        timezone: profile.timezone || "UTC",
        time_format: (profile.time_format as "12_hour" | "24_hour") || "12_hour",
        week_start_day: (profile.week_start_day as "0" | "1" | "2" | "3" | "4" | "5" | "6") || "0",
      })
    }
  }, [profile])



  // Assistant editing functions
  const startEditingAssistant = (assistant: AIPersona) => {
    setEditingAssistant(assistant)
    setAssistantFormData({
      name: assistant.name,
      traits: assistant.traits || "",
      instructions: assistant.instructions || "",
      greeting: assistant.greeting || "",
      agent_id: assistant.agent_id || "",
      model_id: assistant.model_id || "",
      temperature: assistant.temperature || 0.7,
      top_p: assistant.top_p || null,
      is_default: assistant.is_default,
    })
    setAssistantFormErrors({})
    setAssistantAvatarFile(null)
    setAssistantAvatarPreview(null)
  }

  const cancelEditingAssistant = () => {
    setEditingAssistant(null)
    setAssistantFormData({
      name: "",
      traits: "",
      instructions: "",
      greeting: "",
      agent_id: "",
      model_id: "",
      temperature: 0.7,
      top_p: null,
      is_default: false,
    })
    setAssistantFormErrors({})
    setAssistantAvatarFile(null)
    setAssistantAvatarPreview(null)
  }

  const cancelViewingMemories = () => {
    setViewingMemories(null)
  }

  const handleAssistantInputChange = (field: keyof AssistantFormValues, value: string | number | boolean) => {
    setAssistantFormData(prev => ({ ...prev, [field]: value }))
    if (assistantFormErrors[field]) {
      setAssistantFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleAssistantAvatarChange = async (imageBlob: Blob) => {
    const file = new File([imageBlob], 'assistant-avatar.jpg', { type: 'image/jpeg' })
    setAssistantAvatarFile(file)

    // Set preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setAssistantAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(imageBlob)

    // Upload avatar immediately
    try {
      const { publicUrl } = await uploadAvatar(file)

      // Update the form data with the new avatar URL
      setAssistantFormData(prev => ({ ...prev, avatar_url: publicUrl }))
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Failed to upload avatar')

      // Reset preview on error
      setAssistantAvatarFile(null)
      setAssistantAvatarPreview(null)
    }
  }

  const validateAssistantForm = () => {
    try {
      assistantSchema.parse(assistantFormData)
      setAssistantFormErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message
          }
        })
        setAssistantFormErrors(newErrors)
      }
      return false
    }
  }

  const saveAssistant = async () => {
    if (!validateAssistantForm() || !editingAssistant) {
      return
    }

    setSavingAssistant(true)

    // Check if this is a new assistant
    const isNewAssistant = editingAssistant.id === 'new'

    // Prepare data - avatar upload is handled separately
    const assistantData = { ...assistantFormData }

    // Use TanStack Query mutations - they handle success/error via their callbacks
    if (isNewAssistant) {
      createPersona(assistantData, {
        onSuccess: () => {
          cancelEditingAssistant()
          setSavingAssistant(false)
        },
        onError: () => {
          setSavingAssistant(false)
        }
      })
    } else {
      updatePersona({
        id: editingAssistant.id,
        ...assistantData
      }, {
        onSuccess: () => {
          cancelEditingAssistant()
          setSavingAssistant(false)
        },
        onError: () => {
          setSavingAssistant(false)
        }
      })
    }
  }

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
        error.issues.forEach(err => {
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
    }, {
      onSuccess: () => {
        // Sync updated settings to app store
        if (formData.week_start_day) {
          setWeekStartDay(parseInt(formData.week_start_day) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
        }
        if (formData.timezone) {
          setTimezone(formData.timezone)
        }
        if (formData.time_format) {
          setTimeFormat(formData.time_format)
        }
      }
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

            <div className="flex gap-6 items-start">
              {/* Avatar */}
              <div className="flex flex-col items-center">
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
          </div>
        )

      case "calendar":
        if (profileLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )
        }

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Calendar Settings</h3>
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
                  onValueChange={(value) => handleInputChange("timezone", value)}
                  placeholder="Select your timezone..."
                  className="w-full"
                  timeFormat={formData.time_format}
                />
                {errors.timezone && (
                  <p className="text-sm text-destructive">{errors.timezone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  This timezone will be used for displaying times and scheduling events
                </p>
              </div>

              {/* Time Format */}
              <div className="space-y-2">
                <Label>Time Format</Label>
                <Select
                  value={formData.time_format}
                  onValueChange={(value) => handleInputChange("time_format", value)}
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
                  onValueChange={(value) => handleInputChange("week_start_day", value)}
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


      case "ai":
        if (assistantsLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )
        }

        if (assistantsError) {
          return (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">AI Assistants</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your AI assistants and their personalities.
                </p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{assistantsError?.message || 'Failed to load assistants'}</p>
              </div>
            </div>
          )
        }

        // Show edit form if editing an assistant
        if (editingAssistant) {
          const currentAvatar = assistantAvatarPreview || editingAssistant.avatar_url || ""
          const initials = editingAssistant.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)

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
                    isUploading={savingAssistant}
                    onImageChange={handleAssistantAvatarChange}
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
                      onChange={(e) => handleAssistantInputChange("name", e.target.value)}
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
                      onValueChange={(value) => handleAssistantInputChange("agent_id", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an AI agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {agentsLoading ? (
                          <SelectItem value="" disabled>Loading agents...</SelectItem>
                        ) : agents.length === 0 ? (
                          <SelectItem value="" disabled>No agents available</SelectItem>
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
                      value={assistantFormData.model_id || ""}
                      onValueChange={(value) => handleAssistantInputChange("model_id", value)}
                      placeholder="Select an AI model..."
                      className="w-full"
                    />
                    {assistantFormErrors.model_id && (
                      <p className="text-sm text-destructive">{assistantFormErrors.model_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Choose the AI model that will power this assistant (optional, can be set by agent)
                    </p>
                  </div>

                  {/* Greeting Message */}
                  <div className="space-y-2">
                    <Label>Greeting Message</Label>
                    <Textarea
                      placeholder="Hi! I'm here to help you manage your calendar effectively..."
                      value={assistantFormData.greeting}
                      onChange={(e) => handleAssistantInputChange("greeting", e.target.value)}
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
                      onChange={(e) => handleAssistantInputChange("traits", e.target.value)}
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
                      onChange={(e) => handleAssistantInputChange("instructions", e.target.value)}
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
                      onValueChange={(value) => handleAssistantInputChange("temperature", value[0])}
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
                      onCheckedChange={(checked) => handleAssistantInputChange("is_default", checked)}
                    />
                    <Label htmlFor="is-default">Set as default assistant</Label>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        // Show memories view if viewing memories for an assistant
        if (viewingMemories) {
          return <MemoriesView assistant={viewingMemories} onBack={cancelViewingMemories} />
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
              <Button onClick={() => {
                // Start editing with a new assistant (not yet created)
                setEditingAssistant({
                  id: 'new', // Temporary ID for new assistant
                  name: '',
                  temperature: 0.7,
                  is_default: false
                } as AIPersona)
                setAssistantFormData({
                  name: '',
                  traits: '',
                  instructions: '',
                  greeting: '',
                  agent_id: '',
                  model_id: '',
                  temperature: 0.7,
                  top_p: null,
                  is_default: false
                })
              }}>
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
                  Create your first AI assistant to get started with personalized calendar management.
                </p>
                <Button className="mt-4" onClick={() => {
                  // TODO: Implement create new assistant functionality
                  console.log('Create first assistant clicked')
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Assistant
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {aiAssistants.map((assistant) => {
                  const initials = assistant.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  const traitsPreview = assistant.traits
                    ? assistant.traits.split('\n').slice(0, 3).join('\n') +
                      (assistant.traits.split('\n').length > 3 ? '...' : '')
                    : 'No traits defined'

                  return (
                    <Card
                      key={assistant.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        startEditingAssistant(assistant)
                      }}
                    >
                      <CardContent className="px-4 py-2">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={assistant.avatar_url || undefined} alt={assistant.name} />
                            <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
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
                                    e.stopPropagation()
                                    setViewingMemories(assistant)
                                  }}
                                  title="View memories"
                                >
                                  <Brain className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deletePersona(assistant.id)
                                  }}
                                  disabled={isDeleting}
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
                  )
                })}
              </div>
            )}
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
                      {editingAssistant || viewingMemories ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (editingAssistant) {
                              cancelEditingAssistant()
                            }
                            if (viewingMemories) {
                              cancelViewingMemories()
                            }
                          }}
                        >
                          AI Assistants
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{activeItem?.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {(editingAssistant || viewingMemories) && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>
                            {editingAssistant ? editingAssistant.name : `${viewingMemories?.name} Memories`}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col gap-4 p-8 pt-0">
                {renderSettingsContent()}
              </div>
            </ScrollArea>
            {(activeSection === "profile" || activeSection === "calendar" || editingAssistant) && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (editingAssistant) {
                      cancelEditingAssistant()
                    } else {
                      onOpenChange(false)
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingAssistant) {
                      saveAssistant()
                    } else if (activeSection === "calendar") {
                      handleProfileSave() // Calendar settings are saved to profile
                    } else {
                      handleProfileSave()
                    }
                  }}
                  disabled={editingAssistant ? savingAssistant : updateProfile.isPending}
                >
                  {(editingAssistant ? savingAssistant : updateProfile.isPending) && (
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
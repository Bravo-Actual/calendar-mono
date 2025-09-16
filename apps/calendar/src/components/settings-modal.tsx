"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import * as z from "zod"
import {
  Bell,
  Calendar,
  Globe,
  Home,
  Tag,
  User,
  Zap,
  Loader2,
  ChevronRight,
  Plus,
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
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
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
import { supabase } from "@/lib/supabase"

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  display_name: z.string().max(100, "Display name must be less than 100 characters").optional(),
  title: z.string().max(100, "Title must be less than 100 characters").optional(),
  organization: z.string().max(100, "Organization must be less than 100 characters").optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const assistantSchema = z.object({
  persona_name: z.string().min(1, "Assistant name is required").max(100, "Name must be less than 100 characters"),
  traits: z.string().max(2000, "Traits must be less than 2000 characters").optional(),
  instructions: z.string().max(5000, "Instructions must be less than 5000 characters").optional(),
  greeting: z.string().max(500, "Greeting must be less than 500 characters").optional(),
  temperature: z.number().min(0).max(2).optional(),
  is_default: z.boolean().optional(),
})

type AssistantFormValues = z.infer<typeof assistantSchema>

interface AiPersona {
  id: string
  user_id: string
  persona_name: string
  avatar_url?: string
  traits?: string
  instructions?: string
  greeting?: string
  temperature?: number
  is_default: boolean
  properties_ext?: Record<string, any>
  created_at: string
  updated_at: string
}

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

  // AI Assistants state
  const [aiAssistants, setAiAssistants] = useState<AiPersona[]>([])
  const [assistantsLoading, setAssistantsLoading] = useState(false)
  const [assistantsError, setAssistantsError] = useState<string | null>(null)

  // Assistant editing state
  const [editingAssistant, setEditingAssistant] = useState<AiPersona | null>(null)
  const [assistantFormData, setAssistantFormData] = useState<AssistantFormValues>({
    persona_name: "",
    traits: "",
    instructions: "",
    greeting: "",
    temperature: 0.7,
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
      })
    }
  }, [profile])

  // Load AI assistants when modal opens and user is available
  useEffect(() => {
    if (open && user?.id && activeSection === "ai") {
      loadAiAssistants()
    }
  }, [open, user?.id, activeSection])

  const loadAiAssistants = async () => {
    if (!user?.id) return

    setAssistantsLoading(true)
    setAssistantsError(null)

    try {
      const { data, error } = await supabase
        .from('ai_personas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setAiAssistants(data || [])
    } catch (error) {
      console.error('Error loading AI assistants:', error)
      setAssistantsError('Failed to load AI assistants')
    } finally {
      setAssistantsLoading(false)
    }
  }

  // Assistant editing functions
  const startEditingAssistant = (assistant: AiPersona) => {
    setEditingAssistant(assistant)
    setAssistantFormData({
      persona_name: assistant.persona_name,
      traits: assistant.traits || "",
      instructions: assistant.instructions || "",
      greeting: assistant.greeting || "",
      temperature: assistant.temperature || 0.7,
      is_default: assistant.is_default,
    })
    setAssistantFormErrors({})
    setAssistantAvatarFile(null)
    setAssistantAvatarPreview(null)
  }

  const cancelEditingAssistant = () => {
    setEditingAssistant(null)
    setAssistantFormData({
      persona_name: "",
      traits: "",
      instructions: "",
      greeting: "",
      temperature: 0.7,
      is_default: false,
    })
    setAssistantFormErrors({})
    setAssistantAvatarFile(null)
    setAssistantAvatarPreview(null)
  }

  const handleAssistantInputChange = (field: keyof AssistantFormValues, value: any) => {
    setAssistantFormData(prev => ({ ...prev, [field]: value }))
    if (assistantFormErrors[field]) {
      setAssistantFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleAssistantAvatarChange = (imageBlob: Blob) => {
    const file = new File([imageBlob], 'assistant-avatar.jpg', { type: 'image/jpeg' })
    setAssistantAvatarFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setAssistantAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(imageBlob)
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

    try {
      // Prepare update data
      const updateData: any = { ...assistantFormData }

      // Handle avatar upload if there's a new file
      if (assistantAvatarFile) {
        try {
          const fileExt = assistantAvatarFile.name.split('.').pop()
          const fileName = `assistant-${editingAssistant.id}-${Math.random()}.${fileExt}`
          const filePath = `${user?.id}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, assistantAvatarFile, {
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            throw uploadError
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)

          updateData.avatar_url = publicUrl
        } catch (uploadError) {
          console.error('Avatar upload failed:', uploadError)
          setAssistantFormErrors({ general: 'Failed to upload avatar' })
          setSavingAssistant(false)
          return
        }
      }

      const { data, error } = await supabase
        .from('ai_personas')
        .update(updateData)
        .eq('id', editingAssistant.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Update the assistant in the local state
      setAiAssistants(prev =>
        prev.map(assistant =>
          assistant.id === editingAssistant.id ? { ...assistant, ...data } : assistant
        )
      )

      // Reset editing state
      cancelEditingAssistant()
    } catch (error) {
      console.error('Error saving assistant:', error)
      setAssistantFormErrors({ general: 'Failed to save assistant' })
    } finally {
      setSavingAssistant(false)
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
                <p className="text-sm text-destructive">{assistantsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={loadAiAssistants}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )
        }

        // Show edit form if editing an assistant
        if (editingAssistant) {
          const currentAvatar = assistantAvatarPreview || editingAssistant.avatar_url || ""
          const initials = editingAssistant.persona_name
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
                  Customize your AI assistant's personality and behavior.
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
                    alt={assistantFormData.persona_name}
                  />
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-6">
                  {/* Assistant Name */}
                  <div className="space-y-2">
                    <Label>Assistant Name *</Label>
                    <Input
                      placeholder="e.g., Maya the Calendar Expert"
                      value={assistantFormData.persona_name}
                      onChange={(e) => handleAssistantInputChange("persona_name", e.target.value)}
                    />
                    {assistantFormErrors.persona_name && (
                      <p className="text-sm text-destructive">{assistantFormErrors.persona_name}</p>
                    )}
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
                // TODO: Implement create new assistant functionality
                console.log('Create new assistant clicked')
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
                  const initials = assistant.persona_name
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
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => {
                        startEditingAssistant(assistant)
                      }}
                    >
                      <CardContent className="px-4 py-2">
                        <div className="flex items-start gap-4">
                          <AvatarManager
                            src={assistant.avatar_url}
                            fallback={<span className="text-sm font-medium">{initials}</span>}
                            size={48}
                            variant="circle"
                            disabled
                            alt={assistant.persona_name}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium truncate">{assistant.persona_name}</h4>
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                      {editingAssistant ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            cancelEditingAssistant()
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
                          <BreadcrumbPage>{editingAssistant.persona_name}</BreadcrumbPage>
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
            {(activeSection === "profile" || editingAssistant) && (
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
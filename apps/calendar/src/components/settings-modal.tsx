"use client"

import * as React from "react"
import {
  Bell,
  Calendar,
  Globe,
  Home,
  Keyboard,
  Palette,
  Settings,
  Shield,
  User,
  Zap,
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
import { useAppStore } from "@/store/app"

const settingsData = {
  nav: [
    { name: "Profile", icon: User, key: "profile" },
    { name: "Calendar", icon: Calendar, key: "calendar" },
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
  const [activeSection, setActiveSection] = React.useState("profile")

  const activeItem = settingsData.nav.find(item => item.key === activeSection)

  const renderSettingsContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Profile Settings</h3>
              <p className="text-sm text-muted-foreground">
                Manage your personal information and profile preferences.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Personal Information</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Update your name, email, and other basic information.
                </p>
                <Button variant="outline">Edit Profile</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Avatar</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Change your profile picture and avatar settings.
                </p>
                <Button variant="outline">Upload Photo</Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-2">Time Zone</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Set your default time zone for events and scheduling.
                </p>
                <Button variant="outline">Change Time Zone</Button>
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
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[900px] lg:max-w-[1000px]">
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
          <main className="flex h-[580px] flex-1 flex-col overflow-hidden">
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
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
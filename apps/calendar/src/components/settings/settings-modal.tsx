'use client';

import { Bell, Calendar, Clock, Globe, Tag, User, Zap } from 'lucide-react';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useAuth } from '@/contexts/AuthContext';
import { type ClientPersona, useUserProfile } from '@/lib/data-v2';
import { AIPersonasSettings } from './ai-personas-settings';
import { CalendarsAndCategoriesSettings } from './calendars-and-categories-settings';
import { DatesTimesSettings } from './dates-times-settings';
import { NotificationsSettings } from './notifications-settings';
import { ProfileSettings } from './profile-settings';
import { WorkScheduleSettings } from './work-schedule-settings';

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
  const [activeSection, setActiveSection] = React.useState('profile');
  const [editingPersona, setEditingPersona] = useState<ClientPersona | null>(null);

  // Profile/Dates & Times state
  const [profileHasChanges, setProfileHasChanges] = useState(false);
  const profileSaveHandlerRef = useRef<(() => void) | null>(null);

  const [datesTimesHasChanges, setDatesTimesHasChanges] = useState(false);
  const datesTimesSaveHandlerRef = useRef<(() => void) | null>(null);

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

  const activeItem = settingsData.nav.find((item) => item.key === activeSection);

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <ProfileSettings
            onHasChanges={setProfileHasChanges}
            onSaveHandler={(handler) => {
              profileSaveHandlerRef.current = handler;
            }}
          />
        );

      case 'dates-times':
        return (
          <DatesTimesSettings
            onHasChanges={setDatesTimesHasChanges}
            onSaveHandler={(handler) => {
              datesTimesSaveHandlerRef.current = handler;
            }}
          />
        );

      case 'work-schedule':
        return (
          <WorkScheduleSettings
            userId={user?.id || ''}
            timezone={profile?.timezone || 'UTC'}
            onHasChangesChange={handleWorkScheduleHasChangesChange}
            onSaveHandler={handleWorkScheduleSaveHandlerChange}
          />
        );

      case 'calendars-categories':
        return <CalendarsAndCategoriesSettings />;

      case 'notifications':
        return <NotificationsSettings />;

      case 'ai':
        return (
          <AIPersonasSettings
            editingPersona={editingPersona}
            onEditPersona={setEditingPersona}
          />
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

  // Determine if we should show the footer
  const showFooter =
    activeSection === 'profile' ||
    activeSection === 'dates-times' ||
    activeSection === 'work-schedule' ||
    activeSection === 'calendar' ||
    editingPersona;

  // Determine footer button state
  const getFooterButtonState = () => {
    if (editingPersona) {
      return { disabled: false }; // AI Personas handles its own save in the component
    } else if (activeSection === 'work-schedule') {
      return { disabled: !workScheduleHasChanges };
    } else if (activeSection === 'dates-times') {
      return { disabled: !datesTimesHasChanges };
    } else if (activeSection === 'profile') {
      return { disabled: !profileHasChanges };
    }
    return { disabled: false };
  };

  const handleSave = () => {
    if (editingPersona) {
      // AI Personas handles save internally via the component
      return;
    } else if (activeSection === 'work-schedule') {
      workScheduleSaveHandlerRef.current?.();
    } else if (activeSection === 'dates-times') {
      datesTimesSaveHandlerRef.current?.();
    } else if (activeSection === 'profile') {
      profileSaveHandlerRef.current?.();
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
                              setEditingPersona(null);
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
            {showFooter && !editingPersona && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={getFooterButtonState().disabled}>
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

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Users, X } from 'lucide-react';
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useUserProfilesServer } from '@/hooks/use-user-profile-server';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';
import { ScheduleUserSearch } from '../cal-schedule/ScheduleUserSearch';

interface CollaboratorItemProps {
  userId: string;
  showFreeBusy: boolean;
  onToggleFreeBusy: (userId: string) => void;
  onRemove: (userId: string) => void;
  getInitials: (name?: string, email?: string) => string;
  profilesMap: Map<string, { display_name?: string | null; email?: string; avatar_url?: string | null }> | undefined;
}

function CollaboratorItem({
  userId,
  showFreeBusy,
  onToggleFreeBusy,
  onRemove,
  getInitials,
  profilesMap,
}: CollaboratorItemProps) {
  const profile = profilesMap?.get(userId);
  const avatarUrl = getAvatarUrl(profile?.avatar_url || undefined);
  const displayName = profile?.display_name || profile?.email || 'Unknown';
  const initials = getInitials(profile?.display_name || undefined, profile?.email);

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
      onClick={() => onToggleFreeBusy(userId)}
    >
      {/* Checkbox and Avatar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Checkbox
          checked={showFreeBusy}
          onCheckedChange={() => onToggleFreeBusy(userId)}
          className="shrink-0"
        />
        <Avatar className="size-6 shrink-0">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {profile?.display_name && profile?.email && (
            <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
          )}
        </div>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(userId);
        }}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function Collaborators() {
  const { user } = useAuth();
  const {
    collaborators,
    addCollaborator,
    removeCollaborator,
    toggleCollaboratorFreeBusy,
    sidebarTab,
    collaboratorsExpanded,
    setCollaboratorsExpanded,
  } = useAppStore();

  const collaboratorUserIds = collaborators.map((c) => c.userId);

  // Fetch profiles for all collaborators
  const { data: collaboratorProfilesMap } = useUserProfilesServer(collaboratorUserIds);

  const handleSelectUser = (userId: string) => {
    addCollaborator(userId);
  };

  const handleRemoveCollaborator = (userId: string) => {
    removeCollaborator(userId);
  };

  const handleToggleFreeBusy = (userId: string) => {
    toggleCollaboratorFreeBusy(userId);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <AnimatePresence mode="wait">
      {sidebarTab === 'calendars' && (
        <motion.div
          key="collaborators-content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
          }}
          className="flex flex-col border-t"
        >
          {/* Header */}
          <Collapsible open={collaboratorsExpanded} onOpenChange={setCollaboratorsExpanded}>
            <div className="px-4 pt-4 pb-3">
              <CollapsibleTrigger className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                <h3 className="font-medium text-sm">Collaborators</h3>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    collaboratorsExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                  )}
                />
              </CollapsibleTrigger>
            </div>

            {/* Collaborators List */}
            <CollapsibleContent>
              <div className="px-4 pt-2 pb-1">
                <p className="text-xs text-muted-foreground">
                  Hold <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift</kbd> to see
                  when they're free
                </p>
              </div>

              {collaborators.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No collaborators yet.</p>
                  <p className="mt-1">Search below to add people.</p>
                </div>
              ) : (
                <div className="px-2 space-y-1 pb-2">
                  {collaborators.map((collaborator) => (
                    <CollaboratorItem
                      key={collaborator.userId}
                      userId={collaborator.userId}
                      showFreeBusy={collaborator.showFreeBusy}
                      onToggleFreeBusy={handleToggleFreeBusy}
                      onRemove={handleRemoveCollaborator}
                      getInitials={getInitials}
                      profilesMap={collaboratorProfilesMap}
                    />
                  ))}
                </div>
              )}

              {/* Search Box */}
              <div className="p-4 border-t">
                <ScheduleUserSearch
                  onSelectUser={handleSelectUser}
                  excludeUserIds={[user?.id || '', ...collaboratorUserIds]}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

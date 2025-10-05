'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Loader2, Plus } from 'lucide-react';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCalendars } from '@/lib/data-v2';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';

export function Calendars() {
  const { user } = useAuth();
  const calendars = useUserCalendars(user?.id) || [];
  const isLoading = !calendars && !!user?.id;
  const {
    hiddenCalendarIds,
    toggleCalendarVisibility,
    setSettingsModalOpen,
    aiHighlightsVisible,
    toggleAiHighlights,
    sidebarTab,
  } = useAppStore();

  // All calendars are visible by default with hiddenCalendarIds approach

  const handleToggleVisibility = (calendarId: string) => {
    toggleCalendarVisibility(calendarId);
  };

  const handleCreateCalendar = () => {
    // Open settings modal to calendars section for creation
    setSettingsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {sidebarTab === 'calendars' && (
        <motion.div
          key="calendars-content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
          }}
          className="flex flex-col h-full"
        >
          {/* Header with Create button */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">My Calendars</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateCalendar}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar List */}
          <div className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {/* AI Highlights Toggle */}
              <div
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => toggleAiHighlights()}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    checked={aiHighlightsVisible}
                    onCheckedChange={() => toggleAiHighlights()}
                    className="shrink-0"
                  />
                  <div className="w-3 h-3 rounded-sm shrink-0 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium">AI Highlights</span>
                  </div>
                </div>
              </div>

              {/* Calendars */}
              {calendars.map((calendar) => {
                return (
                  <React.Fragment key={calendar.id}>
                    <div
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                      onClick={() => handleToggleVisibility(calendar.id)}
                    >
                      {/* Color indicator and checkbox */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={
                            hiddenCalendarIds instanceof Set
                              ? !hiddenCalendarIds.has(calendar.id)
                              : true
                          }
                          onCheckedChange={() => handleToggleVisibility(calendar.id)}
                          className="shrink-0"
                        />
                        <div
                          className={cn('w-3 h-3 rounded-sm shrink-0', `bg-${calendar.color}-500`)}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">
                            {calendar.name}
                            {calendar.type === 'default' && (
                              <span className="ml-1 text-xs text-muted-foreground">(Default)</span>
                            )}
                            {calendar.type === 'archive' && (
                              <span className="ml-1 text-xs text-muted-foreground">(Archive)</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Footer with summary */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {hiddenCalendarIds instanceof Set
                  ? calendars.length - hiddenCalendarIds.size
                  : calendars.length}{' '}
                of {calendars.length} calendars visible
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

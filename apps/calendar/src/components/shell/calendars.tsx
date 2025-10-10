'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCalendars } from '@/lib/data-v2';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

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
    calendarsExpanded,
    setCalendarsExpanded,
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
          {/* AI Highlights Section */}
          <div className="border-b">
            <div className="px-4 pt-4 pb-2">
              <h3 className="font-medium text-sm mb-3">AI Highlights</h3>
            </div>
            <div className="px-2 pb-2">
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
            </div>
          </div>

          {/* Calendar List */}
          <Collapsible open={calendarsExpanded} onOpenChange={setCalendarsExpanded}>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                  <h3 className="font-medium text-sm">My Calendars</h3>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      calendarsExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                    )}
                  />
                </CollapsibleTrigger>
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
            <CollapsibleContent className="px-2 pb-2 space-y-1">
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
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

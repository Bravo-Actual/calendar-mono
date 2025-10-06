'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, PersonStanding, Plus, Settings2, Trash2, Video, X } from 'lucide-react';
import type { CalendarSelection } from '@/store/app';
import type { ShowTimeAs } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

export interface CalendarGridActionBarProps {
  // Selections from the new calendar grid (direct from CalendarGrid)
  timeRanges: Array<{ type: 'timeRange'; start: Date; end: Date }>;
  selectedItems: CalendarSelection[];
  onClearSelection: () => void;

  // Time selection actions
  onCreateEvent?: (start: Date, end: Date) => void;
  onCreateEvents: (categoryId: string, categoryName: string) => void;

  // Event selection actions
  onDeleteSelected: () => void;
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCalendar: (calendarId: string) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onUpdateIsPrivate: (isPrivate: boolean) => void;

  // Current state of selected events (for checkbox states)
  selectedShowTimeAs?: ShowTimeAs;
  selectedCalendarId?: string;
  selectedCategoryId?: string;
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;
  selectedIsPrivate?: boolean;

  // User calendars and categories for the dropdown
  userCalendars?: Array<{
    id: string;
    name: string;
    color: string;
    type: 'default' | 'archive' | 'user';
  }>;
  userCategories?: Array<{
    id: string;
    name: string;
    color: string;
  }>;

  // Optional positioning
  position?:
    | 'bottom-right'
    | 'bottom-left'
    | 'top-right'
    | 'top-left'
    | 'bottom-center'
    | 'top-center';
  className?: string;
}

export function CalendarGridActionBar({
  timeRanges,
  selectedItems,
  onClearSelection,
  onCreateEvent,
  onCreateEvents,
  onDeleteSelected,
  onUpdateShowTimeAs,
  onUpdateCalendar,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  onUpdateIsPrivate,
  selectedShowTimeAs,
  selectedCalendarId,
  selectedCategoryId,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  selectedIsPrivate,
  userCalendars = [],
  userCategories = [],
  position = 'bottom-center',
  className = '',
}: CalendarGridActionBarProps) {
  // Use the direct props from CalendarGrid
  const hasTimeRanges = timeRanges.length > 0;
  const hasSelectedEvents = selectedItems.filter((item) => item.id).length > 0;
  const selectedEventCount = selectedItems.filter((item) => item.id).length;
  const isSingleEventSelected = selectedEventCount === 1;
  const hasAnySelection = hasTimeRanges || hasSelectedEvents;

  const positionClasses = {
    'bottom-right': 'bottom-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'top-right': 'top-3 right-3',
    'top-left': 'top-3 left-3',
    'bottom-center': 'bottom-3 left-1/2 -translate-x-1/2',
    'top-center': 'top-3 left-1/2 -translate-x-1/2',
  };

  return (
    <AnimatePresence>
      {hasAnySelection && (
        <motion.div
          className={`pointer-events-none absolute ${positionClasses[position]} z-30 ${className}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
            mass: 0.8,
          }}
        >
          <div className="pointer-events-auto bg-background/90 backdrop-blur rounded-xl shadow-lg border flex items-center gap-2 p-2">
            {/* Time selection actions */}
            <AnimatePresence initial={false}>
              {hasTimeRanges && timeRanges.length === 1 && onCreateEvent && (
                <motion.div
                  key="create-button"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="overflow-hidden"
                >
                  <Button
                    size="sm"
                    onClick={() => onCreateEvent(timeRanges[0].start, timeRanges[0].end)}
                    title="Create event and open details"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {hasTimeRanges && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant={timeRanges.length === 1 ? 'outline' : 'default'}
                    title={`Create ${timeRanges.length} event${timeRanges.length > 1 ? 's' : ''}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Quick Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {userCategories.length > 0 ? (
                    userCategories.map((category) => (
                      <DropdownMenuItem
                        key={category.id}
                        onClick={() => onCreateEvents(category.id, category.name)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded ${
                              category.color === 'neutral'
                                ? 'bg-neutral-500'
                                : category.color === 'slate'
                                  ? 'bg-slate-500'
                                  : category.color === 'orange'
                                    ? 'bg-orange-500'
                                    : category.color === 'yellow'
                                      ? 'bg-yellow-500'
                                      : category.color === 'green'
                                        ? 'bg-green-500'
                                        : category.color === 'blue'
                                          ? 'bg-blue-500'
                                          : category.color === 'indigo'
                                            ? 'bg-indigo-500'
                                            : category.color === 'violet'
                                              ? 'bg-violet-500'
                                              : category.color === 'fuchsia'
                                                ? 'bg-fuchsia-500'
                                                : category.color === 'rose'
                                                  ? 'bg-rose-500'
                                                  : 'bg-neutral-500'
                            }`}
                          />
                          {category.name}
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No categories available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Separator between action groups */}
            <AnimatePresence initial={false}>
              {hasTimeRanges && hasSelectedEvents && (
                <motion.div
                  key="separator-1"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="overflow-hidden"
                >
                  <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Event selection actions */}
            <AnimatePresence initial={false}>
              {hasSelectedEvents && (
                <>
                  {/* Event Options dropdown */}
                  <motion.div
                    key="event-options"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                    className="overflow-hidden"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings2 className="h-4 w-4 mr-1" />
                          Event Options
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {/* Show Time As section */}
                        <DropdownMenuLabel>Show Time As</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('busy')}>
                          <div className="flex items-center justify-between w-full">
                            <span>Busy</span>
                            {isSingleEventSelected && selectedShowTimeAs === 'busy' && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('tentative')}>
                          <div className="flex items-center justify-between w-full">
                            <span>Tentative</span>
                            {isSingleEventSelected && selectedShowTimeAs === 'tentative' && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('free')}>
                          <div className="flex items-center justify-between w-full">
                            <span>Free</span>
                            {isSingleEventSelected && selectedShowTimeAs === 'free' && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('oof')}>
                          <div className="flex items-center justify-between w-full">
                            <span>Out of Office</span>
                            {isSingleEventSelected && selectedShowTimeAs === 'oof' && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('working_elsewhere')}>
                          <div className="flex items-center justify-between w-full">
                            <span>Working Elsewhere</span>
                            {isSingleEventSelected &&
                              selectedShowTimeAs === 'working_elsewhere' && (
                                <Check className="h-4 w-4" />
                              )}
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Calendar section */}
                        {userCalendars.length > 0 && (
                          <>
                            <DropdownMenuLabel>Calendar</DropdownMenuLabel>
                            {userCalendars.map((calendar) => (
                              <DropdownMenuItem
                                key={calendar.id}
                                onClick={() => onUpdateCalendar(calendar.id)}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className={`w-3 h-3 rounded-sm bg-${calendar.color}-500`}
                                  ></div>
                                  {calendar.name}
                                  {calendar.type === 'default' && (
                                    <span className="text-xs text-muted-foreground">(Default)</span>
                                  )}
                                  {calendar.type === 'archive' && (
                                    <span className="text-xs text-muted-foreground">(Archive)</span>
                                  )}
                                </div>
                                {isSingleEventSelected && selectedCalendarId === calendar.id && (
                                  <Check className="h-4 w-4 ml-2" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {/* Category section */}
                        {userCategories.length > 0 && (
                          <>
                            <DropdownMenuLabel>Category</DropdownMenuLabel>
                            {userCategories.map((category) => (
                              <DropdownMenuItem
                                key={category.id}
                                onClick={() => onUpdateCategory(category.id)}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className={`w-3 h-3 rounded ${
                                      category.color === 'neutral'
                                        ? 'bg-neutral-500'
                                        : category.color === 'slate'
                                          ? 'bg-slate-500'
                                          : category.color === 'orange'
                                            ? 'bg-orange-500'
                                            : category.color === 'yellow'
                                              ? 'bg-yellow-500'
                                              : category.color === 'green'
                                                ? 'bg-green-500'
                                                : category.color === 'blue'
                                                  ? 'bg-blue-500'
                                                  : category.color === 'indigo'
                                                    ? 'bg-indigo-500'
                                                    : category.color === 'violet'
                                                      ? 'bg-violet-500'
                                                      : category.color === 'fuchsia'
                                                        ? 'bg-fuchsia-500'
                                                        : category.color === 'rose'
                                                          ? 'bg-rose-500'
                                                          : 'bg-neutral-500'
                                    }`}
                                  ></div>
                                  {category.name}
                                </div>
                                {isSingleEventSelected && selectedCategoryId === category.id && (
                                  <Check className="h-4 w-4 ml-2" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {/* Meeting Type section */}
                        <DropdownMenuLabel>Meeting Type</DropdownMenuLabel>
                        {isSingleEventSelected ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => onUpdateIsOnlineMeeting(!selectedIsOnlineMeeting)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <Video className="w-4 h-4" />
                                Online Meeting
                              </div>
                              {selectedIsOnlineMeeting && <Check className="h-4 w-4 ml-2" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateIsInPerson(!selectedIsInPerson)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <PersonStanding className="w-4 h-4" />
                                In Person
                              </div>
                              {selectedIsInPerson && <Check className="h-4 w-4 ml-2" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsPrivate(!selectedIsPrivate)}>
                              <div className="flex items-center gap-2 flex-1">
                                <Lock className="w-4 h-4" />
                                Private
                              </div>
                              {selectedIsPrivate && <Check className="h-4 w-4 ml-2" />}
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => onUpdateIsOnlineMeeting(true)}>
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                Set Online Meeting
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsInPerson(true)}>
                              <div className="flex items-center gap-2">
                                <PersonStanding className="w-4 h-4" />
                                Set In Person
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsPrivate(true)}>
                              <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Set Private
                              </div>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>

                  <motion.div
                    key="delete-button"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                    className="overflow-hidden"
                  >
                    <Button
                      variant="ghost"
                      onClick={onDeleteSelected}
                      size="icon"
                      title={`Delete ${selectedItems.length} selected item${selectedItems.length > 1 ? 's' : ''}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Clear selection button */}
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
            <Button variant="ghost" onClick={onClearSelection} size="icon" title="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

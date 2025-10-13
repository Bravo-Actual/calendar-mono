'use client';

import {
  Add20Regular,
  CalendarPattern20Regular,
  Checkmark20Regular,
  Delete20Regular,
  Dismiss20Regular,
  LockClosed20Regular,
  Options20Regular,
  Person20Regular,
  SignOut20Regular,
  Tag20Regular,
  Target20Regular,
  Video20Regular,
} from '@fluentui/react-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import type { TimeLike } from '@/components/cal-grid/types';
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
import type { CalendarSelection } from '@/store/app';
import type { ShowTimeAs } from '@/types';

export interface CalendarGridActionBarProps {
  // Selections from the new calendar grid (direct from CalendarGrid)
  timeRanges: Array<{ type: 'timeRange'; start: Date; end: Date }>;
  selectedItems: CalendarSelection[];
  gridApi?: React.RefObject<{
    getAllItems: () => Array<{ id?: string; start_time: TimeLike; end_time: TimeLike }>;
  }>;
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

  // Target actions (when both events and time ranges are selected)
  onBestFit?: () => void;
  onSpread?: () => void;

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
  gridApi,
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
  onBestFit,
  onSpread,
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

  // Calculate total duration of selected events
  const totalEventMinutes = selectedItems
    .filter((item) => item.id && item.data)
    .reduce((total, item) => {
      const eventData = item.data as any;
      if (eventData?.start_time && eventData?.end_time) {
        const start = new Date(eventData.start_time);
        const end = new Date(eventData.end_time);
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        return total + durationMinutes;
      }
      return total;
    }, 0);

  // Calculate total duration of selected time ranges
  const totalTimeRangeMinutes = timeRanges.reduce((total, range) => {
    const durationMs = range.end.getTime() - range.start.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    return total + durationMinutes;
  }, 0);

  // Calculate occupied time in selected time ranges (from all EVENTS via grid API, excluding highlights)
  const occupiedTimeMinutes = useMemo(() => {
    if (!gridApi?.current || timeRanges.length === 0) return 0;

    const allItems = gridApi.current.getAllItems();
    let occupied = 0;

    timeRanges.forEach((range) => {
      allItems.forEach((item: any) => {
        // Only include events (items with IDs and proper event data)
        // This excludes highlights, annotations, etc.
        if (!item.id || !item.start_time || !item.end_time) return;

        const itemStart = new Date(item.start_time);
        const itemEnd = new Date(item.end_time);

        // Check if event overlaps with this time range
        if (itemStart < range.end && itemEnd > range.start) {
          // Calculate overlap duration
          const overlapStart = itemStart < range.start ? range.start : itemStart;
          const overlapEnd = itemEnd > range.end ? range.end : itemEnd;
          const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
          const overlapMinutes = overlapMs / (1000 * 60);
          occupied += overlapMinutes;
        }
      });
    });

    return occupied;
  }, [gridApi, timeRanges]);

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      if (mins === 0) {
        return `${hours}hr`;
      }
      return `${hours}hr ${mins}m`;
    }
  };

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
            {/* Event count and duration summary */}
            <AnimatePresence initial={false}>
              {hasSelectedEvents && (
                <motion.div
                  key="event-summary"
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
                  <div className="px-2 text-sm font-medium text-muted-foreground whitespace-nowrap select-none">
                    {selectedEventCount} event{selectedEventCount !== 1 ? 's' : ''}
                    {totalEventMinutes > 0 && `, ${formatDuration(totalEventMinutes)}`}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Time range duration summary */}
            <AnimatePresence initial={false}>
              {hasTimeRanges && (
                <motion.div
                  key="time-summary"
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
                  <div className="px-2 text-sm font-medium text-muted-foreground whitespace-nowrap select-none">
                    {formatDuration(totalTimeRangeMinutes)}
                    {occupiedTimeMinutes > 0 && (
                      <>
                        {' '}
                        - {formatDuration(Math.max(0, totalTimeRangeMinutes - occupiedTimeMinutes))}{' '}
                        free
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Separator after summary */}
            <AnimatePresence initial={false}>
              {hasSelectedEvents && (hasTimeRanges || hasSelectedEvents) && (
                <motion.div
                  key="separator-summary"
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
                    <Add20Regular className="size-5 mr-1" />
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
                    <Add20Regular className="size-5 mr-1" />
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
                  {/* Categories & Calendar dropdown */}
                  <motion.div
                    key="categories-calendar"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Categories & Calendar">
                          <Tag20Regular className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
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
                                  <Checkmark20Regular className="size-5 ml-2" />
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
                                  <Checkmark20Regular className="size-5 ml-2" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>

                  {/* Show Time As dropdown */}
                  <motion.div
                    key="show-time-as"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Show Time As">
                          <CalendarPattern20Regular className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Show Time As</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('busy')}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-base">✓</span>
                              <span>Busy</span>
                            </div>
                            {isSingleEventSelected && selectedShowTimeAs === 'busy' && (
                              <Checkmark20Regular className="size-5" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('tentative')}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-base">?</span>
                              <span>Tentative</span>
                            </div>
                            {isSingleEventSelected && selectedShowTimeAs === 'tentative' && (
                              <Checkmark20Regular className="size-5" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('free')}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-base">○</span>
                              <span>Free</span>
                            </div>
                            {isSingleEventSelected && selectedShowTimeAs === 'free' && (
                              <Checkmark20Regular className="size-5" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('oof')}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <SignOut20Regular className="size-3.5" />
                              <span>Out of Office</span>
                            </div>
                            {isSingleEventSelected && selectedShowTimeAs === 'oof' && (
                              <Checkmark20Regular className="size-5" />
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateShowTimeAs('working_elsewhere')}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-base">↗</span>
                              <span>Working Elsewhere</span>
                            </div>
                            {isSingleEventSelected &&
                              selectedShowTimeAs === 'working_elsewhere' && (
                                <Checkmark20Regular className="size-5" />
                              )}
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>

                  {/* Meeting Options dropdown */}
                  <motion.div
                    key="meeting-options"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Meeting Options">
                          <Options20Regular className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Meeting Type</DropdownMenuLabel>
                        {isSingleEventSelected ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => onUpdateIsOnlineMeeting(!selectedIsOnlineMeeting)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <Video20Regular className="size-5" />
                                  <span>Online Meeting</span>
                                </div>
                                {selectedIsOnlineMeeting && (
                                  <Checkmark20Regular className="size-5" />
                                )}
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateIsInPerson(!selectedIsInPerson)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <Person20Regular className="size-5" />
                                  <span>In Person</span>
                                </div>
                                {selectedIsInPerson && <Checkmark20Regular className="size-5" />}
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsPrivate(!selectedIsPrivate)}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <LockClosed20Regular className="size-5" />
                                  <span>Private</span>
                                </div>
                                {selectedIsPrivate && <Checkmark20Regular className="size-5" />}
                              </div>
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => onUpdateIsOnlineMeeting(true)}>
                              <div className="flex items-center gap-2">
                                <Video20Regular className="size-5" />
                                Set Online Meeting
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsInPerson(true)}>
                              <div className="flex items-center gap-2">
                                <Person20Regular className="size-5" />
                                Set In Person
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onUpdateIsPrivate(true)}>
                              <div className="flex items-center gap-2">
                                <LockClosed20Regular className="size-5" />
                                Set Private
                              </div>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>

                  {/* Target button - only shows when both events and time ranges are selected */}
                  {hasTimeRanges && (
                    <motion.div
                      key="target-button"
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
                          <Button variant="ghost" size="icon" title="Target actions">
                            <Target20Regular className="size-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Target Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={onBestFit}>
                            <div className="flex items-center gap-2">
                              <Target20Regular className="size-5" />
                              Pack
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={onSpread}>
                            <div className="flex items-center gap-2">
                              <Target20Regular className="size-5" />
                              Spread
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  )}

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
                      <Delete20Regular className="size-5" />
                    </Button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Clear selection button */}
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
            <Button variant="ghost" onClick={onClearSelection} size="icon" title="Clear selection">
              <Dismiss20Regular className="size-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

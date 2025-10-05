import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import type { DateRange, Modifiers } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/store/app';

type CalendarMode = 'single' | 'multiple' | 'range';

interface CalendarSelection {
  mode: CalendarMode;
  selected: Date | Date[] | DateRange;
}

interface CalendarItemProps {
  month: Date;
  selection: CalendarSelection;
  onDateSelect: (
    date: Date | Date[] | DateRange | undefined,
    selectedDate: Date | undefined,
    activeModifiers: Modifiers,
    e: React.MouseEvent | React.KeyboardEvent
  ) => void;
}

function CalendarItem({ month, selection, onDateSelect }: CalendarItemProps) {
  const baseProps = {
    month,
    defaultMonth: month,
    showOutsideDays: false,
    onSelect: onDateSelect,
    onMonthChange: () => {}, // Prevent month navigation
    className:
      '[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent',
  };

  switch (selection.mode) {
    case 'multiple':
      return <Calendar {...baseProps} mode="multiple" selected={selection.selected as Date[]} />;
    case 'single':
      return <Calendar {...baseProps} mode="single" selected={selection.selected as Date} />;
    case 'range':
      return <Calendar {...baseProps} mode="range" selected={selection.selected as DateRange} />;
  }
}

export function DatePicker() {
  // Only destructure what we actually need
  const {
    viewMode,
    dateRangeType,
    customDayCount,
    startDate,
    selectedDates,
    weekStartDay,
    setDateRangeView,
    toggleSelectedDate,
    sidebarTab,
  } = useAppStore();

  const [isCtrlHeld, setIsCtrlHeld] = React.useState(false);

  // Generate 12 months starting from current month
  const months = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() + i);
        return date;
      }),
    []
  );

  // Listen for Ctrl key press/release
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Calculate consecutive view dates
  const getConsecutiveViewDates = React.useCallback(() => {
    let calculatedStartDate = startDate;
    let dayCount = 1;

    switch (dateRangeType) {
      case 'day':
        dayCount = 1;
        break;
      case 'week': {
        dayCount = 7;
        // Adjust to week start based on user preference
        const dayOfWeek = startDate.getDay();
        const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
        break;
      }
      case 'workweek': {
        dayCount = 5;
        // Adjust to week start (Monday for work week)
        const currentDay = startDate.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        calculatedStartDate = new Date(startDate);
        calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
        break;
      }
      case 'custom-days':
        dayCount = customDayCount;
        break;
    }

    return { calculatedStartDate, dayCount };
  }, [dateRangeType, startDate, weekStartDay, customDayCount]);

  // Calculate selection for different modes
  const calendarSelection: CalendarSelection = React.useMemo(() => {
    if (viewMode === 'dateArray' || isCtrlHeld) {
      // Date Array mode or ctrl held: show multi-select mode with current selections
      return { mode: 'multiple', selected: selectedDates };
    } else {
      // Date Range mode: show range based on current view
      const { calculatedStartDate, dayCount } = getConsecutiveViewDates();

      if (dayCount === 1) {
        // Single day: use single date selection
        return { mode: 'single', selected: calculatedStartDate };
      } else {
        // Multiple days: use range selection
        const endDate = new Date(calculatedStartDate);
        endDate.setDate(endDate.getDate() + dayCount - 1);
        return { mode: 'range', selected: { from: calculatedStartDate, to: endDate } };
      }
    }
  }, [viewMode, getConsecutiveViewDates, selectedDates, isCtrlHeld]);

  // Handle date selection based on mode and modifier keys
  const handleDateSelect = React.useCallback(
    (
      date: Date | Date[] | DateRange | undefined,
      selectedDate: Date | undefined,
      _activeModifiers: Modifiers,
      e: React.MouseEvent | React.KeyboardEvent
    ) => {
      // Skip calls with undefined date - these are spurious
      if (!date) {
        return;
      }

      const isCtrlClick = e?.ctrlKey || e?.metaKey;

      if (isCtrlClick) {
        // Ctrl+click: handle multi-select mode
        if (calendarSelection.mode === 'multiple' && Array.isArray(date)) {
          // In multiple mode, find the difference between current selection and previous
          const previousCount = selectedDates.length;
          const newCount = date.length;

          if (newCount > previousCount) {
            // Date was added - find the new date
            const newDate = date.find(
              (d) => !selectedDates.some((sd) => sd.toDateString() === d.toDateString())
            );
            if (newDate) {
              toggleSelectedDate(newDate);
            }
          } else if (newCount < previousCount) {
            // Date was removed - find which one is missing
            const removedDate = selectedDates.find(
              (sd) => !date.some((d) => d.toDateString() === sd.toDateString())
            );
            if (removedDate) {
              toggleSelectedDate(removedDate);
            }
          }
        } else {
          // Switch to multi-select mode
          const dateToToggle = selectedDate || (date as DateRange)?.from;
          if (dateToToggle) {
            toggleSelectedDate(dateToToggle);
          }
        }
      } else {
        // Regular click: return to date range mode with clicked date, keeping previous date range settings
        if (selectedDate) {
          setDateRangeView(dateRangeType, selectedDate, customDayCount);
        }
      }
    },
    [
      calendarSelection.mode,
      selectedDates,
      toggleSelectedDate,
      dateRangeType,
      customDayCount,
      setDateRangeView,
    ]
  );

  return (
    <AnimatePresence mode="wait">
      {sidebarTab === 'dates' && (
        <motion.div key="dates-content">
          {months.map((month, index) => (
            <motion.div
              key={`${month.getFullYear()}-${month.getMonth()}-${index}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                ease: 'easeOut',
                delay: index * 0.03,
              }}
            >
              <CalendarItem
                month={month}
                selection={calendarSelection}
                onDateSelect={handleDateSelect}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

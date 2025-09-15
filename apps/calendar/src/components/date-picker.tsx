import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useAppStore } from "@/store/app"
import type { DateRange, Matcher, Modifiers, OnSelectHandler } from "react-day-picker"

export function DatePicker() {
  const {
    viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay,
    setConsecutiveView, toggleSelectedDate,
    // Legacy fields during transition
    selectedDate, isMultiSelectMode, weekStartMs, days, setSelectedDate
  } = useAppStore()
  const [isCtrlHeld, setIsCtrlHeld] = React.useState(false)

  // Generate 12 months starting from current month
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() + i)
    return date
  })

  // Listen for Ctrl key press/release
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlHeld(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Calculate selection for different modes
  const calendarSelection = React.useMemo(() => {
    if (viewMode === 'non-consecutive' && selectedDates.length > 0) {
      // Non-consecutive mode: show individually selected dates
      return { mode: "multiple", selected: selectedDates }
    } else if (isCtrlHeld) {
      // Ctrl held: clear selection to give clean slate for multi-select
      return { mode: "multiple", selected: [] }
    } else {
      // Consecutive mode: show range based on current view
      let calculatedStartDate = startDate;
      let dayCount = 1;

      switch (consecutiveType) {
        case 'day':
          dayCount = 1;
          break;
        case 'week':
          dayCount = 7;
          // Adjust to week start based on user preference
          const dayOfWeek = startDate.getDay();
          const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
          calculatedStartDate = new Date(startDate);
          calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromWeekStart);
          break;
        case 'workweek':
          dayCount = 5;
          // Adjust to week start (Monday for work week)
          const currentDay = startDate.getDay();
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          calculatedStartDate = new Date(startDate);
          calculatedStartDate.setDate(calculatedStartDate.getDate() - daysFromMonday);
          break;
        case 'custom-days':
          dayCount = customDayCount;
          break;
      }

      if (dayCount === 1) {
        // Single day: use single date selection
        return { mode: "single", selected: calculatedStartDate }
      } else {
        // Multiple days: use range selection
        const endDate = new Date(calculatedStartDate);
        endDate.setDate(endDate.getDate() + dayCount - 1);
        return { mode: "range", selected: { from: calculatedStartDate, to: endDate } }
      }
    }
  }, [viewMode, consecutiveType, customDayCount, startDate, selectedDates, weekStartDay, isCtrlHeld])

  return (
    <div>
      {months.map((month, index) => {
        if (calendarSelection.mode === "multiple") {
          return (
            <Calendar
              key={`${month.getFullYear()}-${month.getMonth()}`}
              mode="multiple"
              month={month}
              defaultMonth={month}
              selected={calendarSelection.selected as Date[]}
              showOutsideDays={false}
              onSelect={((date: any, selectedDate: any, activeModifiers: any, e: any) => {
                // Skip calls with undefined date - these are spurious
                if (!date) {
                  return;
                }

                if (e?.ctrlKey || e?.metaKey) {
                  // Ctrl+click: toggle date in multi-select mode
                  if (Array.isArray(date)) {
                    // In multiple mode, find the difference between current selection and previous
                    const previousCount = selectedDates.length;
                    const newCount = date.length;

                    if (newCount > previousCount) {
                      // Date was added - find the new date
                      const newDate = date.find(d => !selectedDates.some(sd => sd.toDateString() === d.toDateString()));
                      if (newDate) {
                        toggleSelectedDate(newDate);
                      }
                    } else if (newCount < previousCount) {
                      // Date was removed - find which one is missing
                      const removedDate = selectedDates.find(sd => !date.some(d => d.toDateString() === sd.toDateString()));
                      if (removedDate) {
                        toggleSelectedDate(removedDate);
                      }
                    }
                  }
                } else {
                  // Regular click: switch to consecutive day view with clicked date
                  setConsecutiveView('day', selectedDate);
                }
              })}
              onMonthChange={() => {}} // Prevent month navigation
              className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
            />
          );
        } else if (calendarSelection.mode === "single") {
          return (
            <Calendar
              key={`${month.getFullYear()}-${month.getMonth()}`}
              mode="single"
              month={month}
              defaultMonth={month}
              selected={calendarSelection.selected as Date}
              showOutsideDays={false}
              onSelect={((date: any, selectedDate: any, activeModifiers: any, e: any) => {
                // Skip calls with undefined date - these are spurious
                if (!date) {
                  return;
                }

                if (e?.ctrlKey || e?.metaKey) {
                  // Ctrl+click: switch to multi-select mode
                  toggleSelectedDate(selectedDate);
                } else {
                  // Regular click: update day view to clicked date
                  setConsecutiveView('day', selectedDate);
                }
              })}
              onMonthChange={() => {}} // Prevent month navigation
              className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
            />
          );
        } else {
          // Range mode
          return (
            <Calendar
              key={`${month.getFullYear()}-${month.getMonth()}`}
              mode="range"
              month={month}
              defaultMonth={month}
              selected={calendarSelection.selected as DateRange}
              showOutsideDays={false}
              onSelect={((date: any, selectedDate: any, activeModifiers: any, e: any) => {
                // Skip calls with undefined date - these are spurious
                if (!date) {
                  return;
                }

                if (e?.ctrlKey || e?.metaKey) {
                  // Ctrl+click: switch to multi-select mode
                  toggleSelectedDate(selectedDate || date.from);
                } else {
                  // Regular click: update consecutive view to start at clicked date
                  setConsecutiveView(consecutiveType, selectedDate, customDayCount);
                }
              })}
              onMonthChange={() => {}} // Prevent month navigation
              className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
            />
          );
        }
      })}
    </div>
  )
}

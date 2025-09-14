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
  const { selectedDate, selectedDates, isMultiSelectMode, weekStartMs, days, setSelectedDate, toggleSelectedDate } = useAppStore()
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
    if (isMultiSelectMode && selectedDates.length > 0) {
      // Multi-select mode: show individually selected dates
      return { mode: "multiple", selected: selectedDates }
    } else if (isCtrlHeld) {
      // Ctrl held: clear selection to give clean slate for multi-select
      return { mode: "multiple", selected: [] }
    } else {
      // Normal mode: use range selection
      if (days === 5) {
        // Work Week: Show Monday-Friday range
        const currentWeekStart = new Date(weekStartMs)
        const currentDay = currentWeekStart.getDay() // 0 = Sunday, 1 = Monday, etc.

        let mondayOffset = 0
        if (currentDay === 0) { // Sunday
          mondayOffset = 1 // Monday is tomorrow
        } else if (currentDay === 1) { // Monday
          mondayOffset = 0 // Already Monday
        } else { // Tuesday-Saturday
          mondayOffset = -(currentDay - 1) // Go back to Monday
        }

        const mondayMs = weekStartMs + (mondayOffset * 86400000)
        const mondayDate = new Date(mondayMs)
        const fridayDate = new Date(mondayMs + (4 * 86400000))

        return { mode: "range", selected: { from: mondayDate, to: fridayDate } }
      } else {
        // Use range mode for regular week view
        const weekStart = new Date(weekStartMs)
        const weekEnd = new Date(weekStartMs + (days - 1) * 86400000)
        return { mode: "range", selected: { from: weekStart, to: weekEnd } }
      }
    }
  }, [isMultiSelectMode, selectedDates, weekStartMs, days, isCtrlHeld])

  return (
    <SidebarGroup className="px-0 py-0 flex-1 min-h-0">
      <SidebarGroupContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full w-full">
          {months.map((month, index) =>
            calendarSelection.mode === "multiple" ? (
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
                    // Regular click: exit multi-select and set single date
                    // Use selectedDate parameter which is the actual clicked date
                    setSelectedDate(selectedDate);
                  }
                })}
                onMonthChange={() => {}} // Prevent month navigation
                className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
              />
            ) : (
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
                    // Ctrl+click: toggle date in multi-select mode
                    toggleSelectedDate(selectedDate || date.from);
                  } else {
                    // Regular click: exit multi-select and set single date
                    // Use selectedDate parameter which is the actual clicked date
                    setSelectedDate(selectedDate);
                  }
                })}
                onMonthChange={() => {}} // Prevent month navigation
                className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
              />
            )
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

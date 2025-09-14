import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useAppStore } from "@/store/app"

export function DatePicker() {
  const { selectedDate, setSelectedDate } = useAppStore()

  // Generate 12 months starting from current month
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() + i)
    return date
  })

  return (
    <SidebarGroup className="px-0 py-0 flex-1 min-h-0">
      <SidebarGroupContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full w-full">
          {months.map((month, index) => (
            <Calendar
              key={`${month.getFullYear()}-${month.getMonth()}`}
              mode="single"
              month={month}
              defaultMonth={month}
              selected={selectedDate}
              showOutsideDays={false}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date)
                  // The calendar will respond to the store change automatically
                }
              }}
              onMonthChange={() => {}} // Prevent month navigation
              className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px] [&_.rdp-nav]:hidden bg-transparent [&_.rdp]:bg-transparent [&_table]:bg-transparent [&_thead]:bg-transparent [&_tbody]:bg-transparent"
            />
          ))}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

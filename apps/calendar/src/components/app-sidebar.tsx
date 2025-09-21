import * as React from "react"

import { DatePicker } from "@/components/date-picker"
import { Calendars } from "@/components/calendars"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/store/app"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarTab, setSidebarTab } = useAppStore();

  return (
    <Sidebar {...props}>
        <SidebarHeader className="border-sidebar-border h-16 border-b flex flex-row items-center px-4">
          <NavUser />
        </SidebarHeader>

      <SidebarContent className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
        <Tabs value={sidebarTab} onValueChange={(value) => setSidebarTab(value as 'dates' | 'calendars')} className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation - Fixed */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="dates" className="text-xs">Dates</TabsTrigger>
              <TabsTrigger value="calendars" className="text-xs">Calendars</TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content - Scrollable */}
          <TabsContent value="dates" className="flex-1 min-h-0 m-0 p-0">
            <ScrollArea className="h-full">
              <DatePicker />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="calendars" className="flex-1 min-h-0 m-0 p-0">
            <ScrollArea className="h-full">
              <Calendars />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}

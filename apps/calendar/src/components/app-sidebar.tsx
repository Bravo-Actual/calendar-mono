import * as React from "react"

import { DatePicker } from "@/components/date-picker"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/ThemeToggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  user: {
    name: "Calendar User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-sidebar-border h-16 border-b flex flex-row items-center justify-between px-4">
        <NavUser user={data.user} />
        <ThemeToggle />
      </SidebarHeader>
      <SidebarContent className="flex-1 min-h-0 p-0">
        <DatePicker />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

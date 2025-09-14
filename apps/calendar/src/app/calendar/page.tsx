"use client";

import React, { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import type { CalendarWeekHandle, CalEvent, TimeHighlight, SystemSlot } from "../../components/types";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "../../components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../../components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { AppSidebar } from "../../components/app-sidebar";
import { useAppStore } from "../../store/app";
import { useHydrated } from "../../hooks/useHydrated";

const CalendarWeek = dynamic(() => import("../../components/calendar-week"), { ssr: false });

export default function CalendarPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const api = useRef<CalendarWeekHandle>(null);

  // Use app store for date state
  const { selectedDate, days, setDays } = useAppStore();

  const [events, setEvents] = useState<CalEvent[]>(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).getTime();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0).getTime();

    return [
      {
        id: "demo-1",
        title: "Team Standup",
        start: todayStart + 30 * 60 * 1000, // 9:30 AM
        end: todayStart + 60 * 60 * 1000, // 10:00 AM
      },
      {
        id: "ai-1",
        title: "Deep Work Block",
        start: todayStart + 2 * 60 * 60 * 1000, // 11:00 AM
        end: todayStart + 4 * 60 * 60 * 1000, // 1:00 PM
        aiSuggested: true,
      },
      {
        id: "ai-2",
        title: "Review & Planning",
        start: todayStart + 6 * 60 * 60 * 1000, // 3:00 PM
        end: todayStart + 7 * 60 * 60 * 1000, // 4:00 PM
        aiSuggested: true,
      },
      {
        id: "ai-3",
        title: "Coffee Break",
        start: tomorrowStart + 1.5 * 60 * 60 * 1000, // 10:30 AM tomorrow
        end: tomorrowStart + 2 * 60 * 60 * 1000, // 11:00 AM tomorrow
        aiSuggested: true,
      }
    ];
  });

  const [aiHighlights] = useState<TimeHighlight[]>([]);

  const [systemSlots] = useState<SystemSlot[]>([]);

  // Navigation handlers that clear selections
  const handlePrevWeek = () => {
    api.current?.prevWeek();
  };

  const handleNextWeek = () => {
    api.current?.nextWeek();
  };

  const handleGoToToday = () => {
    api.current?.goTo(new Date());
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // Redirect if not authenticated using useEffect to avoid setState during render
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show loading while redirecting
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Don't render until hydrated to prevent flashing
  if (!hydrated) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

          {/* Date Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoToToday}
              title="Go to today"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {days === 5 ? "Work Week" : "7 days"}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDays(5)}>
                  Work Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDays(7)}>
                  7 days
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Calendar Content */}
        <div className="flex-1 min-h-0">
          <CalendarWeek
            ref={api}
            days={days}
            events={events}
            onEventsChange={setEvents}
            aiHighlights={aiHighlights}
            systemHighlightSlots={systemSlots}
            onSelectChange={() => {}}
            onTimeSelectionChange={() => {}}
            slotMinutes={30}
            dragSnapMinutes={5}
            minDurationMinutes={15}
            weekStartsOn={0}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { BaseLayout } from "@/components/base-layout";
import { DatePicker } from "@/components/date-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsModal } from "@/components/settings-modal";
import { AIAssistantPanelSimple } from "@/components/ai";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";
import { Menu, Calendar } from "lucide-react";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();

  // Use app store for date state
  const {
    settingsModalOpen, setSettingsModalOpen, aiPanelOpen,
    sidebarOpen, toggleSidebar
  } = useAppStore();

  // Ensure aiPanelOpen has a default value
  const safeAiPanelOpen = aiPanelOpen ?? false;

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

  // Header is now handled by BaseLayout


  // Nav panel (minical - small calendar)
  const navPanel = sidebarOpen ? (
    <div className="flex flex-col items-center p-2">
      <DatePicker />
    </div>
  ) : null;

  // Main content panel (where the main calendar will go)
  const contentPanel = (
    <div className="p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">📅</div>
        <h2 className="text-2xl font-semibold text-foreground">Main Calendar View</h2>
        <p className="text-muted-foreground">
          This is where your main calendar will be displayed. The small calendar (minical) is in the left panel.
        </p>
        <button
          onClick={toggleSidebar}
          className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg"
        >
          {sidebarOpen ? 'Hide' : 'Show'} Sidebar
        </button>
      </div>
    </div>
  );

  // AI panel using existing AIAssistantPanelSimple component
  const aiPanel = safeAiPanelOpen ? (
    <div className="flex flex-col h-full" data-name="aiColumn">
      <AIAssistantPanelSimple />
    </div>
  ) : null;

  return (
    <>
      <BaseLayout
        navPanel={navPanel}
        contentPanel={contentPanel}
        aiPanel={aiPanel}
      />
      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
      />
    </>
  );
}
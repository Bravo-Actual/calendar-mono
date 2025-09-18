"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { DatePicker } from "@/components/date-picker";
import { NavUser } from "@/components/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsModal } from "@/components/settings-modal";
import { AIAssistantPanelSimple } from "@/components/ai";
import { useAppStore } from "@/store/app";
import { useHydrated } from "@/hooks/useHydrated";

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hydrated = useHydrated();
  const [aiPanelWidth, setAiPanelWidth] = useState(400);

  // Use app store for date state
  const {
    settingsModalOpen, setSettingsModalOpen, aiPanelOpen,
    sidebarOpen, toggleSidebar
  } = useAppStore()

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

  return (
    <div className="h-screen flex">
      {/* Sidebar Panel */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0.0, 0.2, 1],
              opacity: { duration: 0.2 }
            }}
            className="h-full bg-sidebar text-sidebar-foreground flex flex-col border-r border-border overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="border-sidebar-border h-16 border-b flex flex-row items-center px-4">
              <NavUser />
            </div>

            {/* Sidebar Content - Dates Only */}
            <div className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
              <ScrollArea className="h-full">
                <DatePicker />
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content and AI Area */}
      <Allotment
        split="vertical"
        resizerStyle={{ width: '4px', backgroundColor: 'hsl(var(--border))' }}
        onResize={(sizes) => {
          // Only update state when user manually resizes (not window resize)
          if (sizes && sizes.length === 2 && safeAiPanelOpen) {
            const newAiWidth = sizes[1];
            // Only update if it's a significant change (manual resize)
            if (Math.abs(newAiWidth - aiPanelWidth) > 10) {
              setAiPanelWidth(newAiWidth);
            }
          }
        }}
      >
        {/* Main Content */}
        <Allotment.Pane minSize={400}>
          <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border bg-background flex items-center px-4">
              <button
                onClick={toggleSidebar}
                className="p-2 hover:bg-muted rounded-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="ml-4 text-lg font-semibold">Schedule++</h1>
            </div>

            {/* Main Content Area - Placeholder */}
            <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30">
              <div className="text-center space-y-4">
                <div className="text-6xl">🗓️</div>
                <h2 className="text-2xl font-semibold text-muted-foreground">Schedule++ Layout Ready</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Calendar components have been removed. This is your clean layout foundation ready for new Schedule++ components.
                </p>
              </div>
            </div>
          </div>
        </Allotment.Pane>

        {/* AI Assistant Panel */}
        {safeAiPanelOpen && (
          <Allotment.Pane
            size={aiPanelWidth}
            minSize={320}
            maxSize={600}
          >
            <AIAssistantPanelSimple />
          </Allotment.Pane>
        )}
      </Allotment>

      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
      />
    </div>
  );
}
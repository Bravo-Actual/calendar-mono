"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavUser } from "@/components/nav-user";

// Panel Header component matching Figma design
interface PanelHeaderProps {
  title: string;
}

function PanelHeader({ title }: PanelHeaderProps) {
  return (
    <div className="relative h-12 w-full shrink-0" data-name="panelHeader">
      <div className="flex gap-2 items-center justify-start px-4 py-0 h-full w-full">
        <div className="font-normal text-base text-white leading-6">
          {title}
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-0 border-b border-neutral-900 pointer-events-none" />
    </div>
  );
}

// App Header component
function AppHeader() {
  return (
    <div className="relative h-full w-full" data-name="appHeader">
      <div className="flex items-center justify-between px-[8px] py-[10px] h-full w-full">
        <div className="flex gap-[10px] h-full items-center justify-start px-[8px] shrink-0" data-name="Nav">
          <div className="font-semibold text-xl text-white tracking-[-0.4px] leading-[1.2]">
            Schedule++
          </div>
        </div>
        <div className="bg-neutral-800 h-[48px] rounded-[8px] shrink-0 w-[299px] overflow-clip" data-name="userNavMenu">
          <NavUser />
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-0 border-b border-neutral-800 pointer-events-none" />
    </div>
  );
}

interface BaseLayoutProps {
  navPanel?: React.ReactNode;
  contentPanel?: React.ReactNode;
  aiPanel?: React.ReactNode;
  children?: React.ReactNode;
}

export function BaseLayout({
  navPanel,
  contentPanel,
  aiPanel,
  children
}: BaseLayoutProps) {
  return (
    <div className="bg-neutral-900 w-full h-screen overflow-hidden" data-name="page">
      <div className="flex flex-col w-full h-full" data-name="pageLayout">
        {/* App Header - spans full width, 56px height */}
        <div className="h-14 shrink-0 w-full" data-name="appHeader">
          <AppHeader />
        </div>

        {/* App Layout - contains all three columns */}
        <div className="flex flex-1 min-h-0" data-name="appLayout">
          {/* Nav Column - 300px width, no padding/rounded corners */}
          {navPanel && (
            <div className="bg-neutral-800 flex flex-col h-full shrink-0 w-[300px]" data-name="navColumn">
              <PanelHeader title="Calendar" />
              <div className="flex-1 min-h-0" data-name="minical">
                <ScrollArea className="h-full">
                  {navPanel}
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Page Column - fills remaining space */}
          <div className="flex flex-col h-full flex-1" data-name="pageColumn">
            <div className="flex flex-col h-full" data-name="pageContent">
              <PanelHeader title="Commands" />
              <div className="flex-1 min-h-0" data-name="content">
                <ScrollArea className="h-full">
                  {contentPanel || children}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* AI Column - 300px width */}
          {aiPanel && (
            <div className="flex flex-col h-full shrink-0 w-[300px]" data-name="aiColumn">
              {aiPanel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { PanelHeader };
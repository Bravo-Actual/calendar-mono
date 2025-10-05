'use client';

import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

export type LayoutSizes = {
  sidebarPx: number; // fixed; collapsible
  calendarFlex: boolean; // always true; stretches to fill
  detailsPx?: number; // optional column; resizable
  aiPx: number; // resizable and sticky
  detailsVisible: boolean;
  sidebarCollapsed: boolean;
};

const DEFAULTS: LayoutSizes = {
  sidebarPx: 308,
  calendarFlex: true,
  detailsPx: 400,
  aiPx: 400,
  detailsVisible: false,
  sidebarCollapsed: false,
};

const STORAGE_KEY = 'calendar:layout-sizes';

function usePersistedSizes(
  externalSizes?: Partial<LayoutSizes>,
  onSizesChange?: (sizes: LayoutSizes) => void
) {
  const [sizes, setSizes] = React.useState<LayoutSizes>(() => {
    // If external sizes provided, use them
    if (externalSizes) {
      return { ...DEFAULTS, ...externalSizes };
    }
    // Otherwise try localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // Sync with external changes
  React.useEffect(() => {
    if (externalSizes) {
      setSizes((prev) => ({ ...prev, ...externalSizes }));
    }
  }, [externalSizes]);

  // Persist and notify on changes
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    onSizesChange?.(sizes);
  }, [sizes, onSizesChange]);

  return [sizes, setSizes] as const;
}

export interface AdaptiveLayoutProps {
  sidebar: React.ReactNode;
  calendar: React.ReactNode;
  details: React.ReactNode;
  assistant: React.ReactNode;
  sizes?: Partial<LayoutSizes>;
  onSizesChange?: (sizes: LayoutSizes) => void;
  sidebarVisible?: boolean;
  detailsVisible?: boolean;
  aiVisible?: boolean;
}

export function AdaptiveLayout({
  sidebar,
  calendar,
  details,
  assistant,
  sizes: externalSizes,
  onSizesChange,
  sidebarVisible = true,
  detailsVisible = false,
  aiVisible = true,
}: AdaptiveLayoutProps) {
  const [sizes, setSizes] = usePersistedSizes(externalSizes, onSizesChange);
  const [resizing, setResizing] = React.useState(false);

  // Refs to measure px on drag end
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const calendarRef = React.useRef<HTMLDivElement>(null);
  const detailsRef = React.useRef<HTMLDivElement>(null);
  const aiRef = React.useRef<HTMLDivElement>(null);

  // Convert locked px -> percentages for the resizable view
  const toPercents = React.useCallback(() => {
    const total = containerRef.current?.getBoundingClientRect().width ?? 1;

    const sidebarPx = sidebarVisible ? (sizes.sidebarCollapsed ? 0 : sizes.sidebarPx) : 0;
    const aiPx = aiVisible ? sizes.aiPx : 0;
    const detailsPx = detailsVisible ? (sizes.detailsPx ?? 0) : 0;

    const fixedSum = sidebarPx + aiPx + detailsPx;
    const calPx = Math.max(320, total - fixedSum);

    const pct = (px: number) => Math.max(0, (px / total) * 100);

    return {
      sidebarPct: sidebarVisible ? pct(sidebarPx) : 0,
      calPct: pct(calPx),
      detailsPct: detailsVisible ? pct(detailsPx) : 0,
      aiPct: aiVisible ? pct(aiPx) : 0,
    };
  }, [sizes, sidebarVisible, detailsVisible, aiVisible]);

  // Begin resize session
  const startResizeSession = React.useCallback(() => {
    setResizing(true);
  }, []);

  // End resize session: measure px widths and lock them
  const endResizeSession = React.useCallback(() => {
    const sidebarPx = sidebarRef.current?.getBoundingClientRect().width ?? sizes.sidebarPx;
    const aiPx = aiRef.current?.getBoundingClientRect().width ?? sizes.aiPx;
    const detailsPx = detailsVisible
      ? (detailsRef.current?.getBoundingClientRect().width ?? sizes.detailsPx ?? 0)
      : sizes.detailsPx;

    setSizes((prev) => ({
      ...prev,
      sidebarPx: Math.round(sidebarPx),
      aiPx: Math.round(aiPx),
      detailsPx: detailsPx != null ? Math.round(detailsPx) : undefined,
    }));
    setResizing(false);
  }, [detailsVisible, sizes.sidebarPx, sizes.aiPx, sizes.detailsPx, setSizes]);

  return (
    <div ref={containerRef} className="h-screen w-full flex">
      {resizing ? (
        // Resizable mode (percent-based during drag)
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1"
          onPointerUp={endResizeSession}
        >
          {/* Sidebar */}
          {sidebarVisible && !sizes.sidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={toPercents().sidebarPct} minSize={15} maxSize={30}>
                <div ref={sidebarRef} className="h-full">
                  {sidebar}
                </div>
              </ResizablePanel>
              <ResizableHandle onPointerDown={startResizeSession} />
            </>
          )}

          {/* Calendar (stretch) */}
          <ResizablePanel defaultSize={toPercents().calPct} minSize={30}>
            <div ref={calendarRef} className="h-full">
              {calendar}
            </div>
          </ResizablePanel>

          {/* Details (optional) */}
          {detailsVisible && (
            <>
              <ResizableHandle withHandle onPointerDown={startResizeSession} />
              <ResizablePanel defaultSize={toPercents().detailsPct} minSize={15} maxSize={40}>
                <div ref={detailsRef} className="h-full">
                  {details}
                </div>
              </ResizablePanel>
            </>
          )}

          {/* AI panel */}
          {aiVisible && (
            <>
              <ResizableHandle withHandle onPointerDown={startResizeSession} />
              <ResizablePanel defaultSize={toPercents().aiPct} minSize={15} maxSize={50}>
                <div ref={aiRef} className="h-full">
                  {assistant}
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      ) : (
        // Locked mode (fixed px; only resizing changes sizes)
        <>
          {/* Sidebar */}
          {sidebarVisible && !sizes.sidebarCollapsed && (
            <div
              ref={sidebarRef}
              style={{
                flex: '0 0 auto',
                width: sizes.sidebarPx,
              }}
              className="h-full overflow-hidden"
            >
              {sidebar}
            </div>
          )}

          {/* Calendar (stretch) */}
          <div
            ref={calendarRef}
            style={{
              flex: '1 1 auto',
              minWidth: 320,
            }}
            className="h-full overflow-hidden"
          >
            {calendar}
          </div>

          {/* Details (optional) */}
          {detailsVisible && (
            <>
              <div
                className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize flex items-center justify-center relative group"
                onMouseDown={startResizeSession}
                onTouchStart={startResizeSession}
              >
                <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
              </div>
              <div
                ref={detailsRef}
                style={{
                  flex: '0 0 auto',
                  width: sizes.detailsPx ?? 400,
                  minWidth: 300,
                  maxWidth: 600,
                }}
                className="h-full overflow-hidden"
              >
                {details}
              </div>
            </>
          )}

          {/* AI panel */}
          {aiVisible && (
            <>
              <div
                className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize flex items-center justify-center relative group"
                onMouseDown={startResizeSession}
                onTouchStart={startResizeSession}
              >
                <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
              </div>
              <div
                ref={aiRef}
                style={{
                  flex: '0 0 auto',
                  width: sizes.aiPx,
                  minWidth: 300,
                }}
                className="h-full overflow-hidden"
              >
                {assistant}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

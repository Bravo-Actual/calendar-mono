// Calendar view component types

export interface SystemSlot {
  id: string;
  startAbs: number; // absolute epoch ms UTC
  endAbs: number; // absolute epoch ms UTC
  reason?: string;
}

export interface SelectedTimeRange {
  id: string; // internal ID
  startAbs: number; // absolute epoch ms UTC (start < end)
  endAbs: number; // absolute epoch ms UTC
}

// Calendar Context for AI Chat Integration
export interface CalendarTimeRange {
  start: string; // ISO datetime string
  end: string; // ISO datetime string
  description: string; // Human-readable description of what this range represents
}

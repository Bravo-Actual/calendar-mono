// Drag types and interfaces for dnd-kit integration
export type DragKind = 'move' | 'resize-start' | 'resize-end';

export interface DragProposal {
  type: 'move' | 'resize';
  eventId: string;
  newStartTime: Date;
  newEndTime: Date;
}

export interface CalendarGeometry {
  pxPerMs: number;
  snapStep: number;
  minDurMs: number;
  yToLocalMs: (y: number, step?: number) => number;
  localMsToY: (msInDay: number) => number;
  dayStartMs: number;
}

export interface DragState {
  eventId: string;
  kind: DragKind;
  originalStartMs: number;
  originalEndMs: number;
  originalDuration: number;
}

export interface PointerDelta {
  deltaX: number;
  deltaY: number;
  pointerY: number;
}

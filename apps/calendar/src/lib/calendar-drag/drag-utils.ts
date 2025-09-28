// Pure drag calculation functions
import type { DragProposal, DragKind, CalendarGeometry, PointerDelta } from './types';
import type { EventResolved } from '@/lib/data-v2';
import { clamp } from '../../components/utils';

export function calculateDragProposal(
  event: EventResolved,
  dragKind: DragKind,
  pointerDelta: PointerDelta,
  geometry: CalendarGeometry
): DragProposal {
  const { yToLocalMs, snapStep, dayStartMs } = geometry;

  // Convert pointer Y to local time within the day
  const targetLocalMs = yToLocalMs(pointerDelta.pointerY, snapStep);
  const targetAbsMs = dayStartMs + targetLocalMs;

  const originalStartMs = event.start_time_ms;
  const originalEndMs = event.end_time_ms;
  const duration = originalEndMs - originalStartMs;

  let newStartMs: number;
  let newEndMs: number;

  switch (dragKind) {
    case 'move': {
      // For move, center the event on the pointer position
      const halfDuration = Math.floor(duration / 2);
      newStartMs = targetAbsMs - halfDuration;
      newEndMs = newStartMs + duration;
      break;
    }
    case 'resize-start': {
      // Resize start time, keep end time fixed
      newStartMs = targetAbsMs;
      newEndMs = originalEndMs;
      // Ensure minimum duration
      if (newEndMs - newStartMs < geometry.minDurMs) {
        newStartMs = newEndMs - geometry.minDurMs;
      }
      break;
    }
    case 'resize-end': {
      // Resize end time, keep start time fixed
      newStartMs = originalStartMs;
      newEndMs = targetAbsMs;
      // Ensure minimum duration
      if (newEndMs - newStartMs < geometry.minDurMs) {
        newEndMs = newStartMs + geometry.minDurMs;
      }
      break;
    }
    default:
      throw new Error(`Unknown drag kind: ${dragKind}`);
  }

  // Apply time constraints (keep within day bounds)
  const { start: constrainedStart, end: constrainedEnd } = applyTimeConstraints(
    new Date(newStartMs),
    new Date(newEndMs),
    geometry
  );

  return {
    type: dragKind === 'move' ? 'move' : 'resize',
    eventId: event.id,
    newStartTime: constrainedStart,
    newEndTime: constrainedEnd
  };
}

export function applyTimeConstraints(
  startTime: Date,
  endTime: Date,
  geometry: CalendarGeometry
): { start: Date; end: Date } {
  const dayStart = new Date(geometry.dayStartMs);
  const dayEnd = new Date(geometry.dayStartMs + 24 * 60 * 60 * 1000); // 24 hours later

  let constrainedStart = new Date(startTime);
  let constrainedEnd = new Date(endTime);

  // Keep within day boundaries
  if (constrainedStart < dayStart) {
    const shift = dayStart.getTime() - constrainedStart.getTime();
    constrainedStart = dayStart;
    constrainedEnd = new Date(constrainedEnd.getTime() + shift);
  }

  if (constrainedEnd > dayEnd) {
    const shift = constrainedEnd.getTime() - dayEnd.getTime();
    constrainedEnd = dayEnd;
    constrainedStart = new Date(constrainedStart.getTime() - shift);
  }

  // Ensure minimum duration
  if (constrainedEnd.getTime() - constrainedStart.getTime() < geometry.minDurMs) {
    constrainedEnd = new Date(constrainedStart.getTime() + geometry.minDurMs);
  }

  return {
    start: constrainedStart,
    end: constrainedEnd
  };
}

export function calculatePointerDelta(
  dragOverEvent: any,
  dayColumnRect: DOMRect
): PointerDelta {
  // Extract pointer position from dnd-kit drag event
  const activatorEvent = dragOverEvent.activatorEvent as PointerEvent;
  const delta = dragOverEvent.delta || { x: 0, y: 0 };

  const pointerY = activatorEvent.clientY + delta.y - dayColumnRect.top;

  return {
    deltaX: delta.x,
    deltaY: delta.y,
    pointerY
  };
}
/**
 * Single Import Path for All Data Hooks
 * Implementation of GPT plan's barrel export pattern
 *
 * Usage: import { useUserCalendars, useEventsRange, useArchiveEvent } from '@/lib/data';
 */

// Base utilities
export * from './base/keys';
export * from './base/dexie';
export * from './base/assembly';
export * from './base/persist';
export * from './base/utils';
export { queryClient } from './base/persist';

// Domain hooks
export * from './domains/users';
export * from './domains/events';
export * from './domains/ai';
export * from './domains/attendees';

// Re-export factory for custom hooks
export * from './base/factory';
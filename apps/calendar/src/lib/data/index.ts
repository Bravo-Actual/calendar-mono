// index.ts - public surface of the unified data layer
export * from './queries';
export * from './base/client-types';
export { startRealtime } from './realtime/subscriptions';
export { db } from './base/dexie';
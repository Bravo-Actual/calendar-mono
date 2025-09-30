// index.ts - public surface of the unified data layer

export * from './base/client-types';
export { db } from './base/dexie';
export * from './queries';
export { startRealtime } from './realtime/subscriptions';

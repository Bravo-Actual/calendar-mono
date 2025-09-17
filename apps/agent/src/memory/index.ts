export { PostgresMemoryAdapter } from './PostgresMemoryAdapter';
export { MemoryService } from './MemoryService';
export * from './types';

// Factory function for easy setup
export function createMemoryService(connectionString: string, options?: {
  maxConnections?: number;
  ssl?: { rejectUnauthorized: boolean };
}) {
  return new MemoryService({
    connectionString,
    maxConnections: options?.maxConnections,
    ssl: options?.ssl,
  });
}
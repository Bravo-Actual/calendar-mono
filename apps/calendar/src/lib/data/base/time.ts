/**
 * Timestamp normalization utilities for PostgreSQL to ISO conversion
 */

export type ISODateString = string;
export type Millis = number;

/**
 * Convert PostgreSQL timestamp to ISO format
 * Handles: "2025-09-25 20:00:00+00" -> "2025-09-25T20:00:00+00:00"
 */
export function pgToIso(ts?: string | null): string | null {
  if (!ts) return ts ?? null;

  // Replace space with T
  let out = ts.replace(' ', 'T');

  // Fix timezone format: +hhmm -> +hh:mm, +hh -> +hh:00
  out = out.replace(/([+-]\d{2})(\d{2})$/, '$1:$2').replace(/([+-]\d{2})$/, '$1:00');

  return out;
}

/**
 * Convert ISO string to milliseconds (safe for epoch milliseconds)
 */
export const toMs = (isoString: string): number => new Date(isoString).getTime();
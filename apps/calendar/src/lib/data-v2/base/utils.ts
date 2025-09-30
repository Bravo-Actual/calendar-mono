// base/utils.ts

// Generate UUID v4 (works in all environments)
export const generateUUID = (): string => {
  // Try crypto.randomUUID if available (HTTPS)
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for HTTP environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Overlap predicate for time ranges
export const overlaps = (Afrom: number, Ato: number, Bstart: number, Bend: number) =>
  Bend >= Afrom && Bstart <= Ato;

// Convert ISO string to milliseconds
export const isoToMs = (iso: string) => Date.parse(iso);

// Convert milliseconds to ISO string
export const msToISO = (ms: number) => new Date(ms).toISOString();

// Get current ISO timestamp
export const nowISO = () => new Date().toISOString();

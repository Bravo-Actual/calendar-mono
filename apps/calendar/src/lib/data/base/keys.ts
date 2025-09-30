// base/keys.ts
export const keys = {
  eventsRange: (uid: string, from: number, to: number) => ['events', { uid, from, to }] as const,
  event: (uid: string, id: string) => ['event', { uid, id }] as const,
  calendars: (uid: string) => ['calendars', { uid }] as const,
  categories: (uid: string) => ['categories', { uid }] as const,
  personas: (uid: string) => ['personas', { uid }] as const,
  annotations: (uid: string) => ['annotations', { uid }] as const,
  annotationsRange: (uid: string, from: number, to: number) =>
    ['annotations', { uid, from, to }] as const,
  profile: (uid: string) => ['profile', { uid }] as const,
  userWorkPeriods: (uid: string) => ['work-periods', { uid }] as const,
};

// Re-export Mastra's storage types
export type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from "@mastra/core/memory";

export const PERSONA_SENTINEL = "00000000-0000-0000-0000-000000000000";

export function makeResourceId(userId: string, personaId?: string | null) {
  return `${userId}:${personaId ?? PERSONA_SENTINEL}`;
}

export function splitResourceId(resourceId: string): { userId: string; personaId: string | null } {
  const [userId, p] = resourceId.split(":");
  return { userId, personaId: p === PERSONA_SENTINEL ? null : p };
}

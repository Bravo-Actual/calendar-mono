// data-v2/domains/ai-personas.ts - Offline-first ai personas implementation
import { useLiveQuery } from 'dexie-react-hooks';
import type { ClientPersona } from '../base/client-types';
import { db } from '../base/dexie';
import { mapPersonaFromServer, mapPersonaToServer } from '../base/mapping';
import { addToOutboxWithMerging } from '../base/outbox-utils';
import { pullTable } from '../base/sync';
import { generateUUID } from '../base/utils';
import { PersonaSchema, validateBeforeEnqueue } from '../base/validators';

// Read hooks using useLiveQuery (instant, reactive)
export function useAIPersonas(uid: string | undefined) {
  return useLiveQuery(async (): Promise<ClientPersona[]> => {
    if (!uid) return [];

    return await db.ai_personas.where('user_id').equals(uid).sortBy('created_at');
  }, [uid]);
}

export function useAIPersona(uid: string | undefined, personaId: string | undefined) {
  return useLiveQuery(async (): Promise<ClientPersona | undefined> => {
    if (!uid || !personaId) return undefined;

    const persona = await db.ai_personas.get(personaId);
    return persona?.user_id === uid ? persona : undefined;
  }, [uid, personaId]);
}

// Dexie-first mutations with outbox pattern
export async function createAIPersona(
  uid: string,
  input: {
    name: string;
    avatar_url?: string | null;
    traits?: string | null;
    instructions?: string | null;
    greeting?: string | null;
    agent_id?: string | null;
    model_id?: string | null;
    temperature?: number | null;
    top_p?: number | null;
    is_default?: boolean;
    properties_ext?: any;
  }
): Promise<ClientPersona> {
  const id = generateUUID();
  const now = new Date();

  const persona: ClientPersona = {
    id,
    user_id: uid,
    name: input.name,
    avatar_url: input.avatar_url ?? null,
    traits: input.traits ?? null,
    instructions: input.instructions ?? null,
    greeting: input.greeting ?? null,
    agent_id: input.agent_id ?? null,
    model_id: input.model_id ?? null,
    temperature: input.temperature ?? null,
    top_p: input.top_p ?? null,
    is_default: input.is_default ?? false,
    properties_ext: input.properties_ext ?? {},
    created_at: now,
    updated_at: now,
  };

  // 1. Validate before enqueue (per plan spec)
  const validatedPersona = validateBeforeEnqueue(PersonaSchema, persona);

  // 2. Write to Dexie first (instant optimistic update)
  await db.ai_personas.put(validatedPersona);

  // 3. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapPersonaToServer(validatedPersona);
  await addToOutboxWithMerging(uid, 'ai_personas', 'insert', serverPayload, id);

  return persona;
}

export async function updateAIPersona(
  uid: string,
  personaId: string,
  input: {
    name?: string;
    avatar_url?: string | null;
    traits?: string | null;
    instructions?: string | null;
    greeting?: string | null;
    agent_id?: string | null;
    model_id?: string | null;
    temperature?: number | null;
    top_p?: number | null;
    is_default?: boolean;
    properties_ext?: any;
  }
): Promise<void> {
  // 1. Get existing persona from Dexie
  const existing = await db.ai_personas.get(personaId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('AI persona not found or access denied');
  }

  const now = new Date();
  const updated: ClientPersona = {
    ...existing,
    ...input,
    updated_at: now,
  };

  // 2. Validate before enqueue (per plan spec)
  const validatedPersona = validateBeforeEnqueue(PersonaSchema, updated);

  // 3. Write to Dexie first (instant optimistic update)
  await db.ai_personas.put(validatedPersona);

  // 4. Enqueue in outbox for eventual server sync (convert Date objects to ISO strings)
  const serverPayload = mapPersonaToServer(validatedPersona);
  await addToOutboxWithMerging(uid, 'ai_personas', 'update', serverPayload, personaId);
}

export async function deleteAIPersona(uid: string, personaId: string): Promise<void> {
  // 1. Get existing persona from Dexie
  const existing = await db.ai_personas.get(personaId);
  if (!existing || existing.user_id !== uid) {
    throw new Error('AI persona not found or access denied');
  }

  // 2. Delete from Dexie first (instant optimistic update)
  await db.ai_personas.delete(personaId);

  // 3. Enqueue in outbox for eventual server sync
  await addToOutboxWithMerging(uid, 'ai_personas', 'delete', { id: personaId }, personaId);
}

// Data sync functions (called by DataProvider)
export async function pullAIPersonas(uid: string): Promise<void> {
  return pullTable('ai_personas', uid, mapPersonaFromServer);
}

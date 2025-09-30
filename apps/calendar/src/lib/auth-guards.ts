// auth-guards.ts
import { createClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export class AuthError extends Error {
  constructor(public code: 'SIGNED_OUT' | 'UNAUTHORIZED') {
    super(code);
  }
}

// Fast check when you need the user id
export async function requireUserId(supabase?: SupabaseClient): Promise<string> {
  const client = supabase || createClient();
  const { data: { session } } = await client.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new AuthError('SIGNED_OUT');
  return uid;
}

// Lightweight boolean guard (no throw)
export async function isSignedIn(supabase?: SupabaseClient): Promise<boolean> {
  const client = supabase || createClient();
  const { data: { session } } = await client.auth.getSession();
  return !!session?.user?.id;
}

// Get valid session or throw
export async function requireSession(supabase?: SupabaseClient) {
  const client = supabase || createClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user?.id || !session.access_token) {
    throw new AuthError('SIGNED_OUT');
  }
  return session;
}
// data-v2/base/client.ts - Simple client for client-side app
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@repo/supabase';

// Use regular createClient for client app, not SSR
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
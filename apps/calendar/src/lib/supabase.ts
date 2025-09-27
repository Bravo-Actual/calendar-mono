import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@repo/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createClient = () => {
  // Check if WebCrypto is available (HTTPS environments)
  const isWebCryptoAvailable = typeof crypto !== 'undefined' &&
    crypto.subtle !== undefined &&
    typeof TextEncoder !== 'undefined'

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Use PKCE when WebCrypto is available (HTTPS), implicit flow otherwise (HTTP)
      flowType: isWebCryptoAvailable ? 'pkce' : 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
    // Realtime configuration for offline-first data layer
    realtime: {
      params: { eventsPerSecond: 10 }
    },
  })
}

// For backward compatibility with existing code
export const supabase = createClient()
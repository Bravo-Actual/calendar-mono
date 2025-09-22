import { createClient } from '@/lib/supabase'

/**
 * Converts a relative avatar path to a full public URL using the current environment's Supabase URL
 * @param relativePath - The relative path stored in the database (e.g., "userId/filename.jpg")
 * @returns The full public URL or null if no relative path provided
 */
export function getAvatarUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null

  // If it's already a full URL, return as is (for backward compatibility)
  if (relativePath.startsWith('http')) {
    return relativePath
  }

  // Generate full URL using current environment's Supabase client
  const supabase = createClient()
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(relativePath)

  return publicUrl
}
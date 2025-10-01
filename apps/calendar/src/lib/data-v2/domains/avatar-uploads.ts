// data-v2/domains/avatar-uploads.ts - Avatar upload utilities for v2 data layer
import { supabase } from '../../supabase';
import { updateAIPersona } from './ai-personas';
import { updateUserProfile } from './user-profiles';

/**
 * Uploads a user profile avatar to storage and updates the user profile
 * @param userId - The user ID
 * @param imageBlob - The cropped image blob from AvatarManager
 * @returns Promise resolving to the relative path stored in the database
 */
export async function uploadUserProfileAvatar(userId: string, imageBlob: Blob): Promise<string> {
  // Generate unique filename
  const fileExt = 'jpg'; // AvatarManager always provides JPEG
  const fileName = `${userId}/profile-${Date.now()}.${fileExt}`;

  // Convert blob to file for upload
  const file = new File([imageBlob], `profile-avatar.${fileExt}`, { type: 'image/jpeg' });

  // Upload file to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Update user profile with new avatar URL using v2 function
  await updateUserProfile(userId, { avatar_url: fileName });

  return fileName;
}

/**
 * Uploads an AI persona avatar to storage and updates the persona
 * @param userId - The user ID (for auth)
 * @param personaId - The persona ID to update
 * @param imageBlob - The cropped image blob from AvatarManager
 * @returns Promise resolving to the relative path stored in the database
 */
export async function uploadAIPersonaAvatar(
  userId: string,
  personaId: string,
  imageBlob: Blob
): Promise<string> {
  // Generate unique filename
  const fileExt = 'jpg'; // AvatarManager always provides JPEG
  const fileName = `${userId}/${personaId}-${Date.now()}.${fileExt}`;

  // Convert blob to file for upload
  const file = new File([imageBlob], `persona-avatar.${fileExt}`, { type: 'image/jpeg' });

  // Upload file to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Update persona with new avatar URL using v2 function
  await updateAIPersona(userId, personaId, { avatar_url: fileName });

  return fileName;
}

/**
 * Deletes a user profile avatar from storage and clears the avatar_url
 * @param userId - The user ID
 * @param avatarUrl - The relative path to delete
 */
export async function deleteUserProfileAvatar(
  userId: string,
  avatarUrl?: string | null
): Promise<void> {
  if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
    // Only delete if it's a relative path (stored in our bucket)
    await supabase.storage.from('avatars').remove([avatarUrl]);
  }

  // Clear avatar URL from user profile
  await updateUserProfile(userId, { avatar_url: null });
}

/**
 * Deletes an AI persona avatar from storage and clears the avatar_url
 * @param userId - The user ID (for auth)
 * @param personaId - The persona ID
 * @param avatarUrl - The relative path to delete
 */
export async function deleteAIPersonaAvatar(
  userId: string,
  personaId: string,
  avatarUrl?: string | null
): Promise<void> {
  if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
    // Only delete if it's a relative path (stored in our bucket)
    await supabase.storage.from('avatars').remove([avatarUrl]);
  }

  // Clear avatar URL from persona
  await updateAIPersona(userId, personaId, { avatar_url: null });
}

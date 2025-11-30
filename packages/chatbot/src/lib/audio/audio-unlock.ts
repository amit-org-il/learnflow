import { audioContext, releaseAllAudioContexts } from './audio-utils';

let audioUnlocked = false;

/**
 * Check if audio has been unlocked
 */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Unlock audio playback (call on user interaction)
 *
 * This should be called on the first user interaction with the chatbot
 * (e.g., clicking the chat button, sending a message).
 *
 * @returns true if audio was unlocked successfully
 */
export async function unlockAudio(): Promise<boolean> {
  if (audioUnlocked) return true;

  try {
    // Use the full audioContext() which handles autoplay policy
    await audioContext({ id: 'audio-unlock' });
    audioUnlocked = true;
    console.log('[Audio] Unlocked successfully');
    return true;
  } catch (err) {
    console.error('[Audio] Failed to unlock:', err);
    return false;
  }
}

/**
 * Cleanup all audio contexts (call on app unmount)
 */
export function cleanupAudio(): void {
  releaseAllAudioContexts();
  audioUnlocked = false;
}

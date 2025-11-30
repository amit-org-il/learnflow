/**
 * Audio Utilities
 *
 * Utility functions for audio context management and data conversion.
 * Handles browser audio autoplay restrictions gracefully.
 */

export type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

/**
 * Cache for reusing AudioContext instances by ID
 * Browsers typically limit to 6-8 AudioContexts per page
 */
const audioContextCache: Map<string, AudioContext> = new Map();

/**
 * Promise that resolves on first user interaction
 * Required for browsers that block autoplay
 */
let didInteractPromise: Promise<void> | null = null;

const getDidInteractPromise = (): Promise<void> => {
  if (!didInteractPromise) {
    didInteractPromise = new Promise((resolve) => {
      const handler = () => {
        resolve();
        window.removeEventListener("pointerdown", handler);
        window.removeEventListener("keydown", handler);
      };
      window.addEventListener("pointerdown", handler, { once: true });
      window.addEventListener("keydown", handler, { once: true });
    });
  }
  return didInteractPromise;
};

/**
 * Get or create an AudioContext with proper autoplay handling
 *
 * Attempts to create AudioContext immediately, falls back to waiting
 * for user interaction if blocked by browser autoplay policy.
 *
 * @param options - AudioContext options plus optional ID for caching
 * @returns Promise resolving to AudioContext
 *
 * @example
 * const ctx = await audioContext({ sampleRate: 16000, id: 'recording' });
 */
export const audioContext = async (
  options?: GetAudioContextOptions
): Promise<AudioContext> => {
  // Check cache first
  if (options?.id && audioContextCache.has(options.id)) {
    const cached = audioContextCache.get(options.id);
    if (cached) {
      // Resume if suspended
      if (cached.state === 'suspended') {
        console.log(`[audio-utils] Resuming cached AudioContext '${options.id}' (was suspended)`);
        await cached.resume();
      }
      return cached;
    }
  }

  try {
    // Try to play a tiny silent audio to test if autoplay is allowed
    const testAudio = new Audio();
    testAudio.src =
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    await testAudio.play();

    // Autoplay allowed, create context immediately
    const ctx = new AudioContext(options);
    console.log(`[audio-utils] AudioContext created (autoplay allowed) - state: ${ctx.state}`);
    if (options?.id) {
      audioContextCache.set(options.id, ctx);
    }
    return ctx;
  } catch {
    // Autoplay blocked, wait for user interaction
    console.warn('[audio-utils] Autoplay blocked, waiting for user gesture...');
    await getDidInteractPromise();
    console.log('[audio-utils] User gesture detected, creating AudioContext');

    // Check cache again after waiting
    if (options?.id && audioContextCache.has(options.id)) {
      const cached = audioContextCache.get(options.id);
      if (cached) {
        if (cached.state === 'suspended') {
          await cached.resume();
        }
        return cached;
      }
    }

    const ctx = new AudioContext(options);
    console.log(`[audio-utils] AudioContext created after user gesture - state: ${ctx.state}`);
    if (options?.id) {
      audioContextCache.set(options.id, ctx);
    }
    return ctx;
  }
};

/**
 * Release and close an AudioContext from the cache
 *
 * @param id - The ID used when creating the AudioContext
 * @returns true if context was found and closed, false otherwise
 */
export const releaseAudioContext = (id: string): boolean => {
  const ctx = audioContextCache.get(id);
  if (ctx) {
    audioContextCache.delete(id);
    if (ctx.state !== 'closed') {
      ctx.close().catch((err) => {
        console.warn(`[audio-utils] Error closing AudioContext '${id}':`, err);
      });
    }
    return true;
  }
  return false;
};

/**
 * Release all AudioContexts (call on app unmount)
 */
export const releaseAllAudioContexts = (): void => {
  audioContextCache.forEach((ctx, id) => {
    if (ctx.state !== 'closed') {
      ctx.close().catch((err) => {
        console.warn(`[audio-utils] Error closing AudioContext '${id}':`, err);
      });
    }
  });
  audioContextCache.clear();
};

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert Blob to JSON
 */
export const blobToJSON = <T = unknown>(blob: Blob): Promise<T> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        try {
          const json = JSON.parse(reader.result as string);
          resolve(json as T);
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e}`));
        }
      } else {
        reject(new Error("FileReader returned empty result"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

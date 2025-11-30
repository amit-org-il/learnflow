import { ref, onUnmounted, type Ref, type ShallowRef, type ComputedRef, computed } from 'vue';
import { GeminiAudioHandler } from '../lib/audio/GeminiAudioHandler';
import type { TalkingHead, MouthShapeValues } from '../types/index';

export interface UseGeminiLipsyncOptions {
  /** TalkingHead instance ref */
  avatarInstance: ShallowRef<TalkingHead | null>;
  /** Sample rate (default: 24000 for Gemini) */
  sampleRate?: number;
  /** Callback when playback starts */
  onStart?: () => void;
  /** Callback when playback stops */
  onStop?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseGeminiLipsyncReturn {
  isPlaying: ComputedRef<boolean>;
  initialize: () => Promise<void>;
  playChunk: (base64Audio: string, isFinal?: boolean) => void;
  complete: () => void;
  stop: () => void;
  cleanup: () => void;
}

export function useGeminiLipsync(options: UseGeminiLipsyncOptions): UseGeminiLipsyncReturn {
  const {
    avatarInstance,
    sampleRate = 24000,
    onStart,
    onStop,
    onError,
  } = options;

  const _isPlaying = ref(false);

  let handler: GeminiAudioHandler | null = null;

  /**
   * Initialize GeminiAudioHandler
   */
  async function initialize(): Promise<void> {
    if (handler) {
      console.log('[useGeminiLipsync] Already initialized');
      return;
    }

    try {
      handler = new GeminiAudioHandler(sampleRate);

      // Listen for mouth shape updates
      // CRITICAL: Apply directly to TalkingHead, NOT reactive state!
      handler.on('mouthShape', (shape) => {
        const avatar = avatarInstance.value;
        if (avatar?.setMouthShape) {
          avatar.setMouthShape(shape as MouthShapeValues);
        }
      });

      handler.on('start', () => {
        _isPlaying.value = true;
        onStart?.();
      });

      handler.on('stop', () => {
        _isPlaying.value = false;
        onStop?.();
      });

      handler.on('error', (error) => {
        console.error('[useGeminiLipsync] Error:', error);
        onError?.(error);
      });

      await handler.initialize();
      console.log('[useGeminiLipsync] Initialized');

    } catch (err) {
      console.error('[useGeminiLipsync] Failed to initialize:', err);
      handler = null;
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Play audio chunk
   */
  function playChunk(base64Audio: string, isFinal = false): void {
    if (!handler) {
      console.warn('[useGeminiLipsync] Not initialized, cannot play audio');
      return;
    }
    handler.playChunk(base64Audio);

    if (isFinal) {
      complete();
    }
  }

  /**
   * Mark playback as complete
   */
  function complete(): void {
    if (handler) {
      handler.complete();
    }
  }

  /**
   * Stop playback
   */
  function stop(): void {
    if (handler) {
      handler.stop();
    }
    _isPlaying.value = false;

    // Reset mouth shape
    const avatar = avatarInstance.value;
    if (avatar?.setMouthShape) {
      avatar.setMouthShape({ jawOpen: 0, mouthOpen: 0 });
    }
  }

  /**
   * Cleanup handler
   */
  function cleanup(): void {
    if (handler) {
      handler.stop();
      handler.removeAllListeners();
      handler.dispose();
      handler = null;
    }
    _isPlaying.value = false;
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isPlaying: computed(() => _isPlaying.value),
    initialize,
    playChunk,
    complete,
    stop,
    cleanup,
  };
}

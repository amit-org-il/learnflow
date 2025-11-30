import { ref, shallowRef, onUnmounted, type Ref, type ShallowRef, type ComputedRef, computed } from 'vue';
import type { TalkingHead } from '../types/index';

export interface UseAvatarOptions {
  /** Lip-sync language (default: 'en') */
  lipsyncLang?: string;
  /** Initial camera view */
  initialView?: 'head' | 'body' | 'full';
  /** Initial mood */
  initialMood?: string;
}

export interface StreamOptions {
  sampleRate: number;
  mood?: string;
  gain?: number;
  lipsyncType?: 'visemes' | 'frequency';
}

export interface StreamAudioData {
  audio: ArrayBuffer;
  visemes?: string[];
  vtimes?: number[];
  vdurations?: number[];
  words?: string[];
  wtimes?: number[];
  wdurations?: number[];
}

export interface UseAvatarReturn {
  // Refs
  containerRef: Ref<HTMLDivElement | null>;
  avatarInstance: ShallowRef<TalkingHead | null>;

  // State
  isLoading: ComputedRef<boolean>;
  loadingProgress: ComputedRef<number>;
  isReady: ComputedRef<boolean>;
  error: ComputedRef<string | null>;

  // Actions
  initialize: (container: HTMLDivElement) => Promise<void>;
  loadAvatar: (url: string, gender?: 'male' | 'female') => Promise<void>;
  setMood: (mood: string, level?: number) => void;
  setView: (view: 'head' | 'body' | 'full') => void;
  playGesture: (gesture: string, duration?: number) => void;
  stopGesture: () => void;
  speakEmoji: (emoji: string) => void;
  setLighting: (options: Record<string, number>) => void;
  stop: () => void;
  cleanup: () => void;

  // For TTS integration
  streamStart: (options: StreamOptions, onStart?: () => void, onEnd?: () => void) => void;
  streamAudio: (data: StreamAudioData) => void;
  streamNotifyEnd: () => void;
}

// TalkingHead class from dynamic import
let TalkingHeadClass: any = null;

/**
 * Load TalkingHead class dynamically from public folder
 */
async function loadTalkingHeadClass(): Promise<any> {
  if (TalkingHeadClass) return TalkingHeadClass;

  try {
    // Dynamic import from public folder
    // @ts-expect-error - This module is loaded at runtime from public folder
    const module = await import('/lib/talkinghead/talkinghead.mjs');
    TalkingHeadClass = module.TalkingHead;
    return TalkingHeadClass;
  } catch (err) {
    console.error('[useAvatar] Failed to load TalkingHead:', err);
    throw new Error('Failed to load avatar engine. Please refresh the page.');
  }
}

export function useAvatar(options: UseAvatarOptions = {}): UseAvatarReturn {
  const { lipsyncLang = 'en', initialView = 'head', initialMood = 'neutral' } = options;

  // Refs
  const containerRef = ref<HTMLDivElement | null>(null);
  const avatarInstance = shallowRef<TalkingHead | null>(null);

  // State
  const _isLoading = ref(false);
  const _loadingProgress = ref(0);
  const _isReady = ref(false);
  const _error = ref<string | null>(null);

  // Guards
  let isInitializing = false;

  /**
   * Initialize TalkingHead instance
   */
  async function initialize(container: HTMLDivElement): Promise<void> {
    if (isInitializing || avatarInstance.value) {
      console.log('[useAvatar] Already initialized or initializing');
      return;
    }

    isInitializing = true;
    _error.value = null;

    try {
      const TH = await loadTalkingHeadClass();

      avatarInstance.value = new TH(container, {
        cameraView: initialView,
        avatarMood: initialMood,
        lipsyncLang,
      });

      containerRef.value = container;
      console.log('[useAvatar] TalkingHead initialized');
    } catch (err) {
      _error.value = err instanceof Error ? err.message : 'Initialization failed';
      throw err;
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Load avatar model with retry logic
   */
  async function loadAvatar(url: string, gender: 'male' | 'female' = 'female'): Promise<void> {
    if (!avatarInstance.value) {
      throw new Error('TalkingHead not initialized');
    }

    _isLoading.value = true;
    _loadingProgress.value = 0;
    _error.value = null;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[useAvatar] Retry attempt ${attempt}/${maxRetries}`);
        }

        const instance = avatarInstance.value;
        if (!instance?.showAvatar) {
          throw new Error('TalkingHead showAvatar method not available');
        }

        await instance.showAvatar(
          {
            url,
            body: gender === 'male' ? 'M' : 'F',
            avatarMood: initialMood,
            lipsyncLang,
          },
          (progress: number) => {
            _loadingProgress.value = Math.round(progress * 100);
          }
        );

        _isLoading.value = false;
        _isReady.value = true;
        console.log('[useAvatar] Avatar loaded successfully');
        return;

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[useAvatar] Load attempt ${attempt + 1} failed:`, err);

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    _isLoading.value = false;
    _error.value = lastError?.message || 'Failed to load avatar';
    throw lastError;
  }

  // Avatar control methods
  function setMood(mood: string, level = 1) {
    avatarInstance.value?.setMood?.(mood, level);
  }

  function setView(view: 'head' | 'body' | 'full') {
    avatarInstance.value?.setView?.(view);
  }

  function playGesture(gesture: string, duration?: number) {
    avatarInstance.value?.playGesture?.(gesture, duration);
  }

  function stopGesture() {
    avatarInstance.value?.stopGesture?.();
  }

  function speakEmoji(emoji: string) {
    avatarInstance.value?.speakEmoji?.(emoji);
  }

  function setLighting(options: Record<string, number>) {
    avatarInstance.value?.setLighting?.(options);
  }

  function stop() {
    avatarInstance.value?.stop?.();
  }

  // Streaming methods (for Azure TTS)
  function streamStart(options: StreamOptions, onStart?: () => void, onEnd?: () => void) {
    // TalkingHead streaming API
    (avatarInstance.value as any)?.streamStart?.(options, onStart, onEnd);
  }

  function streamAudio(data: StreamAudioData) {
    (avatarInstance.value as any)?.streamAudio?.(data);
  }

  function streamNotifyEnd() {
    (avatarInstance.value as any)?.streamNotifyEnd?.();
  }

  function cleanup() {
    if (avatarInstance.value) {
      avatarInstance.value.deleteAvatar?.();
      avatarInstance.value = null;
    }
    _isReady.value = false;
    _loadingProgress.value = 0;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
  });

  return {
    containerRef,
    avatarInstance,
    isLoading: computed(() => _isLoading.value),
    loadingProgress: computed(() => _loadingProgress.value),
    isReady: computed(() => _isReady.value),
    error: computed(() => _error.value),
    initialize,
    loadAvatar,
    setMood,
    setView,
    playGesture,
    stopGesture,
    speakEmoji,
    setLighting,
    stop,
    cleanup,
    streamStart,
    streamAudio,
    streamNotifyEnd,
  };
}

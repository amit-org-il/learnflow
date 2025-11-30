import { ref, computed, onUnmounted, type ComputedRef } from 'vue';
import { AudioRecorder, type AudioRecorderError } from '../lib/audio/AudioRecorder';

export interface UseVoiceRecordingOptions {
  /** Target sample rate (default: 16000 Hz) */
  sampleRate?: number;

  /** Callback for audio chunks */
  onAudioChunk: (base64: string, sampleRate: number, isFinal: boolean) => void;

  /** Voice Activity Detection threshold (default: 0.15) */
  vadThreshold?: number;

  /** Whether to interrupt avatar speech when starting to record */
  interruptOnStart?: boolean;

  /** Callback to interrupt avatar speech */
  onInterruptSpeech?: () => void;

  /** Callback when recording starts */
  onStart?: () => void;

  /** Callback when recording stops */
  onStop?: () => void;

  /** Callback for errors */
  onError?: (error: AudioRecorderError) => void;

  /** Callback for volume changes (0-1 normalized) */
  onVolumeChange?: (level: number) => void;
}

export interface VoiceRecordingState {
  isRecording: ComputedRef<boolean>;
  isInitializing: ComputedRef<boolean>;
  error: ComputedRef<AudioRecorderError | null>;
  volumeLevel: ComputedRef<number>;
  hasPermission: ComputedRef<boolean | null>;
}

export interface VoiceRecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
  setVadThreshold: (threshold: number) => void;
}

export interface UseVoiceRecordingReturn {
  state: VoiceRecordingState;
  actions: VoiceRecordingActions;
}

export function useVoiceRecording(options: UseVoiceRecordingOptions): UseVoiceRecordingReturn {
  // ========================================
  // STATE
  // ========================================

  const isRecording = ref(false);
  const isInitializing = ref(false);
  const error = ref<AudioRecorderError | null>(null);
  const volumeLevel = ref(0);
  const hasPermission = ref<boolean | null>(null);

  let recorder: AudioRecorder | null = null;

  // ========================================
  // ACTIONS
  // ========================================

  async function startRecording(): Promise<void> {
    if (isRecording.value || isInitializing.value) {
      console.warn('[useVoiceRecording] Already recording or initializing');
      return;
    }

    isInitializing.value = true;
    error.value = null;

    try {
      // Create recorder instance
      recorder = new AudioRecorder({
        sampleRate: options.sampleRate || 16000,
        vadThreshold: options.vadThreshold ?? 0.15,
        onAudioChunk: (base64, sampleRate, isFinal) => {
          options.onAudioChunk(base64, sampleRate, isFinal);
        },
        onVolumeChange: (level) => {
          volumeLevel.value = level;
          options.onVolumeChange?.(level);
        }
      });

      // Start recording (may throw)
      await recorder.start();

      // Only interrupt AFTER successful start
      if (options.interruptOnStart && options.onInterruptSpeech) {
        options.onInterruptSpeech();
      }

      // Update state
      isRecording.value = true;
      hasPermission.value = true;
      options.onStart?.();

      console.log('[useVoiceRecording] Started recording');

    } catch (err) {
      // Discriminate error types
      const audioError = err as AudioRecorderError;
      error.value = audioError;

      // Update permission state only for permission errors
      if (audioError.type === 'permission_denied') {
        hasPermission.value = false;
      }

      options.onError?.(audioError);
      console.error('[useVoiceRecording] Failed to start:', audioError);

    } finally {
      isInitializing.value = false;
    }
  }

  function stopRecording(): void {
    if (!isRecording.value || !recorder) {
      console.warn('[useVoiceRecording] Not recording');
      return;
    }

    recorder.stop();
    recorder = null;
    isRecording.value = false;
    volumeLevel.value = 0;

    options.onStop?.();
    console.log('[useVoiceRecording] Stopped recording');
  }

  async function toggleRecording(): Promise<void> {
    if (isRecording.value) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  function setVadThreshold(threshold: number): void {
    if (recorder) {
      recorder.setVadThreshold(threshold);
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  onUnmounted(() => {
    if (recorder) {
      recorder.stop();
      recorder = null;
    }
  });

  // ========================================
  // RETURN
  // ========================================

  return {
    state: {
      isRecording: computed(() => isRecording.value),
      isInitializing: computed(() => isInitializing.value),
      error: computed(() => error.value),
      volumeLevel: computed(() => volumeLevel.value),
      hasPermission: computed(() => hasPermission.value)
    },
    actions: {
      startRecording,
      stopRecording,
      toggleRecording,
      setVadThreshold
    }
  };
}

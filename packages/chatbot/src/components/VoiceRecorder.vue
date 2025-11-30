<template>
  <div class="voice-recorder" :class="className">
    <!-- Main Record Button -->
    <button
      class="voice-recorder__button"
      :class="{
        'voice-recorder__button--recording': state.isRecording,
        'voice-recorder__button--disabled': !isConnected,
        'voice-recorder__button--loading': state.isInitializing
      }"
      :style="{ width: `${size}px`, height: `${size}px` }"
      :disabled="!isConnected || state.isInitializing"
      :aria-label="state.isRecording ? 'Stop recording' : 'Start recording'"
      @click="actions.toggleRecording"
    >
      <!-- Mic Icon -->
      <svg v-if="!state.isRecording" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>

      <!-- Stop Icon -->
      <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>

      <!-- Loading Spinner -->
      <div v-if="state.isInitializing" class="voice-recorder__spinner" aria-label="Initializing microphone" />
    </button>

    <!-- Volume Indicator (Animated Ring) -->
    <div
      v-if="showVolume && state.isRecording"
      class="voice-recorder__volume"
      :style="{ transform: `scale(${1 + state.volumeLevel * 0.5})` }"
      aria-hidden="true"
    />

    <!-- Label -->
    <span v-if="label" class="voice-recorder__label">{{ label }}</span>

    <!-- Error Message -->
    <span v-if="state.error" class="voice-recorder__error" role="alert">
      {{ getErrorMessage(state.error) }}
    </span>

    <!-- Speaking Indicator -->
    <span v-if="isSpeaking && !state.isRecording" class="voice-recorder__hint">
      Tap to interrupt
    </span>
  </div>
</template>

<script setup lang="ts">
import type { AudioRecorderError } from '../lib/audio/AudioRecorder';

interface VoiceRecordingState {
  isRecording: boolean;
  isInitializing: boolean;
  error: AudioRecorderError | null;
  volumeLevel: number;
  hasPermission: boolean | null;
}

interface VoiceRecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
}

interface Props {
  /** Voice recording state from useVoiceRecording */
  state: VoiceRecordingState;

  /** Voice recording actions from useVoiceRecording */
  actions: VoiceRecordingActions;

  /** Whether socket is connected */
  isConnected?: boolean;

  /** Whether avatar is currently speaking */
  isSpeaking?: boolean;

  /** Button size in pixels */
  size?: number;

  /** Additional CSS class */
  className?: string;

  /** Whether to show volume indicator ring */
  showVolume?: boolean;

  /** Label text below button */
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isConnected: true,
  isSpeaking: false,
  size: 64,
  showVolume: true
});

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: AudioRecorderError | null): string {
  if (!error) return '';

  switch (error.type) {
    case 'permission_denied':
      return 'Microphone access denied';
    case 'not_supported':
      return 'Microphone not available';
    case 'worklet_load_failed':
      return 'Audio system error';
    default:
      return 'Recording failed';
  }
}
</script>

<style scoped>
.voice-recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.voice-recorder__button {
  border-radius: 50%;
  border: none;
  background: #4a5568;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.voice-recorder__button svg {
  width: 40%;
  height: 40%;
}

.voice-recorder__button:hover:not(:disabled) {
  background: #2d3748;
  transform: scale(1.05);
}

.voice-recorder__button:active:not(:disabled) {
  transform: scale(0.95);
}

.voice-recorder__button--recording {
  background: #e53e3e;
  animation: pulse 1.5s ease-in-out infinite;
}

.voice-recorder__button--recording:hover {
  background: #c53030;
}

.voice-recorder__button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.voice-recorder__button--loading {
  opacity: 0.7;
  cursor: wait;
}

.voice-recorder__volume {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid #e53e3e;
  pointer-events: none;
  transition: transform 0.1s ease-out;
  opacity: 0.6;
}

.voice-recorder__spinner {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.voice-recorder__label {
  font-size: 0.75rem;
  color: #718096;
  font-weight: 500;
}

.voice-recorder__error {
  font-size: 0.75rem;
  color: #e53e3e;
  max-width: 150px;
  text-align: center;
  font-weight: 500;
}

.voice-recorder__hint {
  font-size: 0.75rem;
  color: #718096;
  font-style: italic;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(229, 62, 62, 0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .voice-recorder__button {
    background: #2d3748;
  }

  .voice-recorder__button:hover:not(:disabled) {
    background: #1a202c;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .voice-recorder__button {
    border: 2px solid currentColor;
  }

  .voice-recorder__volume {
    border-width: 4px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .voice-recorder__button,
  .voice-recorder__volume {
    transition: none;
  }

  .voice-recorder__button--recording {
    animation: none;
  }

  .voice-recorder__spinner {
    animation: none;
  }
}
</style>

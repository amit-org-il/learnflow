<template>
  <button
    class="live-voice-btn"
    :class="{
      'live-voice-btn--active': isRecording,
      'live-voice-btn--disabled': disabled,
      'live-voice-btn--initializing': isInitializing
    }"
    :disabled="disabled || isInitializing"
    :aria-label="isRecording ? 'Stop live voice' : 'Start live voice conversation'"
    :title="isRecording ? 'Stop live voice' : 'Live voice conversation (Gemini Live)'"
    @click="handleClick"
  >
    <!-- Wave/Voice Icon (not recording) -->
    <svg
      v-if="!isRecording && !isInitializing"
      class="live-voice-btn__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- Waveform icon to differentiate from regular mic -->
      <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2v-8z" />
      <path d="M22 12h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z" />
      <path d="M6 12V6a6 6 0 0 1 12 0v6" />
      <line x1="6" y1="12" x2="6" y2="15" />
      <line x1="18" y1="12" x2="18" y2="15" />
    </svg>

    <!-- Active Recording Icon (animated) -->
    <svg
      v-else-if="isRecording"
      class="live-voice-btn__icon live-voice-btn__icon--active"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <!-- Mic with sound waves -->
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>

    <!-- Loading Spinner -->
    <div v-else-if="isInitializing" class="live-voice-btn__spinner" />

    <!-- Volume Ring (when recording) -->
    <div
      v-if="isRecording"
      class="live-voice-btn__volume-ring"
      :style="{ transform: `scale(${1 + volumeLevel * 0.4})` }"
    />
  </button>
</template>

<script setup lang="ts">
interface Props {
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether initializing (requesting mic permission) */
  isInitializing?: boolean;
  /** Current volume level (0-1) */
  volumeLevel?: number;
  /** Disable the button */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isInitializing: false,
  volumeLevel: 0,
  disabled: false
});

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

function handleClick() {
  emit('toggle');
}
</script>

<style scoped>
.live-voice-btn {
  position: relative;
  height: 2.5rem;
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #10b981; /* Green - different from blue mic */
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.live-voice-btn:hover:not(:disabled) {
  background-color: #059669;
}

.live-voice-btn--active {
  background-color: #ef4444; /* Red when recording */
  animation: pulse-live 1.5s ease-in-out infinite;
}

.live-voice-btn--active:hover {
  background-color: #dc2626;
}

.live-voice-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.live-voice-btn--initializing {
  cursor: wait;
  opacity: 0.8;
}

.live-voice-btn__icon {
  width: 1rem;
  height: 1rem;
}

.live-voice-btn__icon--active {
  animation: bounce-mic 0.5s ease-in-out infinite alternate;
}

.live-voice-btn__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.live-voice-btn__volume-ring {
  position: absolute;
  inset: -2px;
  border: 2px solid rgba(239, 68, 68, 0.6);
  border-radius: 0.625rem;
  pointer-events: none;
  transition: transform 0.1s ease-out;
}

@keyframes pulse-live {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

@keyframes bounce-mic {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .live-voice-btn,
  .live-voice-btn__icon--active,
  .live-voice-btn__volume-ring {
    animation: none;
    transition: none;
  }
}
</style>

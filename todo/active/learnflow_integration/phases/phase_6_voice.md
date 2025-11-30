# Phase 6: Voice Input (Gemini Live)

**Estimated Time:** 5 hours
**Prerequisites:** Phase 5 complete
**Priority:** P0 - Critical for Gemini Live bots

---

## Tasks

- [ ] **6.1** Create AudioWorklet processor file (30 minutes)
- [ ] **6.2** Create `AudioRecorder.ts` class (2 hours)
- [ ] **6.3** Create `useVoiceRecording.ts` composable (1.5 hours)
- [ ] **6.4** Create `VoiceRecorder.vue` component (1 hour)

---

## Task 6.1: Create AudioWorklet Processor

**File:** `public/worklets/audio-processor.js`

**Note:** AudioWorklet processors must be plain JavaScript (not TypeScript) and are loaded as separate modules.

```javascript
/**
 * Audio Processor Worklet
 * Processes microphone audio for voice input
 * - Calculates volume (RMS)
 * - Converts Float32 to PCM16
 * - Applies Voice Activity Detection (VAD)
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.vadThreshold = 0.15; // Default 15%

    // Listen for threshold updates from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'setVadThreshold') {
        this.vadThreshold = event.data.value;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // No input channels, skip processing
    if (!input || !input[0]) {
      return true;
    }

    const inputData = input[0]; // Float32Array

    // Calculate RMS volume (0-1 normalized)
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Send volume level to main thread (normalized 0-1)
    this.port.postMessage({
      type: 'volume',
      value: rms
    });

    // VAD: Only process audio if above threshold
    if (rms < this.vadThreshold) {
      return true; // Keep processor alive
    }

    // Convert Float32 to PCM16
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      // Clamp to [-1, 1] range
      const s = Math.max(-1, Math.min(1, inputData[i]));
      // Convert to 16-bit integer
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send PCM16 data to main thread
    this.port.postMessage({
      type: 'audioData',
      data: pcm16
    });

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

---

## Task 6.2: Create AudioRecorder Class

**File:** `src/lib/audio/AudioRecorder.ts`

**Key improvements:**
- Uses AudioWorklet (modern, non-deprecated API)
- Proper base64 encoding for binary data
- Sample rate verification
- Sends `isFinal` on stop
- No audio echo (doesn't connect to destination)
- Reuses AudioContext instances
- Checks microphone permissions before requesting
- Discriminates error types

```typescript
/**
 * AudioRecorder
 * Captures microphone audio using Web Audio API (AudioWorklet)
 * Outputs Base64-encoded PCM16 chunks at 16kHz for Gemini Live
 */

export interface AudioRecorderOptions {
  /** Target sample rate (default: 16000 Hz for Gemini) */
  sampleRate?: number;

  /** Callback for audio chunks */
  onAudioChunk: (base64: string, sampleRate: number, isFinal: boolean) => void;

  /** Callback for volume level changes (0-1 normalized) */
  onVolumeChange?: (level: number) => void;

  /** Voice Activity Detection threshold (0-1, default: 0.15) */
  vadThreshold?: number;
}

export type AudioRecorderError =
  | { type: 'permission_denied'; message: string }
  | { type: 'not_supported'; message: string }
  | { type: 'worklet_load_failed'; message: string }
  | { type: 'unknown'; message: string };

// Cache for AudioContext instances by sample rate
const audioContextCache = new Map<number, AudioContext>();

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isRecording = false;
  private options: AudioRecorderOptions;

  constructor(options: AudioRecorderOptions) {
    this.options = {
      sampleRate: 16000,
      vadThreshold: 0.15,
      ...options
    };
  }

  /**
   * Start recording from microphone
   * @throws {AudioRecorderError} If recording cannot start
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('[AudioRecorder] Already recording');
      return;
    }

    try {
      // Step 1: Check microphone permission status
      await this.checkMicrophonePermission();

      // Step 2: Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Step 3: Get or create AudioContext (cached by sample rate)
      this.audioContext = this.getOrCreateAudioContext(this.options.sampleRate!);

      // Step 4: Verify actual sample rate
      if (this.audioContext.sampleRate !== this.options.sampleRate) {
        console.warn(
          `[AudioRecorder] Requested ${this.options.sampleRate}Hz but got ${this.audioContext.sampleRate}Hz. ` +
          'Audio may need resampling on backend.'
        );
      }

      // Step 5: Load AudioWorklet processor
      try {
        await this.audioContext.audioWorklet.addModule('/worklets/audio-processor.js');
      } catch (err) {
        throw this.createError(
          'worklet_load_failed',
          'Failed to load audio processor worklet. Check if /worklets/audio-processor.js exists.'
        );
      }

      // Step 6: Create AudioWorklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      // Step 7: Set VAD threshold
      this.workletNode.port.postMessage({
        type: 'setVadThreshold',
        value: this.options.vadThreshold
      });

      // Step 8: Listen for messages from worklet
      this.workletNode.port.onmessage = (event) => {
        if (!this.isRecording) return;

        if (event.data.type === 'volume') {
          // Volume is already normalized 0-1 by worklet
          this.options.onVolumeChange?.(event.data.value);
        } else if (event.data.type === 'audioData') {
          // Convert PCM16 to Base64
          const pcm16: Int16Array = event.data.data;
          const base64 = this.pcm16ToBase64(pcm16);
          this.options.onAudioChunk(base64, this.audioContext.sampleRate, false);
        }
      };

      // Step 9: Connect audio graph (NO connection to destination to avoid echo)
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.workletNode);
      // IMPORTANT: Do NOT connect to destination or audio will echo back!

      this.isRecording = true;
      console.log(`[AudioRecorder] Started recording at ${this.audioContext.sampleRate}Hz`);

    } catch (err) {
      // Clean up on error
      this.cleanup();
      throw this.handleError(err);
    }
  }

  /**
   * Stop recording and send final marker
   */
  stop(): void {
    if (!this.isRecording) {
      console.warn('[AudioRecorder] Not recording');
      return;
    }

    // Send final chunk indicator BEFORE cleanup
    if (this.audioContext) {
      this.options.onAudioChunk('', this.audioContext.sampleRate, true);
    }

    this.cleanup();
    this.isRecording = false;
    console.log('[AudioRecorder] Stopped recording');
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Update VAD threshold dynamically
   */
  setVadThreshold(threshold: number): void {
    this.options.vadThreshold = threshold;
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setVadThreshold',
        value: threshold
      });
    }
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  /**
   * Check microphone permission status before requesting
   */
  private async checkMicrophonePermission(): Promise<void> {
    try {
      const permissionStatus = await navigator.permissions.query({
        name: 'microphone' as PermissionName
      });

      if (permissionStatus.state === 'denied') {
        throw this.createError(
          'permission_denied',
          'Microphone access denied. Please enable microphone in browser settings.'
        );
      }
    } catch (err) {
      // Permissions API not supported, continue with getUserMedia
      console.warn('[AudioRecorder] Permissions API not supported, will try getUserMedia');
    }
  }

  /**
   * Get or create cached AudioContext for given sample rate
   * Prevents hitting browser's AudioContext limit (6-8 instances)
   */
  private getOrCreateAudioContext(sampleRate: number): AudioContext {
    let context = audioContextCache.get(sampleRate);

    if (!context || context.state === 'closed') {
      context = new AudioContext({ sampleRate });
      audioContextCache.set(sampleRate, context);
      console.log(`[AudioRecorder] Created new AudioContext at ${sampleRate}Hz`);
    }

    return context;
  }

  /**
   * Convert PCM16 Int16Array to Base64 string
   * Handles binary data > 127 correctly
   */
  private pcm16ToBase64(pcm16: Int16Array): string {
    const bytes = new Uint8Array(pcm16.buffer);

    // Build binary string byte by byte (handles values > 127)
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Don't close AudioContext (it's cached for reuse)
    this.audioContext = null;
  }

  /**
   * Create typed error
   */
  private createError(type: AudioRecorderError['type'], message: string): AudioRecorderError {
    return { type, message };
  }

  /**
   * Handle and classify errors
   */
  private handleError(err: unknown): AudioRecorderError {
    if (err && typeof err === 'object' && 'type' in err) {
      return err as AudioRecorderError;
    }

    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      // Permission denied
      if (message.includes('permission') || message.includes('denied') || message.includes('notallowed')) {
        return this.createError(
          'permission_denied',
          'Microphone access denied. Please allow microphone access and try again.'
        );
      }

      // Not supported
      if (message.includes('not supported') || message.includes('notfound')) {
        return this.createError(
          'not_supported',
          'Microphone not available. Please check your device.'
        );
      }

      // Unknown error
      return this.createError('unknown', err.message);
    }

    return this.createError('unknown', 'Failed to start audio recording');
  }
}
```

---

## Task 6.3: Create useVoiceRecording Composable

**File:** `src/composables/useVoiceRecording.ts`

**Key improvements:**
- Interrupt AFTER recorder starts successfully
- Proper error type handling
- Cleanup on unmount

```typescript
import { ref, computed, onUnmounted } from 'vue';
import { AudioRecorder, type AudioRecorderOptions, type AudioRecorderError } from '@/lib/audio/AudioRecorder';

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

export interface UseVoiceRecordingReturn {
  state: {
    isRecording: Readonly<Ref<boolean>>;
    isInitializing: Readonly<Ref<boolean>>;
    error: Readonly<Ref<AudioRecorderError | null>>;
    volumeLevel: Readonly<Ref<number>>;
    hasPermission: Readonly<Ref<boolean | null>>;
  };
  actions: {
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    toggleRecording: () => Promise<void>;
    setVadThreshold: (threshold: number) => void;
  };
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
```

---

## Task 6.4: Create VoiceRecorder.vue Component

**File:** `src/components/VoiceRecorder.vue`

```vue
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
import { type AudioRecorderError } from '@/lib/audio/AudioRecorder';
import { type Ref } from 'vue';

interface Props {
  /** Voice recording state from useVoiceRecording */
  state: {
    isRecording: boolean;
    isInitializing: boolean;
    error: AudioRecorderError | null;
    volumeLevel: number;
    hasPermission: boolean | null;
  };

  /** Voice recording actions from useVoiceRecording */
  actions: {
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    toggleRecording: () => Promise<void>;
  };

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
```

---

## Integration with ChatInterface

**Example:** How to integrate VoiceRecorder in your chat interface

```vue
<template>
  <div class="chat-interface">
    <!-- ... other chat UI ... -->

    <VoiceRecorder
      :state="voiceState"
      :actions="voiceActions"
      :is-connected="socketState.isConnected"
      :is-speaking="socketState.isSpeaking"
      label="Tap to speak"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VoiceRecorder from '@/components/VoiceRecorder.vue';
import { useVoiceRecording } from '@/composables/useVoiceRecording';
import { useAvatarSocket } from '@/composables/useAvatarSocket';

// Props
interface Props {
  chatId: string;
  botId: string;
  socketUrl: string;
}

const props = defineProps<Props>();

// ========================================
// SOCKET CONNECTION
// ========================================

const avatarSocket = useAvatarSocket({
  url: props.socketUrl, // e.g., 'http://localhost:8001/avatar'
  provider: 'gemini', // or 'azure'
  voiceId: 'en-US-Neural2-F',
  onSpeak: (message) => {
    console.log('[Chat] Received speak message:', message);
    // Handle speak message based on provider
  },
  onSessionStart: (data) => {
    console.log('[Chat] Session started:', data);
  },
  onError: (error) => {
    console.error('[Chat] Socket error:', error);
  }
});

const socketState = {
  isConnected: avatarSocket.isConnected,
  isSpeaking: avatarSocket.isSpeaking
};

// ========================================
// VOICE RECORDING
// ========================================

const { state: voiceState, actions: voiceActions } = useVoiceRecording({
  sampleRate: 16000,
  vadThreshold: 0.15,
  interruptOnStart: true,

  // Interrupt avatar speech when user starts speaking
  onInterruptSpeech: () => {
    avatarSocket.sendUserInterrupt();
  },

  // Send audio chunks to backend
  onAudioChunk: (base64, sampleRate, isFinal) => {
    avatarSocket.sendUserVoice(base64, sampleRate, isFinal);
  },

  // Handle errors
  onError: (error) => {
    console.error('[Chat] Voice error:', error);

    if (error.type === 'permission_denied') {
      // Show permission guide to user
      alert('Please allow microphone access in browser settings');
    }
  },

  // Optional: log volume for debugging
  onVolumeChange: (level) => {
    // console.log('[Chat] Volume:', level);
  }
});
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}
</style>
```

---

## Verification Checklist

### Core Functionality
```
[ ] AudioWorklet processor loads successfully from /worklets/audio-processor.js
[ ] AudioRecorder captures microphone at 16kHz (or warns if different)
[ ] AudioRecorder outputs Base64-encoded PCM16 correctly (handles bytes > 127)
[ ] VAD filters out silence/background noise (threshold configurable)
[ ] Volume level updates in real-time (normalized 0-1)
[ ] No audio echo (processor not connected to destination)
```

### State Management
```
[ ] useVoiceRecording toggles recording state correctly
[ ] isInitializing shows true during microphone permission request
[ ] error state populated with correct error type
[ ] hasPermission reflects microphone permission status
[ ] isFinal=true sent on stop() before cleanup
```

### UI Component
```
[ ] VoiceRecorder shows recording state (red button with pulse)
[ ] VoiceRecorder shows volume ring that scales with volume
[ ] VoiceRecorder handles permission denied (shows error message)
[ ] VoiceRecorder disabled when socket disconnected
[ ] VoiceRecorder accessible (ARIA labels, keyboard support)
```

### Integration
```
[ ] Recording interrupts avatar speech (after successful start)
[ ] Audio chunks sent via avatarSocket.sendUserVoice()
[ ] Integration example uses correct Phase 3 method names
[ ] Error types properly discriminated (permission vs other errors)
```

### Performance & Browser Compatibility
```
[ ] AudioContext instances cached (max 1 per sample rate)
[ ] Microphone permission checked before requesting
[ ] Works in Chrome, Firefox, Safari (WebKit)
[ ] AudioWorklet supported (falls back gracefully if not)
[ ] No memory leaks on repeated start/stop cycles
```

### Edge Cases
```
[ ] Handles sample rate mismatch (browser doesn't support 16kHz)
[ ] Handles AudioWorklet load failure (file not found)
[ ] Handles microphone not found (no audio input device)
[ ] Handles private browsing mode restrictions
[ ] Cleanup on component unmount (stops recording, releases mic)
```

---

## Testing Instructions

### 1. AudioWorklet Processor

```bash
# Ensure file exists
ls public/worklets/audio-processor.js

# Test in browser console
const ctx = new AudioContext();
await ctx.audioWorklet.addModule('/worklets/audio-processor.js');
console.log('Worklet loaded successfully');
```

### 2. AudioRecorder Class

```typescript
// Test in browser console
import { AudioRecorder } from '@/lib/audio/AudioRecorder';

const recorder = new AudioRecorder({
  sampleRate: 16000,
  onAudioChunk: (base64, sr, isFinal) => {
    console.log(`Chunk: ${base64.length} bytes, ${sr}Hz, final=${isFinal}`);
  },
  onVolumeChange: (level) => {
    console.log(`Volume: ${level.toFixed(3)}`);
  }
});

await recorder.start();
// Speak into microphone, check console output

recorder.stop();
// Check for final chunk with isFinal=true
```

### 3. VoiceRecorder Component

```bash
# Start dev server
npm run dev

# Open browser to component demo page
# Click record button
# Speak into microphone
# Verify:
# - Button turns red
# - Volume ring animates
# - Console shows audio chunks
# - Click again to stop
# - Verify final chunk sent
```

### 4. Integration Test

```typescript
// In ChatInterface component
const { state, actions } = useVoiceRecording({
  sampleRate: 16000,
  onAudioChunk: (base64, sr, isFinal) => {
    console.log(`[Integration] Received ${base64.length} bytes`);
    if (isFinal) {
      console.log('[Integration] Final chunk received');
    }
  }
});

// Test:
// 1. Click record button
// 2. Speak
// 3. Check audio chunks sent to socket
// 4. Click stop
// 5. Verify final chunk sent
```

---

## Common Issues & Solutions

### Issue 1: AudioWorklet not loading
**Symptom:** `worklet_load_failed` error
**Solution:**
- Check file exists at `public/worklets/audio-processor.js`
- Check browser supports AudioWorklet (Chrome 66+, Firefox 76+)
- Check CORS policy allows loading worklet

### Issue 2: No audio captured
**Symptom:** Volume stays at 0
**Solution:**
- Check microphone permission granted
- Check VAD threshold (might be too high)
- Check browser security context (HTTPS required)

### Issue 3: Echo/feedback
**Symptom:** Hear own voice through speakers
**Solution:**
- Ensure processor NOT connected to `audioContext.destination`
- Check line 95-96 removed destination connection

### Issue 4: Base64 encoding corruption
**Symptom:** Backend can't decode audio
**Solution:**
- Verify using byte-by-byte encoding (not spread operator)
- Test with binary values > 127

### Issue 5: Sample rate mismatch
**Symptom:** Warning about sample rate
**Solution:**
- Backend should handle resampling
- Or implement client-side resampling (complex)

---

## Performance Considerations

### Memory
- AudioContext instances cached (1 per sample rate)
- MediaStream tracks stopped on cleanup
- Worklet nodes disconnected properly

### CPU
- AudioWorklet runs on separate thread (efficient)
- VAD reduces network traffic (only sends when speaking)
- Volume calculation minimal overhead

### Network
- Base64 encoding increases size by ~33%
- VAD filtering reduces total data sent
- Consider adjusting VAD threshold based on network speed

---

## Next Phase

→ [Phase 7: Streaming Text](./phase_7_streaming.md)

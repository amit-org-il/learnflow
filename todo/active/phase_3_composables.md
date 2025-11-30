# Phase 3: Vue Composables

**Estimated Time:** 12 hours
**Prerequisites:** Phase 2 complete

---

## Tasks

- [x] **3.1** Create `audio-utils.ts` - Full audio context management (1 hour)
- [x] **3.2** Create `audio-unlock.ts` - Simple unlock wrapper (15 min)
- [x] **3.2.5** Copy `audioworklet-registry.ts` - AudioWorklet utility (5 min - copy)
- [x] **3.3** Create `smart-mouth-analyzer.ts` worklet (30 min - copy)
- [x] **3.4** Create `GeminiAudioHandler.ts` (30 min - copy)
- [x] **3.5** Create `useAvatarSocket.ts` - Socket.IO composable (3-4 hours)
- [x] **3.6** Create `useAvatar.ts` - TalkingHead wrapper (2 hours)
- [x] **3.7** Create `useAzureTTS.ts` - Azure Speech SDK (2.5 hours)
- [x] **3.8** Create `useGeminiLipsync.ts` - Gemini audio lip-sync (2 hours)

> **IMPORTANT:** Tasks must be completed in order - later tasks depend on earlier ones.

---

## Task 3.1: Create Audio Utils (CRITICAL)

**File:** `src/lib/audio/audio-utils.ts`

> **Why this is critical:** This handles browser autoplay policies. Without proper handling, audio will fail on iOS/Safari and browsers with strict autoplay policies.

```typescript
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
```

---

## Task 3.2: Create Audio Unlock Utility

**File:** `src/lib/audio/audio-unlock.ts`

> Simple wrapper around `audioContext()` for use in UI event handlers.

```typescript
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
```

**Usage in FloatingChatbot.vue:**
```vue
<script setup lang="ts">
import { unlockAudio } from '@/lib/audio/audio-unlock';

function toggleChat() {
  isOpen.value = !isOpen.value;
  unlockAudio(); // Unlock on first interaction
  emit('toggle');
}
</script>
```

---

## Task 3.2.5: Copy AudioWorklet Registry

**Source:** `frontend/src/lib/audio/audioworklet-registry.ts`
**Target:** `src/lib/audio/audioworklet-registry.ts`

This utility is required by GeminiAudioHandler to create AudioWorklet modules from source strings.

```typescript
/**
 * AudioWorklet Registry
 *
 * Utility for creating and managing AudioWorklet modules from source strings.
 * Creates blob URLs for worklet registration.
 *
 * Based on Google's Gemini Multimodal Live API reference implementation.
 *
 * Copyright 2024 Google LLC
 * Licensed under the Apache License, Version 2.0
 *
 * Task 3.2.5: Copy AudioWorklet Registry
 */

/**
 * Graph structure for tracking worklet connections
 */
export type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(this: MessagePort, ev: MessageEvent) => void>;
};

/**
 * Registry mapping AudioContexts to their registered worklets
 */
export const registeredWorklets: Map<
  AudioContext,
  Record<string, WorkletGraph>
> = new Map();

/**
 * Create a blob URL for an AudioWorklet from source code string
 *
 * @param workletName - Name to register the processor under
 * @param workletSrc - Worklet class source code (without registerProcessor call)
 * @returns Blob URL that can be used with audioWorklet.addModule()
 *
 * @example
 * const src = createWorkletFromSrc('my-processor', MyWorkletSource);
 * await audioContext.audioWorklet.addModule(src);
 */
export const createWorkletFromSrc = (
  workletName: string,
  workletSrc: string,
): string => {
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: "application/javascript",
    },
  );

  return URL.createObjectURL(script);
};
```

---

## Task 3.3: Copy SmartMouthAnalyzer Worklet

**Source:** `frontend/src/lib/audio/worklets/smart-mouth-analyzer.ts`
**Target:** `src/lib/audio/worklets/smart-mouth-analyzer.ts`

Direct copy - this is an AudioWorklet processor that analyzes audio frequency for mouth shapes.

**Vite Worklet Loading Pattern:**
```typescript
// In useGeminiLipsync.ts
async function loadWorklet(ctx: AudioContext): Promise<void> {
  // Vite handles worklet bundling with this pattern
  const workletUrl = new URL(
    '../lib/audio/worklets/smart-mouth-analyzer.ts',
    import.meta.url
  );
  await ctx.audioWorklet.addModule(workletUrl);
}

// Create the node after loading
const analyzerNode = new AudioWorkletNode(ctx, 'smart-mouth-analyzer');
analyzerNode.port.onmessage = (event) => {
  const { mouthShape } = event.data;
  // Apply directly to TalkingHead - NOT reactive state!
  avatarInstance?.setMouthShape(mouthShape);
};
```

---

## Task 3.4: Copy GeminiAudioHandler

**Source:** `frontend/src/lib/audio/GeminiAudioHandler.ts`
**Target:** `src/lib/audio/GeminiAudioHandler.ts`

Direct copy - ensure these imports are correct:

```typescript
import { audioContext, releaseAudioContext } from './audio-utils';
import { createWorkletFromSrc } from './audioworklet-registry';
```

> **Dependencies:** Requires Task 3.1 (audio-utils.ts) and Task 3.2.5 (audioworklet-registry.ts)

**Key features of GeminiAudioHandler:**
- Gapless audio playback via look-ahead scheduling (200ms ahead)
- Initial buffer delay (100ms) for smooth start
- Mouth shape smoothing (0.6 factor) for natural animation
- Event emitter pattern for callbacks
- Automatic cleanup on stop

**Events emitted:**
- `mouthShape` - 40 times/sec with `{ jawOpen, mouthOpen, ... }`
- `start` - When audio playback starts
- `stop` - When audio playback stops
- `error` - On any error

---

## Task 3.5: Create useAvatarSocket Composable (CRITICAL)

**File:** `src/composables/useAvatarSocket.ts`

> **CRITICAL:** The Socket.IO connection URL must include the `/avatar` namespace!

```typescript
import { ref, computed, onUnmounted, type Ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type {
  SessionConfig,
  SpeakMessage,
  BackendMessage,
  isAzureSpeakMessage,
  isGeminiSpeakMessage,
} from '@/types';

// ========================================
// TYPES
// ========================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type ErrorType =
  | 'connection'
  | 'disconnected'
  | 'message_parse'
  | 'tts_failure'
  | 'avatar_load'
  | 'unknown';

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  recoverable: boolean;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface UseAvatarSocketOptions {
  /** Backend URL (e.g., 'http://localhost:8001') */
  url: string;
  /** TTS provider for new sessions */
  provider?: 'azure' | 'gemini-live';
  /** Voice ID for new sessions */
  voiceId?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;

  // Callbacks
  onSessionStart?: (sessionId: string, config: SessionConfig) => void;
  onSpeak?: (message: SpeakMessage) => void;
  onAvatarControl?: (command: string, params: Record<string, unknown>) => void;
  onConfigUpdate?: (config: SessionConfig) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: () => void;
  onDisconnectWhileSpeaking?: () => void;
  onMaxReconnectAttemptsReached?: () => void;
  onInterrupt?: () => void;
}

export interface UseAvatarSocketReturn {
  // State (readonly)
  isConnected: Ref<boolean>;
  isConnecting: Ref<boolean>;
  connectionStatus: Ref<ConnectionStatus>;
  sessionId: Ref<string | null>;
  currentConfig: Ref<SessionConfig | null>;
  error: Ref<string | null>;
  errorInfo: Ref<ErrorInfo | null>;
  isSpeaking: Ref<boolean>;
  isInterrupted: Ref<boolean>;
  pendingMessagesCount: Ref<number>;
  reconnectAttempts: Ref<number>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
  sendReady: (avatarLoaded: boolean, ttsInitialized: boolean) => void;
  sendSpeechComplete: (messageId: string) => void;
  sendUserInterrupt: () => void;
  sendUserMessage: (text: string, language?: string) => void;
  sendUserVoice: (audioChunk: string, sampleRate: number, isFinal: boolean) => void;
  sendError: (error: string, details?: Record<string, unknown>) => void;
  setIsSpeaking: (speaking: boolean) => void;
  interruptSpeaking: () => void;
  clearError: () => void;
  clearInterrupted: () => void;
}

// ========================================
// COMPOSABLE
// ========================================

export function useAvatarSocket(options: UseAvatarSocketOptions): UseAvatarSocketReturn {
  const {
    url,
    provider = 'azure',
    voiceId,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    onSessionStart,
    onSpeak,
    onAvatarControl,
    onConfigUpdate,
    onError,
    onConnect,
    onDisconnect,
    onReconnect,
    onDisconnectWhileSpeaking,
    onMaxReconnectAttemptsReached,
    onInterrupt,
  } = options;

  // ========================================
  // STATE
  // ========================================

  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  const sessionId = ref<string | null>(null);
  const currentConfig = ref<SessionConfig | null>(null);
  const error = ref<string | null>(null);
  const errorInfo = ref<ErrorInfo | null>(null);
  const isSpeaking = ref(false);
  const isInterrupted = ref(false);
  const pendingMessagesCount = ref(0);
  const reconnectAttempts = ref(0);

  // Internal refs
  let socket: Socket | null = null;
  let intentionalDisconnect = false;
  let wasSpeaking = false;
  const pendingMessages: SpeakMessage[] = [];

  // ========================================
  // HELPERS
  // ========================================

  function createErrorInfo(
    type: ErrorType,
    message: string,
    recoverable = true,
    details?: Record<string, unknown>
  ): ErrorInfo {
    return { type, message, recoverable, timestamp: Date.now(), details };
  }

  function setErrorState(info: ErrorInfo) {
    error.value = info.message;
    errorInfo.value = info;
    connectionStatus.value = 'error';
    onError?.(info.message);
  }

  function buildSocketUrl(): string {
    // Extract base URL (protocol + host + port)
    let baseUrl = url.replace(/^ws/, 'http');
    try {
      const parsed = new URL(baseUrl);
      return parsed.origin;
    } catch {
      return baseUrl.replace(/\/ws\/avatar\/?$/, '').replace(/\/avatar\/?$/, '');
    }
  }

  // ========================================
  // ACTIONS
  // ========================================

  function connect() {
    if (socket?.connected) {
      console.log('[useAvatarSocket] Already connected');
      return;
    }

    // Cleanup existing socket
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    intentionalDisconnect = false;
    isConnecting.value = true;
    connectionStatus.value = 'connecting';
    error.value = null;
    errorInfo.value = null;

    const baseUrl = buildSocketUrl();

    // CRITICAL: Include /avatar namespace in URL
    const fullUrl = `${baseUrl}/avatar`;
    console.log('[useAvatarSocket] Connecting to:', fullUrl);

    try {
      socket = io(fullUrl, {
        path: '/socket.io/',
        // Auth for new sessions (backend controls session management)
        auth: {
          voice_id: voiceId,
          provider,
        },
        reconnection: autoReconnect,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });

      // ========================================
      // CONNECTION EVENTS
      // ========================================

      socket.on('connect', () => {
        console.log('[useAvatarSocket] Connected');
        isConnected.value = true;
        isConnecting.value = false;
        connectionStatus.value = 'connected';
        error.value = null;
        errorInfo.value = null;
        reconnectAttempts.value = 0;
        onConnect?.();
      });

      socket.on('connect_error', (err) => {
        console.error('[useAvatarSocket] Connection error:', err);
        setErrorState(createErrorInfo('connection', `Connection error: ${err.message}`, true));
      });

      socket.on('disconnect', (reason) => {
        console.log('[useAvatarSocket] Disconnected:', reason);

        // Check if disconnected while speaking
        if (wasSpeaking && !intentionalDisconnect) {
          console.warn('[useAvatarSocket] Disconnected while speaking');
          onDisconnectWhileSpeaking?.();
        }
        wasSpeaking = false;

        const info = intentionalDisconnect
          ? null
          : createErrorInfo('disconnected', `Disconnected: ${reason}`, true);

        isConnected.value = false;
        isConnecting.value = false;
        isSpeaking.value = false;
        connectionStatus.value = intentionalDisconnect ? 'disconnected' : 'error';
        if (info) {
          error.value = info.message;
          errorInfo.value = info;
        }

        onDisconnect?.(reason);
      });

      // ========================================
      // RECONNECTION EVENTS
      // ========================================

      socket.on('reconnect', (attempt: number) => {
        console.log('[useAvatarSocket] Reconnected after', attempt, 'attempts');
        onReconnect?.();
      });

      socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`[useAvatarSocket] Reconnection attempt ${attempt}/${maxReconnectAttempts}`);
        connectionStatus.value = 'reconnecting';
        reconnectAttempts.value = attempt;
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[useAvatarSocket] Max reconnection attempts reached');
        setErrorState(createErrorInfo(
          'connection',
          `Failed to reconnect after ${maxReconnectAttempts} attempts`,
          false
        ));
        onMaxReconnectAttemptsReached?.();
      });

      // ========================================
      // MESSAGE EVENTS
      // ========================================

      socket.on('session_start', (data: { session_id: string; config: SessionConfig; is_resumed?: boolean }) => {
        console.log('[useAvatarSocket] Session started:', data.session_id, data.is_resumed ? '(resumed)' : '(new)');
        sessionId.value = data.session_id;
        currentConfig.value = data.config;
        onSessionStart?.(data.session_id, data.config);
      });

      socket.on('speak', (message: SpeakMessage) => {
        pendingMessages.push(message);
        pendingMessagesCount.value = pendingMessages.length;
        isInterrupted.value = false;
        onSpeak?.(message);
      });

      socket.on('avatar_control', (data: { command: string; params: Record<string, unknown> }) => {
        onAvatarControl?.(data.command, data.params);
      });

      socket.on('config_update', (data: { config: SessionConfig }) => {
        currentConfig.value = data.config;
        onConfigUpdate?.(data.config);
      });

      socket.on('error', (data: { error: string; details?: Record<string, unknown> }) => {
        console.error('[useAvatarSocket] Server error:', data);
        setErrorState(createErrorInfo('unknown', data.error, true, data.details));
      });

    } catch (err) {
      console.error('[useAvatarSocket] Failed to create connection:', err);
      isConnecting.value = false;
      setErrorState(createErrorInfo(
        'connection',
        err instanceof Error ? err.message : 'Failed to connect',
        true
      ));
    }
  }

  function disconnect() {
    console.log('[useAvatarSocket] Disconnecting...');
    intentionalDisconnect = true;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    // Reset state
    isConnected.value = false;
    isConnecting.value = false;
    connectionStatus.value = 'disconnected';
    sessionId.value = null;
    currentConfig.value = null;
    error.value = null;
    errorInfo.value = null;
    isSpeaking.value = false;
    isInterrupted.value = false;
    pendingMessagesCount.value = 0;
    reconnectAttempts.value = 0;
    pendingMessages.length = 0;
  }

  function retry() {
    console.log('[useAvatarSocket] Retry requested');
    error.value = null;
    errorInfo.value = null;
    reconnectAttempts.value = 0;
    connect();
  }

  function sendReady(avatarLoaded: boolean, ttsInitialized: boolean) {
    if (!socket?.connected) return;
    socket.emit('ready', { avatar_loaded: avatarLoaded, tts_initialized: ttsInitialized });
  }

  function sendSpeechComplete(messageId: string) {
    if (!socket?.connected) return;
    socket.emit('speech_complete', { message_id: messageId });

    // Remove message from queue
    const index = pendingMessages.findIndex(msg => msg.message_id === messageId);
    if (index !== -1) {
      pendingMessages.splice(index, 1);
      pendingMessagesCount.value = pendingMessages.length;
    }
  }

  function sendUserInterrupt() {
    if (!socket?.connected) return;
    socket.emit('user_interrupt', { timestamp: Date.now() });
  }

  function sendUserMessage(text: string, language?: string) {
    if (!socket?.connected) return;
    socket.emit('user_message', { text, language, timestamp: Date.now() });
  }

  function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
    if (!socket?.connected) return;
    socket.emit('user_voice', { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal });
  }

  function sendError(errorMsg: string, details?: Record<string, unknown>) {
    if (!socket?.connected) return;
    socket.emit('error', { error: errorMsg, details });
  }

  function setIsSpeaking(speaking: boolean) {
    wasSpeaking = speaking;
    isSpeaking.value = speaking;
  }

  function interruptSpeaking() {
    console.log('[useAvatarSocket] User interruption triggered');

    // Clear pending messages
    const clearedCount = pendingMessages.length;
    pendingMessages.length = 0;

    // Update state
    isSpeaking.value = false;
    isInterrupted.value = true;
    pendingMessagesCount.value = 0;

    // Send interrupt to backend
    sendUserInterrupt();

    // Call UI callback
    onInterrupt?.();

    console.log(`[useAvatarSocket] Cleared ${clearedCount} pending messages`);
  }

  function clearError() {
    error.value = null;
    errorInfo.value = null;
  }

  function clearInterrupted() {
    isInterrupted.value = false;
  }

  // ========================================
  // CLEANUP
  // ========================================

  onUnmounted(() => {
    console.log('[useAvatarSocket] Cleanup on unmount');
    intentionalDisconnect = true;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  });

  // ========================================
  // RETURN
  // ========================================

  return {
    // State
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    connectionStatus: computed(() => connectionStatus.value),
    sessionId: computed(() => sessionId.value),
    currentConfig: computed(() => currentConfig.value),
    error: computed(() => error.value),
    errorInfo: computed(() => errorInfo.value),
    isSpeaking: computed(() => isSpeaking.value),
    isInterrupted: computed(() => isInterrupted.value),
    pendingMessagesCount: computed(() => pendingMessagesCount.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),

    // Actions
    connect,
    disconnect,
    retry,
    sendReady,
    sendSpeechComplete,
    sendUserInterrupt,
    sendUserMessage,
    sendUserVoice,
    sendError,
    setIsSpeaking,
    interruptSpeaking,
    clearError,
    clearInterrupted,
  };
}
```

---

## Task 3.6: Create useAvatar Composable

**File:** `src/composables/useAvatar.ts`

**Reference:** Port from `frontend/src/components/avatar/useAvatar.ts`

Key features to include:
- Dynamic import of TalkingHead from `/lib/talkinghead/talkinghead.mjs`
- Loading progress tracking (0-100%)
- Retry logic (2 retries on failure)
- Duplicate initialization guard
- Cleanup on unmount

```typescript
import { ref, shallowRef, onUnmounted, type Ref } from 'vue';
import type { TalkingHead } from '@/types';

export interface UseAvatarOptions {
  /** Lip-sync language (default: 'en') */
  lipsyncLang?: string;
  /** Initial camera view */
  initialView?: 'head' | 'body' | 'full';
  /** Initial mood */
  initialMood?: string;
}

export interface UseAvatarReturn {
  // Refs
  containerRef: Ref<HTMLDivElement | null>;
  avatarInstance: Ref<TalkingHead | null>;

  // State
  isLoading: Ref<boolean>;
  loadingProgress: Ref<number>;
  isReady: Ref<boolean>;
  error: Ref<string | null>;

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

interface StreamOptions {
  sampleRate: number;
  mood?: string;
  gain?: number;
  lipsyncType?: 'visemes' | 'frequency';
}

interface StreamAudioData {
  audio: ArrayBuffer;
  visemes?: string[];
  vtimes?: number[];
  vdurations?: number[];
  words?: string[];
  wtimes?: number[];
  wdurations?: number[];
}

export function useAvatar(options: UseAvatarOptions = {}): UseAvatarReturn {
  const { lipsyncLang = 'en', initialView = 'head', initialMood = 'neutral' } = options;

  // Refs
  const containerRef = ref<HTMLDivElement | null>(null);
  const avatarInstance = shallowRef<TalkingHead | null>(null);

  // State
  const isLoading = ref(false);
  const loadingProgress = ref(0);
  const isReady = ref(false);
  const error = ref<string | null>(null);

  // Guards
  let isInitializing = false;
  let TalkingHeadClass: any = null;

  /**
   * Load TalkingHead class dynamically
   */
  async function loadTalkingHeadClass(): Promise<any> {
    if (TalkingHeadClass) return TalkingHeadClass;

    try {
      // Dynamic import from public folder
      const module = await import('/lib/talkinghead/talkinghead.mjs');
      TalkingHeadClass = module.TalkingHead;
      return TalkingHeadClass;
    } catch (err) {
      console.error('[useAvatar] Failed to load TalkingHead:', err);
      throw new Error('Failed to load avatar engine. Please refresh the page.');
    }
  }

  /**
   * Initialize TalkingHead instance
   */
  async function initialize(container: HTMLDivElement): Promise<void> {
    if (isInitializing || avatarInstance.value) {
      console.log('[useAvatar] Already initialized or initializing');
      return;
    }

    isInitializing = true;
    error.value = null;

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
      error.value = err instanceof Error ? err.message : 'Initialization failed';
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

    isLoading.value = true;
    loadingProgress.value = 0;
    error.value = null;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[useAvatar] Retry attempt ${attempt}/${maxRetries}`);
        }

        await avatarInstance.value.showAvatar(
          {
            url,
            body: gender === 'male' ? 'M' : 'F',
            avatarMood: initialMood,
            lipsyncLang,
          },
          (progress: number) => {
            loadingProgress.value = Math.round(progress * 100);
          }
        );

        isLoading.value = false;
        isReady.value = true;
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

    isLoading.value = false;
    error.value = lastError?.message || 'Failed to load avatar';
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
    isReady.value = false;
    loadingProgress.value = 0;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
  });

  return {
    containerRef,
    avatarInstance,
    isLoading,
    loadingProgress,
    isReady,
    error,
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
```

---

## Task 3.7: Create useAzureTTS Composable

**File:** `src/composables/useAzureTTS.ts`

> **CRITICAL:** Azure Speech SDK output format MUST be `Raw48Khz16BitMonoPcm` to match TalkingHead.

```typescript
import { ref, onUnmounted, type Ref } from 'vue';
import type { VoiceConfig } from '@/types';

// Azure viseme map (21 visemes -> TalkingHead phonemes)
const VISEME_MAP = [
  /* 0  */ "sil", /* 1  */ "aa", /* 2  */ "aa", /* 3  */ "O",
  /* 4  */ "E",   /* 5  */ "RR", /* 6  */ "I",  /* 7  */ "U",
  /* 8  */ "O",   /* 9  */ "O",  /* 10 */ "O",  /* 11 */ "I",
  /* 12 */ "kk",  /* 13 */ "RR", /* 14 */ "nn", /* 15 */ "SS",
  /* 16 */ "CH",  /* 17 */ "TH", /* 18 */ "FF", /* 19 */ "DD",
  /* 20 */ "kk",  /* 21 */ "PP"
];

// Declare Azure Speech SDK global
declare global {
  interface Window {
    SpeechSDK: any;
  }
}

export interface UseAzureTTSOptions {
  /** Avatar instance for streaming */
  getAvatarInstance: () => any;
  /** Callback when synthesis starts */
  onStart?: () => void;
  /** Callback when synthesis ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseAzureTTSReturn {
  isSynthesizing: Ref<boolean>;
  speak: (text: string, voice: VoiceConfig) => Promise<void>;
  stop: () => void;
  cleanup: () => void;
}

export function useAzureTTS(options: UseAzureTTSOptions): UseAzureTTSReturn {
  const { getAvatarInstance, onStart, onEnd, onError } = options;

  const isSynthesizing = ref(false);

  // Refs for SDK instances
  let synthesizer: any = null;

  // Viseme buffers (exact React pattern)
  const visemeBuffer = {
    visemes: [] as string[],
    vtimes: [] as number[],
    vdurations: [] as number[],
  };
  const wordBuffer = {
    words: [] as string[],
    wtimes: [] as number[],
    wdurations: [] as number[],
  };
  let prevViseme: { viseme: string; vtime: number } | null = null;

  function resetBuffers() {
    visemeBuffer.visemes = [];
    visemeBuffer.vtimes = [];
    visemeBuffer.vdurations = [];
    wordBuffer.words = [];
    wordBuffer.wtimes = [];
    wordBuffer.wdurations = [];
    prevViseme = null;
  }

  /**
   * Initialize Azure Speech SDK synthesizer
   */
  function initSynthesizer(): void {
    if (synthesizer || !window.SpeechSDK) {
      return;
    }

    console.log('[useAzureTTS] Initializing Azure Speech SDK...');

    // Dynamic proxy URL (supports dev, staging, production)
    const PROXY_HOST = window.location.hostname || 'localhost';
    const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '8001';
    const PROXY_WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${PROXY_WS_PROTOCOL}://${PROXY_HOST}:${BACKEND_PORT}/ws/tts/cognitiveservices/websocket/v1`;

    console.log('[useAzureTTS] Endpoint:', wsUrl);

    const speechConfig = window.SpeechSDK.SpeechConfig.fromEndpoint(
      new URL(wsUrl),
      "dummy_key"  // Backend proxy handles real authentication
    );

    // CRITICAL: Output format must match TalkingHead's expected format
    speechConfig.speechSynthesisOutputFormat =
      window.SpeechSDK.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm;

    synthesizer = new window.SpeechSDK.SpeechSynthesizer(speechConfig, null);

    // Handle streaming audio chunks
    synthesizer.synthesizing = (_s: any, e: any) => {
      const avatar = getAvatarInstance();
      if (!avatar) return;

      // Stream audio with buffered visemes
      avatar.streamAudio?.({
        audio: e.result.audioData,
        visemes: visemeBuffer.visemes.splice(0),
        vtimes: visemeBuffer.vtimes.splice(0),
        vdurations: visemeBuffer.vdurations.splice(0),
      });
    };

    // Handle viseme events
    synthesizer.visemeReceived = (_s: any, e: any) => {
      const avatar = getAvatarInstance();
      if (!avatar?.isStreaming) return;

      const vtime = e.audioOffset / 10000; // Convert to ms
      const viseme = VISEME_MAP[e.visemeId];

      // Calculate duration from previous viseme
      if (prevViseme) {
        let vduration = vtime - prevViseme.vtime;
        if (vduration < 40) vduration = 40; // Minimum duration

        visemeBuffer.visemes.push(prevViseme.viseme);
        visemeBuffer.vtimes.push(prevViseme.vtime);
        visemeBuffer.vdurations.push(vduration);
      }
      prevViseme = { viseme, vtime };
    };

    // Handle word boundaries (for subtitles)
    synthesizer.wordBoundary = (_s: any, e: any) => {
      const word = e.text;
      const time = e.audioOffset / 10000;
      const duration = e.duration / 10000;

      if (e.boundaryType === "PunctuationBoundary" && wordBuffer.words.length) {
        // Merge punctuation with previous word
        wordBuffer.words[wordBuffer.words.length - 1] += word;
        wordBuffer.wdurations[wordBuffer.wdurations.length - 1] += duration;
      } else if (e.boundaryType === "WordBoundary" || e.boundaryType === "PunctuationBoundary") {
        wordBuffer.words.push(word);
        wordBuffer.wtimes.push(time);
        wordBuffer.wdurations.push(duration);
      }
    };

    console.log('[useAzureTTS] Initialized');
  }

  /**
   * Convert text to SSML with optional speaking rate
   */
  function textToSSML(text: string, voice: string, speakingRate?: number): string {
    const lang = voice.startsWith('he-') ? 'he-IL' : 'en-US';
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const needsProsody = speakingRate !== undefined && speakingRate !== 1.0;
    const ratePercent = speakingRate ? `${Math.round(speakingRate * 100)}%` : '100%';

    if (needsProsody) {
      return `<speak version="1.0" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
        <voice name="${voice}">
          <mstts:viseme type="FacialExpression" />
          <prosody rate="${ratePercent}">${escapedText}</prosody>
        </voice>
      </speak>`;
    }

    return `<speak version="1.0" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
      <voice name="${voice}">
        <mstts:viseme type="FacialExpression" />
        ${escapedText}
      </voice>
    </speak>`;
  }

  /**
   * Speak text with Azure TTS
   */
  async function speak(text: string, voice: VoiceConfig): Promise<void> {
    const avatar = getAvatarInstance();
    if (!avatar) {
      throw new Error('Avatar not initialized');
    }

    if (!window.SpeechSDK) {
      throw new Error('Azure Speech SDK not loaded');
    }

    // Initialize synthesizer if needed
    if (!synthesizer) {
      initSynthesizer();
    }

    console.log('[useAzureTTS] Speaking:', { text, voice: voice.voice, rate: voice.speakingRate });

    try {
      isSynthesizing.value = true;
      resetBuffers();

      // Start streaming on TalkingHead
      avatar.streamStart?.(
        { sampleRate: 48000, mood: 'neutral', gain: 0.5, lipsyncType: 'visemes' },
        () => { onStart?.(); },
        () => { onEnd?.(); isSynthesizing.value = false; }
      );

      // Create SSML
      const ssml = textToSSML(text, voice.voice, voice.speakingRate);

      // Synthesize
      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result: any) => {
            if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('[useAzureTTS] Synthesis completed');

              // Handle final viseme
              if (prevViseme) {
                visemeBuffer.visemes.push(prevViseme.viseme);
                visemeBuffer.vtimes.push(prevViseme.vtime);
                visemeBuffer.vdurations.push(100); // Final duration
                prevViseme = null;
              }

              // Stream remaining data
              if (visemeBuffer.visemes.length || wordBuffer.words.length) {
                avatar.streamAudio?.({
                  audio: new ArrayBuffer(0),
                  visemes: visemeBuffer.visemes.splice(0),
                  vtimes: visemeBuffer.vtimes.splice(0),
                  vdurations: visemeBuffer.vdurations.splice(0),
                  words: wordBuffer.words.splice(0),
                  wtimes: wordBuffer.wtimes.splice(0),
                  wdurations: wordBuffer.wdurations.splice(0),
                });
              }

              avatar.streamNotifyEnd?.();
              resetBuffers();
              resolve();
            } else {
              reject(new Error(result.errorDetails || 'Synthesis failed'));
            }
          },
          (error: any) => {
            console.error('[useAzureTTS] Error:', error);
            resetBuffers();
            reject(error);
          }
        );
      });

    } catch (err) {
      console.error('[useAzureTTS] Failed:', err);
      isSynthesizing.value = false;
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  function stop() {
    const avatar = getAvatarInstance();
    avatar?.stop?.();
    isSynthesizing.value = false;
    resetBuffers();
  }

  function cleanup() {
    if (synthesizer) {
      synthesizer.close();
      synthesizer = null;
    }
    resetBuffers();
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isSynthesizing,
    speak,
    stop,
    cleanup,
  };
}
```

---

## Task 3.8: Create useGeminiLipsync Composable

**File:** `src/composables/useGeminiLipsync.ts`

> **CRITICAL:** Do NOT use Vue reactive state for mouth shapes - 40 updates/sec will freeze UI. Apply directly to TalkingHead.

```typescript
import { ref, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { GeminiAudioHandler } from '@/lib/audio/GeminiAudioHandler';
import type { TalkingHead } from '@/types';

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
  isPlaying: Ref<boolean>;
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

  const isPlaying = ref(false);

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
          avatar.setMouthShape(shape);
        }
      });

      handler.on('start', () => {
        isPlaying.value = true;
        onStart?.();
      });

      handler.on('stop', () => {
        isPlaying.value = false;
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
    isPlaying.value = false;

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
      handler = null;
    }
    isPlaying.value = false;
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isPlaying,
    initialize,
    playChunk,
    complete,
    stop,
    cleanup,
  };
}
```

---

## Verification Checklist

```
[ ] audio-utils.ts handles autoplay policy (iOS/Safari)
[ ] audio-unlock.ts unlocks on chatbot click
[ ] smart-mouth-analyzer.ts worklet loads in Vite
[ ] GeminiAudioHandler.ts imports resolve correctly
[ ] useAvatarSocket connects to /avatar namespace
[ ] useAvatarSocket receives session_start event
[ ] useAvatarSocket receives speak events
[ ] useAvatarSocket handles reconnection
[ ] useAvatarSocket cleanup on unmount
[ ] useAvatar loads TalkingHead dynamically
[ ] useAvatar loads avatar with progress
[ ] useAvatar retry logic works (2 retries)
[ ] useAzureTTS uses dynamic proxy URL
[ ] useAzureTTS output format is Raw48Khz16BitMonoPcm
[ ] useAzureTTS viseme buffering works
[ ] useAzureTTS speaking rate works
[ ] useGeminiLipsync applies mouth shapes directly (not reactive)
[ ] useGeminiLipsync gapless playback works
[ ] All composables cleanup on unmount
```

---

## Troubleshooting

### Audio won't play on iOS/Safari

Audio is blocked until user interaction. Make sure `unlockAudio()` is called on the first user click (chatbot button, send message, etc.).

### Socket.IO won't connect

Check that the URL includes the `/avatar` namespace:
```typescript
// WRONG:
io('http://localhost:8001', { query: { chatId } })

// CORRECT:
io('http://localhost:8001/avatar')
```

### Avatar lip-sync is jerky (Gemini)

The mouth shape smoothing factor might be too low. GeminiAudioHandler uses 0.6 by default. Check that you're NOT using Vue reactive state for mouth shapes.

### Azure TTS audio sounds wrong

Check the output format. It MUST be `Raw48Khz16BitMonoPcm` to match TalkingHead's streaming API.

### Visemes don't match lip movements

Check the viseme map. Azure uses 22 visemes (0-21) that map to TalkingHead phonemes.

---

## Next Phase

→ [Phase 4: Components](./phase_4_components.md)

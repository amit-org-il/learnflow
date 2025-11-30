# LEARNFLOW VUE.JS AVATAR INTEGRATION - DETAILED IMPLEMENTATION PLAN

**For:** Alex (Learnflow Team)
**Created:** 2025-11-27
**Updated:** 2025-11-30
**Source:** lipsync-e2e-react project
**Target:** Learnflow chatbot (Vue 3 + Socket.IO)

---

## 🆕 Backend Updates Since Initial Plan

The backend example (`backend-examples/fastapi-complete`) now has MORE features:

| New Feature | Description |
|-------------|-------------|
| **8 Pre-configured Bots** | `default`, `male-en`, `female-en`, `fastie`, `male-he`, `female-he`, `gemini-live`, `gemini-live-female` |
| **Speaking Rate Control** | 0.5x to 2.0x speed (`fastie` demo = 2x) |
| **SpeedControl UI** | User-adjustable speed (1x-2x) with localStorage persistence |
| **Gemini Live Voices** | 8 voices: Charon, Fenrir, Puck, Orus, Zephyr, Leda, Kore, Aoede |
| **E2E Test Endpoints** | Test voices, controls, full suite via REST API |
| **VAD (Voice Activity Detection)** | RMS-based silence detection for Gemini turn-taking |
| **Session Resumption Tokens** | Gemini Live sessions can resume after reconnection |

**All backend work is COMPLETE.** The focus is now Vue frontend integration.

---

## Decisions Made

All critical blockers have been resolved. Here are the key decisions:

| Question | Decision |
|----------|----------|
| WebSocket vs Socket.IO | **Socket.IO** - Add avatar events to existing socket connection |
| Backend endpoint | **Done** - `GET /bots/{bot_id}` + `POST /chats` + chatId query param |
| Authentication | **Existing socket auth** - JWT token already handled |
| TalkingHead.js hosting | **Bundle with Vue app** - Import directly |
| Avatar .glb hosting | **ReadyPlayer.me direct** - Already working, no extra infra |
| API keys | **Backend .env** - AZURE_TTS_KEY, GEMINI_API_KEY |
| Provider selection | **Per-bot fixed config** - Set in bot configuration |
| Bot config endpoint | **`GET /bots/{bot_id}`** - Returns full bot config (DONE) |
| Mobile strategy | **No special handling** - Modern mobiles are fast enough |
| Fallback on avatar fail | **Retry first, then text + audio** (no avatar) |
| User interruption | **Stop button, voice input, or send message** |
| Subtitles | **No subtitles** - Text shows in chat bubble |
| State management | **Composition API only** - Use composables (no Pinia/Vuex) |
| Browser autoplay | **Unlock on chatbot circle click** - Silent audio unlock |

---

## Backend API Status: COMPLETE

The following backend APIs are now implemented and ready:

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /bots/{bot_id}` | **Done** | Returns bot config (avatar, TTS, behavior) |
| `POST /chats` | **Done** | Creates/resumes session, returns `chatId` |
| Socket.IO `?chatId=xxx` | **Done** | Connect to existing session via query param |

**Important**: Only `GET /bots/{bot_id}` is used in Learnflow (bot_id from LMS context). The `GET /bots` list endpoint is for demo only.

### API Integration Flow

```
Step 1: GET /bots/{bot_id}     ->  Get bot config (avatar URL, TTS provider, voice)
Step 2: POST /chats            ->  Create session, get chatId
Step 3: Socket.IO ?chatId=xxx  ->  Connect and chat (session persists)
```

**Note**: `GET /bots` (list all) is NOT used - bot_id comes from LMS context.

---

## Session Lifecycle & Timeout (CRITICAL)

Sessions are created via `POST /chats` and persist across Socket.IO disconnections.

### Timeout Rules
- **Sessions expire after 1 hour** of inactivity
- Inactivity = no Socket.IO messages received
- Background cleanup runs every 5 minutes

### One Session Per Bot Constraint
- `POST /chats` with same `botId` returns the SAME `chatId`
- `isResumed: true` flag indicates session already exists
- No parallel sessions allowed for the same bot

### Error Handling
```typescript
// If chatId expired -> Socket.IO connection rejected
// Error: "Invalid chatId - session not found"

// Solution: Call POST /chats again to create new session
socket.on('connect_error', async (error) => {
  if (error.message.includes('session not found')) {
    // Clear cached chatId
    sessionStorage.removeItem('chatId');
    // Create new session
    const { chatId } = await createChat(botId);
    // Reconnect with new chatId
    socket.io.opts.query = { chatId };
    socket.connect();
  }
});
```

### Best Practices
- Store `chatId` in `sessionStorage` (not `localStorage`)
- On connection error, clear cached `chatId` and create new session
- Handle `is_resumed` flag in UI to show "Continuing previous conversation"

---

## Azure TTS WebSocket Proxy (CRITICAL)

The backend provides a WebSocket proxy to hide Azure API keys from the frontend.

### Endpoint
```
ws://localhost:8001/ws/tts/cognitiveservices/websocket/v1
```

### Frontend Configuration
```typescript
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

// Use backend proxy (NO API KEY NEEDED in frontend!)
const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
  new URL('ws://localhost:8001/ws/tts/cognitiveservices/websocket/v1'),
  ''  // Empty string - backend proxy handles authentication
);

// Configure voice
speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
```

### Why This Matters
- Azure SDK requires API key for authentication
- Backend proxy injects the key, frontend never sees it
- CORS is handled by the proxy
- Keeps API keys secure on server side

---

## Complete BotResponse Interface

The `GET /bots/{bot_id}` response includes these fields:

```typescript
interface BotResponse {
  bot_id: string;
  name: string;
  language: string;

  // Response types (always includes 'avatar' for avatar bots)
  supportedResponseTypes: string[];  // e.g., ["text", "avatar"]

  // Optional fields
  image?: string;           // Base64 thumbnail image
  welcome_message?: string; // Initial greeting

  avatar: {
    glb_url: string;        // ReadyPlayer.me model URL
    gender: 'male' | 'female';
    background: string;     // CSS color/gradient
    camera_view: 'head' | 'body' | 'full';
    initial_mood: string;   // e.g., "neutral", "happy"
    lighting_preset: string; // e.g., "default", "studio"
  };

  tts: {
    provider: 'azure' | 'gemini-live';
    voice_id: string;       // e.g., "en-US-JennyNeural"
    locale: string;         // e.g., "en-US"
    speaking_rate: number;  // 0.5 to 2.0, default 1.0
  };
}
```

---

## Executive Summary

Integration of the 3D lipsync avatar system into the Learnflow chatbot frontend. The avatar will be added as a **4th response type** alongside text, voice, and video.

**Two Provider Modes:**
1. **`gemini-live`**: Backend sends audio chunks -> Frontend plays + frequency-based lip-sync
2. **`azure`**: Backend sends text -> Frontend synthesizes with Azure SDK + viseme-based lip-sync

---

## Table of Contents

1. [Phase 1: Setup & Dependencies](#phase-1-setup--dependencies)
2. [Phase 2: TypeScript Types](#phase-2-typescript-types)
3. [Phase 3: Vue Composables](#phase-3-vue-composables)
4. [Phase 4: Components](#phase-4-components)
5. [Phase 5: Socket.IO Integration](#phase-5-socketio-integration)
6. [Phase 6: Audio Processing](#phase-6-audio-processing)
7. [Phase 7: Testing & Verification](#phase-7-testing--verification)
8. [File Structure Summary](#file-structure-summary)

---

## Phase 1: Setup & Dependencies

### Task 1.1: Install NPM Packages

**File:** `learnflow/packages/chatbot/package.json`

**Changes:**
```json
{
  "dependencies": {
    "microsoft-cognitiveservices-speech-sdk": "^1.35.0"
  }
}
```

**Verification:**
```bash
cd learnflow/packages/chatbot
npm install
npm list microsoft-cognitiveservices-speech-sdk
```

---

### Task 1.2: Bundle TalkingHead.js with Vue App

**Decision:** Bundle directly with Vue app (not CDN, not self-hosted)

**Source:** `lipsync-e2e-react/backend/static/modules/`
**Target:** `learnflow/packages/chatbot/src/lib/talkinghead/`

**Files to Copy:**
```
talkinghead.mjs         (main avatar engine - ~500KB)
lipsync-en.mjs          (English lip-sync rules)
dynamicbones.mjs        (physics simulation for hair/clothing)
```

**Import in Vue:**
```typescript
// Dynamic import
const { TalkingHead } = await import('@/lib/talkinghead/talkinghead.mjs');
```

---

### Task 1.3: Avatar Models Configuration

**Decision:** Use ReadyPlayer.me direct URLs (already in backend config)

**File:** `lipsync-e2e-react/backend-examples/fastapi-complete/app/avatar_config.py` (reference)

Avatar URLs are fetched directly from ReadyPlayer.me - no local hosting needed.

---

## Phase 2: TypeScript Types

### Task 2.1: Create WebSocket Message Types

**File:** `learnflow/packages/chatbot/src/types/avatar-websocket.ts` (NEW)

```typescript
// learnflow/packages/chatbot/src/types/avatar-websocket.ts

/**
 * Session configuration (TTS + avatar)
 */
export interface SessionConfig {
  tts: {
    provider: 'azure' | 'gemini-live';  // Per-bot fixed config
    voice_id: string;
    locale: string;
    gender: 'male' | 'female';
  };
  avatar: {
    url: string;  // ReadyPlayer.me direct URL
    gender: 'male' | 'female';
    initial_mood: 'happy' | 'sad' | 'angry' | 'neutral' | 'excited' | 'love' | 'surprised';
    initial_view: 'head' | 'body' | 'full';
  };
  background?: string;
}

/**
 * Backend -> Frontend: Initial session configuration
 */
export interface SessionStartMessage {
  type: 'session_start';
  session_id: string;
  config: SessionConfig;
  is_resumed: boolean;  // TRUE if reconnecting to existing session
}

/**
 * Backend -> Frontend: Speak command (Azure mode)
 */
export interface AzureSpeakMessage {
  type: 'speak';
  provider: 'azure';
  voice_id?: string;  // Optional voice override (e.g., 'en-US-GuyNeural')
  text: string;
  message_id: string;
  metadata?: Record<string, any>;
}

/**
 * Backend -> Frontend: Speak command (Gemini Live mode)
 */
export interface GeminiSpeakMessage {
  type: 'speak';
  provider: 'gemini-live';
  audio_chunk: string; // Base64 PCM16 24kHz mono
  text_chunk: string;
  sample_rate: number; // Always 24000 (24kHz)
  is_final: boolean;
  message_id: string;
  metadata?: Record<string, any>;
}

export type SpeakMessage = AzureSpeakMessage | GeminiSpeakMessage;

/**
 * Backend -> Frontend: Avatar control (gestures, moods, views)
 */
export interface AvatarControlMessage {
  type: 'avatar_control';
  command: 'gesture' | 'mood' | 'view' | 'stop_gesture' | 'emoji' | 'lighting';
  params: Record<string, any>;
}

/**
 * Frontend -> Backend: Ready to receive commands
 */
export interface ReadyMessage {
  type: 'ready';
  avatar_loaded: boolean;
  tts_initialized: boolean;
}

/**
 * Frontend -> Backend: Speech playback complete
 */
export interface SpeechCompleteMessage {
  type: 'speech_complete';
  message_id: string;
}

/**
 * Frontend -> Backend: User interrupts AI speech
 * Triggered by: stop button, voice input, or sending a message
 */
export interface UserInterruptMessage {
  type: 'user_interrupt';
  timestamp: number;
}

// Type guards
export function isAzureSpeakMessage(msg: any): msg is AzureSpeakMessage {
  return msg.type === 'speak' && msg.provider === 'azure';
}

export function isGeminiSpeakMessage(msg: any): msg is GeminiSpeakMessage {
  return msg.type === 'speak' && msg.provider === 'gemini-live';
}
```

---

### Task 2.2: Create Avatar State Types

**File:** `learnflow/packages/chatbot/src/types/avatar.ts` (NEW)

```typescript
// learnflow/packages/chatbot/src/types/avatar.ts

export interface AvatarState {
  isLoading: boolean;
  loadingProgress: number; // 0-100
  isConnected: boolean;
  isPlaying: boolean;
  isSynthesizing: boolean;
  currentText: string;
  error: string | null;
}

export interface VoiceConfig {
  voice: string; // e.g., 'en-US-JennyNeural'
  locale: string; // e.g., 'en-US'
  gender: 'male' | 'female';
}

export interface AvatarConfig {
  model: string; // GLB URL (ReadyPlayer.me)
  gender: 'male' | 'female';
  expression: string;
  pose: string;
}

export type ViewType = 'head' | 'body' | 'full';
export type MoodType = 'happy' | 'sad' | 'angry' | 'neutral' | 'excited' | 'love' | 'surprised';
export type GestureType = 'handup' | 'index' | 'ok' | 'thumbup' | 'thumbdown' | 'side' | 'shrug' | 'namaste';
```

---

### Task 2.3: Create TalkingHead Type Definitions

**File:** `learnflow/packages/chatbot/src/types/talking-head.d.ts` (NEW)

```typescript
// learnflow/packages/chatbot/src/types/talking-head.d.ts

declare module '@/lib/talkinghead/talkinghead.mjs' {
  export interface TalkingHeadOptions {
    ttsEndpoint?: string;
    ttsApikey?: string;
    cameraView?: 'head' | 'body' | 'full';
    avatarMood?: string;
    lipsyncLang?: string;
  }

  export interface ShowAvatarOptions {
    url: string;
    body?: 'M' | 'F';
    avatarMood?: string;
    lipsyncLang?: string;
  }

  export class TalkingHead {
    constructor(container: HTMLElement, options: TalkingHeadOptions);
    showAvatar(options: ShowAvatarOptions, onProgress?: (progress: number) => void): Promise<void>;
    setMood(mood: string, level?: number): void;
    setCameraView(view: 'head' | 'body' | 'full'): void;
    playGesture(gesture: string, duration?: number): void;
    stopGesture(): void;
    speakEmoji(emoji: string): void;
    speakWithVisemes(text: string, visemes: any[], audio: AudioBuffer): Promise<void>;
    setMouthShape(shape: string): void;
    stop(): void;
    deleteAvatar(): void;
    avatarMood: string;
  }
}
```

---

## Phase 3: Vue Composables

### Task 3.1: Create Audio Unlock Utility

**File:** `learnflow/packages/chatbot/src/lib/audio/audio-unlock.ts` (NEW)

**Purpose:** Unlock browser audio on first user interaction (chatbot circle click)

```typescript
// learnflow/packages/chatbot/src/lib/audio/audio-unlock.ts

let audioUnlocked = false;
let audioContext: AudioContext | null = null;

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

export async function unlockAudio(): Promise<boolean> {
  if (audioUnlocked) return true;

  try {
    // Create AudioContext if needed
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    // Resume if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Play silent buffer to unlock
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);

    audioUnlocked = true;
    console.log('[Audio] Unlocked successfully');
    return true;
  } catch (err) {
    console.error('[Audio] Failed to unlock:', err);
    return false;
  }
}

export function getSharedAudioContext(): AudioContext | null {
  return audioContext;
}
```

**Integration in FloatingChatbot.vue (line 196):**
```typescript
import { unlockAudio } from '@/lib/audio/audio-unlock';

function toggleChat() {
  isOpen.value = !isOpen.value;
  unlockAudio(); // Unlock audio when user clicks chatbot circle
  emit('toggle');
}
```

---

### Task 3.2: Create `useAvatarSocket` Composable

**File:** `learnflow/packages/chatbot/src/composables/useAvatarSocket.ts` (NEW)

**Key Change:** Uses existing Socket.IO connection, not separate WebSocket

```typescript
// learnflow/packages/chatbot/src/composables/useAvatarSocket.ts
//
// IMPORTANT: Socket.IO Connection Pattern
// ========================================
// Use HTTP URL (not ws://), Socket.IO handles transport internally:
//
//   const socket = io('http://localhost:8001', {
//     path: '/socket.io/',
//     query: { chatId },  // Session ID from POST /chats
//     transports: ['websocket']
//   });
//
// The backend /avatar namespace is handled automatically.

import { ref, computed, onUnmounted } from 'vue';
import type { Socket } from 'socket.io-client';
import type { SessionConfig, SpeakMessage } from '@/types/avatar-websocket';

export interface UseAvatarSocketOptions {
  socket: Socket;  // Existing socket from useChatbotWebSocket
  onSessionStart?: (sessionId: string, config: SessionConfig) => void;
  onSpeak?: (message: SpeakMessage) => void;
  onAvatarControl?: (command: string, params: Record<string, any>) => void;
  onError?: (error: string) => void;
}

export function useAvatarSocket(options: UseAvatarSocketOptions) {
  const { socket } = options;

  const sessionId = ref<string | null>(null);
  const currentConfig = ref<SessionConfig | null>(null);
  const isSpeaking = ref(false);
  const pendingMessages = ref<SpeakMessage[]>([]);

  // Listen for avatar events on existing socket
  function setupListeners() {
    socket.on('session_start', (data: any) => {
      sessionId.value = data.session_id;
      currentConfig.value = data.config;
      options.onSessionStart?.(data.session_id, data.config);
    });

    socket.on('speak', (message: SpeakMessage) => {
      pendingMessages.value.push(message);
      options.onSpeak?.(message);
    });

    socket.on('avatar_control', (data: any) => {
      options.onAvatarControl?.(data.command, data.params);
    });

    socket.on('avatar_error', (error: string) => {
      options.onError?.(error);
    });
  }

  function removeListeners() {
    socket.off('session_start');
    socket.off('speak');
    socket.off('avatar_control');
    socket.off('avatar_error');
  }

  // Send avatar-specific events
  function sendReady(avatarLoaded: boolean, ttsInitialized: boolean) {
    socket.emit('ready', { avatar_loaded: avatarLoaded, tts_initialized: ttsInitialized });
  }

  function sendSpeechComplete(messageId: string) {
    socket.emit('speech_complete', { message_id: messageId });
    // Remove from pending
    const index = pendingMessages.value.findIndex(msg => msg.message_id === messageId);
    if (index !== -1) {
      pendingMessages.value.splice(index, 1);
    }
  }

  function sendInterrupt() {
    pendingMessages.value = [];
    isSpeaking.value = false;
    socket.emit('user_interrupt', { timestamp: Date.now() });
  }

  function setIsSpeaking(speaking: boolean) {
    isSpeaking.value = speaking;
  }

  // Setup on creation
  setupListeners();

  onUnmounted(() => {
    removeListeners();
  });

  return {
    sessionId: computed(() => sessionId.value),
    currentConfig: computed(() => currentConfig.value),
    isSpeaking: computed(() => isSpeaking.value),
    pendingMessagesCount: computed(() => pendingMessages.value.length),
    sendReady,
    sendSpeechComplete,
    sendInterrupt,
    setIsSpeaking,
    removeListeners
  };
}
```

---

### Task 3.3: Create `useAvatar` Composable

**File:** `learnflow/packages/chatbot/src/composables/useAvatar.ts` (NEW)

```typescript
// learnflow/packages/chatbot/src/composables/useAvatar.ts

import { ref, computed, onUnmounted } from 'vue';
import type { TalkingHead } from '@/types/talking-head';

export interface UseAvatarOptions {
  modelUrl: string;
  gender: 'male' | 'female';
  onError?: (error: string) => void;
}

export function useAvatar(options: UseAvatarOptions) {
  const isLoading = ref(false);
  const loadingProgress = ref(0);
  const isReady = ref(false);
  const isPlaying = ref(false);
  const error = ref<string | null>(null);
  const retryCount = ref(0);
  const maxRetries = 2;
  const initializationInProgress = ref(false);  // Prevent duplicate init

  let avatarInstance: TalkingHead | null = null;

  async function initialize(container: HTMLElement): Promise<boolean> {
    // Guard against duplicate initialization
    if (isReady.value) return true;
    if (initializationInProgress.value) {
      console.warn('[Avatar] Initialization already in progress');
      return false;
    }
    initializationInProgress.value = true;

    try {
      isLoading.value = true;
      error.value = null;

      // Dynamic import of TalkingHead
      const { TalkingHead } = await import('@/lib/talkinghead/talkinghead.mjs');

      avatarInstance = new TalkingHead(container, {
        ttsEndpoint: '',
        ttsApikey: '',
        cameraView: 'head',
        avatarMood: 'neutral',
        lipsyncLang: 'en'
      });

      await avatarInstance.showAvatar({
        url: options.modelUrl,
        body: options.gender === 'male' ? 'M' : 'F',
        avatarMood: 'neutral',
        lipsyncLang: 'en'
      }, (progress: number) => {
        loadingProgress.value = progress;
      });

      await waitForAvatar();

      isLoading.value = false;
      isReady.value = true;
      retryCount.value = 0;
      initializationInProgress.value = false;
      return true;

    } catch (err) {
      const errorMsg = `Failed to initialize avatar: ${err}`;
      error.value = errorMsg;
      isLoading.value = false;

      // Retry logic
      if (retryCount.value < maxRetries) {
        retryCount.value++;
        console.log(`[Avatar] Retry ${retryCount.value}/${maxRetries}...`);
        return initialize(container);
      }

      initializationInProgress.value = false;
      options.onError?.(errorMsg);
      return false;
    }
  }

  function waitForAvatar(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (avatarInstance && avatarInstance.avatarMood) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Avatar load timeout'));
      }, 30000);
    });
  }

  function setMood(mood: string, level?: number) {
    avatarInstance?.setMood(mood, level);
  }

  function setView(view: 'head' | 'body' | 'full') {
    avatarInstance?.setCameraView(view);
  }

  function playGesture(gesture: string, duration?: number) {
    avatarInstance?.playGesture(gesture, duration);
  }

  function stopGesture() {
    avatarInstance?.stopGesture();
  }

  function speakEmoji(emoji: string) {
    avatarInstance?.speakEmoji(emoji);
  }

  function setMouthShape(shape: string) {
    avatarInstance?.setMouthShape(shape);
  }

  function stop() {
    avatarInstance?.stop();
    isPlaying.value = false;
  }

  function cleanup() {
    if (avatarInstance) {
      avatarInstance.deleteAvatar();
      avatarInstance = null;
    }
    isReady.value = false;
    isPlaying.value = false;
  }

  function getInstance(): TalkingHead | null {
    return avatarInstance;
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isLoading: computed(() => isLoading.value),
    loadingProgress: computed(() => loadingProgress.value),
    isReady: computed(() => isReady.value),
    isPlaying: computed(() => isPlaying.value),
    error: computed(() => error.value),
    initialize,
    setMood,
    setView,
    playGesture,
    stopGesture,
    speakEmoji,
    setMouthShape,
    stop,
    cleanup,
    getInstance
  };
}
```

---

### Task 3.4: Create `useAzureTTS` Composable

**File:** `learnflow/packages/chatbot/src/composables/useAzureTTS.ts` (NEW)

**Reference:** Port from `lipsync-e2e-react/frontend/src/hooks/useAvatarWithTTS.ts`

---

### Task 3.5: Create `useGeminiLipsync` Composable

**File:** `learnflow/packages/chatbot/src/composables/useGeminiLipsync.ts` (NEW)

**Reference:** Port from `lipsync-e2e-react/frontend/src/hooks/useGeminiLipsync.ts`

**Important:** Do NOT use Vue reactive state for mouth shapes (40 updates/sec will freeze UI). Apply directly to TalkingHead instance.

---

### Task 3.6: Create Audio Utilities

**File:** `learnflow/packages/chatbot/src/lib/audio/audio-utils.ts` (NEW)

```typescript
// learnflow/packages/chatbot/src/lib/audio/audio-utils.ts

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const audioContextCache: Map<string, AudioContext> = new Map();

export async function getAudioContext(options?: AudioContextOptions & { id?: string }): Promise<AudioContext> {
  if (options?.id && audioContextCache.has(options.id)) {
    const cached = audioContextCache.get(options.id);
    if (cached) {
      if (cached.state === 'suspended') await cached.resume();
      return cached;
    }
  }

  const ctx = new AudioContext(options);
  if (ctx.state === 'suspended') await ctx.resume();
  if (options?.id) audioContextCache.set(options.id, ctx);
  return ctx;
}

export function releaseAudioContext(id: string): boolean {
  const ctx = audioContextCache.get(id);
  if (ctx) {
    audioContextCache.delete(id);
    if (ctx.state !== 'closed') ctx.close();
    return true;
  }
  return false;
}

/**
 * Release all cached AudioContexts - call on app unmount
 */
export function releaseAllAudioContexts(): void {
  audioContextCache.forEach((ctx, id) => {
    if (ctx.state !== 'closed') ctx.close();
  });
  audioContextCache.clear();
}
```

**Usage in Vue component:**
```typescript
import { onUnmounted } from 'vue';
import { releaseAudioContext } from '@/lib/audio/audio-utils';

// In useGeminiLipsync or AvatarContainer
onUnmounted(() => {
  releaseAudioContext('gemini-audio');
});
```

---

### Task 3.7: Create GeminiAudioHandler Class

**File:** `learnflow/packages/chatbot/src/lib/audio/GeminiAudioHandler.ts` (NEW)

**Reference:** Copy from `lipsync-e2e-react/frontend/src/lib/audio/GeminiAudioHandler.ts`

---

### Task 3.8: Create SmartMouthAnalyzer Worklet

**File:** `learnflow/packages/chatbot/src/lib/audio/worklets/smart-mouth-analyzer.ts` (NEW)

**Vite Worklet Loading Pattern:**
```typescript
// In Vite (Vue), AudioWorklets must be loaded using import.meta.url
// This is different from Webpack's worker-loader

// In useGeminiLipsync.ts or GeminiAudioHandler.ts:
async function loadWorklet(audioContext: AudioContext): Promise<void> {
  const workletUrl = new URL(
    '../lib/audio/worklets/smart-mouth-analyzer.ts',
    import.meta.url
  );
  await audioContext.audioWorklet.addModule(workletUrl);
}

// Then create the node:
const analyzerNode = new AudioWorkletNode(audioContext, 'smart-mouth-analyzer');
analyzerNode.port.onmessage = (event) => {
  const { mouthShape } = event.data;
  // Apply directly to TalkingHead (NOT via Vue reactive state)
  avatarInstance?.setMouthShape(mouthShape);
};
```

**Reference:** Copy from React project's worklet implementation

---

## Phase 4: Components

### Task 4.1: Create AvatarContainer.vue Component

**File:** `learnflow/packages/chatbot/src/components/AvatarContainer.vue` (NEW)

```vue
<template>
  <div class="avatar-container" :style="{ background: background }">
    <!-- Loading State -->
    <div v-if="isLoading" class="avatar-loading">
      <div class="avatar-loading__progress">
        {{ Math.round(loadingProgress) }}%
      </div>
      <div class="avatar-loading__bar">
        <div class="avatar-loading__fill" :style="{ width: `${loadingProgress}%` }" />
      </div>
    </div>

    <!-- Avatar Canvas -->
    <div ref="avatarRef" class="avatar-canvas" v-show="!isLoading && !hasError" />

    <!-- Error State with Retry -->
    <div v-if="hasError" class="avatar-error">
      <p>{{ errorMessage }}</p>
      <button @click="retry">Retry</button>
    </div>

    <!-- Stop Button (visible when speaking) -->
    <button
      v-if="isSpeaking"
      class="avatar-stop-button"
      @click="handleStop"
    >
      Stop
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAvatar } from '@/composables/useAvatar';
import { useAvatarSocket } from '@/composables/useAvatarSocket';
import { useGeminiLipsync } from '@/composables/useGeminiLipsync';
import { useAzureTTS } from '@/composables/useAzureTTS';
import type { Socket } from 'socket.io-client';
import type { SessionConfig, SpeakMessage } from '@/types/avatar-websocket';

interface Props {
  socket: Socket;
  modelUrl: string;
  gender: 'male' | 'female';
  provider: 'azure' | 'gemini-live';
  background?: string;
}

interface Emits {
  (e: 'ready'): void;
  (e: 'speaking-start'): void;
  (e: 'speaking-end'): void;
  (e: 'error', error: string): void;
  (e: 'fallback'): void;  // Emitted when avatar fails after retries
}

const props = withDefaults(defineProps<Props>(), {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
});

const emit = defineEmits<Emits>();

const avatarRef = ref<HTMLElement | null>(null);
const hasError = ref(false);
const errorMessage = ref('');
const fallbackMode = ref(false);

// Initialize composables
const avatar = useAvatar({
  modelUrl: props.modelUrl,
  gender: props.gender,
  onError: (err) => {
    hasError.value = true;
    errorMessage.value = err;
    emit('error', err);
  }
});

const avatarSocket = useAvatarSocket({
  socket: props.socket,
  onSpeak: handleSpeak,
  onAvatarControl: handleAvatarControl,
  onError: (err) => emit('error', err)
});

// Provider-specific handlers
const geminiLipsync = props.provider === 'gemini-live'
  ? useGeminiLipsync({ avatar: avatar.getInstance })
  : null;

const azureTTS = props.provider === 'azure'
  ? useAzureTTS({ avatar: avatar.getInstance })
  : null;

const isLoading = avatar.isLoading;
const loadingProgress = avatar.loadingProgress;
const isSpeaking = avatarSocket.isSpeaking;

async function handleSpeak(message: SpeakMessage) {
  if (fallbackMode.value) {
    // In fallback mode, just play audio without avatar
    // ... handle audio-only playback
    return;
  }

  avatarSocket.setIsSpeaking(true);
  emit('speaking-start');

  try {
    if (message.provider === 'gemini-live' && geminiLipsync) {
      await geminiLipsync.playChunk(message);
      if (message.is_final) {
        avatarSocket.sendSpeechComplete(message.message_id);
        emit('speaking-end');
      }
    } else if (message.provider === 'azure' && azureTTS) {
      await azureTTS.speak(message.text);
      avatarSocket.sendSpeechComplete(message.message_id);
      emit('speaking-end');
    }
  } catch (err) {
    emit('error', `Speech failed: ${err}`);
  }

  avatarSocket.setIsSpeaking(false);
}

function handleAvatarControl(command: string, params: Record<string, any>) {
  switch (command) {
    case 'gesture':
      avatar.playGesture(params.gesture, params.duration);
      break;
    case 'mood':
      avatar.setMood(params.mood, params.level);
      break;
    case 'view':
      avatar.setView(params.view);
      break;
    case 'stop_gesture':
      avatar.stopGesture();
      break;
    case 'emoji':
      avatar.speakEmoji(params.emoji);
      break;
  }
}

function handleStop() {
  avatar.stop();
  avatarSocket.sendInterrupt();
  emit('speaking-end');
}

async function retry() {
  hasError.value = false;
  errorMessage.value = '';
  if (avatarRef.value) {
    const success = await avatar.initialize(avatarRef.value);
    if (!success) {
      // After retries failed, enter fallback mode
      fallbackMode.value = true;
      emit('fallback');
    }
  }
}

onMounted(async () => {
  if (avatarRef.value) {
    const success = await avatar.initialize(avatarRef.value);
    if (success) {
      avatarSocket.sendReady(true, true);
      emit('ready');
    } else {
      fallbackMode.value = true;
      emit('fallback');
    }
  }
});

onUnmounted(() => {
  avatar.cleanup();
});
</script>

<style scoped>
.avatar-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  border-radius: 8px;
  overflow: hidden;
}

.avatar-canvas {
  width: 100%;
  height: 100%;
}

.avatar-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.avatar-loading__progress {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  margin-bottom: 0.5rem;
}

.avatar-loading__bar {
  width: 200px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.avatar-loading__fill {
  height: 100%;
  background: white;
  transition: width 0.2s;
}

.avatar-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
}

.avatar-error button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.avatar-stop-button {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 1.5rem;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
</style>
```

---

### Task 4.2: Integrate Avatar into FloatingChatbot.vue

**File:** `learnflow/packages/chatbot/src/components/FloatingChatbot.vue` (MODIFY)

**Changes:**

1. Add audio unlock to `toggleChat()`:
```typescript
import { unlockAudio } from '@/lib/audio/audio-unlock';

function toggleChat() {
  isOpen.value = !isOpen.value;
  unlockAudio(); // <-- ADD THIS
  emit('toggle');
}
```

2. Add avatar to media section:
```vue
<template>
  <!-- In floating-chatbot__media section -->
  <div v-if="isAvatarEnabled" class="floating-chatbot__avatar">
    <AvatarContainer
      :socket="socket"
      :model-url="avatarConfig.url"
      :gender="avatarConfig.gender"
      :provider="avatarConfig.provider"
      @ready="handleAvatarReady"
      @speaking-start="handleAvatarSpeakingStart"
      @speaking-end="handleAvatarSpeakingEnd"
      @error="handleAvatarError"
      @fallback="handleAvatarFallback"
    />
  </div>

  <!-- Existing video player as fallback -->
  <div v-else-if="botIdleVideo && showVideo" class="floating-chatbot__media">
    <!-- existing video code -->
  </div>
</template>

<script setup>
const isAvatarEnabled = computed(() => {
  return props.botInfo?.supportedResponseTypes?.includes('avatar') &&
         !avatarFallbackMode.value;
});

const avatarFallbackMode = ref(false);

function handleAvatarFallback() {
  avatarFallbackMode.value = true;
  // Continue with text + audio, no avatar
}
</script>
```

---

## Phase 5: Socket.IO Integration

**Key Point:** Avatar events are added to the existing socket connection, not a separate WebSocket.

| Event | Direction | Handler |
|-------|-----------|---------|
| `session_start` | Backend -> Frontend | useAvatarSocket |
| `speak` | Backend -> Frontend | AvatarContainer |
| `avatar_control` | Backend -> Frontend | AvatarContainer |
| `ready` | Frontend -> Backend | useAvatarSocket |
| `speech_complete` | Frontend -> Backend | useAvatarSocket |
| `user_interrupt` | Frontend -> Backend | useAvatarSocket |

---

## Phase 6: Audio Processing

All audio processing is handled in the utilities created in Phase 3.

| Task | Description | File |
|------|-------------|------|
| 6.1 | Base64 to ArrayBuffer | audio-utils.ts |
| 6.2 | PCM16 to Float32 | GeminiAudioHandler.ts |
| 6.3 | Audio Queue Management | GeminiAudioHandler.ts |
| 6.4 | Frequency Analysis | smart-mouth-analyzer.ts |
| 6.5 | Mouth Shape Mapping | smart-mouth-analyzer.ts |

---

## Phase 7: Testing & Verification

### Task 7.1: Test Avatar Loading
- [ ] Avatar container renders
- [ ] TalkingHead.js imports successfully
- [ ] Avatar model downloads from ReadyPlayer.me
- [ ] Loading progress shows 0-100%
- [ ] No errors in console

### Task 7.2: Test Audio Unlock
- [ ] Click chatbot circle
- [ ] Audio unlocks silently
- [ ] Avatar audio plays on first message

### Task 7.3: Test Azure TTS
- [ ] Backend sends `speak` with `provider: 'azure'`
- [ ] Avatar mouth moves (viseme-based)
- [ ] Audio plays clearly
- [ ] `speech_complete` sent to backend

### Task 7.4: Test Gemini Live Audio
- [ ] Backend sends `speak` with `provider: 'gemini-live'`
- [ ] Audio chunks play gaplessly
- [ ] Avatar mouth moves (frequency-based)
- [ ] `speech_complete` sent after `is_final: true`

### Task 7.5: Test Avatar Controls
- [ ] Gesture command works (thumbup, shrug, etc.)
- [ ] Mood command works (happy, sad, etc.)
- [ ] View command works (head, body, full)
- [ ] Stop gesture command works

### Task 7.6: Test User Interruption
- [ ] Click "Stop" button - avatar stops
- [ ] Start voice input - avatar stops
- [ ] Send message - avatar stops
- [ ] `user_interrupt` sent to backend

### Task 7.7: Test Fallback Mode
- [ ] Simulate avatar load failure
- [ ] Retry happens automatically
- [ ] After max retries, fallback mode activates
- [ ] Text + audio continues working without avatar

---

## File Structure Summary

```
learnflow/packages/chatbot/
├── src/
│   ├── types/
│   │   ├── avatar-websocket.ts          (Task 2.1 - NEW)
│   │   ├── avatar.ts                     (Task 2.2 - NEW)
│   │   └── talking-head.d.ts             (Task 2.3 - NEW)
│   ├── composables/
│   │   ├── useAvatarSocket.ts            (Task 3.2 - NEW)
│   │   ├── useAvatar.ts                  (Task 3.3 - NEW)
│   │   ├── useAzureTTS.ts                (Task 3.4 - NEW)
│   │   └── useGeminiLipsync.ts           (Task 3.5 - NEW)
│   ├── lib/
│   │   ├── talkinghead/
│   │   │   ├── talkinghead.mjs           (Task 1.2 - COPY)
│   │   │   ├── lipsync-en.mjs            (Task 1.2 - COPY)
│   │   │   └── dynamicbones.mjs          (Task 1.2 - COPY)
│   │   └── audio/
│   │       ├── audio-unlock.ts           (Task 3.1 - NEW)
│   │       ├── audio-utils.ts            (Task 3.6 - NEW)
│   │       ├── GeminiAudioHandler.ts     (Task 3.7 - NEW)
│   │       └── worklets/
│   │           └── smart-mouth-analyzer.ts (Task 3.8 - NEW)
│   └── components/
│       ├── AvatarContainer.vue           (Task 4.1 - NEW)
│       └── FloatingChatbot.vue           (Task 4.2 - MODIFY)
└── package.json                          (Task 1.1 - MODIFY)
```

---

## Reference Files (Copy From)

### TypeScript Types (CRITICAL - Copy these first!)
| Target File | Source File | Notes |
|-------------|-------------|-------|
| `types/bot.ts` | `frontend/src/types/bot.ts` | **REQUIRED** - BotConfig definition |
| `types/avatar-websocket.ts` | `frontend/src/types/websocket.ts` | Copy ALL types |
| `types/socketio.ts` | `frontend/src/types/socketio.ts` | **REQUIRED** - Socket.IO event types |

### Composables
| Target File | Source File | Notes |
|-------------|-------------|-------|
| `useAvatarSocket.ts` | Custom | Based on existing useChatbotWebSocket.ts pattern |
| `useAvatar.ts` | `frontend/src/components/avatar/useAvatar.ts` | Avatar initialization |
| `useAzureTTS.ts` | `frontend/src/hooks/useAvatarWithTTS.ts` | **Note: Different name in React!** |
| `useGeminiLipsync.ts` | `frontend/src/hooks/useGeminiLipsync.ts` | Gemini audio playback |
| `useBot.ts` | `frontend/src/hooks/useBot.ts` | Fetch bot config |
| `useChat.ts` | `frontend/src/hooks/useChat.ts` | Create/resume session |
| `useSpeedPreference.ts` | `frontend/src/hooks/useSpeedPreference.ts` | **NEW**: User speed preference (localStorage) |

### UI Components
| Target File | Source File | Notes |
|-------------|-------------|-------|
| `SpeedControl.vue` | `frontend/src/components/avatar/SpeedControl.tsx` | **NEW**: Speed control UI (Azure only) |

### Audio Processing
| Target File | Source File | Notes |
|-------------|-------------|-------|
| `lib/audio/audio-utils.ts` | `frontend/src/lib/audio/audio-utils.ts` | Base64, ArrayBuffer conversion |
| `lib/audio/GeminiAudioHandler.ts` | `frontend/src/lib/audio/GeminiAudioHandler.ts` | Audio queue & playback |
| `lib/audio/worklets/*` | `frontend/src/lib/audio/worklets/` | AudioWorklet files |

### TalkingHead.js
| Target File | Source File |
|-------------|-------------|
| `lib/talkinghead/*.mjs` | `backend/static/modules/` |

### API Service
| Target File | Source File | Notes |
|-------------|-------------|-------|
| `services/api.ts` | `frontend/src/services/api.ts` | REST API client (listBots, getBot, createChat) |

---

## Initialization Sequence (CRITICAL)

The correct order for initializing the avatar system:

```
1. Fetch bot config:     GET /bots/{bot_id}
2. Create chat session:  POST /chats { botId }
3. Wait for chatId:      Response: { chatId, bot, isResumed }
4. Connect Socket.IO:    io(url, { query: { chatId } })
5. Wait for connection:  socket.on('connect')
6. Render avatar:        <AvatarContainer /> mounts
7. Initialize avatar:    TalkingHead.showAvatar()
8. Send ready:           socket.emit('ready', { avatar_loaded: true })
9. Receive session:      socket.on('session_start')
10. Start chatting:      Ready for speak events!
```

**Common Mistake**: Connecting Socket.IO before chatId is available will fail!

---

## Project Locations

**Avatar Reference (React):**
```
C:\ai\amit_projects\lipsync-e2e-react
```

**Learnflow Chatbot (Vue):**
```
C:\ai\amit_projects\learnflow\packages\chatbot
```

**Backend Example:**
```
C:\ai\amit_projects\lipsync-e2e-react\backend-examples\fastapi-complete
```

---

**This plan is ready for implementation. All decisions have been made and documented.**

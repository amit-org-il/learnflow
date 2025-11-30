# Feature Mapping: React → Vue (Learnflow Integration)

**Created:** 2025-11-30
**Purpose:** Complete feature inventory mapping from lipsync-e2e-react to Learnflow Vue

---

## Feature Inventory Summary

### Status Legend
- ✅ = Documented in IMPLEMENTATION_PLAN.md
- ⚠️ = Missing from plan (needs to be added)
- ⏭️ = Skip (not needed for Learnflow)

---

## A. Hooks (React) → Composables (Vue)

| React Hook | Vue Composable | Status | Notes |
|------------|----------------|--------|-------|
| `useAvatarWebSocket.ts` | `useAvatarSocket.ts` | ✅ | Socket.IO events |
| `useAvatarWithTTS.ts` | `useAzureTTS.ts` | ✅ | Azure viseme-based TTS |
| `useGeminiLipsync.ts` | `useGeminiLipsync.ts` | ✅ | Frequency-based lip sync |
| `useBot.ts` | `useBot.ts` | ✅ | Fetch bot config |
| `useChat.ts` | `useChat.ts` | ✅ | Create/resume session |
| `useVoiceRecording.ts` | `useVoiceRecording.ts` | ⚠️ | **P0** - Voice input with VAD |
| `useAvatarPreloader.ts` | `useAvatarPreloader.ts` | ⚠️ | **P1** - IndexedDB caching |
| `useEventCallback.ts` | N/A | ⏭️ | React-specific utility |
| `useWebSocket.ts` | N/A | ⏭️ | Replaced by Socket.IO |

---

## B. Components (React) → Components (Vue)

| React Component | Vue Component | Status | Notes |
|-----------------|---------------|--------|-------|
| `AvatarCanvas.tsx` | `AvatarContainer.vue` | ✅ | TalkingHead canvas |
| `ViewToggleButton.tsx` | `ViewToggleButton.vue` | ⚠️ | **P2** - Camera view cycling |
| `VoiceRecorder.tsx` | `VoiceRecorder.vue` | ⚠️ | **P0** - Mic button + volume |
| `StreamingText.tsx` | `StreamingText.vue` | ⚠️ | **P0** - Gemini text chunks |
| `ErrorBoundary.tsx` | N/A | ⏭️ | React-specific pattern |
| `BotSelector.tsx` | N/A | ⏭️ | Demo app only |
| `BotCard.tsx` | N/A | ⏭️ | Demo app only |
| `ChatInterface.tsx` | N/A | ⏭️ | Demo app only |
| `StatusIndicators.tsx` | N/A | ⏭️ | Demo app only |
| `VoiceSelector.tsx` | N/A | ⏭️ | Demo app only |

---

## C. Services

| React Service | Vue Service | Status | Notes |
|---------------|-------------|--------|-------|
| `api.ts` | `api.ts` | ✅ | REST API client |
| `healthService.ts` | `healthService.ts` | ⚠️ | **P2** - Backend health monitor |
| `azureTTSService.ts` | Part of `useAzureTTS.ts` | ✅ | Azure SDK wrapper |
| `speechRecognition.ts` | N/A | ⏭️ | Browser STT (not used) |
| `websocket.ts` | N/A | ⏭️ | Replaced by Socket.IO |
| `tts.ts` | N/A | ⏭️ | Legacy |
| `lipsync.ts` | N/A | ⏭️ | Legacy |
| `gemini-lipsync.ts` | N/A | ⏭️ | Moved to hook |
| `chatbot.ts` | N/A | ⏭️ | Demo app only |

---

## D. Audio Processing

| React File | Vue File | Status | Notes |
|------------|----------|--------|-------|
| `AudioRecorder.ts` | `AudioRecorder.ts` | ⚠️ | **P0** - Mic capture + VAD |
| `GeminiAudioHandler.ts` | `GeminiAudioHandler.ts` | ✅ | Audio playback queue |
| `smart-mouth-analyzer.ts` | `smart-mouth-analyzer.ts` | ✅ | AudioWorklet |
| `audio-utils.ts` | `audio-utils.ts` | ✅ | Base64/ArrayBuffer |

---

## E. Caching

| React File | Vue File | Status | Notes |
|------------|----------|--------|-------|
| `avatarCacheService.ts` | `avatarCacheService.ts` | ⚠️ | **P1** - IndexedDB avatar cache |

---

## F. Types

| React Type File | Vue Type File | Status | Notes |
|-----------------|---------------|--------|-------|
| `bot.ts` | `bot.ts` | ✅ | BotConfig definition |
| `websocket.ts` | `avatar-websocket.ts` | ✅ | Socket.IO message types |
| `socketio.ts` | `socketio.ts` | ✅ | Socket.IO event types |

---

## Missing Features - Detailed Specs

### 1. VoiceRecording with VAD (P0 - Critical)

**Files to Create:**
- `src/composables/useVoiceRecording.ts`
- `src/components/VoiceRecorder.vue`
- `src/lib/audio/AudioRecorder.ts`

**Source Reference:** `frontend/src/hooks/useVoiceRecording.ts`

```typescript
// Key Interface
export interface UseVoiceRecordingOptions {
  sampleRate?: number;           // Default: 16000 for Gemini
  onAudioChunk: (base64Audio: string, sampleRate: number, isFinal: boolean) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: Error) => void;
  onVolumeChange?: (level: number) => void;
  interruptOnStart?: boolean;    // Stop avatar speech when user starts speaking
  onInterruptSpeech?: () => void;
  vadThreshold?: number;         // Voice Activity Detection threshold (0-1)
}

export interface VoiceRecordingState {
  isRecording: boolean;
  isInitializing: boolean;
  error: string | null;
  volumeLevel: number;           // 0-1 for UI visualization
  hasPermission: boolean;
}

export interface VoiceRecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
}
```

**VoiceRecorder.vue Features:**
- Large circular mic button (red when recording)
- Real-time volume level ring/bar
- Disabled state when disconnected
- Permission denied handling
- Loading state during mic init

---

### 2. StreamingText Component (P0 - Critical)

**File:** `src/components/StreamingText.vue`

**Source Reference:** `frontend/src/components/StreamingText.tsx`

```vue
<template>
  <div
    ref="containerRef"
    class="streaming-text"
    :style="{ maxHeight: `${maxHeight}px` }"
    :dir="dir"
  >
    <div ref="textRef" class="streaming-text__content">
      {{ displayText }}
      <span v-if="isStreaming" class="streaming-text__cursor">|</span>
    </div>
    <button
      v-if="showClearButton && !isStreaming && displayText"
      class="streaming-text__clear"
      @click="handleClear"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  textChunks: string[];
  isStreaming: boolean;
  onClear?: () => void;
  dir?: 'ltr' | 'rtl' | 'auto';
  maxHeight?: number;         // Default: 200px
  showClearButton?: boolean;  // Default: true when not streaming
}

// Features:
// - Auto-scroll to bottom on new chunks
// - Blinking cursor while streaming
// - RTL support for Hebrew
// - Clear button after completion
</script>
```

---

### 3. Avatar Preloader with IndexedDB Cache (P1 - High)

**Files:**
- `src/composables/useAvatarPreloader.ts`
- `src/lib/cache/avatarCacheService.ts`

**Source Reference:** `frontend/src/hooks/useAvatarPreloader.ts`, `frontend/src/lib/cache/avatarCacheService.ts`

**Benefits:**
- First visit: Avatar fetched and cached (~5-10 seconds)
- Subsequent visits: Instant from cache (~100ms)
- Switching avatars (male/female) is instant
- 30-day cache TTL with auto-refresh

```typescript
// avatarCacheService.ts - Key Interface
interface CachedAvatar {
  url: string;           // Original URL (key)
  data: ArrayBuffer;     // GLB file binary data
  timestamp: number;     // Cache time
  version: string;       // Cache version for invalidation
  size: number;          // File size in bytes
}

class AvatarCacheService {
  async getCachedUrl(originalUrl: string): Promise<string | null>;
  async cacheAvatar(url: string): Promise<string>;
  async clearCache(): Promise<void>;
  async getCacheStats(): Promise<CacheStats>;
}

// useAvatarPreloader.ts - Interface
interface UseAvatarPreloaderReturn {
  status: AvatarPreloadState;    // { female: 'loaded', male: 'loading' }
  cachedUrls: CachedAvatarUrls;  // Blob URLs or original URLs
  isPreloading: boolean;
  isReady: boolean;
  preload: () => void;
  getAvatarUrl: (gender: 'male' | 'female') => string;
}
```

---

### 4. ViewToggleButton Component (P2 - Medium)

**File:** `src/components/ViewToggleButton.vue`

**Source Reference:** `frontend/src/components/avatar/ViewToggleButton.tsx`

```typescript
// View cycle: head → upper → body → full → head
const VIEW_CYCLE = ['head', 'upper', 'body', 'full'] as const;
const VIEW_ICONS = {
  head: '😊',   // Close-up face
  upper: '👆',  // Upper body
  body: '👤',   // Mid body
  full: '🧍',   // Full body
};

// Props
interface ViewToggleButtonProps {
  currentView: string;
  onViewChange: (view: ViewType) => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showLabel?: boolean;
}
```

---

### 5. Health Service (P2 - Medium)

**File:** `src/services/healthService.ts`

**Source Reference:** `frontend/src/services/healthService.ts`

```typescript
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  azure_configured: boolean;
  region?: string;
  timestamp: number;
  error?: string;
}

export interface HealthCheckOptions {
  checkInterval?: number;  // Default: 30000ms
  timeout?: number;        // Default: 5000ms
  maxRetries?: number;     // Default: 3
}

// Features:
// - Polls /health endpoint every 30 seconds
// - Status change callbacks
// - Retry with backoff on failure
// - Auto-reconnect logic
```

---

## Backend Socket.IO Events - Complete Reference

### Backend → Frontend Events

| Event | Provider | Payload | Handler |
|-------|----------|---------|---------|
| `session_start` | Both | `{ session_id, config, is_resumed }` | Initialize avatar config |
| `speak` | Azure | `{ type: 'speak', provider: 'azure', text, message_id, voice_id? }` | Synthesize + play |
| `speak` | Gemini | `{ type: 'speak', provider: 'gemini-live', audio_chunk, text_chunk, is_final, message_id }` | Play audio + lip sync |
| `avatar_control` | Both | `{ command, params }` | Gesture/mood/view |
| `avatar_error` | Both | `string` | Display error |
| `config_update` | Both | `{ config }` | Hot reload config |
| `pong` | Both | `{ timestamp }` | Heartbeat response |

### Frontend → Backend Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `ready` | `{ avatar_loaded, tts_initialized }` | Signal avatar ready |
| `speech_complete` | `{ message_id }` | Speech finished |
| `user_message` | `{ text, language?, timestamp }` | Text input |
| `user_voice` | `{ audio_chunk, sample_rate, is_final }` | Voice input |
| `user_interrupt` | `{ timestamp }` | Stop avatar speech |
| `error` | `{ code, message }` | Client error report |
| `ping` | `{ timestamp }` | Heartbeat request |

---

## Updated File Structure (Complete)

```
learnflow/packages/chatbot/
├── src/
│   ├── types/
│   │   ├── avatar-websocket.ts          (Task 2.1)
│   │   ├── avatar.ts                     (Task 2.2)
│   │   └── talking-head.d.ts             (Task 2.3)
│   ├── composables/
│   │   ├── useAvatarSocket.ts            (Task 3.2)
│   │   ├── useAvatar.ts                  (Task 3.3)
│   │   ├── useAzureTTS.ts                (Task 3.4)
│   │   ├── useGeminiLipsync.ts           (Task 3.5)
│   │   ├── useVoiceRecording.ts          (P0 - NEW)
│   │   └── useAvatarPreloader.ts         (P1 - NEW)
│   ├── lib/
│   │   ├── talkinghead/
│   │   │   ├── talkinghead.mjs           (Task 1.2 - COPY)
│   │   │   ├── lipsync-en.mjs            (Task 1.2 - COPY)
│   │   │   └── dynamicbones.mjs          (Task 1.2 - COPY)
│   │   ├── audio/
│   │   │   ├── audio-unlock.ts           (Task 3.1)
│   │   │   ├── audio-utils.ts            (Task 3.6)
│   │   │   ├── AudioRecorder.ts          (P0 - NEW)
│   │   │   ├── GeminiAudioHandler.ts     (Task 3.7)
│   │   │   └── worklets/
│   │   │       └── smart-mouth-analyzer.ts (Task 3.8)
│   │   └── cache/
│   │       └── avatarCacheService.ts     (P1 - NEW)
│   ├── services/
│   │   └── healthService.ts              (P2 - NEW)
│   └── components/
│       ├── AvatarContainer.vue           (Task 4.1)
│       ├── ViewToggleButton.vue          (P2 - NEW)
│       ├── VoiceRecorder.vue             (P0 - NEW)
│       ├── StreamingText.vue             (P0 - NEW)
│       └── FloatingChatbot.vue           (Task 4.2 - MODIFY)
└── package.json                          (Task 1.1 - MODIFY)
```

---

## Priority Matrix

| Priority | Feature | Reason | Effort |
|----------|---------|--------|--------|
| **P0** | VoiceRecording + AudioRecorder | Required for Gemini Live voice input | 3-4 hrs |
| **P0** | StreamingText | Required for Gemini Live text display | 1-2 hrs |
| **P1** | Avatar Caching (IndexedDB) | UX: Reduces load time 10s → 100ms | 2-3 hrs |
| **P2** | ViewToggleButton | Nice to have for camera control | 1 hr |
| **P2** | HealthService | Monitoring, not core functionality | 1 hr |

**Total Additional Effort:** ~8-11 hours

---

## Source File References

### Copy From (with modifications for Vue)

| Target | Source | Copy/Port |
|--------|--------|-----------|
| `useVoiceRecording.ts` | `frontend/src/hooks/useVoiceRecording.ts` | Port to Vue |
| `VoiceRecorder.vue` | `frontend/src/components/VoiceRecorder.tsx` | Port to Vue |
| `AudioRecorder.ts` | `frontend/src/lib/audio/AudioRecorder.ts` | Direct copy |
| `StreamingText.vue` | `frontend/src/components/StreamingText.tsx` | Port to Vue |
| `useAvatarPreloader.ts` | `frontend/src/hooks/useAvatarPreloader.ts` | Port to Vue |
| `avatarCacheService.ts` | `frontend/src/lib/cache/avatarCacheService.ts` | Direct copy |
| `ViewToggleButton.vue` | `frontend/src/components/avatar/ViewToggleButton.tsx` | Port to Vue |
| `healthService.ts` | `frontend/src/services/healthService.ts` | Direct copy |

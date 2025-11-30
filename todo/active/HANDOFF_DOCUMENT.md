# Learnflow Avatar Integration - Handoff Document
**Date:** 2025-11-30
**From:** Claude Code Validation Team
**To:** Learnflow Integration Team

---

## 📋 Overview

This document contains everything learned during the validation and fixing of the Learnflow avatar integration plan. The phases folder (`todo/active/learnflow_integration/phases/`) is now your **SINGLE SOURCE OF TRUTH** - all code is complete, tested against the working React implementation, and ready to copy-paste.

---

## 🎯 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Vue 3 + Vite + TypeScript
- Backend running on port 8001

### Implementation Order
```
Phase 1 (Setup) → Phase 2 (Types) → Phase 3 (Composables) → Phase 4 (Components)
                                                          ↓
Phase 9 (Polish) ← Phase 8 (Caching) ← Phase 7 (Streaming) ← Phase 6 (Voice) ← Phase 5 (API)
```

**Note:** Phase 8 (Caching) can run in parallel with Phases 5-7.

---

## 🔑 Critical Decisions Already Made

These decisions were made during validation - **DO NOT change them**:

### 1. Session Management
- **Backend controls session IDs** - frontend does NOT generate them
- Frontend calls `POST /chats` → backend returns `{ chatId, bot, isResumed }`
- Store chatId in `sessionStorage` (NOT localStorage - clears on tab close)

### 2. TTS Provider Strategy
- Support **BOTH Azure TTS and Gemini Live**
- Bot config determines which provider to use
- **Single synthesizer per bot** - no voice switching mid-conversation

### 3. Socket.IO Configuration
```typescript
// CORRECT - namespace in URL path:
io('http://localhost:8001/avatar', { query: { chatId } })

// WRONG - namespace as query param:
io('http://localhost:8001', { query: { namespace: 'avatar' } })
```

### 4. Audio Handling
- Use `audioContext()` factory from `audio-utils.ts` (handles autoplay policy)
- Call audio unlock on user interaction (chat toggle, first click)
- Azure TTS output format: `Raw48Khz16BitMonoPcm`

### 5. Mouth Shapes (IMPORTANT!)
- Apply mouth shapes **directly to TalkingHead instance**
- Do **NOT** use Vue reactive state for mouth updates (40 updates/sec would freeze UI)

### 6. IndexedDB Caching
- Store `ArrayBuffer` in IndexedDB, **NOT Blob**
- Create Blob URL from ArrayBuffer when retrieving
- This was a bug fix from the React implementation

### 7. Avatar Container Dimensions (IMPORTANT!)
The TalkingHead avatar requires **different dimensions** than the Learnflow video player:

| Aspect | Learnflow Video Player | TalkingHead Avatar |
|--------|------------------------|-------------------|
| Width | 360px (22.5rem) | **400px (25rem)** |
| Height | 176px (11rem) | **200-400px (responsive)** |
| Aspect Ratio | ~2:1 (wide) | **~1:1 (square-ish)** |

**⚠️ Layout Challenge:** A fixed 400px avatar would leave almost NO room for chat messages in the current 600px window!

**Solution: Responsive Avatar Sizing**
```css
/* Responsive height: adapts to screen size */
.floating-chatbot__media--avatar {
  height: clamp(12.5rem, 35vh, 25rem); /* 200px min, 35% viewport, 400px max */
}

/* Larger window to accommodate avatar + messages */
.floating-chatbot__window--floating.has-avatar {
  width: 25rem;
  max-height: 56rem;  /* 896px */
  height: calc(100vh - 4rem);
}

/* Ensure messages always have minimum space */
.chat-container__messages {
  min-height: 12.5rem;  /* 200px minimum */
}
```

**Responsive Breakdown:**
| Screen Height | Avatar | Messages | Status |
|---------------|--------|----------|--------|
| > 900px | 400px | ~300px | ✅ Full size |
| 700-900px | 280px | ~250px | ✅ Good |
| 600-700px | 220px | ~200px | ✅ Usable |
| < 600px | 160px | ~200px | ✅ Compact |

See **Phase 4** for complete responsive CSS with all breakpoints.

---

## 📁 File Structure to Create

```
learnflow/packages/chatbot/
├── .env                                    # Phase 1
├── public/
│   ├── lib/talkinghead/
│   │   ├── talkinghead.mjs                # Phase 1 (copy from backend-old)
│   │   ├── lipsync-en.mjs                 # Phase 1
│   │   └── dynamicbones.mjs               # Phase 1
│   └── worklets/
│       └── audio-processor.js             # Phase 6
├── src/
│   ├── config/
│   │   └── api.ts                         # Phase 5 (shared base URL)
│   ├── types/
│   │   ├── avatar-websocket.ts            # Phase 2
│   │   ├── avatar.ts                      # Phase 2
│   │   └── talking-head.d.ts              # Phase 2
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── audio-utils.ts             # Phase 3
│   │   │   ├── audio-unlock.ts            # Phase 3
│   │   │   ├── audioworklet-registry.ts   # Phase 3
│   │   │   ├── GeminiAudioHandler.ts      # Phase 3
│   │   │   └── AudioRecorder.ts           # Phase 6
│   │   └── cache/
│   │       └── avatarCacheService.ts      # Phase 8
│   ├── composables/
│   │   ├── useAvatarSocket.ts             # Phase 3
│   │   ├── useAvatar.ts                   # Phase 3
│   │   ├── useAzureTTS.ts                 # Phase 3
│   │   ├── useGeminiLipsync.ts            # Phase 3
│   │   ├── useBot.ts                      # Phase 5
│   │   ├── useChat.ts                     # Phase 5
│   │   ├── useVoiceRecording.ts           # Phase 6
│   │   └── useAvatarPreloader.ts          # Phase 8
│   ├── components/
│   │   ├── AvatarContainer.vue            # Phase 4
│   │   ├── VoiceRecorder.vue              # Phase 6
│   │   ├── StreamingText.vue              # Phase 7
│   │   └── ViewToggleButton.vue           # Phase 9
│   └── services/
│       └── healthService.ts               # Phase 9
└── vite.config.ts                         # Phase 1 (update)
```

---

## ⚠️ Common Pitfalls & Solutions

### 1. TalkingHead.js Files Location
```bash
# WRONG path:
backend/static/modules/talkinghead.mjs

# CORRECT path:
backend-old/static/modules/talkinghead.mjs
```

### 2. GeminiAudioHandler API
```typescript
// WRONG (old API):
handler.start();
handler.queueAudio(base64);

// CORRECT (current API):
handler.initialize();
handler.playChunk(base64);
handler.complete();  // Call when is_final=true
```

### 3. Socket.IO Event Names
```typescript
// WRONG - separate event per provider:
socket.on('gemini_speak', ...);
socket.on('azure_speak', ...);

// CORRECT - single event, check provider:
socket.on('speak', (message: SpeakMessage) => {
  if (message.provider === 'gemini-live') {
    // Handle Gemini
  } else if (message.provider === 'azure') {
    // Handle Azure
  }
});
```

### 4. Base64 Encoding for Audio
```typescript
// WRONG - fails for bytes > 127:
btoa(String.fromCharCode(...new Uint8Array(buffer)))

// CORRECT - byte-by-byte:
const bytes = new Uint8Array(buffer);
let binary = '';
for (let i = 0; i < bytes.length; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const base64 = btoa(binary);
```

### 5. AudioWorklet vs ScriptProcessor
```typescript
// WRONG - deprecated:
const processor = audioContext.createScriptProcessor(4096, 1, 1);

// CORRECT - modern API:
await audioContext.audioWorklet.addModule('/worklets/audio-processor.js');
const processor = new AudioWorkletNode(audioContext, 'audio-processor');
```

### 6. ViewType Values
```typescript
// CORRECT - only 3 values (matches backend):
type ViewType = 'head' | 'body' | 'full';

// WRONG - 'upper' doesn't exist in backend:
type ViewType = 'head' | 'upper' | 'body' | 'full';
```

---

## 🔌 Backend API Reference

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/bots/{bot_id}` | Get bot configuration |
| POST | `/chats` | Create/resume chat session |
| GET | `/health` | Backend health check |

### POST /chats Request
```json
{
  "botId": "string",
  "courseId": "string (optional)",
  "lessonId": "string (optional)",
  "pageId": "string (optional)"
}
```

### POST /chats Response
```json
{
  "chatId": "uuid",
  "bot": { /* BotConfig */ },
  "isResumed": false
}
```

### Socket.IO Events

| Direction | Event | Payload |
|-----------|-------|---------|
| Server→Client | `connect` | - |
| Server→Client | `session_start` | `SessionConfig` |
| Server→Client | `speak` | `SpeakMessage` (Azure or Gemini) |
| Server→Client | `avatar_control` | `AvatarControlMessage` |
| Client→Server | `ready` | `{ avatar_loaded, audio_enabled }` |
| Client→Server | `user_message` | `{ text }` |
| Client→Server | `user_voice` | `{ audio, sample_rate, is_final }` |
| Client→Server | `speech_complete` | `{ message_id }` |
| Client→Server | `user_interrupt` | `{}` |

---

## 🎤 Azure TTS Proxy

The backend proxies Azure TTS to hide API keys:

```typescript
// Frontend connects to backend proxy:
const wsUrl = `ws://localhost:8001/ws/tts/cognitiveservices/websocket/v1`;

const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
  new URL(wsUrl),
  "dummy_key"  // Backend handles real auth
);

speechConfig.speechSynthesisOutputFormat =
  SpeechSDK.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm;
```

---

## 🎙️ Gemini Live Audio Flow

```
┌─────────────┐    Base64 PCM16    ┌─────────────┐
│ Microphone  │ ─────────────────> │   Backend   │
│ (16kHz)     │    user_voice      │             │
└─────────────┘                    └─────────────┘
                                          │
                                          │ speak event
                                          │ (audio_chunk, is_final)
                                          ▼
┌─────────────┐    mouth shapes    ┌─────────────┐
│ TalkingHead │ <───────────────── │ Gemini      │
│ Avatar      │    (direct apply)  │ Lipsync     │
└─────────────┘                    └─────────────┘
```

**Key points:**
- Microphone captures at 16kHz (Gemini requirement)
- VAD (Voice Activity Detection) filters silence
- Audio chunks streamed with 200ms look-ahead scheduling
- Mouth shapes calculated from audio frequency, NOT visemes

---

## 📊 Viseme Map (Azure TTS)

```typescript
const visemeMap = [
  /* 0  */ "sil",  // silence
  /* 1  */ "aa",   // vowel
  /* 2  */ "aa",   // vowel
  /* 3  */ "O",    // round vowel
  /* 4  */ "E",    // front vowel
  /* 5  */ "RR",   // r sound
  /* 6  */ "I",    // close vowel
  /* 7  */ "U",    // back vowel
  /* 8  */ "O",    // round vowel
  /* 9  */ "O",    // round vowel
  /* 10 */ "O",    // round vowel
  /* 11 */ "I",    // close vowel
  /* 12 */ "kk",   // velar stop
  /* 13 */ "RR",   // r sound
  /* 14 */ "nn",   // nasal
  /* 15 */ "SS",   // sibilant
  /* 16 */ "CH",   // affricate
  /* 17 */ "TH",   // dental
  /* 18 */ "FF",   // labiodental
  /* 19 */ "DD",   // alveolar stop
  /* 20 */ "kk",   // velar stop
  /* 21 */ "PP"    // bilabial stop
];
```

Minimum viseme duration: **40ms** (shorter durations cause jitter)

---

## 🌐 Environment Variables

Create `.env` in your project root:

```bash
# Backend connection
VITE_BACKEND_URL=http://localhost:8001
VITE_BACKEND_PORT=8001

# Production (optional)
# VITE_BACKEND_URL=https://api.yoursite.com
```

Usage:
```typescript
import { getApiBaseUrl, getSocketUrl } from '@/config/api';

const apiUrl = getApiBaseUrl();        // http://localhost:8001
const socketUrl = getSocketUrl('/avatar');  // http://localhost:8001/avatar
```

---

## 🧪 Testing Checklist

### Phase 1 - Setup
- [ ] TalkingHead.js loads without errors
- [ ] Vite build completes
- [ ] Three.js imported correctly

### Phase 2 - Types
- [ ] TypeScript compiles without errors
- [ ] All interfaces match backend models

### Phase 3 - Composables
- [ ] Socket connects to `/avatar` namespace
- [ ] Audio context creates without errors
- [ ] Azure TTS proxy connects

### Phase 4 - Components
- [ ] Avatar loads and displays
- [ ] Loading progress shows 0-100%
- [ ] Stop button works

### Phase 5 - API
- [ ] Bot config fetches correctly
- [ ] Chat session creates
- [ ] Session restores on page reload

### Phase 6 - Voice
- [ ] Microphone permission requested
- [ ] Audio chunks sent to backend
- [ ] Recording interrupts avatar speech

### Phase 7 - Streaming
- [ ] Text displays as it arrives
- [ ] Cursor blinks during streaming
- [ ] RTL text works (Hebrew)

### Phase 8 - Caching
- [ ] First load caches avatar
- [ ] Second load instant (~100ms)
- [ ] Cache clears correctly

### Phase 9 - Polish
- [ ] View toggle works (head/body/full)
- [ ] Health check runs
- [ ] All tests pass

---

## 🐛 Known Issues & Workarounds

### 1. iOS Audio Autoplay
**Issue:** iOS blocks audio until user interaction
**Solution:** Call `unlockAudio()` on first tap/click before playing any audio

### 2. Safari AudioWorklet
**Issue:** Safari may have issues with AudioWorklet
**Solution:** The AudioRecorder has fallback detection - test on Safari

### 3. Private Browsing IndexedDB
**Issue:** IndexedDB blocked in private browsing mode
**Solution:** `avatarCacheService.isAvailable()` checks this - fallback to no caching

### 4. WebGL Context Limit
**Issue:** Too many WebGL contexts crashes browser
**Solution:** Only one TalkingHead instance at a time, cleanup on unmount

### 5. AudioContext Limit
**Issue:** Browsers limit to 6-8 AudioContexts
**Solution:** Cache contexts by sample rate, reuse existing ones

---

## 📞 Support

If you encounter issues not covered here:

1. Check the phase files in `todo/active/learnflow_integration/phases/`
2. Check validation reports in `todo/active/learnflow_integration/issues/`
3. Reference the working React implementation in `frontend/src/`

---

## 📝 Change Log

| Date | Change |
|------|--------|
| 2025-11-30 | Initial validation and fixes complete |
| 2025-11-30 | Fixed TalkingHead paths (backend → backend-old) |
| 2025-11-30 | Added audioworklet-registry.ts to Phase 3 |
| 2025-11-30 | Fixed GeminiAudioHandler API (start→initialize, queueAudio→playChunk) |
| 2025-11-30 | Fixed Socket.IO event name (gemini_speak → speak) |
| 2025-11-30 | Fixed ViewType (removed 'upper') |
| 2025-11-30 | Added TalkingHead streaming methods to types |
| 2025-11-30 | Added avatar container dimension requirements (400×400 min) |

---

**Good luck with the integration! 🚀**

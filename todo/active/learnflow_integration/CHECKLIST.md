# Learnflow Avatar Integration Checklist

**Total Tasks: 32 | Estimated: 25-28 hours (3-4 days)**
**Last Updated:** 2025-11-30

---

## Backend Features Status (All Complete!)

The backend example at `backend-examples/fastapi-complete` now includes:

| Feature | Status | Notes |
|---------|--------|-------|
| `GET /bots` - List bots | ✅ Done | 8 pre-configured bots |
| `GET /bots/{bot_id}` - Get bot | ✅ Done | Full config with avatar, TTS, behavior |
| `POST /chats` - Create session | ✅ Done | Returns chatId, handles resume |
| Socket.IO `/avatar` namespace | ✅ Done | Supports `?chatId=xxx` query param |
| Session persistence | ✅ Done | 1-hour timeout, one per bot |
| Speaking rate control | ✅ Done | 0.5x to 2.0x (see `fastie` bot) |
| SpeedControl UI | ✅ Done | User-adjustable speed (1x-2x) for Azure bots |
| Azure TTS proxy | ✅ Done | `/ws/tts/...` hides API keys |
| Gemini Live integration | ✅ Done | Multi-turn voice with VAD |
| E2E test endpoints | ✅ Done | Test voices, controls |

**Default Bots (for testing only):**
- `default`, `male-en`, `female-en`, `fastie` (English Azure)
- `male-he`, `female-he` (Hebrew Azure)
- `gemini-live`, `gemini-live-female` (Gemini Live voice)

> In production, users define their own bots with custom avatars, voices, and prompts.

---

## Pre-requisite: Backend API (COMPLETE)

The following backend APIs are now ready and working:

- [x] `GET /bots/{bot_id}` - Returns bot config (avatar, TTS, behavior)
- [x] `POST /chats` - Creates/resumes session, returns `chatId`
- [x] Socket.IO `?chatId=xxx` query param - Connect to existing session
- [x] Session persistence on disconnect

**Note**: Only `GET /bots/{bot_id}` is used in Learnflow (bot_id comes from LMS context). The `GET /bots` list endpoint is for demo only.

---

## CRITICAL: Session & Connection Rules

### Session Timeout
- **Sessions expire after 1 hour** of inactivity
- On expired session, call `POST /chats` again to create new one
- Store `chatId` in `sessionStorage` (not localStorage)

### One Session Per Bot
- Same `botId` always returns same `chatId`
- `isResumed: true` flag indicates existing session
- No parallel sessions for same bot

### Socket.IO Connection Pattern
```typescript
// CORRECT: Use HTTP URL, not ws://
const socket = io('http://localhost:8001', {
  path: '/socket.io/',
  query: { chatId },  // From POST /chats response
  transports: ['websocket']
});
```

### Azure TTS Proxy
```typescript
// Backend proxy hides API key - NO key needed in frontend!
const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
  new URL('ws://localhost:8001/ws/tts/cognitiveservices/websocket/v1'),
  ''  // Empty string
);
```

---

## Phase 1: Setup & Dependencies (2 hours)

- [ ] **1.1** Install NPM packages (`microsoft-cognitiveservices-speech-sdk`)
- [ ] **1.2** Copy TalkingHead.js files to Learnflow chatbot lib folder
- [ ] **1.3** Create avatar models config (or use backend `/bots/{bot_id}` response)

## Phase 2: TypeScript Types (1.5 hours)

- [ ] **2.1** Create `avatar-websocket.ts` (message types)
- [ ] **2.2** Create `avatar.ts` (state types)

## Phase 3: Vue Composables (10.5 hours)

- [ ] **3.1** Create `useAvatarSocket.ts` - Socket.IO avatar events (3-4 hours)
- [ ] **3.2** Create `useAvatar.ts` - TalkingHead wrapper (3 hours)
- [ ] **3.3** Create `useAzureTTS.ts` - Azure Speech SDK (2 hours)
- [ ] **3.4** Create `useGeminiLipsync.ts` - Gemini audio playback (4 hours)
- [ ] **3.5** Create `audio-utils.ts` (30 min)
- [ ] **3.6** Create `GeminiAudioHandler.ts` (30 min - copy from React)
- [ ] **3.7** Create `smart-mouth-analyzer.ts` worklet (30 min - copy from React)

## Phase 4: Components (3 hours)

- [ ] **4.1** Create `AvatarContainer.vue` (2 hours)
- [ ] **4.2** Integrate into `FloatingChatbot.vue` (1 hour)

## Phase 5: API Integration (NEW - 2 hours)

- [ ] **5.1** Create `useBot.ts` composable - Fetch bot config via `GET /bots/{bot_id}`
- [ ] **5.2** Create `useChat.ts` composable - Create session via `POST /chats`
- [ ] **5.3** Update Socket.IO connection to use `?chatId=xxx` query param

## Phase 6: Socket.IO Events (included in above)

- [ ] **6.1** Handle `session_start` event
- [ ] **6.2** Handle `speak` event (Azure mode)
- [ ] **6.3** Handle `speak` event (Gemini mode)
- [ ] **6.4** Handle `avatar_control` event
- [ ] **6.5** Send `ready` event
- [ ] **6.6** Send `speech_complete` event
- [ ] **6.7** Handle user interruption

## Phase 7: Audio Processing (included in composables)

- [ ] **7.1** Base64 to ArrayBuffer conversion
- [ ] **7.2** PCM16 to Float32 conversion
- [ ] **7.3** Audio queue management
- [ ] **7.4** Frequency analysis
- [ ] **7.5** Mouth shape mapping


## Phase 7B: Missing Features (NEW - 8-11 hours)

**P0 - Critical (Required for Gemini Live):**
- [ ] **7B.1** Create  composable (2 hours)
- [ ] **7B.2** Create  class (1 hour)
- [ ] **7B.3** Create  component (1 hour)
- [ ] **7B.4** Create  component (1-2 hours)

**P1 - High Priority (UX Improvement):**
- [ ] **7B.5** Create  for IndexedDB (2 hours)
- [ ] **7B.6** Create  composable (1 hour)

**P2 - Nice to Have:**
- [ ] **7B.7** Create  component (1 hour)
- [ ] **7B.8** Create  for monitoring (1 hour)

## Phase 8: Testing & Verification (3 hours)

- [ ] **8.1** Test avatar loading
- [ ] **8.2** Test Azure TTS synthesis
- [ ] **8.3** Test Gemini Live audio
- [ ] **8.4** Test avatar controls (gesture, mood, view)
- [ ] **8.5** Test user interruption
- [ ] **8.6** Test error handling
- [ ] **8.7** Test mobile compatibility

---

## Quick Test Checklist

### API Flow Test
```
[ ] GET /bots/{bot_id} returns bot config
[ ] POST /chats creates session with chatId
[ ] Socket.IO connects with ?chatId=xxx
[ ] Session survives disconnect/reconnect
```

### Avatar Loading Test
```
[ ] Container renders
[ ] Progress shows 0-100%
[ ] Avatar displays in 3D
[ ] No console errors
```

### Azure TTS Test
```
[ ] Text message triggers speak
[ ] Mouth moves with visemes
[ ] Audio plays
[ ] speech_complete sent
```

### Gemini Live Test
```
[ ] Audio chunks play
[ ] No gaps between chunks
[ ] Mouth moves with frequency
[ ] speech_complete after is_final
```

### Controls Test
```
[ ] gesture: thumbup works
[ ] mood: happy works
[ ] view: head/body/full works
[ ] stop_gesture works
```

---

## Files to Create

| File | Phase | Priority |
|------|-------|----------|
| `src/types/avatar-websocket.ts` | 2 | High |
| `src/types/avatar.ts` | 2 | High |
| `src/composables/useBot.ts` | 5 | High |
| `src/composables/useChat.ts` | 5 | High |
| `src/composables/useAvatarSocket.ts` | 3 | High |
| `src/composables/useAvatar.ts` | 3 | High |
| `src/composables/useAzureTTS.ts` | 3 | High |
| `src/composables/useGeminiLipsync.ts` | 3 | High |
| `src/lib/audio/audio-utils.ts` | 3 | High |
| `src/lib/audio/GeminiAudioHandler.ts` | 3 | High |
| `src/lib/audio/worklets/smart-mouth-analyzer.ts` | 3 | High |
| `src/components/AvatarContainer.vue` | 4 | High |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add Azure Speech SDK |
| `FloatingChatbot.vue` | Add avatar conditional rendering |

## Files to Copy (from lipsync-e2e-react)

| Source | Target |
|--------|--------|
| `frontend/src/lib/talkinghead/` modules | `chatbot/src/lib/talkinghead/` |
| `frontend/src/lib/audio/GeminiAudioHandler.ts` | `chatbot/src/lib/audio/` |
| `frontend/src/lib/audio/worklets/` | `chatbot/src/lib/audio/worklets/` |

---

## API Integration (NEW)

### Step 1: Get Bot Config
```typescript
// useBot.ts - Fetch bot config by ID (bot_id from LMS context)
const { bot, loading, error } = useBot(botId);

// Response from GET /bots/{bot_id}:
{
  "bot_id": "male-en",
  "name": "English Male Assistant",
  "language": "en",
  "avatar": {
    "glb_url": "https://models.readyplayer.me/...",
    "gender": "male",
    "background": "#1a1a2e",
    "camera_view": "head"
  },
  "tts": {
    "provider": "azure",
    "voice_id": "en-US-GuyNeural",
    "locale": "en-US"
  }
}
```

### Step 2: Create Chat Session
```typescript
// useChat.ts - Create/resume session
const { chatId, isResumed, loading, error } = useChat({
  botId,
  courseId,  // From LMS context
  lessonId,  // From LMS context
  pageId     // From LMS context
});

// POST /chats body:
{ "botId": "male-en", "courseId": "...", "lessonId": "...", "pageId": "..." }

// Response:
{ "chatId": "uuid-here", "bot": {...}, "isResumed": false }
```

### Step 3: Connect Socket.IO with chatId
```typescript
// Connect with chatId as query param
const socket = io('http://localhost:8001/avatar', {
  query: { chatId },  // <-- This is the key change
  transports: ['websocket']
});

// Backend will use existing session, no auth needed for session creation
```

---

## Socket.IO Events Summary

### Backend → Frontend
| Event | Provider | Payload |
|-------|----------|---------|
| `session_start` | both | `{ session_id, config, is_resumed }` |
| `speak` | azure | `{ provider: 'azure', text, message_id }` |
| `speak` | gemini | `{ provider: 'gemini-live', audio_chunk, text_chunk, is_final, message_id }` |
| `avatar_control` | both | `{ command, params }` |

### Frontend → Backend
| Event | Payload |
|-------|---------|
| `ready` | `{ avatar_loaded, tts_initialized }` |
| `speech_complete` | `{ message_id }` |
| `user_message` | `{ text, language, timestamp }` |
| `user_voice` | `{ audio_chunk, sample_rate, is_final }` |
| `user_interrupt` | `{ timestamp }` |

---

**Reference:** See `IMPLEMENTATION_PLAN.md` for detailed code examples.

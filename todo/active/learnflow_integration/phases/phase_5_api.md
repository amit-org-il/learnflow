# Phase 5: API Integration

**Estimated Time:** 2 hours
**Prerequisites:** Phase 4 complete

---

## Tasks

- [ ] **5.1** Create `getApiBaseUrl()` helper - Centralized base URL management
- [ ] **5.2** Create `useBot.ts` composable - Fetch bot config
- [ ] **5.3** Create `useChat.ts` composable - Create/resume session
- [ ] **5.4** Update Socket.IO connection to use `?chatId=xxx` with `/avatar` namespace

---

## CRITICAL: API Flow

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│  GET /bots/{bot_id}     │────>│  POST /chats            │────>│  Socket.IO              │
│  (bot_id from LMS)      │     │  { botId, courseId,     │     │  /avatar namespace      │
│                         │     │    lessonId, pageId }   │     │  ?chatId=xxx            │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
      Step 1                          Step 2                          Step 3
   Get bot config                 Create session                 Connect & chat
```

**IMPORTANT:** `GET /bots` (list all) is NOT used in Learnflow - bot_id comes from LMS context.

---

## Task 5.1: Create API Base URL Helper

**File:** `src/config/api.ts`

```typescript
/**
 * Centralized API base URL configuration
 * Used by all API services and Socket.IO connections
 */

/**
 * Get the backend API base URL
 * Priority:
 * 1. VITE_BACKEND_URL environment variable
 * 2. Development: http://localhost:8001
 * 3. Production: Same origin as frontend
 */
export function getApiBaseUrl(): string {
  // 1. Check environment variable (can be set in .env files)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // 2. Development mode - use localhost:8001
  const isDev = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';

  if (isDev) {
    return 'http://localhost:8001';
  }

  // 3. Production - same origin
  return window.location.origin;
}

/**
 * Get Socket.IO connection URL with namespace
 * @param namespace - Socket.IO namespace (default: '/avatar')
 */
export function getSocketUrl(namespace: string = '/avatar'): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${namespace}`;
}
```

**Environment Variables:**

Create `.env.development`:
```bash
VITE_BACKEND_URL=http://localhost:8001
```

Create `.env.production`:
```bash
# Leave empty to use same origin, or set explicit URL:
# VITE_BACKEND_URL=https://api.learnflow.com
```

---

## Task 5.2: Create useBot Composable

**File:** `src/composables/useBot.ts`

```typescript
import { ref, computed, watch } from 'vue';
import { getApiBaseUrl } from '@/config/api';

export interface BotConfig {
  bot_id: string;
  name: string;
  language: string;
  supportedResponseTypes: ('text' | 'audio' | 'avatar')[]; // CRITICAL: Added missing field
  image?: string;
  welcome_message?: string;
  avatar: {
    glb_url: string;
    gender: 'male' | 'female';
    background: string;
    camera_view: 'head' | 'body' | 'full';
    initial_mood: string;
    lighting_preset: string;
  };
  tts: {
    provider: 'azure' | 'gemini-live';
    voice_id: string;
    locale: string;
    speaking_rate: number;
  };
}

export interface UseBotOptions {
  baseUrl?: string;
  timeout?: number; // Timeout in milliseconds (default: 10000)
}

export function useBot(botId: string | (() => string), options: UseBotOptions = {}) {
  const baseUrl = options.baseUrl || getApiBaseUrl();
  const timeout = options.timeout || 10000;

  const bot = ref<BotConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchBot(id: string) {
    if (!id) return;

    loading.value = true;
    error.value = null;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/bots/${id}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Bot not found: ${id}`);
        }
        throw new Error(`Failed to fetch bot: ${response.status} ${response.statusText}`);
      }

      bot.value = await response.json();
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          error.value = 'Request timeout - check network connection';
        } else {
          error.value = err.message;
        }
      } else {
        error.value = 'Failed to fetch bot configuration';
      }
      bot.value = null;
    } finally {
      clearTimeout(timeoutId);
      loading.value = false;
    }
  }

  // Initial fetch
  const resolvedBotId = typeof botId === 'function' ? botId() : botId;
  if (resolvedBotId) {
    fetchBot(resolvedBotId);
  }

  // Watch for botId changes (if reactive)
  if (typeof botId === 'function') {
    watch(botId, (newId) => {
      if (newId) fetchBot(newId);
    });
  }

  return {
    bot: computed(() => bot.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refetch: () => fetchBot(typeof botId === 'function' ? botId() : botId)
  };
}
```

---

## Task 5.3: Create useChat Composable

**File:** `src/composables/useChat.ts`

```typescript
import { ref, computed } from 'vue';
import { getApiBaseUrl } from '@/config/api';
import type { BotConfig } from './useBot';

export interface ChatSession {
  chatId: string;
  bot: BotConfig; // CRITICAL: Changed from `any` to `BotConfig`
  isResumed: boolean;
}

export interface CreateChatParams {
  botId: string;
  courseId?: string;
  lessonId?: string;
  pageId?: string;
}

export interface UseChatOptions {
  baseUrl?: string;
  timeout?: number;
}

export function useChat(options: UseChatOptions = {}) {
  const baseUrl = options.baseUrl || getApiBaseUrl();
  const timeout = options.timeout || 10000;

  const chatId = ref<string | null>(null);
  const isResumed = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function createChat(params: CreateChatParams): Promise<string | null> {
    loading.value = true;
    error.value = null;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to create chat session: ${response.status} ${response.statusText}`);
      }

      const data: ChatSession = await response.json();
      chatId.value = data.chatId;
      isResumed.value = data.isResumed;

      // Store in sessionStorage (not localStorage - clears on tab close)
      // CRITICAL: Store all context for proper session resume
      sessionStorage.setItem('chatId', data.chatId);
      sessionStorage.setItem('botId', params.botId);
      if (params.courseId) sessionStorage.setItem('courseId', params.courseId);
      if (params.lessonId) sessionStorage.setItem('lessonId', params.lessonId);
      if (params.pageId) sessionStorage.setItem('pageId', params.pageId);

      return data.chatId;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          error.value = 'Request timeout - check network connection';
        } else {
          error.value = err.message;
        }
      } else {
        error.value = 'Failed to create chat session';
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
      loading.value = false;
    }
  }

  function clearSession() {
    chatId.value = null;
    isResumed.value = false;
    sessionStorage.removeItem('chatId');
    sessionStorage.removeItem('botId');
    sessionStorage.removeItem('courseId');
    sessionStorage.removeItem('lessonId');
    sessionStorage.removeItem('pageId');
  }

  // Restore from sessionStorage if available
  const storedChatId = sessionStorage.getItem('chatId');
  if (storedChatId) {
    chatId.value = storedChatId;
    isResumed.value = true;
  }

  return {
    chatId: computed(() => chatId.value),
    isResumed: computed(() => isResumed.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    createChat,
    clearSession
  };
}
```

---

## Task 5.4: Update Socket.IO Connection

**File:** Update existing Socket.IO connection code (typically in component or composable)

**CRITICAL: Correct Socket.IO Configuration**

```typescript
import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '@/config/api';
import { useChat } from '@/composables/useChat';

const { chatId, createChat, clearSession } = useChat();

let socket: Socket | null = null;

async function connectSocket(botId: string, courseId?: string, lessonId?: string, pageId?: string) {
  // Step 1: Get or create chatId
  let id = chatId.value;
  if (!id) {
    id = await createChat({ botId, courseId, lessonId, pageId });
  }

  if (!id) {
    console.error('[Socket] Failed to create chat session');
    return null;
  }

  // Step 2: Connect with chatId to /avatar namespace
  // CRITICAL: Must include /avatar namespace in URL!
  socket = io(getSocketUrl('/avatar'), {
    path: '/socket.io/',
    query: { chatId: id },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Step 3: Handle session expiration
  socket.on('connect_error', async (error) => {
    console.error('[Socket] Connection error:', error.message);

    // Check if session expired
    if (error.message.includes('session not found') ||
        error.message.includes('Invalid chatId') ||
        error.message.includes('Session expired')) {
      console.warn('[Socket] Session expired, creating new one...');
      clearSession();

      // Create new session and reconnect
      const newId = await createChat({ botId, courseId, lessonId, pageId });
      if (newId && socket) {
        // CRITICAL: Disconnect before updating query params
        socket.disconnect();
        socket.io.opts.query = { chatId: newId };
        socket.connect();
      }
    }
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to /avatar namespace with chatId:', id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  return socket;
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { connectSocket, disconnectSocket };
```

---

## Session Lifecycle Rules

### Timeout
- Sessions expire after **1 hour** of inactivity
- On expired session, call `POST /chats` again
- Retry logic automatically creates new session

### One Session Per Bot
- Same `botId` always returns same `chatId`
- `isResumed: true` flag indicates existing session
- Backend manages session deduplication

### Storage Strategy
- Store `chatId`, `botId`, `courseId`, `lessonId`, `pageId` in `sessionStorage`
- Use `sessionStorage` (clears on tab close)
- NOT `localStorage` (persists forever, causes stale sessions)

---

## Initialization Sequence

```
┌────────────────────────────────────────────────────────────────────────────┐
│ LEARNFLOW INITIALIZATION SEQUENCE - MUST FOLLOW THIS ORDER                │
└────────────────────────────────────────────────────────────────────────────┘

1. Component Mount
   └─> FloatingChatbot.vue onMounted()

2. Fetch Bot Config
   └─> GET /bots/{bot_id}
   └─> Wait for response { bot_id, name, avatar, tts, ... }
   └─> Validation: Check bot.supportedResponseTypes includes 'avatar'

3. Create/Resume Chat Session
   └─> POST /chats { botId, courseId, lessonId, pageId }
   └─> Wait for response { chatId, bot, isResumed }
   └─> Store chatId in sessionStorage

4. Connect Socket.IO
   └─> io('http://localhost:8001/avatar', { query: { chatId } })
   └─> Wait for 'connect' event
   └─> CRITICAL: Must include /avatar namespace!

5. Avatar Component Mount
   └─> AvatarContainer.vue onMounted()
   └─> Wait for containerRef.value to exist

6. Initialize TalkingHead
   └─> avatar.initialize(containerRef.value, avatarConfig)
   └─> Wait for avatar load complete

7. Send Ready Signal
   └─> socket.emit('ready', { avatar_loaded: true })

8. Receive Session Start
   └─> socket.on('session_start', { sessionId, welcomeMessage })

9. Ready to Chat
   └─> User can now interact with avatar!

┌────────────────────────────────────────────────────────────────────────────┐
│ COMMON MISTAKES TO AVOID                                                  │
└────────────────────────────────────────────────────────────────────────────┘

❌ Connecting Socket.IO BEFORE chatId is available
❌ Forgetting /avatar namespace in Socket.IO URL
❌ Not handling session expiration
❌ Using localStorage instead of sessionStorage
❌ Not checking bot.supportedResponseTypes before showing avatar
❌ Not disconnecting socket before reconnecting with new chatId
```

---

## Error Handling Best Practices

### Network Errors
```typescript
try {
  const response = await fetch(url, { signal: controller.signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (err) {
  if (err.name === 'AbortError') {
    // Timeout
  } else if (err.message.includes('Failed to fetch')) {
    // Network error
  } else {
    // Other error
  }
}
```

### Session Expiration
```typescript
socket.on('connect_error', async (error) => {
  if (error.message.includes('session') || error.message.includes('Invalid chatId')) {
    clearSession();
    const newId = await createChat({ botId });
    if (newId && socket) {
      socket.disconnect(); // MUST disconnect first!
      socket.io.opts.query = { chatId: newId };
      socket.connect();
    }
  }
});
```

### Bot Not Found
```typescript
const { bot, error } = useBot(botId);

if (error.value) {
  // Show error to user: "Bot not found" or "Network error"
  console.error('[Bot] Failed to load:', error.value);
}
```

---

## TypeScript Type Safety

All types MUST match Phase 2 definitions:

```typescript
// From Phase 2
import type { BotConfig } from './useBot';
import type { ChatSession } from './useChat';
import type { AvatarConfig, VoiceConfig } from '@/types';

// Usage
const bot: BotConfig = await fetchBot(id);
const session: ChatSession = await createChat({ botId });
```

**Type Checklist:**
- [ ] `BotConfig.supportedResponseTypes` is array of strings
- [ ] `ChatSession.bot` is `BotConfig` not `any`
- [ ] All fetch responses are typed
- [ ] No `any` types in composables

---

## Verification Checklist

```
STEP 1: API Helper
[ ] getApiBaseUrl() returns correct URL for dev/prod
[ ] getSocketUrl() includes /avatar namespace
[ ] Environment variables work (.env.development)

STEP 2: Bot Fetching
[ ] useBot fetches bot config by ID
[ ] useBot handles 404 errors gracefully
[ ] useBot handles network timeouts (10s)
[ ] bot.supportedResponseTypes field exists

STEP 3: Chat Session
[ ] useChat creates session and returns chatId
[ ] useChat stores chatId, botId, courseId, lessonId, pageId in sessionStorage
[ ] useChat restores chatId on page reload
[ ] useChat handles timeout errors
[ ] ChatSession.bot is typed as BotConfig

STEP 4: Socket.IO
[ ] Socket connects to http://localhost:8001/avatar (with namespace!)
[ ] Socket includes ?chatId=xxx query parameter
[ ] Session expiration creates new session
[ ] Socket disconnects before reconnecting with new chatId
[ ] connect/disconnect/connect_error events are handled

STEP 5: Integration
[ ] Bot config loads before chat session is created
[ ] Chat session created before Socket.IO connection
[ ] Socket connected before avatar initializes
[ ] Avatar initialized before sending 'ready' event
[ ] isResumed flag is displayed in UI (optional)

STEP 6: Error Recovery
[ ] Network errors show user-friendly messages
[ ] Timeout errors retry automatically
[ ] Session expiration recovers without user action
[ ] Bot not found shows error state
```

---

## Testing Guide

### Manual Test 1: First Time User
```
1. Clear sessionStorage
2. Open FloatingChatbot
3. Verify: GET /bots/{id} called
4. Verify: POST /chats called
5. Verify: Socket connects to /avatar with ?chatId=xxx
6. Verify: Avatar loads and welcome message shows
```

### Manual Test 2: Returning User
```
1. Complete Test 1
2. Refresh page
3. Verify: GET /bots/{id} called again
4. Verify: POST /chats NOT called (chatId in sessionStorage)
5. Verify: Socket reconnects with same chatId
6. Verify: Chat history restored
```

### Manual Test 3: Session Expiration
```
1. Complete Test 1
2. Wait 1 hour (or simulate by clearing backend session)
3. Send message
4. Verify: connect_error event fires
5. Verify: New session created automatically
6. Verify: Socket reconnects with new chatId
7. Verify: User can continue chatting
```

### Manual Test 4: Network Error
```
1. Stop backend server
2. Try to load bot
3. Verify: Error message shows after timeout
4. Restart server
5. Click retry
6. Verify: Bot loads successfully
```

---

## Next Phase

-> [Phase 6: Voice Input](./phase_6_voice.md)

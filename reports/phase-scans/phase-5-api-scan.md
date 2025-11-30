# Phase 5: API Integration - Scan Report

**Scan Date:** 2025-11-30
**Status:** ✅ COMPLETE - 91% compliant, integration layer delegation to parent

---

## Summary

Phase 5 composables are fully implemented with proper session management, timeout handling, and error recovery. There are two API systems (Avatar + WebSocket) that coexist for different use cases.

---

## ✅ Correctly Implemented

### src/config/api.ts

| Requirement | Status | Evidence |
|-------------|--------|----------|
| getApiBaseUrl() | ✅ | Lines 13-35 |
| Priority: VITE_BACKEND_URL first | ✅ | Line 15-16 |
| Priority: localhost:8001 for dev | ✅ | Lines 20-27 |
| Priority: same origin for prod | ✅ | Line 30 |
| getSocketUrl(namespace) | ✅ | Lines 41-44, includes namespace |

### src/composables/useBot.ts

| Requirement | Status | Evidence |
|-------------|--------|----------|
| GET /bots/{bot_id} | ✅ | Line 108 |
| BotConfig.supportedResponseTypes | ✅ | Line 14 |
| Timeout 10s default | ✅ | Line 82 |
| AbortController | ✅ | Lines 104-105 |
| 404 error handling | ✅ | Lines 115-118 |
| supportsAvatar computed | ✅ | Lines 195-198 |

### src/composables/useAvatarChat.ts

| Requirement | Status | Evidence |
|-------------|--------|----------|
| POST /chats | ✅ | Line 151 |
| Body: botId, courseId, lessonId, pageId | ✅ | Lines 157, 17-22 |
| sessionStorage (NOT localStorage) | ✅ | Lines 115-119 |
| All context fields stored | ✅ | Lines 115-119 |
| Session restoration | ✅ | Lines 98-107 |
| ChatSession.bot as BotConfig | ✅ | Line 10 |
| clearSession() | ✅ | Lines 196-209 |
| Timeout 10s | ✅ | Line 85 |

### Socket.IO Connection (useAvatarSocket.ts)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| /avatar namespace in URL | ✅ | Line 203 |
| chatId in query params | ✅ | Lines 208-211 |
| Session expiration detection | ✅ | Lines 246-254 |
| Disconnect before reconnect | ✅ | Line 468 |

### Environment Files

| File | Status |
|------|--------|
| .env.development | ✅ VITE_BACKEND_PORT=8001, VITE_BACKEND_URL |
| .env.production | ✅ Documented with comments |

---

## ❌ Issues Found

### Issue #1: WebSocketChatbotClient Missing /avatar Namespace

**Location:** `packages/chatbot/src/api/websocket-client.ts:173`
**Severity:** MEDIUM (may not affect avatar flow)

**Problem:** WebSocketChatbotClient connects without namespace:
```typescript
const socketUrl = `${this.config.endpoint}?${queryParams.toString()}`;
// Missing: /avatar namespace
```

**Note:** This may be intentional if WebSocketChatbotClient is for non-avatar chatbots.

### Issue #2: Composables Not Used in FloatingChatbot

**Location:** `packages/chatbot/src/components/FloatingChatbot.vue`
**Severity:** LOW (architecture decision)

**Observation:** FloatingChatbot receives bot config and chatId as props from parent, rather than using useBot + useAvatarChat directly.

**Impact:** None - composables work, just different integration pattern.

---

## ❓ Clarifications / Notes

1. **Dual API Systems:**
   - Avatar System: useBot.ts + useAvatarChat.ts + useAvatarSocket.ts (Phase 5 compliant)
   - WebSocket System: WebSocketChatbotClient + useChatbotWebSocket (alternative)
   - Both coexist for different use cases

2. **sessionStorage confirmed:** NO localStorage usage in Phase 5 files

3. **Storage keys prefixed:** `avatar_chatId`, `avatar_botId`, etc. (prevents conflicts)

---

## Action Items

1. **OPTIONAL:** Add /avatar namespace to WebSocketChatbotClient (if needed for avatar)
2. **OPTIONAL:** Document when to use each API system

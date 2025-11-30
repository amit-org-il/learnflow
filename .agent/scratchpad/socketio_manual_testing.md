# Socket.IO Migration - Manual Testing Checklist

**Date**: 2025-11-27
**Tester**: [Your Name]
**Status**: Ready for testing

---

## Prerequisites

1. **Backend Running**:
   ```bash
   cd backend-examples/fastapi-complete
   pip install -r requirements.txt
   uvicorn main:socket_app --port 8001 --reload
   ```

2. **Frontend Running**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Environment Variables** (`.env` in `backend-examples/fastapi-complete`):
   ```env
   AZURE_TTS_KEY=your_azure_key
   AZURE_TTS_REGION=your_region
   GEMINI_API_KEY=your_gemini_key
   ```

---

## Task 4.2: Azure TTS Flow

**Goal**: Verify Azure TTS works end-to-end with Socket.IO

### Steps:
1. [ ] Open browser to http://localhost:5173
2. [ ] Open DevTools (F12) -> Network tab
3. [ ] Refresh page and check for Socket.IO connection
4. [ ] Look for: `GET /socket.io/?EIO=4&transport=polling`
5. [ ] Look for: WebSocket upgrade to `/socket.io/?EIO=4&transport=websocket`

### Verification:
1. [ ] **Console shows**: `[useAvatarWebSocket] Connected`
2. [ ] **Console shows**: `[useAvatarWebSocket] Connecting to: http://localhost:8001/avatar`
3. [ ] **State shows**: `connectionStatus: 'connected'`

### Test Speech (via API):
1. [ ] Get session ID from frontend state (React DevTools or console.log)
2. [ ] Call test endpoint:
   ```bash
   curl -X POST "http://localhost:8001/api/test/single-voice/{SESSION_ID}?voice_id=en-US-GuyNeural&text=Hello%20Socket.IO%20test"
   ```
3. [ ] **Verify**: Frontend receives `speak` event (check console)
4. [ ] **Verify**: Avatar speaks the text
5. [ ] **Verify**: Frontend sends `speech_complete` event after speaking

### Expected Backend Logs:
```
[SocketIO] Client connecting: xxxxx
[SocketIO] Connected: xxxxx -> session yyy
[SocketIO] Sent session_start to yyy
```

### Result: [ ] PASS / [ ] FAIL

**Notes**:
_____________________________

---

## Task 4.3: Gemini Live Flow

**Goal**: Verify Gemini Live streaming works with Socket.IO

### Prerequisites:
- GEMINI_API_KEY must be configured

### Steps:
1. [ ] Connect to frontend
2. [ ] Switch to Gemini Live provider (if UI available, or modify code)
3. [ ] Click microphone button
4. [ ] Speak a test phrase

### Verification:
1. [ ] **Backend receives**: `user_voice` events
2. [ ] **Backend sends**: Audio chunks via `speak` event
3. [ ] **Avatar**: Lip-syncs with streaming audio
4. [ ] **Audio**: Plays smoothly without choppy playback

### Test via Console (if no UI):
```javascript
// In browser console (if connected via Socket.IO)
// This requires the socket to be connected with provider='gemini-live'
```

### Result: [ ] PASS / [ ] FAIL / [ ] SKIP (no Gemini key)

**Notes**:
_____________________________

---

## Task 4.4: Avatar Controls

**Goal**: Verify avatar gestures, moods, and emojis work via Socket.IO

### Test via API:
```bash
# Get session ID first, then:

# Test gesture
curl -X POST "http://localhost:8001/api/sessions/{SESSION_ID}/control?command=gesture" \
     -H "Content-Type: application/json" \
     -d '{"gesture": "thumbup"}'

# Test mood
curl -X POST "http://localhost:8001/api/sessions/{SESSION_ID}/control?command=mood" \
     -H "Content-Type: application/json" \
     -d '{"mood": "happy"}'

# Or use the full test suite:
curl -X POST "http://localhost:8001/api/test/avatar-controls/{SESSION_ID}?delay=2"
```

### Verification:
1. [ ] **Gestures**: Avatar performs gesture (thumbup, handup, ok, shrug)
2. [ ] **Moods**: Avatar mood changes (happy, sad, excited, neutral)
3. [ ] **Emojis**: Avatar shows emoji reactions (if implemented)

### Result: [ ] PASS / [ ] FAIL

**Notes**:
_____________________________

---

## Task 4.5: Auto-Reconnection

**Goal**: Verify Socket.IO auto-reconnects when backend restarts

### Steps:
1. [ ] Connect frontend to backend
2. [ ] Verify connected state
3. [ ] **Kill backend**: Ctrl+C in backend terminal
4. [ ] **Watch frontend**: Should show "reconnecting" status
5. [ ] **Restart backend**: `uvicorn main:socket_app --port 8001`
6. [ ] **Watch frontend**: Should auto-reconnect

### Verification:
1. [ ] **Console shows**: `[useAvatarWebSocket] Reconnection attempt 1/5`
2. [ ] **Status shows**: `connectionStatus: 'reconnecting'`
3. [ ] **After restart**: `connectionStatus: 'connected'`
4. [ ] **Console shows**: `[useAvatarWebSocket] Reconnected via Socket.IO`

### Result: [ ] PASS / [ ] FAIL

**Notes**:
_____________________________

---

## Task 4.6: Azure TTS Proxy (Unchanged)

**Goal**: Verify native WebSocket `/ws/tts` endpoint still works

### Steps:
1. [ ] Frontend connects for TTS via native WebSocket
2. [ ] Frontend synthesizes speech using Azure SDK
3. [ ] Audio plays correctly

### Verification:
- This endpoint should be unchanged from before Socket.IO migration
- Check Network tab for `/ws/tts` WebSocket connection (separate from Socket.IO)

### Result: [ ] PASS / [ ] FAIL

**Notes**:
_____________________________

---

## Summary

| Task | Status | Notes |
|------|--------|-------|
| 4.2 Azure TTS | [ ] | |
| 4.3 Gemini Live | [ ] | |
| 4.4 Avatar Controls | [ ] | |
| 4.5 Auto-Reconnect | [ ] | |
| 4.6 TTS Proxy | [ ] | |

**Overall Result**: [ ] ALL PASS / [ ] PARTIAL / [ ] FAIL

---

## Quick Test Commands

```bash
# Check backend health
curl http://localhost:8001/health

# List active sessions
curl http://localhost:8001/api/sessions

# List test voices
curl http://localhost:8001/api/test/voices

# Run full E2E test (after getting session ID)
curl -X POST "http://localhost:8001/api/test/full/{SESSION_ID}"
```

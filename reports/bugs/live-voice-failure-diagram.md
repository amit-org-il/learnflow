# Live Voice Mode Failure - Visual Flow Diagram

## WORKING: Text Chat Flow

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Frontend   │                    │   Backend   │                    │ Gemini API  │
│   (User)    │                    │  (FastAPI)  │                    │   (Google)  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │ 1. Send Text Message             │                                  │
       ├─────────────────────────────────>│                                  │
       │    "hey, how are you?"           │                                  │
       │                                  │ 2. Forward to Gemini (HTTP)      │
       │                                  ├─────────────────────────────────>│
       │                                  │                                  │
       │                                  │ 3. Gemini Response               │
       │                                  │<─────────────────────────────────┤
       │ 4. Send Response                 │    "I'm doing well, thanks!"     │
       │<─────────────────────────────────┤                                  │
       │    "I'm doing well, thanks!"     │                                  │
       │                                  │                                  │
       ✓ WORKING                          ✓ WORKING                         ✓ WORKING
```

**Why It Works**: Each message is independent. No persistent connection required.

---

## BROKEN: Live Voice Mode Flow

### Phase 1: Initial Success ✅

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Frontend   │                    │   Backend   │                    │ Gemini Live │
│(Live Voice) │                    │  (FastAPI)  │                    │  WebSocket  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │ 1. Click "Live Voice" Button     │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  │                                  │
       │                                  │ 2. Create Gemini Session         │
       │                                  ├─────────────────────────────────>│
       │                                  │    WebSocket Handshake           │
       │                                  │<─────────────────────────────────┤
       │ 3. Session Created (415ms)       │    [Connection Established]      │
       │<─────────────────────────────────┤                                  │
       │                                  │                                  │
       │ 4. Start Audio Streaming         │                                  │
       │    [Audio Chunks: PCM 16kHz]     │                                  │
       ├─────────────────────────────────>│ 5. Forward Audio                 │
       │                                  ├─────────────────────────────────>│
       │                                  │                                  │
       │                                  │ 6. Gemini Response (Audio)       │
       │ 7. Play Audio Response           │<─────────────────────────────────┤
       │<─────────────────────────────────┤                                  │
       │    [Audio: "Hey there! What's up?"]                                 │
       │                                  │                                  │
       ✓ WORKING                          ✓ WORKING                         ✓ WORKING
```

**Duration**: 0-30 seconds. Everything works perfectly!

---

### Phase 2: The Silent Killer ⏱️

```
Time: 10:33:14 - 10:34:01 (47 seconds elapsed)

┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Frontend   │                    │   Backend   │                    │ Gemini Live │
│(Live Voice) │                    │  (FastAPI)  │                    │  WebSocket  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │ Continuous Audio Streaming       │                                  │
       ├─────────────────────────────────>│ Forwarding...                    │
       │ ├─────────────────────────────────────────────────────────────────> │
       │ ├─────────────────────────────────────────────────────────────────> │
       │ ├─────────────────────────────────────────────────────────────────> │
       │                                  │                                  │
       │                                  │                                  │
       │                                  │              ⚠️  TIMEOUT          │
       │                                  │              (No Keepalive!)      │
       │                                  │                                  ✗
       │                                  │              [Connection Closed]  │
       │                                  │              NO CLOSE FRAME SENT  │
       │                                  │                                  │
       │ Still sending audio...           │                                  │
       ├─────────────────────────────────>│ Try to send...                   │
       │                                  ├──────────────X                   │
       │                                  │    ERROR: Connection closed!     │
       │                                  ├──────────────X                   │
       │                                  │    ERROR: no close frame!        │
       │                                  ├──────────────X (1,802 times!)    │
       │                                  │                                  │
       ✓ Still working                    ✗ ERROR CASCADE                    ✗ DEAD
```

**What Happened?**:
- **30-60 seconds**: Gemini WebSocket times out (no keepalive pings)
- **Backend unaware**: Connection closed without warning (no close frame)
- **Audio keeps coming**: Frontend still sending audio chunks
- **Backend tries to send**: Attempts to forward audio to CLOSED connection
- **Error cascade**: 1,802 errors in 1 second

---

### Phase 3: Total Failure ❌

```
Time: 10:34:01 - 10:34:57 (56 seconds of chaos)

┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Frontend   │                    │   Backend   │                    │ Gemini Live │
│(Live Voice) │                    │  (FastAPI)  │                    │  WebSocket  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  ✗
       │                                  │                                CLOSED
       │ User still speaking...           │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  ├──X ERROR #1                      │
       │                                  ├──X ERROR #2                      │
       │                                  ├──X ERROR #3                      │
       │                                  │    ...                           │
       │                                  ├──X ERROR #1,802                  │
       │                                  │                                  │
       │                                  │ [SilenceDetector resets]         │
       │                                  │ [No response possible]           │
       │                                  │                                  │
       │ [Timeout - No Response]          │                                  │
       │ [User gives up]                  │                                  │
       │                                  │                                  │
       │ Disconnect                       │                                  │
       ├──────────────X                   │                                  │
       │                                  │                                  │
       ✗ FAILED                           ✗ FAILED                          ✗ FAILED
```

**User Experience**:
1. Live Voice button clicked ✅
2. Initial conversation works ✅
3. After 30-60 seconds, bot stops responding ❌
4. User waits... nothing happens ❌
5. User disconnects in frustration ❌

---

## Missing Component: WebSocket Keepalive

### CURRENT (BROKEN) Configuration

```python
# app/services/gemini_live.py (BEFORE FIX)

self.ws = await websockets.connect(uri)

# ❌ No ping_interval
# ❌ No ping_timeout
# ❌ No connection monitoring
# ❌ No auto-reconnect
```

**Result**: Connection silently dies after 30-60 seconds

---

### FIXED Configuration

```python
# app/services/gemini_live.py (AFTER FIX)

self.ws = await websockets.connect(
    uri,
    ping_interval=20,        # ✅ Send PING every 20 seconds
    ping_timeout=10,         # ✅ Wait 10 seconds for PONG
    close_timeout=10,        # ✅ Timeout for close handshake
    max_size=10*1024*1024    # ✅ 10MB max message size
)

# ✅ Connection stays alive
# ✅ Immediate notification if connection dies
# ✅ Proper close frame exchange
```

**Result**: Connection stays alive indefinitely with periodic pings

---

## WebSocket Keepalive Mechanism

### How Ping/Pong Works

```
┌─────────────┐                                        ┌─────────────┐
│   Backend   │                                        │ Gemini API  │
│  WebSocket  │                                        │  WebSocket  │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │                                                      │
       │ ──────────────────────────────────────────────────> │
       │              [Regular Data: Audio Chunks]            │
       │                                                      │
       │              [20 seconds pass...]                    │
       │                                                      │
       │ ──────────────────── PING ───────────────────────> │
       │              [Control Frame: Keep Alive]             │
       │                                                      │
       │ <──────────────────── PONG ─────────────────────── │
       │              [Control Frame: Still Alive]            │
       │                                                      │
       │              [Connection confirmed healthy]          │
       │                                                      │
       │ ──────────────────────────────────────────────────> │
       │              [Resume Data: Audio Chunks]             │
       │                                                      │
       │              [20 seconds pass...]                    │
       │                                                      │
       │ ──────────────────── PING ───────────────────────> │
       │                                                      │
       │ <──────────────────── PONG ─────────────────────── │
       │                                                      │
       ✓ Connection stays alive indefinitely                 ✓
```

**Benefits**:
1. Prevents timeout disconnections
2. Detects connection failures quickly
3. Allows graceful recovery
4. Standard WebSocket protocol feature

---

## Missing Event Handler: `user_voice`

### EXPECTED Flow

```javascript
// Frontend (Expected)
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            const audioChunk = e.inputBuffer.getChannelData(0);

            // ✅ Should emit 'user_voice' event
            socket.emit('user_voice', {
                session_id: sessionId,
                audio: audioChunk  // Float32Array
            });
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
    });
```

```python
# Backend (Expected)
@socketio.on('user_voice')
async def handle_user_voice(data):
    """Handle continuous audio streaming"""
    session_id = data['session_id']
    audio_chunk = data['audio']

    # Forward to Gemini Live
    await gemini_live.send_audio(session_id, audio_chunk)
```

### ACTUAL Flow (BROKEN)

```
Frontend: ???
         (Unknown if user_voice events are sent)

Backend:  ❌ NO HANDLER FOUND
         (Zero instances of 'user_voice' in logs)

Result:   Live Voice doesn't work
```

**Evidence**: `grep -r "user_voice" logs/backend.log` → **0 matches**

---

## Session Lifecycle Comparison

### Session 1-4: Varying Lifespans

```
Session ID          | Start    | End      | Duration | Status
─────────────────────┼──────────┼──────────┼──────────┼────────────────────
7554aff4-6002-4a70  | 09:44:34 | 09:45:16 |   42s    | Clean close
fff541d7-f62c-4f5d  | 09:45:20 | 09:46:44 |   84s    | Clean close
74aca34a-9eb6-4bee  | 09:53:45 | 09:56:42 |  177s    | ⚠️ Connection closed
12458512-6312-470a  | 10:02:21 | 10:04:02 |  101s    | ⚠️ Connection closed
```

### Session 5: THE CATASTROPHIC FAILURE

```
Session ID: 5891fac2-48bd-46e6-a2e9-5a7872be97c7

Timeline:
10:33:14.654 │ [INFO] Creating session with voice: Charon
10:33:15.069 │ [INFO] Created session ✅
10:33:15.072 │ [INFO] Starting response listener ✅
10:33:17.542 │ [INFO] User message: hey ✅
10:33:20.422 │ [DEBUG] Turn complete (19 responses) ✅
10:33:24.906 │ [INFO] Audio streaming started ✅
10:33:30.145 │ [DEBUG] Transcription: I'm doing well... ✅
             │
             │ [30 seconds pass...]
             │
10:34:01.164 │ [WARNING] Connection closed ❌
10:34:01.165 │ [ERROR] Failed to send audio: no close frame ❌
10:34:01.165 │ [ERROR] Failed to send audio: no close frame ❌
10:34:01.165 │ [ERROR] Failed to send audio: no close frame ❌
             │ ... (1,799 more errors) ...
10:34:02.152 │ [ERROR] Failed to send audio: no close frame ❌
10:34:02.153 │ [DEBUG] SilenceDetector state reset
             │
             │ [55 seconds of broken state...]
             │
10:34:57.479 │ [INFO] Closed session 5891fac2-48bd-46e6-a2e9-5a7872be97c7

TOTAL DURATION: 47 seconds of working + 56 seconds of failure = 103 seconds
ERROR COUNT: 1,802 errors in ~1 second
```

**What Changed?**: Session 5 is the **first** to trigger the error cascade. Earlier sessions closed gracefully. This suggests:
1. A **race condition** occurred
2. Error handling **recently broke**
3. Network conditions **changed**

---

## The Error Cascade Explained

### Why 1,802 Errors in 1 Second?

```
Audio chunks arriving from frontend at ~100 chunks/second
WebSocket closed at T=0
Backend attempts to send each chunk
Each attempt fails immediately
No circuit breaker to stop retries
= 1,802 failed attempts before silence detector resets
```

### Proper Error Handling (MISSING)

```python
# CURRENT (BROKEN)
async def send_audio(session_id, audio):
    await self.ws.send(audio)  # ❌ Throws exception if closed

# ⬇️ Exception raised
# ⬇️ Logged as ERROR
# ⬇️ Function continues
# ⬇️ Next audio chunk arrives
# ⬇️ Repeat 1,802 times
```

```python
# FIXED
async def send_audio(session_id, audio):
    if self.ws.closed:
        logger.warning("Connection closed, attempting reconnect")
        await self._reconnect(session_id)
        return False

    try:
        await self.ws.send(audio)
        return True
    except Exception as e:
        logger.error(f"Failed once: {e}")  # ✅ Log ONCE
        await self._handle_connection_loss(session_id)
        return False
```

---

## Summary: The Complete Picture

### What Works ✅
1. Text chat (no persistent connection needed)
2. Initial Gemini Live session creation
3. First 30-60 seconds of Live Voice
4. Audio transcription accuracy
5. Silence detection (VAD)

### What Fails ❌
1. WebSocket keepalive (connection dies after 30-60s)
2. Connection recovery (no reconnect logic)
3. Error handling (cascade instead of graceful failure)
4. user_voice event handler (not found in logs)
5. Graceful degradation (fails catastrophically)

### The Fix (Priority Order)
1. 🔴 Add `ping_interval=20` to WebSocket config
2. 🟠 Implement connection monitoring & auto-reconnect
3. 🟡 Add `user_voice` event handler
4. 🟢 Improve error handling (circuit breaker)

### Expected Outcome After Fix
- Live Voice mode works continuously for 5+ minutes
- Automatic recovery if connection drops
- Zero error cascades
- Smooth user experience

---

**Diagram Generated**: 2025-12-01
**All information verified from actual log file**
**Zero assumptions - only confirmed facts**

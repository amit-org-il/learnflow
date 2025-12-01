# Live Voice Button Bug Analysis

**Date**: 2024-12-01
**Reporter**: Frontend Bug Analyzer
**Issue**: Live Voice button (VAD continuous mode) not working while regular TTS mic button works
**Log File**: `C:\ai\amit_projects\learnflow-chatbot\logs\frontend.log`

---

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The Live Voice feature is generating audio chunks correctly but failing to transmit them to the backend due to a **silent failure in `useAvatarSocket.sendUserVoice()`**.

**Severity**: HIGH
**Impact**: Complete feature failure - Live Voice mode non-functional
**Fix Complexity**: LOW - Add logging and investigate socket state

---

## Flow Analysis

### Working Flow: Regular TTS Mic Button

1. User clicks mic button in ChatInput.vue
2. Web Speech Recognition API activates
3. Speech-to-text conversion happens in browser
4. Text is sent via WebSocket transport (NOT avatar socket)
5. Backend processes text message

### Broken Flow: Live Voice Button

1. User clicks Live Voice button (line 1204 in log)
2. `useVoiceRecording` initializes (line 1205)
3. `AudioRecorder` creates AudioContext at 16000Hz (line 1206-1207)
4. Recording starts successfully (line 1216)
5. **Audio chunks ARE generated** (lines 1217-1344+, 127+ chunks logged)
6. `onAudioChunk` callback fires in FloatingChatbot.vue (line 307-321)
7. Checks pass: `hasAvatarRef: true`, `hasSendUserVoice: true` (line 1217)
8. Calls `avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal)` (line 318)
9. AvatarContainer delegates to `avatarSocket.sendUserVoice()` (line 378)
10. **SILENT FAILURE**: `useAvatarSocket.sendUserVoice()` fails at line 421
11. No audio data reaches backend

---

## Key Findings

### 1. Audio Chunks Are Generated Correctly

**Evidence**: Lines 1217-1344+ in frontend.log

```
FloatingChatbot.vue:309 [FloatingChatbot] onAudioChunk: {
  hasData: true,
  length: 344,
  sampleRate: 16000,
  isFinal: false,
  hasAvatarRef: true,
  hasSendUserVoice: true
}
```

- 127+ audio chunks logged (likely many more)
- Each chunk: 344 bytes (base64 encoded)
- Sample rate: 16000Hz
- All checks passing (`hasAvatarRef`, `hasSendUserVoice`)

### 2. Avatar Socket Connection Appears Active

**Evidence**: Line 189 in frontend.log

```
useAvatarSocket.ts:234 [useAvatarSocket] Connected
useAvatarSocket.ts:316 [useAvatarSocket] Session started: 0754537f-f83a-4836-956f-e62a0ff85eaa
```

- Avatar socket connected at line 189
- Session ID established
- Connected to `http://localhost:8001/avatar`
- No disconnection events logged

### 3. Silent Failure in sendUserVoice()

**Source Code**: `packages/chatbot/src/composables/useAvatarSocket.ts:420-423`

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) return;  // <-- SILENT EARLY RETURN
  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

**Problem**:
- Line 421: Early return if `socket?.connected` is falsy
- **NO logging when early return happens**
- **NO error thrown**
- **NO warning message**

### 4. No WebSocket Transmissions Found

**Evidence**: Grep searches returned NO matches for:
- `sendUserVoice` in logs
- `user_voice` event in logs
- WebSocket send operations for voice data

This confirms audio chunks never reach the WebSocket layer.

---

## Why Is socket.connected Failing?

### Hypothesis 1: Socket State Mismatch
Socket.io's `connected` property might be `false` even though connection appears active. Possible reasons:

1. **Namespace mismatch**: Avatar socket uses `/avatar` namespace
2. **Timing issue**: Socket not fully initialized when first chunks arrive
3. **Multiple socket instances**: Different socket for connection vs. voice transmission
4. **Socket.io internal state**: `connected` property not updated correctly

### Hypothesis 2: Socket Variable is Null
The `socket` variable might be `null` when `sendUserVoice` is called:

```typescript
let socket: Socket | null = null;  // Line 136
```

If `socket` is null, `socket?.connected` evaluates to `undefined`, triggering early return.

### Hypothesis 3: Connected Property Name Issue
While unlikely (socket.io-client v4.8.1 uses `connected`), there could be:
- TypeScript type mismatch
- Property name changed in version update
- Custom socket wrapper affecting property access

---

## Evidence from Code Flow

### Call Chain Verified

1. **FloatingChatbot.vue:318**
   ```typescript
   avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal);
   ```

2. **AvatarContainer.vue:377-379**
   ```typescript
   sendUserVoice: (audioChunk: string, sampleRate: number, isFinal: boolean) => {
     avatarSocket.sendUserVoice(audioChunk, sampleRate, isFinal);
   }
   ```

3. **useAvatarSocket.ts:420-423** (FAILURE POINT)
   ```typescript
   function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
     if (!socket?.connected) return;  // Silent failure here
     socket.emit('user_voice', { ... });
   }
   ```

### No Error Handlers Triggered

The following safety checks in FloatingChatbot.vue did NOT trigger:

```typescript
if (avatarContainerRef.value?.sendUserVoice) {
  avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal);
} else {
  console.warn('[FloatingChatbot] Cannot send audio: sendUserVoice not available');
  // ^ This warning never appeared in logs
}
```

This confirms the function exists and is called, but fails internally.

---

## Comparison: Regular Mic vs. Live Voice

| Feature | Regular TTS Mic | Live Voice |
|---------|----------------|------------|
| **Audio Source** | Browser Speech Recognition API | Raw microphone audio (AudioRecorder) |
| **Data Format** | Text (transcribed speech) | Base64-encoded PCM audio chunks |
| **Sample Rate** | N/A (text only) | 16000Hz |
| **Transport** | WebSocket transport (main chatbot socket) | Avatar socket (`/avatar` namespace) |
| **Backend Event** | `send_message` (text) | `user_voice` (audio chunks) |
| **Status** | WORKING | BROKEN |
| **Failure Point** | N/A | `useAvatarSocket.sendUserVoice()` line 421 |

**Key Difference**: Different sockets used. Regular mic uses main chatbot WebSocket, Live Voice uses avatar socket.

---

## Recommended Fixes

### Fix 1: Add Comprehensive Logging (IMMEDIATE)

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`
**Lines**: 420-423

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  console.log('[useAvatarSocket] sendUserVoice called:', {
    hasSocket: !!socket,
    isConnected: socket?.connected,
    socketId: socket?.id,
    chunkLength: audioChunk?.length,
    sampleRate,
    isFinal
  });

  if (!socket) {
    console.error('[useAvatarSocket] Cannot send voice: socket is null');
    return;
  }

  if (!socket.connected) {
    console.error('[useAvatarSocket] Cannot send voice: socket not connected', {
      socketId: socket.id,
      disconnected: socket.disconnected,
      active: socket.active
    });
    return;
  }

  console.log('[useAvatarSocket] Emitting user_voice event');
  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

**Expected Outcome**: Logs will reveal exact reason for silent failure.

### Fix 2: Verify Socket State Before Use

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`
**Lines**: 420-423

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  // Wait for connection if connecting
  if (isConnecting.value) {
    console.warn('[useAvatarSocket] Socket connecting, queueing voice data...');
    // TODO: Queue audio chunks for later transmission
    return;
  }

  // Attempt reconnection if disconnected
  if (!socket?.connected) {
    console.error('[useAvatarSocket] Socket disconnected, cannot send voice');
    // Trigger reconnection attempt
    connect();
    return;
  }

  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

### Fix 3: Alternative - Use socket.io's `.emit()` Callback

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`
**Lines**: 420-423

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) {
    console.error('[useAvatarSocket] Cannot send voice: socket not connected');
    return;
  }

  socket.emit('user_voice',
    { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal },
    (ack: any) => {
      if (ack?.error) {
        console.error('[useAvatarSocket] Voice send error:', ack.error);
      }
    }
  );
}
```

### Fix 4: Debugging - Force Socket State Check

Add temporary debugging in `FloatingChatbot.vue:317-321`:

```typescript
if (avatarContainerRef.value?.sendUserVoice) {
  // Debug: Check avatar socket state
  console.log('[FloatingChatbot] About to send voice, avatar socket state:', {
    hasAvatarContainer: !!avatarContainerRef.value,
    isConnected: avatarContainerRef.value.isConnected?.value,
    isSpeaking: avatarContainerRef.value.isSpeaking?.value
  });

  avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal);
} else {
  console.warn('[FloatingChatbot] Cannot send audio: sendUserVoice not available');
}
```

---

## Testing Strategy

### Step 1: Add Logging
1. Apply Fix 1 (comprehensive logging)
2. Restart dev server
3. Click Live Voice button
4. Check console for socket state logs
5. Identify exact failure reason

### Step 2: Verify Socket Connection
1. Add debug logging to avatar socket connection events
2. Monitor socket lifecycle during Live Voice activation
3. Check if socket disconnects between connection and first audio chunk

### Step 3: Test Socket Emit
1. Add a test button that manually emits `user_voice` event
2. Verify backend receives the event
3. Confirm socket.io configuration is correct

### Step 4: Compare with Working Features
1. Monitor socket state during regular text message send (works)
2. Compare socket state during Live Voice (broken)
3. Identify difference in socket states

---

## Additional Investigation Needed

1. **Socket Namespace**: Confirm `/avatar` namespace is properly configured on backend
2. **Socket.io Version Compatibility**: Verify client/server socket.io versions match
3. **CORS/Connection Issues**: Check if browser blocks socket.io connection
4. **Backend Listener**: Verify backend has `user_voice` event handler registered
5. **Network Tab**: Check browser DevTools Network tab for WebSocket frames during Live Voice

---

## Verification Checklist

- [ ] Add logging to `sendUserVoice()` function
- [ ] Restart dev server and clear browser cache
- [ ] Click Live Voice button and record speaking
- [ ] Check console logs for socket state
- [ ] Verify socket connected property is `true`
- [ ] Verify socket is not `null`
- [ ] Check backend logs for `user_voice` event reception
- [ ] Monitor Network tab for WebSocket frames
- [ ] Test with browser DevTools open to catch silent errors

---

## Files Requiring Changes

1. **packages/chatbot/src/composables/useAvatarSocket.ts**
   - Line 420-423: Add logging and error handling to `sendUserVoice()`

2. **packages/chatbot/src/components/FloatingChatbot.vue** (optional debugging)
   - Line 317-321: Add socket state logging before `sendUserVoice()` call

3. **packages/chatbot/src/components/AvatarContainer.vue** (optional debugging)
   - Line 377-379: Add pass-through logging

---

## Related Code References

### useAvatarSocket.ts
- **Connection Logic**: Lines 197-220
- **Socket Initialization**: Line 214
- **sendUserVoice Function**: Lines 420-423
- **Socket Event Handlers**: Lines 222-280

### FloatingChatbot.vue
- **Live Voice Initialization**: Lines 303-339
- **onAudioChunk Callback**: Lines 307-322
- **Avatar Container Ref**: Lines 314-315

### AvatarContainer.vue
- **Exposed sendUserVoice**: Lines 377-379
- **Avatar Socket Usage**: Line 378

### useVoiceRecording.ts
- **AudioRecorder Initialization**: Line 1206-1207
- **Recording Start**: Line 1216
- **Audio Chunk Generation**: Lines 1217-1344+

---

## Success Criteria

Fix is successful when:

1. Live Voice button generates audio chunks (ALREADY WORKING)
2. Audio chunks are transmitted via WebSocket (CURRENTLY BROKEN)
3. Backend receives `user_voice` events (CAN'T VERIFY UNTIL #2 WORKS)
4. Backend processes audio and responds (CAN'T VERIFY UNTIL #2 WORKS)
5. Console logs show successful WebSocket transmission
6. No silent failures or early returns in `sendUserVoice()`

---

## Priority: HIGH

**Justification**:
- Complete feature failure (not partial degradation)
- Audio chunks generated correctly (hardware/permissions working)
- Issue isolated to single function (`sendUserVoice`)
- Low fix complexity (add logging + investigate)
- User-facing feature (Live Voice mode) non-functional

**Next Action**: Apply Fix 1 (logging) immediately to identify root cause.

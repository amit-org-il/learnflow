# Live Voice Bug - Recommended Fix Implementation

## Step-by-Step Fix Guide

### Phase 1: Add Diagnostic Logging (IMMEDIATE)

**Goal**: Identify exact reason for silent failure

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`

**Before** (Lines 420-423):
```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) return;
  socket.emit('user_voice', { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal });
}
```

**After**:
```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  // Diagnostic logging
  const socketState = {
    socketExists: !!socket,
    socketId: socket?.id || 'none',
    connected: socket?.connected,
    disconnected: socket?.disconnected,
    active: socket?.active,
    chunkLength: audioChunk?.length || 0,
    sampleRate,
    isFinal
  };

  console.log('[useAvatarSocket] sendUserVoice called:', socketState);

  // Check if socket exists
  if (!socket) {
    console.error('[useAvatarSocket] CRITICAL: Socket is null/undefined - cannot send voice data');
    return;
  }

  // Check connection state
  if (!socket.connected) {
    console.error('[useAvatarSocket] CRITICAL: Socket not connected - cannot send voice data', {
      socketId: socket.id,
      disconnected: socket.disconnected,
      active: socket.active,
      connectionStatus: connectionStatus.value
    });
    return;
  }

  // Emit the event
  console.log('[useAvatarSocket] Emitting user_voice event', {
    socketId: socket.id,
    chunkSize: audioChunk.length,
    sampleRate,
    isFinal
  });

  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });

  console.log('[useAvatarSocket] user_voice event emitted successfully');
}
```

**Test**:
1. Save file
2. Dev server should auto-reload
3. Click Live Voice button
4. Speak into mic
5. Check console logs - look for `[useAvatarSocket] sendUserVoice called:` messages
6. Identify which condition is failing

---

### Phase 2: Fix Based on Findings

#### Scenario A: Socket is Null

**If logs show**: `socketExists: false`

**Root Cause**: Socket not initialized when Live Voice starts

**Fix**: Ensure socket is created before allowing Live Voice

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket) {
    console.warn('[useAvatarSocket] Socket not initialized, attempting connection...');
    connect();
    // Queue this chunk for retry after connection
    setTimeout(() => {
      if (socket?.connected) {
        sendUserVoice(audioChunk, sampleRate, isFinal);
      }
    }, 100);
    return;
  }

  if (!socket.connected) {
    console.error('[useAvatarSocket] Socket not connected');
    return;
  }

  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

#### Scenario B: Socket Exists but Not Connected

**If logs show**: `socketExists: true, connected: false, disconnected: true`

**Root Cause**: Socket disconnected or connection failed

**Fix Option 1 - Auto-reconnect**:
```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket) {
    console.error('[useAvatarSocket] Socket is null');
    return;
  }

  if (!socket.connected) {
    console.warn('[useAvatarSocket] Socket disconnected, attempting reconnect...');
    socket.connect();
    return;
  }

  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

**Fix Option 2 - Queue audio chunks**:
```typescript
const audioQueue: Array<{ audioChunk: string, sampleRate: number, isFinal: boolean }> = [];

function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) {
    console.warn('[useAvatarSocket] Queueing voice data (socket not ready)');
    audioQueue.push({ audioChunk, sampleRate, isFinal });
    if (audioQueue.length > 100) {
      audioQueue.shift(); // Prevent memory leak
    }
    return;
  }

  // Send queued audio first
  while (audioQueue.length > 0 && socket.connected) {
    const queued = audioQueue.shift()!;
    socket.emit('user_voice', {
      audio_chunk: queued.audioChunk,
      sample_rate: queued.sampleRate,
      is_final: queued.isFinal
    });
  }

  // Send current chunk
  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

#### Scenario C: Socket Connected but Emit Fails

**If logs show**: `socketExists: true, connected: true` but still no transmission

**Root Cause**: Backend not listening or wrong event name

**Fix**: Add emit acknowledgment callback
```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) {
    console.error('[useAvatarSocket] Socket not ready');
    return;
  }

  socket.emit(
    'user_voice',
    {
      audio_chunk: audioChunk,
      sample_rate: sampleRate,
      is_final: isFinal
    },
    (ack: any) => {
      if (ack?.error) {
        console.error('[useAvatarSocket] Backend error:', ack.error);
      } else {
        console.log('[useAvatarSocket] Backend acknowledged voice chunk');
      }
    }
  );
}
```

#### Scenario D: Namespace Issue

**If logs show**: Socket connected but on wrong namespace

**Root Cause**: Avatar socket not connected to `/avatar` namespace

**Fix**: Verify namespace in connection
```typescript
// In connect() function (line 214)
socket = io(fullUrl, {
  path: '/socket.io/',
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  // Ensure namespace is correct
  query: query
});

console.log('[useAvatarSocket] Socket created for namespace:', socket.nsp);
```

---

### Phase 3: Additional Improvements

#### Improvement 1: Add Error Event to FloatingChatbot

**File**: `packages/chatbot/src/components/FloatingChatbot.vue`

Add error handler to Live Voice initialization:

```typescript
liveVoiceRecording.value = useVoiceRecording({
  sampleRate: 16000,
  vadThreshold: 0.05,
  interruptOnStart: true,
  onAudioChunk: (base64, sampleRate, isFinal) => {
    if (!avatarContainerRef.value?.sendUserVoice) {
      console.error('[FloatingChatbot] sendUserVoice not available!');
      return;
    }

    try {
      avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal);
    } catch (error) {
      console.error('[FloatingChatbot] Error sending voice:', error);
    }
  },
  onError: (err) => {
    console.error('[FloatingChatbot] Live voice error:', err);
    // Show user-friendly error message
    alert('Live Voice error: ' + err.message);
  },
});
```

#### Improvement 2: Add Socket Health Check

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`

```typescript
// Add this function
function checkSocketHealth(): boolean {
  const health = {
    socketExists: !!socket,
    isConnected: socket?.connected ?? false,
    socketId: socket?.id || 'none',
    connectionStatus: connectionStatus.value
  };

  console.log('[useAvatarSocket] Socket health check:', health);

  if (!socket) {
    console.error('[useAvatarSocket] Health check FAILED: Socket is null');
    return false;
  }

  if (!socket.connected) {
    console.error('[useAvatarSocket] Health check FAILED: Socket not connected');
    return false;
  }

  console.log('[useAvatarSocket] Health check PASSED');
  return true;
}

// Use in sendUserVoice
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!checkSocketHealth()) {
    return;
  }

  socket!.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

#### Improvement 3: Expose Socket State to UI

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts`

Add to return statement:

```typescript
return {
  // ... existing returns

  // Add socket health info
  socketHealth: computed(() => ({
    connected: socket?.connected ?? false,
    id: socket?.id || null,
    active: socket?.active ?? false
  })),
};
```

Then in FloatingChatbot, disable Live Voice button when socket not ready:

```typescript
const isLiveVoiceDisabled = computed(() => {
  if (!avatarContainerRef.value) return true;
  const health = avatarContainerRef.value.socketHealth;
  return !health?.connected;
});
```

---

### Phase 4: Testing Checklist

After applying fixes:

- [ ] Clear browser cache and hard reload
- [ ] Restart dev server
- [ ] Open browser DevTools Console
- [ ] Click Live Voice button
- [ ] Grant microphone permission if prompted
- [ ] Speak into microphone
- [ ] Verify console logs show:
  - `[useAvatarSocket] sendUserVoice called:`
  - `socketExists: true`
  - `connected: true`
  - `[useAvatarSocket] Emitting user_voice event`
  - `[useAvatarSocket] user_voice event emitted successfully`
- [ ] Check browser DevTools Network tab → WS tab
  - Should see WebSocket connection to `/avatar`
  - Should see frames being sent (user_voice events)
- [ ] Check backend logs for received `user_voice` events
- [ ] Verify avatar responds to voice input

---

## Rollback Plan

If fixes cause issues:

1. **Immediate Rollback**:
   ```bash
   git checkout packages/chatbot/src/composables/useAvatarSocket.ts
   ```

2. **Keep Logging Only**:
   - Remove all fixes except diagnostic logging
   - Continue investigation with more data

---

## Expected Outcomes

### Best Case
- Logs reveal simple issue (e.g., socket.connected vs socket.active)
- Quick fix applied
- Live Voice works immediately

### Moderate Case
- Socket timing issue identified
- Need to queue audio chunks
- Implement retry mechanism

### Worst Case
- Fundamental architecture issue
- Need to refactor avatar socket connection flow
- Estimated 2-4 hours of work

---

## Files to Change

1. **packages/chatbot/src/composables/useAvatarSocket.ts**
   - Lines 420-423 (sendUserVoice function)
   - Optional: Lines 214-220 (socket initialization)

2. **packages/chatbot/src/components/FloatingChatbot.vue** (optional)
   - Lines 307-322 (onAudioChunk callback)

---

## Success Metrics

Fix is successful when:

1. Console shows successful `user_voice` event emission
2. Network tab shows WebSocket frames being sent
3. Backend logs show received `user_voice` events
4. Avatar responds to voice input
5. No errors or warnings in console
6. Live Voice button works reliably on repeated use

---

## Need Help?

If Phase 1 logging doesn't reveal the issue:

1. Share console logs showing socket state
2. Share Network tab WebSocket frames
3. Share backend logs during Live Voice attempt
4. Consider pair debugging session

**Estimated Time**:
- Phase 1 (logging): 5 minutes
- Phase 2 (fix): 15-30 minutes depending on scenario
- Phase 3 (improvements): 1 hour (optional)
- Testing: 15 minutes

**Total**: 35 minutes to 2 hours

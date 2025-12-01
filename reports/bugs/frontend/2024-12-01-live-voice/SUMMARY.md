# Live Voice Bug - Quick Summary

## Problem
Live Voice button doesn't work - audio chunks generated but never transmitted to backend.

## Root Cause
**Silent failure** in `useAvatarSocket.sendUserVoice()` at line 421:

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) return;  // <-- FAILS SILENTLY HERE
  socket.emit('user_voice', { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal });
}
```

## Evidence
- 127+ audio chunks logged in console (WORKING)
- Avatar socket shows "Connected" status (line 189)
- Zero `user_voice` events in logs (BROKEN)
- No error messages or warnings
- Function called 127+ times, never emits WebSocket event

## Quick Fix (Add Logging)

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts:420-423`

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  console.log('[useAvatarSocket] sendUserVoice:', {
    hasSocket: !!socket,
    connected: socket?.connected,
    socketId: socket?.id
  });

  if (!socket) {
    console.error('[useAvatarSocket] Socket is null!');
    return;
  }

  if (!socket.connected) {
    console.error('[useAvatarSocket] Socket not connected!', {
      disconnected: socket.disconnected,
      active: socket.active
    });
    return;
  }

  console.log('[useAvatarSocket] Emitting user_voice');
  socket.emit('user_voice', {
    audio_chunk: audioChunk,
    sample_rate: sampleRate,
    is_final: isFinal
  });
}
```

## Test
1. Apply fix
2. Click Live Voice button
3. Speak into microphone
4. Check console logs - should see exact failure reason

## Impact
- **Severity**: HIGH
- **User Impact**: Complete Live Voice feature failure
- **Fix Complexity**: LOW (add logging first, then fix based on findings)

## Files Changed
- `packages/chatbot/src/composables/useAvatarSocket.ts` (lines 420-423)

## Related Reports
- Full analysis: `live-voice-bug-analysis.md`

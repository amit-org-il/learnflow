# Live Voice Button Bug Report

**Date**: 2024-12-01
**Status**: Root Cause Identified
**Severity**: HIGH
**Complexity**: LOW

---

## TL;DR

Live Voice button generates audio chunks correctly but fails to transmit them to backend due to **silent failure** in `useAvatarSocket.sendUserVoice()` function. The function returns early without logging when `socket?.connected` is falsy.

---

## Report Files

1. **SUMMARY.md** - Quick reference (2 min read)
2. **live-voice-bug-analysis.md** - Full technical analysis (10 min read)
3. **RECOMMENDED-FIX.md** - Step-by-step fix guide (15 min read)
4. **README.md** - This file

---

## Key Facts

| Metric | Value |
|--------|-------|
| Audio Chunks Generated | 127+ (WORKING) |
| Audio Chunks Transmitted | 0 (BROKEN) |
| Failure Point | `useAvatarSocket.ts:421` |
| Failure Type | Silent early return |
| Socket State | Connected (line 189 in logs) |
| Error Messages | None (silent failure) |

---

## Root Cause

**File**: `packages/chatbot/src/composables/useAvatarSocket.ts:420-423`

```typescript
function sendUserVoice(audioChunk: string, sampleRate: number, isFinal: boolean) {
  if (!socket?.connected) return;  // <-- SILENT FAILURE HERE
  socket.emit('user_voice', { audio_chunk: audioChunk, sample_rate: sampleRate, is_final: isFinal });
}
```

**Problem**: Early return without logging when socket check fails.

---

## Evidence Summary

### What Works
- Microphone access granted
- Audio recording (AudioRecorder at 16000Hz)
- Audio chunk generation (127+ chunks)
- VAD (Voice Activity Detection)
- onAudioChunk callback execution
- avatarContainerRef.value.sendUserVoice() call
- Avatar socket connection established

### What Breaks
- useAvatarSocket.sendUserVoice() function
- WebSocket transmission of audio chunks
- Backend reception of user_voice events
- Avatar response to voice input

---

## Next Steps

### Immediate Action (5 minutes)
1. Open `packages/chatbot/src/composables/useAvatarSocket.ts`
2. Navigate to line 420-423
3. Add comprehensive logging (see RECOMMENDED-FIX.md Phase 1)
4. Save and let dev server reload
5. Click Live Voice button
6. Check console logs for socket state

### Short-term Fix (30 minutes)
1. Based on logs, identify exact failure reason
2. Apply appropriate fix from RECOMMENDED-FIX.md Phase 2
3. Test Live Voice functionality
4. Verify backend receives events

### Long-term Improvements (1 hour)
1. Add socket health monitoring
2. Implement audio chunk queueing
3. Add user-facing error messages
4. Expose socket state to UI

---

## Impact Analysis

### User Impact
- **Current**: Live Voice feature completely non-functional
- **Workaround**: Use regular TTS mic button (text-based)
- **Frustration Level**: High (feature appears broken, no error message)

### Business Impact
- **Feature Availability**: 0% (completely broken)
- **User Experience**: Degraded (must use text instead of voice)
- **Support Tickets**: Likely increase if users try Live Voice

### Technical Debt
- **Silent Failures**: Bad practice, makes debugging hard
- **Missing Logging**: No visibility into socket state
- **Error Handling**: Insufficient for production use

---

## Comparison: Working vs Broken

| Feature | Regular Mic Button | Live Voice Button |
|---------|-------------------|------------------|
| **Status** | WORKING | BROKEN |
| **Technology** | Web Speech Recognition API | Raw Audio Capture |
| **Data Format** | Text (transcribed) | Base64 PCM audio |
| **Transport** | Main WebSocket | Avatar Socket |
| **Backend Event** | `send_message` | `user_voice` |
| **Sample Rate** | N/A | 16000Hz |
| **Failure Point** | N/A | `sendUserVoice()` line 421 |

---

## Related Issues

- Avatar socket connection: WORKING
- Audio chunk generation: WORKING
- WebSocket transport (main): WORKING
- Avatar socket transport: BROKEN (for voice data)

---

## Technical Details

### Audio Format
- **Sample Rate**: 16000Hz
- **Encoding**: Base64
- **Chunk Size**: ~344 bytes per chunk
- **Format**: PCM (raw audio)

### Socket Details
- **URL**: `http://localhost:8001/avatar`
- **Namespace**: `/avatar`
- **Transport**: WebSocket
- **Protocol**: socket.io-client v4.8.1
- **Connection Status**: Connected (line 189)
- **Session ID**: `0754537f-f83a-4836-956f-e62a0ff85eaa`

### Code Flow
```
User clicks Live Voice
→ useVoiceRecording initializes
→ AudioRecorder starts
→ Audio chunks generated (127+)
→ onAudioChunk callback fires
→ FloatingChatbot.sendUserVoice() called
→ AvatarContainer.sendUserVoice() delegates
→ useAvatarSocket.sendUserVoice() checks socket
→ FAILS at line 421 (silent return)
→ socket.emit() never called
→ Backend never receives data
```

---

## Testing After Fix

### Manual Test
1. Click Live Voice button
2. Speak: "Hello, can you hear me?"
3. Verify console logs show successful transmission
4. Verify avatar responds with speech

### Automated Test Ideas
1. Mock socket.emit() to verify calls
2. Test socket state transitions
3. Test audio chunk generation
4. Test error handling paths

---

## Success Criteria

Fix is complete when:

1. ✅ Console logs show successful `user_voice` emission
2. ✅ Network tab shows WebSocket frames
3. ✅ Backend logs show received events
4. ✅ Avatar responds to voice input
5. ✅ No silent failures
6. ✅ Error messages guide debugging
7. ✅ Feature works on repeated use

---

## Time Estimates

- **Reading Reports**: 15 minutes
- **Adding Logging**: 5 minutes
- **Identifying Issue**: 5-10 minutes
- **Implementing Fix**: 15-30 minutes
- **Testing**: 15 minutes
- **Documentation**: 10 minutes

**Total**: 1-1.5 hours from start to working feature

---

## Priority Justification

**HIGH Priority** because:

1. Complete feature failure (not degraded performance)
2. User-facing functionality broken
3. No error messages (appears as silent failure to users)
4. Low fix complexity (isolated to one function)
5. Clear root cause identified
6. High confidence fix will resolve issue

---

## Questions?

- **Why does regular mic work?** Uses different transport (main WebSocket, not avatar socket) and sends text, not audio
- **Is socket connected?** Yes, logs show "Connected" at line 189
- **Are chunks generated?** Yes, 127+ chunks logged
- **Is it a permissions issue?** No, microphone access granted
- **Is it a backend issue?** Unknown, but likely frontend issue (chunks never sent)

---

## Contact

For questions or assistance:
- See RECOMMENDED-FIX.md for detailed fix instructions
- See live-voice-bug-analysis.md for full technical analysis
- See SUMMARY.md for quick reference

---

**Last Updated**: 2024-12-01
**Analyzer**: Frontend Bug Analyzer (AI)
**Log File**: `C:\ai\amit_projects\learnflow-chatbot\logs\frontend.log`
**Lines Analyzed**: 1344+ lines

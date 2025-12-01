# Live Voice Button Bug - Quick Summary

## Problem
The green "Live Voice" button (Gemini Live VAD mode) **appears to work** but doesn't actually transmit user voice to the backend.

## Root Cause
**VAD (Voice Activity Detection) threshold is set too high at 0.15 (15% volume)**

The AudioWorklet processor discards any audio below this threshold. Normal speaking volume in a quiet environment often doesn't reach 15%, so the audio is silently dropped.

## The Fix (5 minutes)

### File: `packages/chatbot/src/components/FloatingChatbot.vue`
### Line: 305

**Change this:**
```typescript
vadThreshold: 0.15,
```

**To this:**
```typescript
vadThreshold: 0.05,  // Lower threshold for better voice detection
```

## Why It Happens

1. User clicks green microphone button ✓
2. AudioRecorder starts at 16kHz ✓
3. Microphone captures audio ✓
4. AudioWorklet calculates volume (RMS) ✓
5. **Volume is below 0.15 threshold** ✗
6. Worklet discards audio (no `audioData` event sent) ✗
7. No audio chunks reach `onAudioChunk` callback ✗
8. Nothing is sent to backend ✗

## Evidence

**From logs - What works:**
```
ChatInput.vue:240 [ChatInput] Live voice toggle clicked
AudioRecorder.ts:122 [AudioRecorder] Started recording at 16000Hz
FloatingChatbot.vue:320 [FloatingChatbot] Live voice recording started
```

**Missing from logs - What doesn't work:**
```
NO logs found for:
- sendUserVoice
- user_voice
- audioData
- audio chunk transmission
```

## Testing After Fix

1. Apply the fix (change 0.15 to 0.05)
2. Rebuild: `npm run build` (in packages/chatbot directory)
3. Refresh browser
4. Click green microphone
5. Speak normally
6. You should see audio being transmitted to backend

## Full Details

See: `live-voice-button-bug-analysis.md` for:
- Complete code analysis
- All evidence from logs
- Alternative fixes
- Visual indicators
- Testing instructions

---

**Status:** Root cause identified, fix ready to apply
**Confidence:** 95%
**Effort to fix:** 5 minutes

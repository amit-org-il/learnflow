# Phase 4: Vue Components

**Estimated Time:** 3 hours
**Prerequisites:** Phase 3 complete

---

## Tasks

- [ ] **4.1** Create `AvatarContainer.vue` (2 hours)
- [ ] **4.2** Integrate into `FloatingChatbot.vue` (1 hour)

---

## Task 4.1: Create AvatarContainer.vue

**File:** `src/components/AvatarContainer.vue`

> **CRITICAL FIXES APPLIED:**
> - Receives URL params instead of Socket instance (uses useAvatarSocket internally)
> - Calls `geminiLipsync.queueAudio()` not `playChunk()`
> - Passes `voiceConfig` to `azureTTS.speak()`
> - Calls `unlockAudio()` in `onMounted` before initialization
> - Added null check for `avatarRef` before initialization
> - Added error recovery in catch block (sets `isSpeaking: false`)
> - Uses proper `AvatarControlParams` type from Phase 2
> - Validates `message.provider` matches `props.provider`
> - Added cleanup for provider composables in `onUnmounted`

```vue
<template>
  <div class="avatar-container" :style="{ background: background }">
    <!-- Loading State -->
    <div v-if="isLoading" class="avatar-loading">
      <div class="avatar-loading__progress">
        {{ Math.round(loadingProgress) }}%
      </div>
      <div class="avatar-loading__bar">
        <div class="avatar-loading__fill" :style="{ width: `${loadingProgress}%` }" />
      </div>
    </div>

    <!-- Avatar Canvas -->
    <div ref="avatarRef" class="avatar-canvas" v-show="!isLoading && !hasError" />

    <!-- Error State with Retry -->
    <div v-if="hasError" class="avatar-error">
      <p>{{ errorMessage }}</p>
      <button @click="retry">Retry</button>
    </div>

    <!-- Stop Button (visible when speaking) -->
    <button
      v-if="isSpeaking"
      class="avatar-stop-button"
      @click="handleStop"
    >
      Stop
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAvatar } from '@/composables/useAvatar';
import { useAvatarSocket } from '@/composables/useAvatarSocket';
import { useGeminiLipsync } from '@/composables/useGeminiLipsync';
import { useAzureTTS } from '@/composables/useAzureTTS';
import { unlockAudio } from '@/lib/audio/audio-unlock';
import type { SpeakMessage, AvatarControlParams, VoiceConfig } from '@/types';

interface Props {
  /** Backend URL (e.g., 'http://localhost:8001') */
  backendUrl: string;
  /** Chat session ID for Socket.IO */
  chatId: string;
  /** Avatar .glb model URL */
  modelUrl: string;
  /** Avatar gender */
  gender: 'male' | 'female';
  /** TTS provider */
  provider: 'azure' | 'gemini-live';
  /** Voice configuration for Azure TTS */
  voiceConfig: VoiceConfig;
  /** Background CSS (color/gradient/image URL) */
  background?: string;
}

interface Emits {
  (e: 'ready'): void;
  (e: 'speaking-start'): void;
  (e: 'speaking-end'): void;
  (e: 'error', error: string): void;
  (e: 'fallback'): void;
}

const props = withDefaults(defineProps<Props>(), {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
});

const emit = defineEmits<Emits>();

const avatarRef = ref<HTMLElement | null>(null);
const hasError = ref(false);
const errorMessage = ref('');
const fallbackMode = ref(false);

// Initialize avatar composable
const avatar = useAvatar({
  lipsyncLang: 'en',
  initialView: 'head',
  initialMood: 'neutral',
});

// CRITICAL FIX #1: Create socket internally using URL params
const avatarSocket = useAvatarSocket({
  url: props.backendUrl,
  provider: props.provider,
  voiceId: props.voiceConfig.voice,
  onSpeak: handleSpeak,
  onAvatarControl: handleAvatarControl,
  onError: (err) => emit('error', err),
});

// CRITICAL FIX #8: Provider-specific handlers with cleanup
const geminiLipsync = props.provider === 'gemini-live'
  ? useGeminiLipsync({
      avatarInstance: avatar.avatarInstance,
      sampleRate: 24000,
      onStart: () => emit('speaking-start'),
      onStop: () => emit('speaking-end'),
      onError: (err) => emit('error', err.message),
    })
  : null;

const azureTTS = props.provider === 'azure'
  ? useAzureTTS({
      getAvatarInstance: () => avatar.avatarInstance.value,
      onStart: () => emit('speaking-start'),
      onEnd: () => emit('speaking-end'),
      onError: (err) => emit('error', err.message),
    })
  : null;

const isLoading = avatar.isLoading;
const loadingProgress = avatar.loadingProgress;
const isSpeaking = avatarSocket.isSpeaking;

async function handleSpeak(message: SpeakMessage) {
  if (fallbackMode.value) {
    // In fallback mode, just play audio without avatar
    return;
  }

  // CRITICAL FIX #7: Validate provider matches
  if (message.provider !== props.provider) {
    console.warn(
      `[AvatarContainer] Provider mismatch: expected ${props.provider}, got ${message.provider}`
    );
    emit('error', `Provider mismatch: ${message.provider}`);
    return;
  }

  avatarSocket.setIsSpeaking(true);

  try {
    if (message.provider === 'gemini-live' && geminiLipsync) {
      // CRITICAL FIX #2: Use queueAudio() not playChunk()
      // Initialize if needed
      if (!geminiLipsync.isPlaying.value) {
        await geminiLipsync.start();
      }

      // Queue the audio chunk
      geminiLipsync.queueAudio(message.audio_chunk);

      // Handle final chunk
      if (message.is_final) {
        avatarSocket.sendSpeechComplete(message.message_id);
        emit('speaking-end');
      }
    } else if (message.provider === 'azure' && azureTTS) {
      // CRITICAL FIX #3: Pass voiceConfig to speak()
      await azureTTS.speak(message.text, props.voiceConfig);
      avatarSocket.sendSpeechComplete(message.message_id);
      emit('speaking-end');
    }
  } catch (err) {
    // CRITICAL FIX #6: Reset speaking state in error recovery
    avatarSocket.setIsSpeaking(false);
    emit('error', `Speech failed: ${err}`);
  }

  avatarSocket.setIsSpeaking(false);
}

// CRITICAL FIX #9: Use proper AvatarControlParams type
function handleAvatarControl(command: string, params: AvatarControlParams) {
  switch (command) {
    case 'gesture':
      if (params.gesture) {
        avatar.playGesture(params.gesture, params.duration);
      }
      break;
    case 'mood':
      if (params.mood !== undefined) {
        avatar.setMood(params.mood, params.level);
      }
      break;
    case 'view':
      if (params.view) {
        avatar.setView(params.view);
      }
      break;
    case 'stop_gesture':
      avatar.stopGesture();
      break;
    case 'emoji':
      if (params.emoji) {
        avatar.speakEmoji(params.emoji);
      }
      break;
  }
}

function handleStop() {
  avatar.stop();
  avatarSocket.interruptSpeaking();
  emit('speaking-end');
}

async function retry() {
  hasError.value = false;
  errorMessage.value = '';

  // CRITICAL FIX #5: Null check for avatarRef
  if (!avatarRef.value) {
    console.error('[AvatarContainer] Container ref not available');
    errorMessage.value = 'Container element not found';
    hasError.value = true;
    return;
  }

  try {
    await avatar.initialize(avatarRef.value);
    await avatar.loadAvatar(props.modelUrl, props.gender);

    avatarSocket.sendReady(true, true);
    emit('ready');
  } catch (err) {
    console.error('[AvatarContainer] Retry failed:', err);
    fallbackMode.value = true;
    emit('fallback');
  }
}

onMounted(async () => {
  // CRITICAL FIX #4: Unlock audio BEFORE initialization
  await unlockAudio();

  // CRITICAL FIX #5: Null check before initialization
  if (!avatarRef.value) {
    console.error('[AvatarContainer] Container ref not available');
    hasError.value = true;
    errorMessage.value = 'Container element not found';
    emit('error', 'Container element not found');
    return;
  }

  try {
    // Initialize TalkingHead
    await avatar.initialize(avatarRef.value);

    // Load avatar model
    await avatar.loadAvatar(props.modelUrl, props.gender);

    // Connect socket
    avatarSocket.connect();

    // Notify backend that avatar is ready
    avatarSocket.sendReady(true, true);
    emit('ready');

  } catch (err) {
    console.error('[AvatarContainer] Initialization failed:', err);
    hasError.value = true;
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load avatar';

    // Try fallback mode
    fallbackMode.value = true;
    emit('fallback');
  }
});

onUnmounted(() => {
  // Cleanup avatar
  avatar.cleanup();

  // Cleanup socket
  avatarSocket.disconnect();

  // CRITICAL FIX #8: Cleanup provider composables
  if (geminiLipsync) {
    geminiLipsync.cleanup();
  }
  if (azureTTS) {
    azureTTS.cleanup();
  }
});
</script>

<style scoped>
.avatar-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  border-radius: 8px;
  overflow: hidden;
}

.avatar-canvas {
  width: 100%;
  height: 100%;
}

.avatar-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.avatar-loading__progress {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  margin-bottom: 0.5rem;
}

.avatar-loading__bar {
  width: 200px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.avatar-loading__fill {
  height: 100%;
  background: white;
  transition: width 0.2s;
}

.avatar-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
}

.avatar-error button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.avatar-stop-button {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 1.5rem;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
</style>
```

---

## Task 4.2: Integrate into FloatingChatbot.vue

**File:** `src/components/FloatingChatbot.vue` (MODIFY)

---

### ⚠️ CRITICAL: Avatar Container Dimensions

The TalkingHead avatar requires **LARGER dimensions** than the current Learnflow video player:

| Aspect | Current Video Player | Required for Avatar |
|--------|---------------------|---------------------|
| Width | 360px (22.5rem) | **400px (25rem)** |
| Height | **176px (11rem)** | **400px (25rem)** |
| Aspect Ratio | ~2:1 (wide) | **1:1 (square)** |

**The current 176px height is TOO SHORT!** Avatar minimum is 400px.

**Add these CSS classes for avatar mode:**

```css
/* ============================================
   AVATAR CONTAINER - RESPONSIVE SOLUTION
   ============================================

   The avatar needs sufficient space (min 200px for quality)
   but we also need room for chat messages.

   Solution: Responsive sizing based on viewport height
   ============================================ */

/* Avatar-specific media container */
.floating-chatbot__media--avatar {
  width: 100%;
  /* Responsive height: min 200px, ideal 35% of viewport, max 400px */
  height: clamp(12.5rem, 35vh, 25rem);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

/* Increase window size when avatar is enabled */
.floating-chatbot__window--floating.has-avatar {
  width: 25rem;         /* 400px - wider for avatar */
  max-height: 56rem;    /* 896px - increased to fit avatar + messages */
  height: calc(100vh - 4rem);  /* Use more screen space */
}

/* Sidebar mode with avatar */
.floating-chatbot__window--sidebar.has-avatar {
  width: 25rem;         /* 400px */
}

/* Panel mode - avatar can be larger */
.floating-chatbot__window--panel.has-avatar .floating-chatbot__media--avatar {
  height: clamp(15rem, 40vh, 30rem);  /* Larger in panel mode */
}

/* Ensure messages area always has minimum usable space */
.floating-chatbot__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat-container__messages {
  flex: 1;
  min-height: 12.5rem;  /* 200px minimum for messages */
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* ============================================
   RESPONSIVE BREAKPOINTS
   ============================================ */

/* Large desktop (height > 900px) - full size avatar */
@media (min-height: 900px) {
  .floating-chatbot__media--avatar {
    height: 25rem;  /* 400px */
  }
}

/* Standard desktop/tablet (600-900px height) */
@media (max-height: 900px) {
  .floating-chatbot__media--avatar {
    height: clamp(12.5rem, 35vh, 20rem);  /* 200-320px */
  }
}

/* Small screens / mobile landscape (< 600px height) */
@media (max-height: 600px) {
  .floating-chatbot__media--avatar {
    height: 10rem;  /* 160px - compact but visible */
  }

  .floating-chatbot__window--floating.has-avatar {
    max-height: calc(100vh - 2rem);
    bottom: 1rem;
  }
}

/* Very small screens (< 500px height) */
@media (max-height: 500px) {
  .floating-chatbot__media--avatar {
    height: 8rem;  /* 128px - minimal */
  }
}

/* Mobile portrait - full width */
@media (max-width: 480px) {
  .floating-chatbot__window--floating.has-avatar {
    width: calc(100vw - 1rem);
    right: 0.5rem;
    left: 0.5rem;
  }
}
```

### Layout Math (with responsive solution):

| Screen Height | Avatar Size | Messages Area | Status |
|---------------|-------------|---------------|--------|
| > 900px | 400px | ~300px | ✅ Excellent |
| 700-900px | 280px | ~250px | ✅ Good |
| 600-700px | 220px | ~200px | ✅ Usable |
| 500-600px | 160px | ~200px | ✅ Compact |
| < 500px | 128px | ~150px | ⚠️ Minimal |

### Key Features:
- **`clamp()`** ensures avatar is never too small or too large
- **`min-height: 200px`** on messages guarantees chat usability
- **Responsive breakpoints** adapt to different devices
- **Mobile portrait** uses full screen width

**Update template to use conditional class:**

```vue
<div
  :class="[
    'floating-chatbot__media',
    isAvatarEnabled ? 'floating-chatbot__media--avatar' : ''
  ]"
>
  <!-- Avatar or Video content -->
</div>

<div
  :class="[
    'floating-chatbot__window',
    `floating-chatbot__window--${mode}`,
    isAvatarEnabled ? 'has-avatar' : ''
  ]"
>
  <!-- Window content -->
</div>
```

---

**Step 1: Add audio unlock to toggleChat:**

> **CRITICAL FIX #4:** Audio unlock is called in BOTH places (belt and suspenders approach):
> 1. In FloatingChatbot when user clicks chatbot button
> 2. In AvatarContainer.onMounted before initialization

```typescript
import { unlockAudio } from '@/lib/audio/audio-unlock';

function toggleChat() {
  isOpen.value = !isOpen.value;
  // Unlock audio on first user interaction
  unlockAudio();
  emit('toggle');
}
```

**Step 2: Add avatar to template:**

```vue
<template>
  <!-- In floating-chatbot__media section -->
  <div v-if="isAvatarEnabled" class="floating-chatbot__avatar">
    <AvatarContainer
      :backend-url="backendUrl"
      :chat-id="chatId"
      :model-url="avatarConfig.url"
      :gender="avatarConfig.gender"
      :provider="avatarConfig.provider"
      :voice-config="avatarConfig.voiceConfig"
      :background="avatarConfig.background"
      @ready="handleAvatarReady"
      @speaking-start="handleAvatarSpeakingStart"
      @speaking-end="handleAvatarSpeakingEnd"
      @error="handleAvatarError"
      @fallback="handleAvatarFallback"
    />
  </div>

  <!-- Existing video player as fallback -->
  <div v-else-if="botIdleVideo && showVideo" class="floating-chatbot__media">
    <!-- existing video code -->
  </div>
</template>
```

**Step 3: Add computed and handlers:**

```typescript
import AvatarContainer from '@/components/AvatarContainer.vue';
import type { VoiceConfig } from '@/types';

const isAvatarEnabled = computed(() => {
  return props.botInfo?.supportedResponseTypes?.includes('avatar') &&
         !avatarFallbackMode.value;
});

const avatarFallbackMode = ref(false);

const avatarConfig = computed(() => {
  const voiceConfig: VoiceConfig = {
    voice: props.botInfo?.tts?.voice_id || 'en-US-JennyNeural',
    locale: props.botInfo?.tts?.locale || 'en-US',
    gender: props.botInfo?.avatar?.gender || 'female',
    speakingRate: props.botInfo?.tts?.speaking_rate || 1.0,
  };

  return {
    url: props.botInfo?.avatar?.glb_url || '',
    gender: props.botInfo?.avatar?.gender || 'female',
    provider: props.botInfo?.tts?.provider || 'azure',
    voiceConfig,
    background: props.botInfo?.avatar?.background ||
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  };
});

// Get backend URL from environment or default
const backendUrl = computed(() => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  const isDev = window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:8001' : window.location.origin;
});

// Get current chat ID (from your chat state)
const chatId = computed(() => {
  return props.currentChatId || '';
});

function handleAvatarReady() {
  console.log('[Chatbot] Avatar ready');
}

function handleAvatarSpeakingStart() {
  // Optionally disable text input while speaking
}

function handleAvatarSpeakingEnd() {
  // Re-enable text input
}

function handleAvatarError(error: string) {
  console.error('[Chatbot] Avatar error:', error);
  // Show error toast/notification
}

function handleAvatarFallback() {
  avatarFallbackMode.value = true;
  // Continue with text + audio, no avatar
  console.log('[Chatbot] Fallback mode activated (no avatar)');
}
```

**Step 4: Add to FloatingChatbot Props interface:**

```typescript
interface Props {
  // ... existing props ...
  currentChatId?: string;  // Add this
}
```

---

## Verification Checklist

### Component Rendering
```
[ ] AvatarContainer renders loading state
[ ] AvatarContainer shows 0-100% progress
[ ] Avatar displays in 3D after loading
[ ] Stop button appears when speaking
[ ] Stop button triggers interrupt
[ ] Error state shows retry button
[ ] Retry works after error
[ ] Fallback mode activates after max retries
```

### Integration
```
[ ] FloatingChatbot conditionally shows avatar
[ ] Audio unlocks on chatbot click
[ ] Audio unlocks again in AvatarContainer.onMounted
[ ] backendUrl computed from environment
[ ] chatId passed correctly to AvatarContainer
```

### Socket.IO Connection
```
[ ] Socket connects to correct URL with /avatar namespace
[ ] Socket receives session_start event
[ ] Socket receives speak events
[ ] Socket handles reconnection
[ ] Socket cleanup on unmount
```

### Provider-Specific (Azure)
```
[ ] Azure TTS receives voiceConfig
[ ] Voice ID passed correctly
[ ] Speaking rate applied
[ ] Viseme lip-sync works
[ ] Speech complete event sent after synthesis
```

### Provider-Specific (Gemini Live)
```
[ ] Gemini handler starts before first chunk
[ ] Audio chunks queued with queueAudio()
[ ] is_final triggers speech_complete
[ ] Mouth shapes applied smoothly
[ ] No UI freezing (not using reactive state for mouth)
```

### Error Handling
```
[ ] Provider mismatch detected and logged
[ ] Null avatarRef checked before initialization
[ ] Speaking state reset on error
[ ] Cleanup happens on unmount for all composables
```

### Type Safety
```
[ ] AvatarControlParams type used (not Record<string, any>)
[ ] VoiceConfig type used
[ ] All imports resolve correctly
[ ] No TypeScript errors
```

---

## Common Issues & Solutions

### Issue: "Cannot read property 'queueAudio' of null"
**Cause:** geminiLipsync not started before queueAudio() called
**Fix:** Check `if (!geminiLipsync.isPlaying.value) await geminiLipsync.start()` before queueAudio

### Issue: "Provider mismatch" warning in console
**Cause:** Backend sent different provider than expected
**Fix:** Check bot configuration, ensure TTS provider matches avatar configuration

### Issue: Audio won't play on mobile
**Cause:** Audio not unlocked before playback
**Fix:** Ensure unlockAudio() called in toggleChat AND in AvatarContainer.onMounted

### Issue: Avatar not loading
**Cause:** TalkingHead script not loaded or container ref null
**Fix:** Check console for script errors, verify avatarRef.value exists before initialize()

### Issue: Socket won't connect
**Cause:** Missing /avatar namespace in URL
**Fix:** useAvatarSocket automatically adds /avatar, verify backendUrl is correct

---

## Testing Instructions

### Manual Testing

1. **Open chatbot and verify avatar loads:**
   ```
   - Click chatbot button
   - Verify loading progress 0-100%
   - Verify 3D avatar appears
   - Check console for "[AvatarContainer] Avatar ready"
   ```

2. **Test Azure TTS (if provider = 'azure'):**
   ```
   - Send a message
   - Verify avatar lip-sync matches speech
   - Verify speech completes fully
   - Check speaking rate applied
   ```

3. **Test Gemini Live (if provider = 'gemini-live'):**
   ```
   - Send a message
   - Verify audio chunks stream smoothly
   - Verify mouth shapes update in real-time
   - Verify no UI freezing
   ```

4. **Test interruption:**
   ```
   - Start avatar speaking
   - Click Stop button
   - Verify speech stops immediately
   - Verify interrupt sent to backend
   ```

5. **Test error recovery:**
   ```
   - Disconnect network
   - Verify error message appears
   - Click Retry
   - Verify reconnection works
   ```

6. **Test fallback mode:**
   ```
   - Force avatar load failure (bad model URL)
   - Verify fallback mode activates
   - Verify chat continues without avatar
   ```

### Automated Testing (Optional)

```typescript
// Test AvatarContainer props
describe('AvatarContainer', () => {
  it('should receive URL params not Socket instance', () => {
    const wrapper = mount(AvatarContainer, {
      props: {
        backendUrl: 'http://localhost:8001',
        chatId: 'test-123',
        modelUrl: '/models/avatar.glb',
        gender: 'female',
        provider: 'azure',
        voiceConfig: {
          voice: 'en-US-JennyNeural',
          locale: 'en-US',
          gender: 'female',
          speakingRate: 1.0,
        },
      },
    });
    expect(wrapper.exists()).toBe(true);
  });
});
```

---

## Next Phase

→ [Phase 5: API Integration](./phase_5_api.md)

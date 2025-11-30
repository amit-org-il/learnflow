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
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAvatar } from '../composables/useAvatar';
import { useAvatarSocket } from '../composables/useAvatarSocket';
import { useGeminiLipsync } from '../composables/useGeminiLipsync';
import { useAzureTTS } from '../composables/useAzureTTS';
import { unlockAudio } from '../lib/audio/audio-unlock';
import type { SpeakMessage, AvatarControlParams, VoiceConfig, AzureSpeakMessage, GeminiSpeakMessage } from '../types/index';

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

// Create socket internally using URL params
const avatarSocket = useAvatarSocket({
  url: props.backendUrl,
  provider: props.provider,
  voiceId: props.voiceConfig.voice,
  onSpeak: handleSpeak,
  onAvatarControl: handleAvatarControl,
  onError: (err) => emit('error', err),
});

// Provider-specific handlers with cleanup
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

const isLoading = computed(() => avatar.isLoading.value);
const loadingProgress = computed(() => avatar.loadingProgress.value);
const isSpeaking = computed(() => avatarSocket.isSpeaking.value);

async function handleSpeak(message: SpeakMessage) {
  if (fallbackMode.value) {
    // In fallback mode, just play audio without avatar
    return;
  }

  // Validate provider matches
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
      const geminiMessage = message as GeminiSpeakMessage;

      // Initialize if not already playing
      if (!geminiLipsync.isPlaying.value) {
        await geminiLipsync.initialize();
      }

      // Play the audio chunk
      geminiLipsync.playChunk(geminiMessage.audio_chunk, geminiMessage.is_final);

      // Handle final chunk
      if (geminiMessage.is_final) {
        avatarSocket.sendSpeechComplete(geminiMessage.message_id);
        avatarSocket.setIsSpeaking(false);
      }
    } else if (message.provider === 'azure' && azureTTS) {
      const azureMessage = message as AzureSpeakMessage;

      // Pass voiceConfig to speak()
      await azureTTS.speak(azureMessage.text, props.voiceConfig);
      avatarSocket.sendSpeechComplete(azureMessage.message_id);
      avatarSocket.setIsSpeaking(false);
    }
  } catch (err) {
    // Reset speaking state in error recovery
    avatarSocket.setIsSpeaking(false);
    emit('error', `Speech failed: ${err}`);
  }
}

// Handle avatar control commands
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
  if (geminiLipsync) {
    geminiLipsync.stop();
  }
  if (azureTTS) {
    azureTTS.stop();
  }
  avatarSocket.interruptSpeaking();
  emit('speaking-end');
}

async function retry() {
  hasError.value = false;
  errorMessage.value = '';

  // Null check for avatarRef
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
  // Unlock audio BEFORE initialization
  await unlockAudio();

  // Null check before initialization
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

  // Cleanup provider composables
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

<template>
  <div class="avatar-container" :style="{ background: background }">
    <!-- Loading State -->
    <div v-if="isLoading" class="avatar-loading" role="status" aria-live="polite" aria-label="Loading avatar">
      <div class="avatar-loading__progress" aria-hidden="true">
        {{ loadingProgress || 0 }}%
      </div>
      <div class="avatar-loading__bar" role="progressbar" :aria-valuenow="loadingProgress || 0" aria-valuemin="0" aria-valuemax="100">
        <div class="avatar-loading__fill" :style="{ width: `${loadingProgress || 0}%` }" />
      </div>
      <span class="sr-only">Loading avatar: {{ loadingProgress || 0 }} percent complete</span>
    </div>

    <!-- Avatar Canvas -->
    <div ref="avatarRef" class="avatar-canvas" v-show="!isLoading && !hasError" />

    <!-- Error State with Retry -->
    <div v-if="hasError" class="avatar-error" role="alert" aria-live="assertive">
      <p>{{ errorMessage }}</p>
      <button @click="retry" type="button" aria-label="Retry loading avatar">Retry</button>
    </div>

    <!-- Streaming Text Overlay removed - text now shown in chat bubbles via gemini-text emit -->
    <!-- Stop Button moved to ChatInput - shows as red square instead of mic when speaking -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAvatar } from '../composables/useAvatar';
import { useAvatarSocket } from '../composables/useAvatarSocket';
import { useGeminiLipsync } from '../composables/useGeminiLipsync';
import { useAzureTTS } from '../composables/useAzureTTS';
import { useStreamingText } from '../composables/useStreamingText';
import { unlockAudio } from '../lib/audio/audio-unlock';
import StreamingText from './StreamingText.vue';
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
  /** Emitted when Gemini Live text is received (for chat bubble display) */
  (e: 'gemini-text', data: { messageId: string; textChunk: string; isFinal: boolean }): void;
  /** Emitted when Azure TTS text is received (for chat bubble display) */
  (e: 'azure-text', data: { messageId: string; text: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
});

const emit = defineEmits<Emits>();

const avatarRef = ref<HTMLElement | null>(null);
const hasError = ref(false);
const errorMessage = ref('');
const fallbackMode = ref(false);
const textOnlyMode = ref(false);  // When true, skip audio playback (muted)

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

// Streaming text for Gemini Live responses
const streamingText = useStreamingText({
  defaultDir: 'auto',
  onClear: () => console.log('[AvatarContainer] Streaming text cleared'),
});

const isLoading = computed(() => avatar.isLoading.value);
const loadingProgress = computed(() => avatar.loadingProgress.value);
const isSpeaking = computed(() => avatarSocket.isSpeaking.value);

async function handleSpeak(message: SpeakMessage) {
  // Always process streaming text for Gemini Live messages (even in fallback mode)
  if (message.provider === 'gemini-live') {
    streamingText.handleSpeakMessage(message);

    // Emit text to parent for chat bubble display
    // Always emit when there's text OR when is_final (so parent knows stream ended)
    const geminiMessage = message as GeminiSpeakMessage;
    if (geminiMessage.text_chunk || geminiMessage.is_final) {
      emit('gemini-text', {
        messageId: geminiMessage.message_id,
        textChunk: geminiMessage.text_chunk || '',
        isFinal: geminiMessage.is_final,
      });
    }
  }

  if (fallbackMode.value) {
    // In fallback mode, just play audio without avatar
    return;
  }

  // Text-only mode (muted) - show text but skip audio playback
  if (textOnlyMode.value) {
    console.log('[AvatarContainer] Text-only mode - skipping audio playback');
    // For Azure, still emit text for chat bubble but skip TTS
    if (message.provider === 'azure') {
      const azureMessage = message as AzureSpeakMessage;
      emit('azure-text', {
        messageId: azureMessage.message_id,
        text: azureMessage.text || '',
      });
      avatarSocket.sendSpeechComplete(azureMessage.message_id);
    }
    // For Gemini, text was already emitted above
    if (message.provider === 'gemini-live') {
      const geminiMessage = message as GeminiSpeakMessage;
      if (geminiMessage.is_final) {
        avatarSocket.sendSpeechComplete(geminiMessage.message_id);
      }
    }
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
    } else if (message.provider === 'azure') {
      console.log('[AvatarContainer] Azure provider detected, azureTTS:', azureTTS ? 'exists' : 'NULL', 'props.provider:', props.provider);

      if (!azureTTS) {
        console.error('[AvatarContainer] azureTTS is null! Component was created with wrong provider?');
        emit('error', 'Azure TTS not initialized - provider mismatch');
        return;
      }

      const azureMessage = message as AzureSpeakMessage;

      // Emit text to parent for chat bubble display (Azure sends full text, not chunks)
      console.log('[AvatarContainer] Emitting azure-text:', azureMessage.text?.substring(0, 50));
      emit('azure-text', {
        messageId: azureMessage.message_id,
        text: azureMessage.text || '',
      });
      console.log('[AvatarContainer] AFTER azure-text emit, continuing to guard check');

      // Guard against undefined/empty text from backend
      if (!azureMessage.text || azureMessage.text.trim() === '') {
        console.warn('[AvatarContainer] Empty text from backend, skipping Azure TTS speech');
        avatarSocket.sendSpeechComplete(azureMessage.message_id);
        avatarSocket.setIsSpeaking(false);
        return;
      }

      // Pass voiceConfig to speak() - DEBUG v2
      console.log('[AvatarContainer] About to call azureTTS.speak() with:', {
        text: azureMessage.text?.substring(0, 30),
        voiceConfig: props.voiceConfig,
        timestamp: Date.now()
      });
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
  // Only stop the audio/speech, NOT the avatar animations
  // avatar.stop() would freeze the avatar completely - we don't want that
  if (geminiLipsync) {
    geminiLipsync.stop();
  }
  if (azureTTS) {
    azureTTS.stop();
  }
  avatarSocket.interruptSpeaking();
  streamingText.clearText();
  avatarSocket.setIsSpeaking(false);
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
  // Null check before initialization
  if (!avatarRef.value) {
    console.error('[AvatarContainer] Container ref not available');
    hasError.value = true;
    errorMessage.value = 'Container element not found';
    emit('error', 'Container element not found');
    return;
  }

  try {
    // Start audio unlock in background (don't wait - audio only needed when speaking)
    // This will resolve immediately if autoplay allowed, or wait for user gesture
    unlockAudio().catch(err => {
      console.warn('[AvatarContainer] Audio unlock failed (will retry on speak):', err);
    });

    // Initialize TalkingHead (doesn't require audio)
    await avatar.initialize(avatarRef.value);

    // Load avatar model (doesn't require audio)
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

// Expose methods for parent component to use
defineExpose({
  sendUserMessage: (text: string, language?: string, textOnly?: boolean) => {
    // Set text-only mode to skip audio playback when response arrives
    textOnlyMode.value = textOnly ?? false;
    console.log('[AvatarContainer] sendUserMessage textOnly:', textOnly, '-> textOnlyMode:', textOnlyMode.value);
    avatarSocket.sendUserMessage(text, language, textOnly);
  },
  sendUserVoice: (audioChunk: string, sampleRate: number, isFinal: boolean) => {
    avatarSocket.sendUserVoice(audioChunk, sampleRate, isFinal);
  },
  stop: handleStop,
  isConnected: avatarSocket.isConnected,
  isSpeaking: avatarSocket.isSpeaking,
  // Avatar view control
  setView: (view: 'head' | 'upper' | 'full' | 'mid') => {
    avatar.setView(view as any);
  },
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

/* Screen reader only - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

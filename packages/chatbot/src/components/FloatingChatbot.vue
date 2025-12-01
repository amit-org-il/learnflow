<template>
  <!-- Floating Button (Only visible when in floating mode) -->
  <div
    v-if="currentLayout === 'floating'"
    class="floating-chatbot__trigger"
    @click="toggleChat"
  >
    <img
      v-if="botImage"
      :src="botImage"
      :alt="botName || 'Chatbot'"
      class="floating-chatbot__trigger-image"
    />
    <video
      v-else-if="botIdleVideo"
      :poster="botImage"
      :src="botIdleVideo"
      class="floating-chatbot__trigger-video"
      playsinline
      autoplay
      muted
      loop
    />
    <div v-else class="floating-chatbot__trigger-placeholder">
      🤖
    </div>
  </div>

  <!-- Chat Window -->
  <!-- In panel mode, always show (no transition, no isOpen check) -->
  <!-- In floating/sidebar mode, show only when isOpen -->
  <Transition name="fade">
    <div
      v-if="currentLayout === 'panel' || isOpen"
      class="floating-chatbot__window"
      :class="{
        'floating-chatbot__window--sidebar': currentLayout === 'sidebar',
        'floating-chatbot__window--floating': currentLayout === 'floating',
        'floating-chatbot__window--panel': currentLayout === 'panel',
        'has-avatar': isAvatarEnabled
      }"
      :dir="rtl ? 'rtl' : 'ltr'"
    >
      <div class="floating-chatbot__header">
        <div class="floating-chatbot__header-left">
          <img
            v-if="botImage"
            :src="botImage"
            :alt="botName || 'Chatbot'"
            class="floating-chatbot__header-avatar"
          />
          <div v-else class="floating-chatbot__header-avatar-placeholder">
            🤖
          </div>
                <span class="floating-chatbot__header-title">{{ botName || 'Chatbot' }}</span>
        </div>
        <div class="floating-chatbot__header-right">
          <!-- RTL/LTR Toggle -->
          <button
            class="floating-chatbot__header-button"
            @click="toggleRTL"
            :title="rtl ? 'Switch to LTR' : 'Switch to RTL'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16M4 12h16M4 20h16" />
            </svg>
            <span style="font-size: 0.65rem; margin-left: 0.25rem; font-weight: 600;">{{ rtl ? 'RTL' : 'LTR' }}</span>
          </button>
          <!-- Toggle between floating and panel -->
          <button
            class="floating-chatbot__header-button"
            @click="toggleLayout"
            :title="currentLayout === 'floating' ? 'Switch to panel' : 'Switch to floating'"
          >
            <!-- When in floating mode, show maximize icon (switch to panel) -->
            <svg v-if="currentLayout === 'floating'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <!-- When in panel mode, show minimize/float icon (switch to floating) -->
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          </button>
          <!-- Close button (only in floating/sidebar mode, not in panel mode) -->
          <button
            v-if="currentLayout !== 'panel'"
            class="floating-chatbot__header-button"
            @click="toggleChat"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="floating-chatbot__content">
        <!-- Avatar (if enabled) -->
        <!-- Key forces recreation when provider changes (azure vs gemini-live have different audio handlers) -->
        <div v-if="isAvatarEnabled" class="floating-chatbot__media floating-chatbot__media--avatar">
          <AvatarContainer
            :key="`avatar-${avatarConfig.provider}-${chatId}`"
            ref="avatarContainerRef"
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
            @gemini-text="handleGeminiText"
            @azure-text="handleAzureText"
          />

          <!-- Avatar Controls -->
          <!-- View Toggle Button (head/body/full) - all bots -->
          <ViewToggleButton
            :current-view="currentView"
            position="bottom-right"
            @change="handleViewChange"
          />

          <!-- Bottom-left controls container -->
          <div class="floating-chatbot__bottom-left-controls">
            <!-- Mute Button - all avatar bots -->
            <MuteButton
              :is-muted="isMuted"
              @change="handleMuteChange"
            />

            <!-- Speed Control (1.0x - 2.0x) - Azure bots only -->
            <SpeedControl
              v-if="isAzureBot"
              :current-speed="currentSpeed"
              @change="handleSpeedChange"
            />
          </div>
        </div>

        <!-- Video/Audio player area (fallback or non-avatar mode) -->
        <div v-else-if="botIdleVideo && showVideo" class="floating-chatbot__media">
          <video
            ref="idleVideoRef"
            :poster="botImage"
            :src="botIdleVideo"
            class="floating-chatbot__media-video"
            playsinline
            autoplay
            muted
            loop
          />
        </div>

        <ChatContainer
          :messages="messages"
          :is-loading="isLoading"
          :is-streaming="isStreaming"
          :error="error"
          :custom-components="customComponents"
          :rtl="rtl"
          :supports-markdown="supportsMarkdown"
          :placeholder="rtl ? 'הקלידו משהו' : 'Type your message...'"
          :is-speaking="isAvatarSpeaking"
          :is-gemini-live="isGeminiLive"
          :is-live-voice-recording="isLiveVoiceRecording"
          :is-live-voice-initializing="isLiveVoiceInitializing"
          :live-voice-volume="liveVoiceVolume"
          @submit="handleSubmit"
          @stop="handleAvatarStop"
          @live-voice-toggle="handleLiveVoiceToggle"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ChatContainer from './ChatContainer.vue';
import AvatarContainer from './AvatarContainer.vue';
import ViewToggleButton from './ViewToggleButton.vue';
import SpeedControl from './SpeedControl.vue';
import MuteButton from './MuteButton.vue';
import { unlockAudio } from '../lib/audio/audio-unlock';
import { useVoiceRecording } from '../composables/useVoiceRecording';
import type { ChatMessage, BotInfo } from '../types.js';
import type { VoiceConfig } from '../types/index';

interface Props {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  customComponents?: Record<string, any>;
  botInfo?: BotInfo | null;
  rtl?: boolean;
  layout?: 'floating' | 'sidebar' | 'panel';
  modelValue?: boolean; // v-model for open state
  supportsMarkdown?: boolean;
  /** Current chat session ID (for avatar Socket.IO) */
  currentChatId?: string;
}

interface Emits {
  (e: 'submit', message: string, avatarMode?: boolean): void;
  (e: 'toggle'): void;
  (e: 'update:modelValue', value: boolean): void;
  (e: 'layout-change', layout: 'floating' | 'sidebar' | 'panel'): void;
  (e: 'rtl-change', rtl: boolean): void;
  /** Emitted when Gemini Live text is received (for chat bubble display) */
  (e: 'gemini-text', data: { messageId: string; textChunk: string; isFinal: boolean }): void;
  /** Emitted when Azure TTS text is received (for chat bubble display) */
  (e: 'azure-text', data: { messageId: string; text: string }): void;
  /** Emitted when stop button is clicked to interrupt avatar and streaming */
  (e: 'stop'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isStreaming: false,
  error: null,
  customComponents: () => ({}),
  botInfo: null,
  rtl: false,
  layout: 'floating',
  modelValue: false,
  supportsMarkdown: true,
  currentChatId: '',
});

const emit = defineEmits<Emits>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const currentLayout = ref<'floating' | 'sidebar' | 'panel'>(props.layout);
const showVideo = ref(true);
const idleVideoRef = ref<HTMLVideoElement | null>(null);
const internalRTL = ref(props.rtl);
const avatarContainerRef = ref<InstanceType<typeof AvatarContainer> | null>(null);

// Avatar control state
const currentView = ref<'head' | 'upper'>('head');
const currentSpeed = ref(1.0);
const isMuted = ref(false);  // When true, sends text_only requests (no audio)

const botImage = computed(() => {
  // Force reactivity by accessing the prop directly
  return props.botInfo?.image;
});
const botName = computed(() => {
  // Force reactivity by accessing the prop directly
  return props.botInfo?.name;
});
const botIdleVideo = computed(() => props.botInfo?.idleVideo);
const botLanguage = computed(() => props.botInfo?.language || 'en');
const supportedResponseTypes = computed(() => props.botInfo?.supportedResponseTypes || ['text']);

// RTL state - can be toggled independently of bot language
const rtl = computed(() => {
  return internalRTL.value;
});

// Avatar state
const avatarFallbackMode = ref(false);
const isAvatarSpeaking = ref(false);

// Check if avatar is enabled for this bot
const isAvatarEnabled = computed(() => {
  return props.botInfo?.supportedResponseTypes?.includes('avatar') &&
         !avatarFallbackMode.value;
});

// Check if Azure TTS provider (for showing speed control)
const isAzureBot = computed(() => {
  return (props.botInfo as any)?.tts?.provider === 'azure';
});

// Check if Gemini Live provider (for showing live voice button)
const isGeminiLive = computed(() => {
  return (props.botInfo as any)?.tts?.provider === 'gemini-live';
});

// Live Voice Recording state (for Gemini Live)
const liveVoiceRecording = ref<ReturnType<typeof useVoiceRecording> | null>(null);

// Initialize voice recording when component mounts and it's Gemini Live
function setupVoiceRecording() {
  if (!isGeminiLive.value || !avatarContainerRef.value) {
    liveVoiceRecording.value = null;
    return;
  }

  liveVoiceRecording.value = useVoiceRecording({
    sampleRate: 16000,
    vadThreshold: 0,  // Disabled (send all audio) - matches React implementation
    interruptOnStart: true,
    onAudioChunk: (base64, sampleRate, isFinal) => {
      // Send audio to avatar socket
      console.log('[FloatingChatbot] onAudioChunk:', {
        hasData: !!base64,
        length: base64?.length || 0,
        sampleRate,
        isFinal,
        hasAvatarRef: !!avatarContainerRef.value,
        hasSendUserVoice: !!avatarContainerRef.value?.sendUserVoice
      });
      if (avatarContainerRef.value?.sendUserVoice) {
        avatarContainerRef.value.sendUserVoice(base64, sampleRate, isFinal);
      } else {
        console.warn('[FloatingChatbot] Cannot send audio: sendUserVoice not available');
      }
    },
    onInterruptSpeech: () => {
      // Stop avatar speaking when user starts talking
      if (avatarContainerRef.value?.stop) {
        avatarContainerRef.value.stop();
      }
    },
    onStart: () => {
      console.log('[FloatingChatbot] Live voice recording started');
    },
    onStop: () => {
      console.log('[FloatingChatbot] Live voice recording stopped');
    },
    onError: (err) => {
      console.error('[FloatingChatbot] Live voice error:', err);
    },
  });
}

// Live voice computed state (safe access)
const isLiveVoiceRecording = computed(() => liveVoiceRecording.value?.state.isRecording.value ?? false);
const isLiveVoiceInitializing = computed(() => liveVoiceRecording.value?.state.isInitializing.value ?? false);
const liveVoiceVolume = computed(() => liveVoiceRecording.value?.state.volumeLevel.value ?? 0);

// Handle live voice toggle
function handleLiveVoiceToggle() {
  if (!liveVoiceRecording.value) {
    // Initialize on first use
    setupVoiceRecording();
  }
  if (liveVoiceRecording.value) {
    liveVoiceRecording.value.actions.toggleRecording();
  }
}

// Avatar configuration from bot info
const avatarConfig = computed(() => {
  const voiceConfig: VoiceConfig = {
    voice: (props.botInfo as any)?.tts?.voice_id || 'en-US-JennyNeural',
    locale: (props.botInfo as any)?.tts?.locale || 'en-US',
    gender: (props.botInfo as any)?.avatar?.gender || 'female',
    // Use currentSpeed from state (reactive) - allows runtime speed changes
    speakingRate: currentSpeed.value,
  };

  return {
    url: (props.botInfo as any)?.avatar?.glb_url || '',
    gender: ((props.botInfo as any)?.avatar?.gender || 'female') as 'male' | 'female',
    provider: ((props.botInfo as any)?.tts?.provider || 'azure') as 'azure' | 'gemini-live',
    voiceConfig,
    background: (props.botInfo as any)?.avatar?.background ||
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  };
});

// Get backend URL from environment or default
const backendUrl = computed(() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) {
    return (import.meta as any).env.VITE_BACKEND_URL;
  }
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:8001' : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8001');
});

// Get current chat ID
const chatId = computed(() => {
  return props.currentChatId || '';
});

function toggleChat() {
  isOpen.value = !isOpen.value;
  // Unlock audio on first user interaction
  unlockAudio();
  emit('toggle');
}

function toggleLayout() {
  // Toggle between 'floating' and 'panel' (skip 'sidebar' for now)
  currentLayout.value = currentLayout.value === 'floating' ? 'panel' : 'floating';
  emit('layout-change', currentLayout.value);
}

function toggleRTL() {
  internalRTL.value = !internalRTL.value;
  emit('rtl-change', internalRTL.value);
}

function handleSubmit(message: string) {
  const usingAvatar = isAvatarEnabled.value && avatarContainerRef.value?.sendUserMessage;

  // For avatar-enabled bots, send message through avatar socket
  if (usingAvatar) {
    const language = botLanguage.value || 'en-US';
    const textOnly = isMuted.value;  // When muted, request text-only (no audio)
    console.log('[FloatingChatbot] Sending message through avatar socket:', message, 'lang:', language, 'textOnly:', textOnly);
    avatarContainerRef.value!.sendUserMessage(message, language, textOnly);
  }
  // Emit to parent with avatarMode flag (for display in chat UI, skip transport if avatar)
  emit('submit', message, usingAvatar);
}

// Avatar event handlers
function handleAvatarReady() {
  console.log('[FloatingChatbot] Avatar ready');
}

function handleAvatarSpeakingStart() {
  console.log('[FloatingChatbot] Avatar speaking started');
  isAvatarSpeaking.value = true;
}

function handleAvatarSpeakingEnd() {
  console.log('[FloatingChatbot] Avatar speaking ended');
  isAvatarSpeaking.value = false;
}

function handleAvatarError(error: string) {
  console.error('[FloatingChatbot] Avatar error:', error);
  // Could show error toast/notification here
}

function handleAvatarFallback() {
  avatarFallbackMode.value = true;
  // Continue with text + audio, no avatar
  console.log('[FloatingChatbot] Fallback mode activated (no avatar)');
}

// Handle Gemini Live text - emit to parent for chat bubble display
function handleGeminiText(data: { messageId: string; textChunk: string; isFinal: boolean }) {
  emit('gemini-text', data);
}

// Handle Azure TTS text - emit to parent for chat bubble display
function handleAzureText(data: { messageId: string; text: string }) {
  console.log('[FloatingChatbot] handleAzureText received:', data.text?.substring(0, 50));
  emit('azure-text', data);
}

// Handle view toggle (head/upper)
function handleViewChange(view: 'head' | 'upper') {
  console.log('[FloatingChatbot] View changed to:', view);
  currentView.value = view;
  // Call avatar's setView method
  if (avatarContainerRef.value?.setView) {
    avatarContainerRef.value.setView(view);
  }
}

// Handle speed change (Azure TTS only)
function handleSpeedChange(speed: number) {
  console.log('[FloatingChatbot] Speed changed to:', speed);
  currentSpeed.value = speed;
  // The avatarConfig computed will pick up the new speed via currentSpeed.value
  // and pass it to AvatarContainer's voiceConfig prop
}

// Handle mute toggle - when muted, send text_only requests (no audio)
function handleMuteChange(muted: boolean) {
  console.log('[FloatingChatbot] Mute changed to:', muted);
  isMuted.value = muted;
}

// Handle stop button click from ChatInput
function handleAvatarStop() {
  console.log('[FloatingChatbot] Stop button clicked');
  // Stop avatar audio
  if (avatarContainerRef.value?.stop) {
    avatarContainerRef.value.stop();
  }
  isAvatarSpeaking.value = false;
  // Emit stop to parent to end streaming (typing indicator)
  emit('stop');
}

// Watch for bot info changes (welcome message is handled by parent)
watch(() => props.botInfo, (newBotInfo) => {
  console.log('[FloatingChatbot] botInfo prop changed:', newBotInfo);
  console.log('[FloatingChatbot] botImage:', botImage.value, 'botName:', botName.value);

  // Initialize speed from bot config if available
  const botSpeed = (newBotInfo as any)?.tts?.speaking_rate;
  if (botSpeed && botSpeed !== currentSpeed.value) {
    currentSpeed.value = botSpeed;
  }
}, { deep: true, immediate: true });

// Cleanup voice recording when component unmounts
// (needed because composable may be initialized lazily outside setup)
onUnmounted(() => {
  if (liveVoiceRecording.value) {
    liveVoiceRecording.value.actions.cleanup();
    liveVoiceRecording.value = null;
  }
});
</script>

<style scoped>
.floating-chatbot__trigger {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  background-color: white;
  border: 2px solid rgba(59, 130, 246, 1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9998;
  transition: transform 0.2s, box-shadow 0.2s;
}

.floating-chatbot__trigger:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* RTL does NOT change button position - only chat content direction */

.floating-chatbot__trigger-image,
.floating-chatbot__trigger-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.floating-chatbot__trigger-placeholder {
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-chatbot__window {
  position: fixed;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.floating-chatbot__window--floating {
  bottom: 6rem;
  right: 1.5rem;
  width: 22.5rem;
  height: calc(100vh - 8rem);
  max-height: 37.5rem;
  /* Prevent overlap with browser URL bar */
  max-height: min(37.5rem, calc(100vh - 8rem));
  max-height: min(37.5rem, calc(100dvh - 8rem)); /* Use dvh for mobile browsers */
}

/* RTL only affects content direction, not window position */

.floating-chatbot__window--sidebar {
  top: 0;
  right: 0;
  width: 22.5rem;
  height: 100vh;
  border-radius: 0;
  border-left: 1px solid rgba(229, 231, 235, 1);
}

/* Panel mode - no fixed positioning, fills parent container */
.floating-chatbot__window--panel {
  position: relative !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 0;
  box-shadow: none;
  border: none;
}

/* RTL only affects content direction, not window position */


.floating-chatbot__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(229, 231, 235, 1);
  background-color: white;
  flex-shrink: 0;
}

.floating-chatbot__header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.floating-chatbot__header-avatar,
.floating-chatbot__header-avatar-placeholder {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  object-fit: cover;
}

.floating-chatbot__header-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(243, 244, 246, 1);
  font-size: 1.25rem;
}

.floating-chatbot__header-title {
  font-weight: 600;
  font-size: 0.75rem;
  color: rgba(17, 24, 39, 1);
}

.floating-chatbot__header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.floating-chatbot__header-button {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  color: rgba(107, 114, 128, 1);
  transition: background-color 0.2s, color 0.2s;
}

.floating-chatbot__header-button:hover {
  background-color: rgba(243, 244, 246, 1);
  color: rgba(17, 24, 39, 1);
}

.floating-chatbot__content {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.floating-chatbot__media {
  width: 100%;
  height: 11rem;
  background-color: rgba(243, 244, 246, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(229, 231, 235, 1);
  position: relative;
  overflow: hidden;
}

.floating-chatbot__media-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* ============================================
   AVATAR CONTAINER - RESPONSIVE SOLUTION
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
  height: calc(100dvh - 8rem);  /* Use dvh for mobile browsers, leave space for URL bar */
  max-height: min(56rem, calc(100dvh - 8rem));  /* Cap at 896px or viewport minus margins */
}

/* Sidebar mode with avatar */
.floating-chatbot__window--sidebar.has-avatar {
  width: 25rem;         /* 400px */
}

/* Panel mode - avatar can be larger */
.floating-chatbot__window--panel.has-avatar .floating-chatbot__media--avatar {
  height: clamp(15rem, 40vh, 30rem);  /* Larger in panel mode */
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

/* ============================================
   AVATAR CONTROL BUTTONS
   ============================================ */

/* Bottom-left controls container (mute + speed) */
.floating-chatbot__bottom-left-controls {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 10;
}
</style>


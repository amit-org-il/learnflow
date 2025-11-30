<template>
  <div class="chat-container" :dir="rtl ? 'rtl' : 'ltr'">
    <div class="chat-container__messages" ref="messagesContainerRef">
      <TransitionGroup name="list" tag="div" class="chat-container__messages-list">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :custom-components="customComponents"
          :rtl="rtl"
          :full-width="true"
          :supports-markdown="supportsMarkdown"
          @suggestion-click="handleSuggestionClick"
        />
      </TransitionGroup>
      <div v-if="messages.length === 0" class="chat-container__empty">
        <p class="chat-container__empty-text">No messages yet. Start a conversation!</p>
      </div>
    </div>
    <div v-if="error" class="chat-container__error">
      <span class="chat-container__error-icon">⚠️</span>
      <span class="chat-container__error-text">{{ error }}</span>
    </div>
    <ChatInput
      v-model="inputValue"
      :disabled="!!(isLoading || isStreaming)"
      :loading="!!(isLoading || isStreaming)"
      :placeholder="placeholder"
      :rtl="rtl"
      :is-speaking="isSpeaking"
      :is-gemini-live="isGeminiLive"
      :is-live-voice-recording="isLiveVoiceRecording"
      :is-live-voice-initializing="isLiveVoiceInitializing"
      :live-voice-volume="liveVoiceVolume"
      @submit="handleSubmit"
      @stop="handleStop"
      @live-voice-toggle="handleLiveVoiceToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import ChatMessage from './ChatMessage.vue';
import ChatInput from './ChatInput.vue';
import type { ChatMessage as ChatMessageType } from '../types.js';

interface Props {
  messages: ChatMessageType[];
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  customComponents?: Record<string, any>;
  rtl?: boolean;
  placeholder?: string;
  supportsMarkdown?: boolean;
  /** Whether avatar is currently speaking (shows stop button instead of mic) */
  isSpeaking?: boolean;
  /** Whether this is a Gemini Live bot (shows live voice button) */
  isGeminiLive?: boolean;
  /** Whether live voice recording is active */
  isLiveVoiceRecording?: boolean;
  /** Whether live voice is initializing */
  isLiveVoiceInitializing?: boolean;
  /** Live voice volume level (0-1) */
  liveVoiceVolume?: number;
}

interface Emits {
  (e: 'submit', message: string): void;
  (e: 'suggestionClick', suggestion: import('../types.js').Suggestion): void;
  /** Emitted when stop button is clicked to interrupt avatar */
  (e: 'stop'): void;
  /** Emitted when live voice button is toggled */
  (e: 'live-voice-toggle'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isStreaming: false,
  error: null,
  customComponents: () => ({}),
  rtl: false,
  placeholder: 'Type your message...',
  supportsMarkdown: true,
  isSpeaking: false,
  isGeminiLive: false,
  isLiveVoiceRecording: false,
  isLiveVoiceInitializing: false,
  liveVoiceVolume: 0,
});

const emit = defineEmits<Emits>();

function handleSuggestionClick(suggestion: import('../types.js').Suggestion): void {
  if (suggestion.action.kind === 'botCommand') {
    // Send message with prompt or command
    const message = suggestion.action.prompt || `[${suggestion.action.command}]`;
    emit('submit', message);
  } else if (suggestion.action.kind === 'navigate') {
    // Just show indication (could emit an event for parent to handle)
    console.log('[ChatContainer] Navigate suggestion clicked:', suggestion.action);
    // Could emit a navigate event here if needed
  } else if (suggestion.action.kind === 'resource') {
    // Open resource in new tab (or same tab based on openIn)
    const openInNewTab = suggestion.action.openIn !== 'same_tab';
    if (openInNewTab) {
      window.open(suggestion.action.url, '_blank');
    } else {
      window.location.href = suggestion.action.url;
    }
  }
  // Emit the event for parent components to handle if needed
  emit('suggestionClick', suggestion);
}

const messagesContainerRef = ref<HTMLElement | null>(null);
const inputValue = ref('');

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
  { deep: true }
);

watch(
  () => props.messages[props.messages.length - 1]?.content,
  () => {
    if (props.isStreaming) {
      nextTick(() => {
        scrollToBottom();
      });
    }
  }
);

function scrollToBottom() {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
  }
}

function handleSubmit(message: string) {
  emit('submit', message);
}

function handleStop() {
  emit('stop');
}

function handleLiveVoiceToggle() {
  emit('live-voice-toggle');
}

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background-color: white;
  border-radius: 0.5rem;
  overflow: hidden;
}

.chat-container[dir="rtl"] {
  direction: rtl;
}

.chat-container__messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  scroll-behavior: smooth;
}

.chat-container__messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-container__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(107, 114, 128, 1);
}

.chat-container__empty-text {
  font-size: 0.875rem;
  font-style: italic;
}

.chat-container__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: rgba(254, 242, 242, 1);
  color: rgba(220, 38, 38, 1);
  font-size: 0.875rem;
  border-top: 1px solid rgba(229, 231, 235, 1);
}

.chat-container__error-icon {
  font-size: 1rem;
}

.chat-container__error-text {
  flex: 1;
}

/* Transition animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>


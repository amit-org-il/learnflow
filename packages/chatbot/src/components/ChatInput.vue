<template>
  <div class="chat-input" :dir="rtl ? 'rtl' : 'ltr'">
    <div class="chat-input__form">
      <!-- Live Voice Button (Gemini Live only - far left, external side) -->
      <LiveVoiceButton
        v-if="isGeminiLive"
        :is-recording="isLiveVoiceRecording"
        :is-initializing="isLiveVoiceInitializing"
        :volume-level="liveVoiceVolume"
        :disabled="disabled"
        @toggle="handleLiveVoiceToggle"
      />

      <div class="chat-input__input-wrapper">
        <input
          v-model="inputValue"
          type="text"
          :disabled="disabled"
          :placeholder="placeholder"
          class="chat-input__input"
          @keyup.enter="handleSubmit"
        />
      </div>

      <!-- Stop Button (when avatar is speaking) -->
      <button
        v-if="isSpeaking"
        class="chat-input__stop-btn"
        @click="handleStopClick"
        aria-label="Stop avatar speaking"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="chat-input__stop-icon"
        >
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>

      <!-- Voice/Mic Button (when avatar is NOT speaking) -->
      <button
        v-else
        class="chat-input__voice-btn"
        :disabled="disabled"
        @click="handleVoiceClick"
      >
        <svg
          v-if="!isListening"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="chat-input__voice-icon"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="chat-input__voice-icon chat-input__voice-icon--listening"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import LiveVoiceButton from './LiveVoiceButton.vue';

interface Props {
  modelValue: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  rtl?: boolean;
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
  (e: 'update:modelValue', value: string): void;
  (e: 'submit', value: string): void;
  (e: 'voice-toggle', value: boolean): void;
  /** Emitted when stop button is clicked to interrupt avatar */
  (e: 'stop'): void;
  /** Emitted when live voice button is toggled */
  (e: 'live-voice-toggle'): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false,
  placeholder: 'Type your message...',
  rtl: false,
  isSpeaking: false,
  isGeminiLive: false,
  isLiveVoiceRecording: false,
  isLiveVoiceInitializing: false,
  liveVoiceVolume: 0,
});

const emit = defineEmits<Emits>();

const inputValue = ref(props.modelValue);
const isListening = ref(false);

// Speech recognition using Web Speech API
const recognitionLang = computed(() => {
  return props.rtl ? 'he-IL' : 'en-US';
});

// TypeScript types for Web Speech API
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

let recognition: SpeechRecognition | null = null;
if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
  const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognitionConstructor() as SpeechRecognition;
  recognition.lang = recognitionLang.value;
  recognition.continuous = false;
  recognition.interimResults = false;
  
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const text = event.results[0][0].transcript;
    inputValue.value = text;
    handleSubmit();
    isListening.value = false;
  };
  
  recognition.onend = () => {
    isListening.value = false;
  };
  
  recognition.onerror = () => {
    isListening.value = false;
  };
}

watch(() => props.modelValue, (newValue) => {
  inputValue.value = newValue;
});

watch(inputValue, (newValue) => {
  emit('update:modelValue', newValue);
});

function handleSubmit() {
  if (!inputValue.value.trim() || props.disabled) return;
  
  const message = inputValue.value.trim();
  emit('submit', message);
  inputValue.value = '';
}

function handleVoiceClick() {
  if (!recognition) {
    console.warn('Speech recognition not supported in this browser');
    return;
  }

  if (isListening.value) {
    recognition.stop();
    isListening.value = false;
  } else {
    recognition.lang = recognitionLang.value;
    recognition.start();
    isListening.value = true;
  }
  emit('voice-toggle', isListening.value);
}

function handleStopClick() {
  console.log('[ChatInput] Stop button clicked');
  emit('stop');
}

function handleLiveVoiceToggle() {
  console.log('[ChatInput] Live voice toggle clicked');
  emit('live-voice-toggle');
}
</script>

<style scoped>
.chat-input {
  border-top: 1px solid rgba(229, 231, 235, 1);
  padding: 1rem;
  background-color: white;
  height: 4rem;
  display: flex;
  align-items: center;
}

.chat-input__form {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 2.5rem;
}

.chat-input__input-wrapper {
  flex: 1;
  position: relative;
  width: 100%;
}

.chat-input__input {
  width: 100%;
  height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid rgba(209, 213, 219, 1);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s;
  background-color: rgba(243, 244, 246, 0.5);
}

.chat-input__input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 1);
  background-color: white;
}

.chat-input__input:disabled {
  background-color: rgba(243, 244, 246, 1);
  cursor: not-allowed;
  opacity: 0.6;
}

.chat-input__voice-btn {
  height: 2.5rem;
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(59, 130, 246, 1);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.chat-input__voice-btn:hover:not(:disabled) {
  background-color: rgba(37, 99, 235, 1);
}

.chat-input__voice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stop button - red square when avatar is speaking */
.chat-input__stop-btn {
  height: 2.5rem;
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(220, 38, 38, 1);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
  animation: pulse-stop 1.5s ease-in-out infinite;
}

.chat-input__stop-btn:hover {
  background-color: rgba(185, 28, 28, 1);
}

.chat-input__stop-icon {
  width: 1rem;
  height: 1rem;
}

@keyframes pulse-stop {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
  }
}

.chat-input__voice-icon {
  stroke: currentColor;
  width: 1rem;
  height: 1rem;
}

.chat-input__voice-icon--listening {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  75%, 100% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}
</style>


/**
 * useStreamingText Composable
 *
 * Manages streaming text state for Gemini Live responses.
 * Handles text chunks, cursor animation, and message ordering.
 *
 * Features:
 * - Chunk ordering protection (detects message change mid-stream)
 * - Max length protection (trims old chunks to prevent unbounded growth)
 * - RTL language support
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { GeminiSpeakMessage, SpeakMessage } from '../types/avatar-websocket';

// Maximum number of chunks to prevent unbounded growth
const MAX_CHUNKS = 10000;

// RTL languages list
const RTL_LANGUAGES = ['he', 'ar', 'fa', 'ur', 'yi'];

export interface UseStreamingTextOptions {
  /** Default text direction if language is not specified */
  defaultDir?: 'ltr' | 'rtl' | 'auto';
  /** Maximum number of chunks to keep (default: 10000) */
  maxChunks?: number;
  /** Callback when text is cleared */
  onClear?: () => void;
  /** Callback when message changes mid-stream */
  onMessageChange?: (oldId: string | null, newId: string) => void;
}

export interface UseStreamingTextReturn {
  // State
  textChunks: Ref<string[]>;
  isStreaming: Ref<boolean>;
  currentMessageId: Ref<string | null>;
  displayText: ComputedRef<string>;
  hasContent: ComputedRef<boolean>;

  // Text direction
  textDirection: ComputedRef<'ltr' | 'rtl' | 'auto'>;
  setLanguage: (language: string) => void;

  // Actions
  handleGeminiText: (message: GeminiSpeakMessage) => void;
  handleSpeakMessage: (message: SpeakMessage) => void;
  clearText: () => void;
  reset: () => void;
}

export function useStreamingText(options: UseStreamingTextOptions = {}): UseStreamingTextReturn {
  const {
    defaultDir = 'auto',
    maxChunks = MAX_CHUNKS,
    onClear,
    onMessageChange,
  } = options;

  // ========================================
  // STATE
  // ========================================

  const textChunks = ref<string[]>([]);
  const isStreaming = ref(false);
  const currentMessageId = ref<string | null>(null);
  const language = ref<string>('');

  // ========================================
  // COMPUTED
  // ========================================

  const displayText = computed(() => textChunks.value.join(''));

  const hasContent = computed(() => textChunks.value.length > 0);

  const textDirection = computed((): 'ltr' | 'rtl' | 'auto' => {
    if (language.value && RTL_LANGUAGES.includes(language.value.toLowerCase().substring(0, 2))) {
      return 'rtl';
    }
    return defaultDir;
  });

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Handle a Gemini Live speak message with text_chunk
   */
  function handleGeminiText(message: GeminiSpeakMessage): void {
    // Chunk ordering protection - detect message change mid-stream
    if (message.message_id !== currentMessageId.value) {
      if (currentMessageId.value && isStreaming.value) {
        console.warn('[useStreamingText] Message changed while streaming, clearing previous chunks');
        onMessageChange?.(currentMessageId.value, message.message_id);
      }
      textChunks.value = [];
      currentMessageId.value = message.message_id;
    }

    // Append text chunk
    if (message.text_chunk) {
      textChunks.value.push(message.text_chunk);
      isStreaming.value = true;

      // Max length protection - trim old chunks if array grows too large
      if (textChunks.value.length > maxChunks) {
        console.warn(`[useStreamingText] Chunk limit exceeded, trimming to last ${maxChunks}`);
        textChunks.value = textChunks.value.slice(-maxChunks);
      }
    }

    // Final chunk
    if (message.is_final) {
      isStreaming.value = false;
    }
  }

  /**
   * Handle any speak message - filters for gemini-live provider
   */
  function handleSpeakMessage(message: SpeakMessage): void {
    if (message.provider === 'gemini-live') {
      handleGeminiText(message as GeminiSpeakMessage);
    }
    // Azure TTS messages don't have streaming text chunks
  }

  /**
   * Clear all text chunks (e.g., user interrupt or explicit clear)
   */
  function clearText(): void {
    textChunks.value = [];
    isStreaming.value = false;
    currentMessageId.value = null;
    onClear?.();
  }

  /**
   * Reset to initial state (keeps language)
   */
  function reset(): void {
    textChunks.value = [];
    isStreaming.value = false;
    currentMessageId.value = null;
  }

  /**
   * Set language for text direction detection
   */
  function setLanguage(lang: string): void {
    language.value = lang;
  }

  // ========================================
  // RETURN
  // ========================================

  return {
    // State
    textChunks,
    isStreaming,
    currentMessageId,
    displayText,
    hasContent,

    // Text direction
    textDirection,
    setLanguage,

    // Actions
    handleGeminiText,
    handleSpeakMessage,
    clearText,
    reset,
  };
}

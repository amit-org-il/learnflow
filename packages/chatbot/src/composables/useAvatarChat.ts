import { ref, computed, type ComputedRef } from 'vue';
import { getApiBaseUrl } from '../config/api';
import type { BotConfig } from './useBot';

/**
 * Chat session response from POST /chats
 */
export interface ChatSession {
  chatId: string;
  bot: BotConfig;
  isResumed: boolean;
}

/**
 * Parameters for creating a chat session
 */
export interface CreateChatParams {
  botId: string;
  courseId?: string;
  lessonId?: string;
  pageId?: string;
}

/**
 * Session storage keys
 */
const STORAGE_KEYS = {
  CHAT_ID: 'avatar_chatId',
  BOT_ID: 'avatar_botId',
  COURSE_ID: 'avatar_courseId',
  LESSON_ID: 'avatar_lessonId',
  PAGE_ID: 'avatar_pageId',
} as const;

export interface UseAvatarChatOptions {
  /** Base URL for API (default: from getApiBaseUrl()) */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Use sessionStorage to persist chatId (default: true) */
  persistSession?: boolean;
}

export interface UseAvatarChatReturn {
  /** Current chat session ID */
  chatId: ComputedRef<string | null>;
  /** Whether this is a resumed session */
  isResumed: ComputedRef<boolean>;
  /** Loading state */
  loading: ComputedRef<boolean>;
  /** Error message */
  error: ComputedRef<string | null>;
  /** Create or resume a chat session */
  createChat: (params: CreateChatParams) => Promise<string | null>;
  /** Clear the current session */
  clearSession: () => void;
  /** Get stored session context */
  getStoredContext: () => CreateChatParams | null;
}

/**
 * Composable for managing avatar chat sessions
 *
 * Handles the POST /chats API call to create or resume sessions.
 * Sessions are stored in sessionStorage (clears on tab close).
 *
 * @example
 * ```ts
 * const { chatId, createChat, clearSession } = useAvatarChat();
 *
 * // Create new session
 * const id = await createChat({
 *   botId: 'my-bot',
 *   courseId: 'course-123',
 *   lessonId: 'lesson-456'
 * });
 *
 * // Connect Socket.IO with chatId
 * socket = io(url, { query: { chatId: id } });
 * ```
 */
export function useAvatarChat(options: UseAvatarChatOptions = {}): UseAvatarChatReturn {
  const {
    baseUrl = getApiBaseUrl(),
    timeout = 10000,
    persistSession = true,
  } = options;

  // State
  const chatId = ref<string | null>(null);
  const isResumed = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Restore session from sessionStorage
   */
  function restoreSession(): void {
    if (!persistSession || typeof sessionStorage === 'undefined') return;

    const storedChatId = sessionStorage.getItem(STORAGE_KEYS.CHAT_ID);
    if (storedChatId) {
      chatId.value = storedChatId;
      isResumed.value = true;
      console.log('[useAvatarChat] Restored session:', storedChatId);
    }
  }

  /**
   * Save session to sessionStorage
   */
  function saveSession(id: string, params: CreateChatParams): void {
    if (!persistSession || typeof sessionStorage === 'undefined') return;

    sessionStorage.setItem(STORAGE_KEYS.CHAT_ID, id);
    sessionStorage.setItem(STORAGE_KEYS.BOT_ID, params.botId);
    if (params.courseId) sessionStorage.setItem(STORAGE_KEYS.COURSE_ID, params.courseId);
    if (params.lessonId) sessionStorage.setItem(STORAGE_KEYS.LESSON_ID, params.lessonId);
    if (params.pageId) sessionStorage.setItem(STORAGE_KEYS.PAGE_ID, params.pageId);
  }

  /**
   * Get stored session context
   */
  function getStoredContext(): CreateChatParams | null {
    if (typeof sessionStorage === 'undefined') return null;

    const botId = sessionStorage.getItem(STORAGE_KEYS.BOT_ID);
    if (!botId) return null;

    return {
      botId,
      courseId: sessionStorage.getItem(STORAGE_KEYS.COURSE_ID) || undefined,
      lessonId: sessionStorage.getItem(STORAGE_KEYS.LESSON_ID) || undefined,
      pageId: sessionStorage.getItem(STORAGE_KEYS.PAGE_ID) || undefined,
    };
  }

  /**
   * Create or resume a chat session
   */
  async function createChat(params: CreateChatParams): Promise<string | null> {
    loading.value = true;
    error.value = null;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to create chat session: ${response.status} ${response.statusText}`);
      }

      const data: ChatSession = await response.json();

      chatId.value = data.chatId;
      isResumed.value = data.isResumed;

      // Store in sessionStorage
      saveSession(data.chatId, params);

      console.log('[useAvatarChat] Session created:', data.chatId, data.isResumed ? '(resumed)' : '(new)');
      return data.chatId;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          error.value = 'Request timeout - check network connection';
        } else {
          error.value = err.message;
        }
      } else {
        error.value = 'Failed to create chat session';
      }
      console.error('[useAvatarChat] Error:', error.value);
      return null;
    } finally {
      clearTimeout(timeoutId);
      loading.value = false;
    }
  }

  /**
   * Clear the current session
   */
  function clearSession(): void {
    chatId.value = null;
    isResumed.value = false;

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEYS.CHAT_ID);
      sessionStorage.removeItem(STORAGE_KEYS.BOT_ID);
      sessionStorage.removeItem(STORAGE_KEYS.COURSE_ID);
      sessionStorage.removeItem(STORAGE_KEYS.LESSON_ID);
      sessionStorage.removeItem(STORAGE_KEYS.PAGE_ID);
    }

    console.log('[useAvatarChat] Session cleared');
  }

  // Restore session on initialization
  restoreSession();

  return {
    chatId: computed(() => chatId.value),
    isResumed: computed(() => isResumed.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    createChat,
    clearSession,
    getStoredContext,
  };
}

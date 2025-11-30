import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { getApiBaseUrl } from '../config/api';
import type { ViewType } from '../types/avatar';

/**
 * Bot configuration from backend API
 * Matches the backend's bot model structure
 */
export interface BotConfig {
  bot_id: string;
  name: string;
  language: string;
  /** CRITICAL: Must check this before showing avatar */
  supportedResponseTypes: ('text' | 'audio' | 'avatar')[];
  image?: string;
  welcome_message?: string;
  avatar: {
    glb_url: string;
    gender: 'male' | 'female';
    background: string;
    camera_view: ViewType;
    initial_mood: string;
    lighting_preset: string;
  };
  tts: {
    provider: 'azure' | 'gemini-live';
    voice_id: string;
    locale: string;
    speaking_rate: number;
  };
}

export interface UseBotOptions {
  /** Base URL for API (default: from getApiBaseUrl()) */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Fetch immediately on creation (default: true) */
  immediate?: boolean;
}

export interface UseBotReturn {
  /** Bot configuration (null if not loaded) */
  bot: ComputedRef<BotConfig | null>;
  /** Loading state */
  loading: ComputedRef<boolean>;
  /** Error message (null if no error) */
  error: ComputedRef<string | null>;
  /** Whether avatar is supported by this bot */
  supportsAvatar: ComputedRef<boolean>;
  /** Manually refetch bot configuration */
  refetch: () => Promise<void>;
}

/**
 * Composable for fetching and managing bot configuration
 *
 * @param botId - Bot ID (string or getter function for reactivity)
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * // Simple usage
 * const { bot, loading, error } = useBot('my-bot-id');
 *
 * // Reactive bot ID
 * const { bot } = useBot(() => props.botId);
 *
 * // With options
 * const { bot, refetch } = useBot('my-bot-id', {
 *   timeout: 5000,
 *   immediate: false
 * });
 * ```
 */
export function useBot(
  botId: string | (() => string | undefined) | Ref<string | undefined>,
  options: UseBotOptions = {}
): UseBotReturn {
  const {
    baseUrl = getApiBaseUrl(),
    timeout = 10000,
    immediate = true,
  } = options;

  // State
  const bot = ref<BotConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Fetch bot configuration from API
   */
  async function fetchBot(id: string): Promise<void> {
    if (!id) {
      error.value = 'Bot ID is required';
      return;
    }

    loading.value = true;
    error.value = null;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/bots/${id}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Bot not found: ${id}`);
        }
        throw new Error(`Failed to fetch bot: ${response.status} ${response.statusText}`);
      }

      bot.value = await response.json();
      console.log('[useBot] Loaded bot config:', bot.value?.name);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          error.value = 'Request timeout - check network connection';
        } else {
          error.value = err.message;
        }
      } else {
        error.value = 'Failed to fetch bot configuration';
      }
      bot.value = null;
      console.error('[useBot] Error:', error.value);
    } finally {
      clearTimeout(timeoutId);
      loading.value = false;
    }
  }

  /**
   * Get resolved bot ID from various input types
   */
  function getResolvedBotId(): string | undefined {
    if (typeof botId === 'function') {
      return botId();
    }
    if (typeof botId === 'object' && 'value' in botId) {
      return botId.value;
    }
    return botId;
  }

  /**
   * Refetch bot configuration
   */
  async function refetch(): Promise<void> {
    const id = getResolvedBotId();
    if (id) {
      await fetchBot(id);
    }
  }

  // Initial fetch
  if (immediate) {
    const id = getResolvedBotId();
    if (id) {
      fetchBot(id);
    }
  }

  // Watch for botId changes (if reactive)
  if (typeof botId === 'function') {
    watch(botId, (newId) => {
      if (newId) {
        fetchBot(newId);
      } else {
        bot.value = null;
        error.value = null;
      }
    });
  } else if (typeof botId === 'object' && 'value' in botId) {
    watch(botId, (newId) => {
      if (newId) {
        fetchBot(newId);
      } else {
        bot.value = null;
        error.value = null;
      }
    });
  }

  // Computed: check if bot supports avatar response type
  const supportsAvatar = computed(() => {
    if (!bot.value) return false;
    return bot.value.supportedResponseTypes?.includes('avatar') ?? false;
  });

  return {
    bot: computed(() => bot.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    supportsAvatar,
    refetch,
  };
}

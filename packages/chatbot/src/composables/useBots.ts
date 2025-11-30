import { ref, onMounted, type Ref, type ComputedRef, computed } from 'vue';
import { getApiBaseUrl } from '../config/api';

/**
 * Summary info for a bot (used in bot listing)
 * This is a lighter version of BotConfig for listing purposes
 */
export interface BotSummary {
  bot_id: string;
  name: string;
  language: string;
  tts_provider: 'azure' | 'gemini-live';
  supportedResponseTypes: ('text' | 'audio' | 'avatar')[];
}

export interface UseBotsOptions {
  /** Base URL for API (default: from getApiBaseUrl()) */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Fetch immediately on creation (default: true) */
  immediate?: boolean;
  /** Initial bot ID to select (default: 'default') */
  initialBotId?: string;
}

export interface UseBotsReturn {
  /** List of available bots */
  bots: Ref<BotSummary[]>;
  /** Loading state */
  loading: ComputedRef<boolean>;
  /** Error message (null if no error) */
  error: ComputedRef<string | null>;
  /** Currently selected bot ID */
  selectedBotId: Ref<string>;
  /** Select a bot by ID */
  selectBot: (botId: string) => void;
  /** Manually refetch bot list */
  fetchBots: () => Promise<void>;
}

/**
 * Composable for fetching and managing available bots
 *
 * @remarks
 * **DEMO ONLY** - This is for demo/testing purposes only.
 * In production (Learnflow LMS), the `bot_id` comes from the LMS context.
 * Users don't manually select bots in production.
 *
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * // Simple usage
 * const { bots, selectedBotId, selectBot } = useBots();
 *
 * // With custom options
 * const { bots, fetchBots } = useBots({
 *   baseUrl: 'http://localhost:8001',
 *   initialBotId: 'female-en'
 * });
 * ```
 */
export function useBots(options: UseBotsOptions = {}): UseBotsReturn {
  const {
    baseUrl = getApiBaseUrl(),
    timeout = 10000,
    immediate = true,
    initialBotId = 'default',
  } = options;

  // State
  const bots = ref<BotSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedBotId = ref<string>(initialBotId);

  /**
   * Fetch available bots from API
   */
  async function fetchBots(): Promise<void> {
    loading.value = true;
    error.value = null;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/bots`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bots: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Map API response to BotSummary format
      bots.value = data.map((bot: any) => ({
        bot_id: bot.bot_id,
        name: bot.name,
        language: bot.language,
        tts_provider: bot.tts?.provider || 'azure',
        supportedResponseTypes: bot.supportedResponseTypes || ['text'],
      }));

      console.log('[useBots] Loaded', bots.value.length, 'bots');

      // Restore from sessionStorage if available
      const storedBotId = sessionStorage.getItem('selectedBotId');
      if (storedBotId && bots.value.some(b => b.bot_id === storedBotId)) {
        selectedBotId.value = storedBotId;
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          error.value = 'Request timeout - check backend connection';
        } else {
          error.value = err.message;
        }
      } else {
        error.value = 'Failed to fetch bots';
      }
      console.error('[useBots] Error:', error.value);
    } finally {
      clearTimeout(timeoutId);
      loading.value = false;
    }
  }

  /**
   * Select a bot by ID
   * @param botId - Bot ID to select
   */
  function selectBot(botId: string): void {
    selectedBotId.value = botId;
    // Persist to sessionStorage for page refresh
    sessionStorage.setItem('selectedBotId', botId);
    console.log('[useBots] Selected bot:', botId);
  }

  // Initial fetch
  if (immediate) {
    onMounted(() => {
      fetchBots();
    });
  }

  return {
    bots,
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    selectedBotId,
    selectBot,
    fetchBots,
  };
}

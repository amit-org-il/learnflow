<template>
  <div class="bot-selector" data-testid="bot-selector">
    <!-- DEMO ONLY NOTICE -->
    <div
      class="bot-selector__demo-notice"
      title="Demo mode: In production, bot is selected automatically from LMS context"
    >
      Demo Only
    </div>

    <label for="bot-select" class="bot-selector__label">
      Select Bot
    </label>

    <select
      id="bot-select"
      v-model="internalSelectedBotId"
      @change="onBotChange"
      class="bot-selector__dropdown"
      :disabled="loading"
      title="Demo mode: In production, bot is selected automatically from LMS context"
      data-testid="bot-select-dropdown"
    >
      <option value="" disabled>-- Select a bot --</option>
      <option
        v-for="bot in bots"
        :key="bot.bot_id"
        :value="bot.bot_id"
      >
        {{ bot.name }} ({{ bot.language.toUpperCase() }}) - {{ getProviderLabel(bot.tts_provider) }}
      </option>
    </select>

    <span v-if="loading" class="bot-selector__loading">Loading bots...</span>
    <span v-if="error" class="bot-selector__error">{{ error }}</span>

    <!-- Tooltip for Alex @ 200apps -->
    <p class="bot-selector__tooltip">
      Demo mode: In production, bot is selected automatically from LMS context
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useBots, type BotSummary } from '../composables/useBots';

interface Props {
  /** Initial bot ID to select */
  initialBotId?: string;
  /** Backend URL (optional, uses default if not provided) */
  backendUrl?: string;
}

interface Emits {
  (e: 'bot-changed', botId: string): void;
  (e: 'bot-loaded', bot: BotSummary): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialBotId: 'default',
  backendUrl: undefined,
});

const emit = defineEmits<Emits>();

// Initialize useBots composable
const { bots, loading, error, selectedBotId, selectBot, fetchBots } = useBots({
  baseUrl: props.backendUrl,
  initialBotId: props.initialBotId,
});

// Local state for v-model binding
const internalSelectedBotId = ref(props.initialBotId);

// Sync with composable's selectedBotId
watch(selectedBotId, (newId) => {
  internalSelectedBotId.value = newId;
});

// Handle bot selection change
function onBotChange(): void {
  const botId = internalSelectedBotId.value;
  selectBot(botId);
  emit('bot-changed', botId);

  // Find and emit the selected bot details
  const selectedBot = bots.value.find(b => b.bot_id === botId);
  if (selectedBot) {
    emit('bot-loaded', selectedBot);
  }
}

// Helper to format provider label
function getProviderLabel(provider: string): string {
  switch (provider) {
    case 'azure':
      return 'Azure TTS';
    case 'gemini-live':
      return 'Gemini Live';
    default:
      return provider;
  }
}

// Fetch bots on mount (immediate is already true in useBots)
onMounted(async () => {
  // If bots are already loaded, emit initial selection
  if (bots.value.length > 0) {
    const initialBot = bots.value.find(b => b.bot_id === internalSelectedBotId.value);
    if (initialBot) {
      emit('bot-loaded', initialBot);
    }
  }
});

// Watch for bots loading to emit initial selection
watch(bots, (newBots) => {
  if (newBots.length > 0 && internalSelectedBotId.value) {
    const initialBot = newBots.find(b => b.bot_id === internalSelectedBotId.value);
    if (initialBot) {
      emit('bot-loaded', initialBot);
    }
  }
}, { once: true });
</script>

<style scoped>
.bot-selector {
  background: white;
  border: 1px solid rgba(229, 231, 235, 1);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.bot-selector__demo-notice {
  background: #fef3c7;
  color: #92400e;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 0.75rem;
  display: inline-block;
  cursor: help;
}

.bot-selector__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(17, 24, 39, 1);
  margin-bottom: 0.5rem;
}

.bot-selector__dropdown {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(209, 213, 219, 1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.bot-selector__dropdown:hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.5);
}

.bot-selector__dropdown:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 1);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.bot-selector__dropdown:disabled {
  background: rgba(249, 250, 251, 1);
  cursor: not-allowed;
  opacity: 0.7;
}

.bot-selector__loading {
  display: block;
  font-size: 0.75rem;
  color: rgba(107, 114, 128, 1);
  margin-top: 0.5rem;
}

.bot-selector__error {
  display: block;
  font-size: 0.75rem;
  color: rgba(220, 38, 38, 1);
  margin-top: 0.5rem;
}

.bot-selector__tooltip {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
  margin-top: 0.5rem;
  margin-bottom: 0;
}
</style>

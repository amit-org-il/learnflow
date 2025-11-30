<template>
  <div class="avatar-demo">
    <Splitter style="height: 100%; flex: 1; min-height: 0;" class="avatar-demo__splitter">
      <!-- Config Panel (Left) -->
      <SplitterPanel :size="30" :minSize="20" class="avatar-demo__config-panel">
        <div class="avatar-demo__config">
          <!-- Connection Status -->
          <div
            class="avatar-demo__connection-result"
            :class="{
              'avatar-demo__connection-result--success': connectionStatus === 'connected',
              'avatar-demo__connection-result--error': connectionStatus === 'error',
              'avatar-demo__connection-result--pending': connectionStatus === 'connecting' || connectionStatus === 'disconnected'
            }"
          >
            <span v-if="connectionStatus === 'connected'">Connected to backend</span>
            <span v-else-if="connectionStatus === 'error'">{{ connectionError || 'Connection failed' }}</span>
            <span v-else-if="connectionStatus === 'connecting'">Connecting...</span>
            <span v-else>Disconnected</span>
          </div>

          <!-- Bot Selector (DEMO ONLY) -->
          <BotSelector
            :initial-bot-id="selectedBotId"
            :backend-url="backendUrl"
            @bot-changed="handleBotChanged"
            @bot-loaded="handleBotLoaded"
          />

          <!-- Configuration Section -->
          <div class="avatar-demo__config-section">
            <h2 class="avatar-demo__config-title">Configuration</h2>

            <div class="avatar-demo__config-field">
              <label class="avatar-demo__label">Backend URL</label>
              <input
                v-model="backendUrl"
                type="text"
                placeholder="http://localhost:8001"
                class="avatar-demo__input"
              />
            </div>

            <div class="avatar-demo__config-field">
              <label class="avatar-demo__label">Chat ID</label>
              <input
                v-model="chatId"
                type="text"
                placeholder="Auto-generated"
                class="avatar-demo__input"
                readonly
              />
            </div>
          </div>

          <!-- Bot Details Section (Collapsed by default) -->
          <div class="avatar-demo__config-section mt-4">
            <div class="avatar-demo__collapsible-header" @click="botDetailsExpanded = !botDetailsExpanded">
              <h3 class="avatar-demo__config-subtitle">
                <span :style="{ transform: botDetailsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }">&#9654;</span>
                Bot Details
              </h3>
            </div>
            <div v-show="botDetailsExpanded" class="avatar-demo__collapsible-content">
              <div v-if="currentBot" class="avatar-demo__bot-details">
                <p><strong>ID:</strong> {{ currentBot.bot_id }}</p>
                <p><strong>Name:</strong> {{ currentBot.name }}</p>
                <p><strong>Language:</strong> {{ currentBot.language }}</p>
                <p><strong>TTS Provider:</strong> {{ currentBot.tts?.provider }}</p>
                <p><strong>Voice:</strong> {{ currentBot.tts?.voice_id }}</p>
                <p><strong>Speaking Rate:</strong> {{ currentBot.tts?.speaking_rate }}x</p>
                <p><strong>Avatar Gender:</strong> {{ currentBot.avatar?.gender }}</p>
              </div>
              <div v-else class="avatar-demo__bot-details--empty">
                Select a bot to see details
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="avatar-demo__config-actions mt-4">
            <Button
              @click="createNewSession"
              label="New Session"
              severity="primary"
              size="small"
              :loading="isCreatingSession"
            />
            <Button
              @click="testBackend"
              label="Test Connection"
              severity="secondary"
              size="small"
            />
          </div>

          <!-- Test Messages -->
          <div class="avatar-demo__config-section mt-4">
            <h3 class="avatar-demo__config-subtitle">Test Messages</h3>
            <div class="avatar-demo__test-input">
              <input
                v-model="testMessage"
                type="text"
                placeholder="Type a message to test..."
                class="avatar-demo__input"
                @keyup.enter="sendTestMessage"
              />
              <Button
                @click="sendTestMessage"
                label="Send"
                severity="secondary"
                size="small"
                :disabled="!testMessage.trim() || !chatId"
              />
            </div>
          </div>
        </div>
      </SplitterPanel>

      <!-- Avatar Panel (Right) -->
      <SplitterPanel :size="70" :minSize="40" class="avatar-demo__avatar-panel">
        <div class="avatar-demo__avatar-wrapper">
          <!-- Avatar Container -->
          <div v-if="currentBot && chatId" class="avatar-demo__avatar-container">
            <AvatarContainer
              :key="avatarKey"
              :backend-url="backendUrl"
              :chat-id="chatId"
              :model-url="currentBot.avatar?.glb_url || ''"
              :gender="(currentBot.avatar?.gender as 'male' | 'female') || 'female'"
              :provider="(currentBot.tts?.provider as 'azure' | 'gemini-live') || 'azure'"
              :voice-config="voiceConfig"
              :background="currentBot.avatar?.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'"
              @ready="handleAvatarReady"
              @speaking-start="handleSpeakingStart"
              @speaking-end="handleSpeakingEnd"
              @error="handleAvatarError"
              @fallback="handleAvatarFallback"
            />
          </div>

          <!-- Placeholder when no bot selected -->
          <div v-else class="avatar-demo__avatar-placeholder">
            <div class="avatar-demo__avatar-placeholder-content">
              <span class="avatar-demo__avatar-placeholder-icon">&#129302;</span>
              <h3>Select a Bot</h3>
              <p>Choose a bot from the dropdown to load the avatar.</p>
            </div>
          </div>

          <!-- Status Bar -->
          <div class="avatar-demo__status-bar">
            <span :class="['avatar-demo__status-indicator', avatarStatus]">
              {{ avatarStatusText }}
            </span>
            <span v-if="isSpeaking" class="avatar-demo__speaking-indicator">
              Speaking...
            </span>
          </div>
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import Button from 'primevue/button';
import {
  AvatarContainer,
  BotSelector,
} from '@amit/chatbot/components';
import { useBot, type BotSummary } from '@amit/chatbot/vue';
import type { VoiceConfig } from '@amit/chatbot/vue';

// Backend configuration
const backendUrl = ref('http://localhost:8001');
const selectedBotId = ref('default');
const chatId = ref('');
const avatarKey = ref(0); // Force re-render when bot changes

// Connection state
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
const connectionError = ref<string | null>(null);
const isCreatingSession = ref(false);

// UI state
const botDetailsExpanded = ref(false);
const testMessage = ref('');

// Avatar state
const avatarStatus = ref<'loading' | 'ready' | 'error'>('loading');
const avatarStatusText = ref('Loading...');
const isSpeaking = ref(false);

// Fetch full bot config using useBot composable
const { bot: currentBot, loading: botLoading, error: botError, refetch: refetchBot } = useBot(
  () => selectedBotId.value,
  { baseUrl: backendUrl.value, immediate: true }
);

// Compute voice config from current bot
const voiceConfig = computed<VoiceConfig>(() => ({
  voice: currentBot.value?.tts?.voice_id || 'en-US-JennyNeural',
  locale: currentBot.value?.tts?.locale || 'en-US',
  gender: currentBot.value?.avatar?.gender || 'female',
  speakingRate: currentBot.value?.tts?.speaking_rate || 1.0,
}));

// Test backend connection
async function testBackend(): Promise<void> {
  connectionStatus.value = 'connecting';
  connectionError.value = null;

  try {
    const response = await fetch(`${backendUrl.value}/health`);
    if (response.ok) {
      connectionStatus.value = 'connected';
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    connectionStatus.value = 'error';
    connectionError.value = err instanceof Error ? err.message : 'Connection failed';
  }
}

// Create new chat session
async function createNewSession(): Promise<void> {
  isCreatingSession.value = true;
  connectionError.value = null;

  try {
    const response = await fetch(`${backendUrl.value}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId: selectedBotId.value }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    chatId.value = data.chatId;
    connectionStatus.value = 'connected';

    // Force avatar re-render with new chatId
    avatarKey.value++;
    avatarStatus.value = 'loading';
    avatarStatusText.value = 'Loading...';

    console.log('[AvatarDemo] Created session:', chatId.value);
  } catch (err) {
    connectionStatus.value = 'error';
    connectionError.value = err instanceof Error ? err.message : 'Failed to create session';
    console.error('[AvatarDemo] Failed to create session:', err);
  } finally {
    isCreatingSession.value = false;
  }
}

// Handle bot selection change
async function handleBotChanged(botId: string): Promise<void> {
  console.log('[AvatarDemo] Bot changed:', botId);
  selectedBotId.value = botId;

  // Refetch full bot config
  await refetchBot();

  // Create new session with new bot
  await createNewSession();
}

// Handle bot loaded event (from BotSelector)
function handleBotLoaded(bot: BotSummary): void {
  console.log('[AvatarDemo] Bot loaded:', bot.name);
}

// Send test message via WebSocket
async function sendTestMessage(): Promise<void> {
  if (!testMessage.value.trim() || !chatId.value) return;

  console.log('[AvatarDemo] Sending test message:', testMessage.value);

  // TODO: Integrate with socket to send message
  // For now, just clear the input
  testMessage.value = '';
}

// Avatar event handlers
function handleAvatarReady(): void {
  avatarStatus.value = 'ready';
  avatarStatusText.value = 'Ready';
  console.log('[AvatarDemo] Avatar ready');
}

function handleSpeakingStart(): void {
  isSpeaking.value = true;
  console.log('[AvatarDemo] Speaking started');
}

function handleSpeakingEnd(): void {
  isSpeaking.value = false;
  console.log('[AvatarDemo] Speaking ended');
}

function handleAvatarError(error: string): void {
  avatarStatus.value = 'error';
  avatarStatusText.value = error;
  console.error('[AvatarDemo] Avatar error:', error);
}

function handleAvatarFallback(): void {
  avatarStatus.value = 'error';
  avatarStatusText.value = 'Fallback mode (no avatar)';
  console.warn('[AvatarDemo] Avatar fallback mode');
}

// Initialize on mount
onMounted(async () => {
  // Test backend connection
  await testBackend();

  // Create initial session if connected
  if (connectionStatus.value === 'connected') {
    await createNewSession();
  }
});
</script>

<style scoped>
.avatar-demo {
  padding: 1rem;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f9fafb;
}

.avatar-demo__splitter {
  height: 100%;
}

.avatar-demo__config-panel {
  overflow-y: auto;
  padding: 1rem;
}

.avatar-demo__avatar-panel {
  padding: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.avatar-demo__config {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.avatar-demo__config-section {
  background-color: white;
  border: 1px solid rgba(229, 231, 235, 1);
  border-radius: 0.5rem;
  padding: 1rem;
}

.avatar-demo__config-title {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(17, 24, 39, 1);
  margin: 0 0 1rem 0;
}

.avatar-demo__config-subtitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(17, 24, 39, 1);
  margin: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar-demo__config-field {
  margin-bottom: 1rem;
}

.avatar-demo__config-field:last-child {
  margin-bottom: 0;
}

.avatar-demo__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(17, 24, 39, 1);
  margin-bottom: 0.5rem;
}

.avatar-demo__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(209, 213, 219, 1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.avatar-demo__input:read-only {
  background: rgba(249, 250, 251, 1);
  color: rgba(107, 114, 128, 1);
}

.avatar-demo__config-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.avatar-demo__connection-result {
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.avatar-demo__connection-result--success {
  background-color: rgba(220, 252, 231, 1);
  color: rgba(22, 101, 52, 1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.avatar-demo__connection-result--error {
  background-color: rgba(254, 242, 242, 1);
  color: rgba(220, 38, 38, 1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.avatar-demo__connection-result--pending {
  background-color: rgba(249, 250, 251, 1);
  color: rgba(107, 114, 128, 1);
  border: 1px solid rgba(229, 231, 235, 1);
}

.avatar-demo__collapsible-header {
  cursor: pointer;
  padding: 0.5rem 0;
}

.avatar-demo__collapsible-content {
  margin-top: 0.5rem;
}

.avatar-demo__bot-details {
  font-size: 0.8rem;
  color: rgba(55, 65, 81, 1);
}

.avatar-demo__bot-details p {
  margin: 0.25rem 0;
}

.avatar-demo__bot-details--empty {
  font-size: 0.8rem;
  color: rgba(107, 114, 128, 1);
  font-style: italic;
}

.avatar-demo__test-input {
  display: flex;
  gap: 0.5rem;
}

.avatar-demo__test-input .avatar-demo__input {
  flex: 1;
}

/* Avatar Panel */
.avatar-demo__avatar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0.5rem;
  margin: 0.5rem;
}

.avatar-demo__avatar-container {
  flex: 1;
  min-height: 0;
}

.avatar-demo__avatar-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-demo__avatar-placeholder-content {
  text-align: center;
  color: white;
}

.avatar-demo__avatar-placeholder-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.avatar-demo__avatar-placeholder-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.avatar-demo__avatar-placeholder-content p {
  margin: 0;
  opacity: 0.8;
}

.avatar-demo__status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 0.75rem;
}

.avatar-demo__status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar-demo__status-indicator::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.avatar-demo__status-indicator.loading::before {
  background: #fbbf24;
}

.avatar-demo__status-indicator.ready::before {
  background: #34d399;
}

.avatar-demo__status-indicator.error::before {
  background: #f87171;
}

.avatar-demo__speaking-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.mt-4 {
  margin-top: 1rem;
}
</style>

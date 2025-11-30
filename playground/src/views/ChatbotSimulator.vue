<template>
  <div class="chatbot-simulator">
    <Splitter :key="`splitter-${chatbotExpanded}`" style="height: 100%; flex: 1; min-height: 0;" class="chatbot-simulator__splitter">
      <SplitterPanel :size="chatbotExpanded ? 25 : 30" :minSize="20" class="chatbot-simulator__config-panel">
        <div class="chatbot-simulator__config">
          <!-- Connection Status (Always visible at top) -->
          <div class="chatbot-simulator__connection-result" :class="{
            'chatbot-simulator__connection-result--success': isConnected,
            'chatbot-simulator__connection-result--error': !isConnected,
            'chatbot-simulator__connection-result--pending': !isConnected && !connectionResult
          }">
            <span v-if="isConnected">✓ Connected</span>
            <span v-else-if="connectionResult && !connectionResult.success">✗ {{ connectionResult.error || 'Connection failed' }}</span>
            <span v-else>○ Disconnected</span>
          </div>

          <div class="chatbot-simulator__config-section">
            <h2 class="chatbot-simulator__config-title">Configuration</h2>
            
            <div class="chatbot-simulator__config-field">
              <label class="chatbot-simulator__label">API Endpoint</label>
              <input
                v-model="config.endpoint"
                type="text"
                placeholder="https://api.example.com/chat"
                class="chatbot-simulator__input"
              />
            </div>

            <div class="chatbot-simulator__config-field">
              <label class="chatbot-simulator__label">Auth Token</label>
              <input
                v-model="config.token"
                type="password"
                placeholder="Bearer token"
                class="chatbot-simulator__input"
              />
            </div>

            <div class="chatbot-simulator__config-field">
              <label class="chatbot-simulator__label">Bot ID</label>
              <input
                v-model="config.botId"
                type="text"
                placeholder="Bot ID"
                class="chatbot-simulator__input"
              />
            </div>

            <!-- Collapsible Metadata Section -->
            <div class="chatbot-simulator__config-section mt-4">
              <div class="chatbot-simulator__collapsible-header" @click="metadataExpanded = !metadataExpanded">
                <h3 class="chatbot-simulator__config-title" style="font-size: 0.875rem; font-weight: 600; margin: 0; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                  <span :style="{ transform: metadataExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }">▶</span>
                  Metadata
                </h3>
              </div>
              <div v-show="metadataExpanded" class="chatbot-simulator__collapsible-content" style="margin-top: 0.5rem;">
                <div class="chatbot-simulator__config-field">
                  <label class="chatbot-simulator__label">Course ID</label>
                  <input
                    v-model="config.meta.courseId"
                    type="text"
                    placeholder="Course ID"
                    class="chatbot-simulator__input"
                  />
                </div>
                <div class="chatbot-simulator__config-field">
                  <label class="chatbot-simulator__label">Lesson ID</label>
                  <input
                    v-model="config.meta.lessonId"
                    type="text"
                    placeholder="Lesson ID"
                    class="chatbot-simulator__input"
                  />
                </div>
                <div class="chatbot-simulator__config-field">
                  <label class="chatbot-simulator__label">Page ID</label>
                  <input
                    v-model="config.meta.pageId"
                    type="text"
                    placeholder="Page ID"
                    class="chatbot-simulator__input"
                  />
                </div>
              </div>
            </div>

            <!-- Collapsible UI Configuration Section -->
            <div class="chatbot-simulator__config-section mt-4">
              <div class="chatbot-simulator__collapsible-header" @click="uiExpanded = !uiExpanded">
                <h3 class="chatbot-simulator__config-title" style="font-size: 0.875rem; font-weight: 600; margin: 0; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                  <span :style="{ transform: uiExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }">▶</span>
                  UI Configuration
                </h3>
              </div>
              <div v-show="uiExpanded" class="chatbot-simulator__collapsible-content" style="margin-top: 0.5rem;">
                <div class="chatbot-simulator__config-field">
                  <label class="chatbot-simulator__label">
                    <input
                      v-model="config.ui.supportsMarkdown"
                      type="checkbox"
                      class="chatbot-simulator__checkbox"
                    />
                    Supports Markdown
                  </label>
                </div>
              </div>
            </div>

            <div class="chatbot-simulator__config-actions mt-4">
              <Button @click="updateConfig" label="Update Config" severity="primary" size="small" :loading="testingConnection" />
            </div>

            <!-- Statistics Panel -->
            <div class="chatbot-simulator__stats mt-4">
              <ChatbotStats :stats="stats" @reset="resetStats" />
            </div>

            <!-- Message Injection Controls (Always Available) -->
            <div class="chatbot-simulator__config-section mt-4">
              <h3 class="chatbot-simulator__config-title">Inject Messages</h3>
              <p class="chatbot-simulator__config-note" style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">
                These buttons inject messages directly into the chat.
              </p>
              <div class="chatbot-simulator__config-actions">
                <Button @click="injectStreamMessage" label="Inject Stream" severity="secondary" size="small" />
                <Button @click="injectInstantMessage" label="Inject Instant" severity="secondary" size="small" />
                <Button @click="injectMarkdownMessage" label="Inject Markdown" severity="secondary" size="small" />
                <Button @click="injectMessageWithSuggestions" label="Inject with Suggestions" severity="secondary" size="small" />
              </div>
            </div>
            

            <div class="chatbot-simulator__config-actions mt-4">
              <Button @click="clearMessages" label="Clear Messages" severity="danger" size="small" />
            </div>
          </div>
        </div>
      </SplitterPanel>
      
      <SplitterPanel :size="chatbotExpanded ? 50 : 70" :minSize="30" class="chatbot-simulator__chat-panel">
        <!-- Main content area - always visible -->
        <div class="chatbot-simulator__dummy-content">
          <h2>Main Content Area</h2>
          <p>This is the main content area.</p>
          <p v-if="chatbotExpanded">When the chatbot is expanded, it appears in the right panel.</p>
          <p v-else>The chatbot appears as a floating window.</p>
          <p>You can add any content here - forms, data, visualizations, etc.</p>
        </div>
      </SplitterPanel>
      
      <!-- Third Panel for Expanded Chatbot (when in panel mode) -->
      <SplitterPanel v-if="chatbotExpanded" :size="25" :minSize="20" class="chatbot-simulator__chat-expanded-panel">
        <!-- FloatingChatbot in panel mode - shows header and can toggle back -->
        <FloatingChatbot
          v-model="chatbotOpen"
          :messages="displayMessages"
          :is-loading="isLoading"
          :is-streaming="isStreaming"
          :error="error"
          :custom-components="customComponents"
          :bot-info="botInfo"
          :rtl="chatRTL"
          :layout="'panel'"
          :supports-markdown="config.ui?.supportsMarkdown ?? true"
          :current-chat-id="currentChatId"
          @submit="handleSubmit"
          @rtl-change="chatRTL = $event"
          @layout-change="handleLayoutChange"
          @gemini-text="handleGeminiText"
          @azure-text="handleAzureText"
          @stop="handleStop"
        />
      </SplitterPanel>
    </Splitter>

    <!-- Floating Chatbot (when in floating mode) -->
      <FloatingChatbot
        v-if="!chatbotExpanded"
        v-model="chatbotOpen"
        :messages="displayMessages"
        :is-loading="isLoading"
        :is-streaming="isStreaming"
        :error="error"
        :custom-components="customComponents"
        :bot-info="botInfo"
        :rtl="chatRTL"
        :layout="'floating'"
        :supports-markdown="config.ui?.supportsMarkdown ?? true"
        :current-chat-id="currentChatId"
        @submit="handleSubmit"
        @rtl-change="chatRTL = $event"
        @layout-change="handleLayoutChange"
        @gemini-text="handleGeminiText"
        @azure-text="handleAzureText"
        @stop="handleStop"
      />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, toRef } from 'vue';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import Button from 'primevue/button';
import { 
  useChat, 
  WebSocketTransport
} from '@amit/chatbot/vue';
import { 
  FloatingChatbot, 
  ChatbotStats,
  ChatContainer
} from '@amit/chatbot/components';
import type { ChatbotConfig, ChatMessage, ChatTransport } from '@amit/chatbot/vue';

// Initial configuration
// NOTE: Using local avatar backend for testing avatar integration
// Change to remote backend when testing production botgen
const initialConfig: ChatbotConfig = {
  endpoint: 'http://localhost:8001', // Local avatar backend for testing
  token: '', // No token needed for local backend
  streaming: true,
  timeout: 30000,
  useWebSocket: true,
  botId: 'gemini-pirate', // Avatar-enabled bot (Captain Pete)
  meta: {
    courseId: 'test-course',
    lessonId: 'test-lesson',
    pageId: 'test-page',
  },
  ui: {
    supportsMarkdown: true,
  },
};

const config = ref<ChatbotConfig>({ ...initialConfig });
const chatRTL = ref(true); // Default to RTL
const chatbotOpen = ref(false);
const chatbotExpanded = ref(false);
const testingConnection = ref(false);
const connectionResult = ref<{ success: boolean; error?: string } | null>(null); // Stores last connection attempt result
const metadataExpanded = ref(false); // Collapsed by default
const uiExpanded = ref(false); // Collapsed by default

// Core chat interface (transport-agnostic)
const chat = useChat();

// WebSocket transport (always use WebSocket)
let wsTransport: WebSocketTransport | null = null;

// Create transport immediately (not lazy)
wsTransport = new WebSocketTransport(config.value);
setupTransportHandlers(wsTransport);

// Current transport (always WebSocket)
const currentTransport = computed<ChatTransport | undefined>(() => {
  return wsTransport;
});

// Bot info (only available from WebSocket transport) - define before watches
// Use computed that tracks the ref directly for better reactivity
const botInfo = computed(() => {
  // Access wsTransport.botInfo.value to track the ref
  return wsTransport?.botInfo?.value || null;
});

// Auto-connect ONLY on initial mount when botId is available
// Bot switching should be done via "Update Config" button, not auto-reconnect
watch(() => config.value.botId, async (botId, oldBotId) => {
  console.log('[ChatbotSimulator] botId watch triggered - botId:', botId, 'oldBotId:', oldBotId, 'wsTransport:', !!wsTransport);

  // Only auto-connect on INITIAL mount (oldBotId is undefined)
  // Don't reconnect on every keystroke - use "Update Config" button instead
  if (botId && wsTransport && oldBotId === undefined && !wsTransport.isConnected.value) {
    try {
      console.log('[ChatbotSimulator] Initial auto-connecting with botId:', botId);
      await wsTransport.connect();
      console.log('[ChatbotSimulator] Auto-connect successful');
      console.log('[ChatbotSimulator] botInfo after connect:', wsTransport.botInfo?.value);

      // Wait for reactivity to update
      await nextTick();

      // botInfo is set during connect() via createChat()
      // Add welcome message if available and no messages yet
      if (wsTransport.botInfo?.value?.welcome_message && chat.messages.value.length === 0) {
        console.log('[ChatbotSimulator] Adding welcome message after auto-connect');
        chat.addMessage('assistant', wsTransport.botInfo.value.welcome_message, {
          welcome: true,
          botId: wsTransport.botInfo.value.id,
        });
        // Auto-open chatbot if floating and closed
        if (!chatbotExpanded.value && !chatbotOpen.value) {
          console.log('[ChatbotSimulator] Auto-opening chatbot - welcome message added');
          chatbotOpen.value = true;
        }
      }
    } catch (err) {
      console.error('[ChatbotSimulator] Auto-connect failed:', err);
    }
  } else if (oldBotId !== undefined && botId !== oldBotId) {
    // Bot ID changed after initial mount - just log it, don't auto-reconnect
    // User should click "Update Config" to apply the change
    console.log('[ChatbotSimulator] BotId changed from', oldBotId, 'to', botId, '- click "Update Config" to apply');
  }
}, { immediate: true });

// Also watch for botInfo computed changes (backup watch)
watch(botInfo, (newBotInfo) => {
  console.log('[ChatbotSimulator] botInfo computed watch triggered:', newBotInfo);
  if (newBotInfo?.welcome_message && chat.messages.value.length === 0) {
    console.log('[ChatbotSimulator] Adding welcome message from computed watch:', newBotInfo.welcome_message);
    chat.addMessage('assistant', newBotInfo.welcome_message, {
      welcome: true,
      botId: newBotInfo.id,
    });
    // Auto-open chatbot if floating and closed
    if (!chatbotExpanded.value && !chatbotOpen.value) {
      console.log('[ChatbotSimulator] Auto-opening chatbot - welcome message added from computed watch');
      chatbotOpen.value = true;
    }
  }
}, { immediate: true });

// Setup transport handlers (called when transport is created)
function setupTransportHandlers(transport: ChatTransport): void {
  console.log('[ChatbotSimulator] Setting up transport handlers');
  if (transport.onStreamChunk) {
    transport.onStreamChunk((chunk: string, end: boolean, suggestions?: any) => {
      console.log('[ChatbotSimulator] Stream chunk received:', chunk, 'end:', end, 'suggestions:', suggestions);
      if (!end && chunk) {
        chat.appendStreamChunk(chunk);
      } else if (end) {
        console.log('[ChatbotSimulator] Ending stream message with suggestions:', suggestions);
        chat.endStreamingMessage(suggestions);
      }
    });
    console.log('[ChatbotSimulator] Stream chunk handler registered');
  } else {
    console.warn('[ChatbotSimulator] Transport does not support onStreamChunk');
  }
  
  if (transport.onMessage) {
    transport.onMessage((message: string, metadata?: Record<string, any>) => {
      console.log('[ChatbotSimulator] Message received:', message);
      chat.addMessage('assistant', message, metadata);
    });
  }
  
  if (transport.onError) {
    transport.onError((error: Error) => {
      console.error('[Chat] Transport error:', error);
    });
  }
}

// Watch transport changes and update chat
watch(currentTransport, (newTransport) => {
  if (newTransport) {
    setupTransportHandlers(newTransport);
  }
  chat.setTransport(newTransport);
}, { immediate: true });

// Watch for botInfo changes to trigger reactivity and add welcome message
// Watch the ref's value directly
watch(() => wsTransport?.botInfo?.value, (newBotInfo) => {
  console.log('[ChatbotSimulator] botInfo watch triggered:', newBotInfo);
  if (newBotInfo?.welcome_message && chat.messages.value.length === 0) {
    console.log('[ChatbotSimulator] Adding welcome message:', newBotInfo.welcome_message);
    chat.addMessage('assistant', newBotInfo.welcome_message, {
      welcome: true,
      botId: newBotInfo.id,
    });
    // Auto-open chatbot if floating and closed
    if (!chatbotExpanded.value && !chatbotOpen.value) {
      console.log('[ChatbotSimulator] Auto-opening chatbot - welcome message added from botInfo watch');
      chatbotOpen.value = true;
    }
  }
}, { deep: true, immediate: true });

// Expose chat state
const displayMessages = computed(() => chat.messages.value);
const isLoading = computed(() => chat.isLoading.value);
const isStreaming = computed(() => chat.isStreaming.value);
const error = computed(() => chat.error.value);
const stats = computed(() => chat.stats.value);

// Auto-open chatbot when bot sends a message (if floating and closed)
watch(
  () => displayMessages.value,
  (newMessages, oldMessages) => {
    // Check if a new assistant message was added
    if (newMessages.length > (oldMessages?.length || 0)) {
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && !chatbotExpanded.value && !chatbotOpen.value) {
        // Bot sent a message and chatbot is floating and closed - open it
        console.log('[ChatbotSimulator] Auto-opening chatbot - bot sent message');
        chatbotOpen.value = true;
      }
    }
  },
  { deep: true }
);

const isConnected = computed(() => {
  if (wsTransport) {
    return wsTransport.isConnected.value;
  }
  return false;
});

// Chat ID for avatar socket connection
const currentChatId = computed(() => {
  return wsTransport?.currentChatId || '';
});

// Custom components for markdown rendering
const customComponents = ref<Record<string, any>>({});

async function updateConfig() {
  testingConnection.value = true;
  connectionResult.value = null;

  try {
    // Update WebSocket transport config
    if (wsTransport) {
      // Always disconnect and reset session when updating config
      // This ensures a fresh connection with new botId
      if (wsTransport.isConnected.value) {
        wsTransport.disconnect();
      }

      // Reset session to clear chatId and botInfo
      // This forces createChat() to be called with new botId
      wsTransport.resetSession();

      // Update config with new values
      wsTransport.updateConfig(config.value);
      console.log('[ChatbotSimulator] Config updated, botId:', config.value.botId);

      // Connect with new config
      if (config.value.botId) {
        await wsTransport.connect();
        console.log('[ChatbotSimulator] Connected with new botInfo:', wsTransport.botInfo?.value);
        connectionResult.value = { success: true };

        // Clear existing messages for new bot
        chat.clearMessages();

        // Add welcome message for new bot if available
        if (wsTransport.botInfo?.value?.welcome_message) {
          chat.addMessage('assistant', wsTransport.botInfo.value.welcome_message, {
            welcome: true,
            botId: wsTransport.botInfo.value.id,
          });
        }
      } else {
        connectionResult.value = { success: false, error: 'Bot ID is required' };
      }
    } else {
      // Recreate transport with new config
      wsTransport = new WebSocketTransport(config.value);
      setupTransportHandlers(wsTransport);
      chat.setTransport(wsTransport);

      // Connect if botId is available
      if (config.value.botId) {
        await wsTransport.connect();
        connectionResult.value = { success: true };
      } else {
        connectionResult.value = { success: false, error: 'Bot ID is required' };
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    connectionResult.value = { success: false, error: errorMessage };
    console.error('[ChatbotSimulator] Update config failed:', err);
  } finally {
    testingConnection.value = false;
  }
}


function handleLayoutChange(layout: 'floating' | 'sidebar' | 'panel') {
  chatbotExpanded.value = layout === 'panel';
  // Auto-open when switching to panel mode
  if (layout === 'panel') {
    chatbotOpen.value = true;
  }
}

async function handleSubmit(message: string, avatarMode?: boolean) {
  if (avatarMode) {
    // Avatar mode: just add user message to display, don't send via text transport
    // (message already sent via avatar socket)
    chat.addMessage('user', message);
  } else {
    // Normal mode: send via chat (which uses transport if available)
    await chat.sendMessage(message);
  }
}

// Track if we're currently streaming a Gemini response (single session, ignore per-chunk messageIds)
let geminiStreamingActive = false;

// Handle Gemini Live text chunks - stream into chat bubble in real-time
// Note: Backend sends each chunk with a NEW messageId, so we ignore messageId and track streaming state ourselves
function handleGeminiText(data: { messageId: string; textChunk: string; isFinal: boolean }) {
  const { textChunk, isFinal } = data;

  // Start streaming message on first chunk (if not already streaming)
  if (!geminiStreamingActive && textChunk) {
    geminiStreamingActive = true;
    chat.startStreamingMessage({ source: 'gemini-live' });
    console.log('[ChatbotSimulator] Started Gemini streaming');
  }

  // Append text chunk to streaming message
  if (textChunk && geminiStreamingActive) {
    chat.appendStreamChunk(textChunk);
  }

  // End streaming when final
  if (isFinal && geminiStreamingActive) {
    geminiStreamingActive = false;
    chat.endStreamingMessage();
    console.log('[ChatbotSimulator] Ended Gemini streaming');
  }
}

// Handle Azure TTS text - add complete message to chat (not streaming, Azure sends full text)
function handleAzureText(data: { messageId: string; text: string }) {
  const { text } = data;
  if (text) {
    // addMessage expects separate arguments: (role, content, metadata, suggestions)
    chat.addMessage('assistant', text);
    console.log('[ChatbotSimulator] Added Azure text message:', text.substring(0, 50) + '...');
  }
}

// Handle stop button click - end streaming and clear typing indicator
function handleStop() {
  console.log('[ChatbotSimulator] Stop button clicked - ending streaming');
  // End any active streaming message
  if (geminiStreamingActive) {
    chat.endStreamingMessage();
    geminiStreamingActive = false;
  }
  // Also end any regular streaming that might be happening
  if (isStreaming.value) {
    chat.endStreamingMessage();
  }
}

function clearMessages() {
  chat.clearMessages();
  geminiStreamingActive = false;
}

function resetStats() {
  chat.resetStats();
}

// Message injection functions (work regardless of transport)
function injectStreamMessage() {
  // Auto-open chatbot if closed (floating mode)
  if (!chatbotExpanded.value && !chatbotOpen.value) {
    chatbotOpen.value = true;
  }
  
  const fullText = chatRTL.value 
    ? 'זהו הודעה מוזרקת עם סטרימינג. היא תופיע תו אחר תו כדי להדגים את פונקציונליות הסטרימינג.'
    : 'This is an injected streaming message. It will appear character by character to demonstrate the streaming functionality.';
  
  // Add random suggestions (or none)
  const shouldAddSuggestions = Math.random() > 0.3; // 70% chance of suggestions
  const suggestions = shouldAddSuggestions ? [
    {
      label: chatRTL.value ? 'הסבר שוב בפשטות' : 'Explain again simply',
      action: {
        kind: 'botCommand' as const,
        command: 'explain_simpler',
        prompt: chatRTL.value ? 'הסבר שוב בפשטות' : 'Explain again simply',
      },
    },
    {
      label: chatRTL.value ? 'לעבור לשיעור' : 'Go to lesson',
      action: {
        kind: 'navigate' as const,
        target: 'lesson' as const,
        courseId: config.value.meta?.courseId || '',
        lessonId: config.value.meta?.lessonId || '',
      },
    },
  ] : undefined;
  
  chat.simulateResponse(fullText, true, undefined, suggestions);
}

function injectInstantMessage() {
  chat.addMessage('assistant', 'This is an injected instant message. It appears all at once without streaming.');
}

function injectMarkdownMessage() {
  // Auto-open chatbot if closed (floating mode)
  if (!chatbotExpanded.value && !chatbotOpen.value) {
    chatbotOpen.value = true;
  }
  
  const markdownContent = chatRTL.value
    ? `# הודעת בדיקת Markdown

זוהי **הודעת בדיקה** כדי לוודא שרנדור Markdown עובד כראוי.

## תכונות שנבדקו:

- **טקסט מודגש** ו*טקסט נטוי*
- [קישורים](https://example.com)
- \`קוד בשורה\` ובלוקי קוד
- רשימות (מסודרות ולא מסודרות)

### דוגמה לבלוק קוד:

\`\`\`javascript
function test() {
  console.log("שלום, Markdown!");
}
\`\`\`

### דוגמאות לרשימות:

1. פריט ראשון
2. פריט שני
3. פריט שלישי

- פריט לא מסודר 1
- פריט לא מסודר 2
- פריט לא מסודר 3`
    : `# Markdown Test Message

This is a **test message** to verify markdown rendering works correctly.

## Features Tested:

- **Bold text** and *italic text*
- [Links](https://example.com)
- \`Inline code\` and code blocks
- Lists (ordered and unordered)

### Code Block Example:

\`\`\`javascript
function test() {
  console.log("Hello, Markdown!");
}
\`\`\`

### List Examples:

1. First item
2. Second item
3. Third item

- Unordered item 1
- Unordered item 2
- Unordered item 3

> This is a blockquote

---

**If you can see this formatted correctly, markdown rendering is working!** 🎉`;

  chat.addMessage('assistant', markdownContent);
}

function injectMessageWithSuggestions() {
  // Auto-open chatbot if closed (floating mode)
  if (!chatbotExpanded.value && !chatbotOpen.value) {
    chatbotOpen.value = true;
  }
  
  const message = chatRTL.value
    ? 'זוהי הודעה עם הצעות. לחץ על אחת מהן כדי לנסות!'
    : 'This is a message with suggestions. Click on one to try it!';
  
  const suggestions: import('@amit/chatbot/vue').Suggestion[] = [
    {
      label: chatRTL.value ? 'הסבר שוב בפשטות' : 'Explain again simply',
      action: {
        kind: 'botCommand' as const,
        command: 'explain_simpler',
        prompt: chatRTL.value ? 'הסבר שוב בפשטות' : 'Explain again simply',
      },
    },
    {
      label: chatRTL.value ? 'לעבור לשיעור' : 'Go to lesson',
      action: {
        kind: 'navigate' as const,
        target: 'lesson' as const,
        courseId: config.value.meta?.courseId || '',
        lessonId: config.value.meta?.lessonId || '',
      },
    },
    {
      label: chatRTL.value ? 'לעבור לעמוד' : 'Go to page',
      action: {
        kind: 'navigate' as const,
        target: 'page' as const,
        pageId: config.value.meta?.pageId || '',
      },
    },
    {
      label: chatRTL.value ? 'מדריך דקדוק' : 'Grammar guide',
      action: {
        kind: 'resource' as const,
        url: 'https://example.com/grammar',
        openIn: 'new_tab' as const,
      },
    },
  ];
  
  console.log('[ChatbotSimulator] Injecting message with suggestions:', suggestions);
  // Add message with suggestions directly
  const addedMessage = chat.addMessage('assistant', message, undefined, suggestions);
  console.log('[ChatbotSimulator] Message added:', addedMessage, 'suggestions:', addedMessage.suggestions);
}

onMounted(async () => {
  // Initialize transport (connection happens in watch)
  currentTransport.value;
});

onUnmounted(() => {
  if (wsTransport) {
    wsTransport.disconnect();
  }
});
</script>

<style scoped>
.chatbot-simulator {
  padding: 2rem;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chatbot-simulator__splitter {
  height: 100%;
}

.chatbot-simulator__config-panel {
  overflow-y: auto;
  padding: 1rem;
}

.chatbot-simulator__chat-panel {
  padding: 0;
  overflow: hidden;
  position: relative;
}

.chatbot-simulator__floating-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.chatbot-simulator__chat-expanded-panel {
  padding: 0 !important;
  overflow: hidden !important;
  border-left: 1px solid rgba(229, 231, 235, 1);
  position: relative !important;
  display: flex !important;
  flex-direction: column;
  height: 100% !important;
  width: 100% !important;
}

/* FloatingChatbot in panel mode should fill the panel */
.chatbot-simulator__chat-expanded-panel :deep(.floating-chatbot__window--panel) {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Force hide ANY FloatingChatbot elements when expanded panel exists - use multiple selectors for maximum compatibility */
.chatbot-simulator:has(.chatbot-simulator__chat-expanded-panel) .floating-chatbot__trigger,
.chatbot-simulator:has(.chatbot-simulator__chat-expanded-panel) .floating-chatbot__window,
.chatbot-simulator:has(.chatbot-simulator__chat-expanded-panel) .floating-chatbot,
.chatbot-simulator__chat-expanded-panel ~ .floating-chatbot,
.chatbot-simulator__chat-expanded-panel ~ * .floating-chatbot {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
}

.chatbot-simulator__dummy-content {
  padding: 2rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #6b7280;
}

.chatbot-simulator__dummy-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
}

.chatbot-simulator__dummy-content p {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.chatbot-simulator__config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chatbot-simulator__config-section {
  background-color: white;
  border: 1px solid rgba(229, 231, 235, 1);
  border-radius: 0.5rem;
  padding: 1rem;
}

.chatbot-simulator__config-title {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(17, 24, 39, 1);
  margin: 0 0 1rem 0;
}

.chatbot-simulator__config-field {
  margin-bottom: 1rem;
}

.chatbot-simulator__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(17, 24, 39, 1);
  margin-bottom: 0.5rem;
}

.chatbot-simulator__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(209, 213, 219, 1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.chatbot-simulator__checkbox {
  margin-right: 0.5rem;
}

.chatbot-simulator__config-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chatbot-simulator__connection-result {
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.chatbot-simulator__connection-result--success {
  background-color: rgba(220, 252, 231, 1);
  color: rgba(22, 101, 52, 1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.chatbot-simulator__connection-result--error {
  background-color: rgba(254, 242, 242, 1);
  color: rgba(220, 38, 38, 1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.chatbot-simulator__connection-result--pending {
  background-color: rgba(249, 250, 251, 1);
  color: rgba(107, 114, 128, 1);
  border: 1px solid rgba(229, 231, 235, 1);
}

.chatbot-simulator__stats {
  flex-shrink: 0;
}
</style>

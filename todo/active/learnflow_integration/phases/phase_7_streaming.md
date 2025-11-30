# Phase 7: Streaming Text (Gemini Live)

**Estimated Time:** 1.5 hours
**Prerequisites:** Phase 6 complete
**Priority:** P0 - Critical for Gemini Live bots

---

## Tasks

- [ ] **7.1** Create `StreamingText.vue` component (1.5 hours)

---

## Task 7.1: Create StreamingText Component

**File:** `src/components/StreamingText.vue`

**Purpose:** Displays Gemini's text response in real-time (ChatGPT-style typewriter effect) as `text_chunk` events arrive via WebSocket.

**WebSocket Event:** The component receives chunks from the `gemini_speak` Socket.IO event, which includes a `text_chunk` property.

```vue
<template>
  <div
    ref="containerRef"
    class="streaming-text"
    :class="className"
    :style="{ maxHeight: `${maxHeight}px` }"
    :dir="dir"
  >
    <!-- Text Content -->
    <div ref="textRef" class="streaming-text__content">
      {{ displayText }}
      <span v-if="isStreaming" class="streaming-text__cursor">|</span>
    </div>

    <!-- Clear Button -->
    <button
      v-if="showClearButton && !isStreaming && displayText"
      class="streaming-text__clear"
      @click="handleClear"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';

interface Props {
  /** Array of text chunks received from backend */
  textChunks: string[];
  /** Whether still receiving chunks (shows cursor animation) */
  isStreaming: boolean;
  /** Callback to clear text */
  onClear?: () => void;
  /** Optional className for container */
  className?: string;
  /** Text direction (for RTL languages like Hebrew) */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Maximum height before scrolling (default: 200px) */
  maxHeight?: number;
  /** Show clear button (default: true when not streaming) */
  showClearButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  dir: 'auto',
  maxHeight: 200,
  showClearButton: true
});

const emit = defineEmits<{
  (e: 'clear'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const textRef = ref<HTMLDivElement | null>(null);

// Combine all chunks into display text
const displayText = computed(() => {
  return props.textChunks.join('');
});

// Auto-scroll to bottom when new content arrives
watch(displayText, async () => {
  await nextTick();
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight;
  }
});

function handleClear() {
  props.onClear?.();
  emit('clear');
}

// Scroll to bottom on mount if there's content
onMounted(() => {
  if (containerRef.value && displayText.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight;
  }
});
</script>

<style scoped>
.streaming-text {
  position: relative;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.streaming-text__content {
  font-size: 0.95rem;
  line-height: 1.5;
  color: white;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.streaming-text__cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  font-weight: bold;
  color: #4fd1c5;
}

.streaming-text__clear {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.streaming-text__clear:hover {
  opacity: 1;
}

/* RTL Support */
.streaming-text[dir="rtl"] .streaming-text__content {
  text-align: right;
}

.streaming-text[dir="rtl"] .streaming-text__clear {
  right: auto;
  left: 0.5rem;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
```

---

## Integration with Chat Interface

**Important:** Includes chunk ordering protection and max length protection from validation report.

```vue
<template>
  <div class="chat-interface">
    <!-- Avatar Container -->
    <AvatarContainer ... />

    <!-- Streaming Text (below avatar) -->
    <StreamingText
      v-if="textChunks.length > 0 || isReceivingText"
      :text-chunks="textChunks"
      :is-streaming="isReceivingText"
      :dir="textDirection"
      @clear="clearTextChunks"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import StreamingText from '@/components/StreamingText.vue';
import type { SpeakMessage, GeminiSpeakMessage } from '@/types/avatar-websocket';

const textChunks = ref<string[]>([]);
const isReceivingText = ref(false);
const currentMessageId = ref<string | null>(null);

// Maximum number of chunks to prevent unbounded growth
const MAX_CHUNKS = 10000;

// Determine text direction based on bot language
const textDirection = computed(() => {
  const rtlLanguages = ['he', 'ar', 'fa'];
  return rtlLanguages.includes(botLanguage.value) ? 'rtl' : 'ltr';
});

// Handle speak events from Gemini Live
function handleGeminiText(message: GeminiSpeakMessage) {
  // Chunk ordering protection - detect message change mid-stream
  if (message.message_id !== currentMessageId.value) {
    if (currentMessageId.value && isReceivingText.value) {
      console.warn('[StreamingText] Message changed while streaming, clearing previous chunks');
    }
    textChunks.value = [];
    currentMessageId.value = message.message_id;
  }

  // Append text chunk
  if (message.text_chunk) {
    textChunks.value.push(message.text_chunk);
    isReceivingText.value = true;

    // Max length protection - trim old chunks if array grows too large
    if (textChunks.value.length > MAX_CHUNKS) {
      console.warn(`[StreamingText] Chunk limit exceeded, trimming to last ${MAX_CHUNKS}`);
      textChunks.value = textChunks.value.slice(-MAX_CHUNKS);
    }
  }

  // Final chunk
  if (message.is_final) {
    isReceivingText.value = false;
  }
}

function clearTextChunks() {
  textChunks.value = [];
  currentMessageId.value = null;
}

// Also clear on user interrupt
function handleUserInterrupt() {
  clearTextChunks();
  avatarSocket.sendInterrupt();
}

// Socket event listener - listen for 'speak' event and check provider
socket.on('speak', (message: SpeakMessage) => {
  if (message.provider === 'gemini-live') {
    handleGeminiText(message as GeminiSpeakMessage);
  }
});
</script>
```

---

## Styling Variants

### Minimal (default above)
Translucent dark background with white text.

### Chat Bubble Style
```css
.streaming-text--bubble {
  background: white;
  color: #1a202c;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 16px 16px 4px 16px;
}

.streaming-text--bubble .streaming-text__cursor {
  color: #3182ce;
}
```

### Floating Overlay
```css
.streaming-text--floating {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  right: 1rem;
  max-width: 400px;
  background: rgba(0, 0, 0, 0.8);
}
```

---

## Verification Checklist

```
[ ] Text chunks display as they arrive
[ ] Blinking cursor shows while streaming
[ ] Cursor disappears after is_final
[ ] Auto-scrolls to bottom on new content
[ ] Clear button appears after streaming ends
[ ] Clear button works
[ ] RTL text displays correctly (Hebrew)
[ ] Max height limits container size
[ ] Scrollbar appears when content overflows
[ ] New message clears previous text
[ ] Chunk ordering protection works (warns on mid-stream message change)
[ ] Max length protection trims old chunks (after 10,000 chunks)
[ ] Socket.IO 'speak' event properly filters for provider='gemini-live'
[ ] Type imports include SpeakMessage and GeminiSpeakMessage
```

---

## Next Phase

→ [Phase 8: Avatar Caching](./phase_8_caching.md)

<template>
  <div
    ref="containerRef"
    class="streaming-text"
    :class="className"
    :style="{ maxHeight: `${maxHeight}px` }"
    :dir="dir"
    role="log"
    aria-live="polite"
    aria-label="Streaming response text"
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
      aria-label="Clear streaming text"
      type="button"
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

/* Styling Variants */
.streaming-text--bubble {
  background: white;
  color: #1a202c;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 16px 16px 4px 16px;
}

.streaming-text--bubble .streaming-text__content {
  color: #1a202c;
}

.streaming-text--bubble .streaming-text__cursor {
  color: #3182ce;
}

.streaming-text--floating {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  right: 1rem;
  max-width: 400px;
  background: rgba(0, 0, 0, 0.8);
}
</style>

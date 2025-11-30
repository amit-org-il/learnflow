<template>
  <button
    class="view-toggle"
    :class="[`view-toggle--${position}`, className]"
    @click="handleClick"
    :title="`Switch to ${nextViewLabel} view`"
    :aria-label="`Switch to ${nextViewLabel} view`"
  >
    <span class="view-toggle__icon" aria-hidden="true">{{ currentIcon }}</span>
    <span v-if="showLabel" class="view-toggle__label">{{ currentLabel }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const VIEW_CYCLE = ['head', 'body', 'full'] as const;
type ViewType = typeof VIEW_CYCLE[number];

const VIEW_ICONS: Record<ViewType, string> = {
  head: '😊',
  body: '👤',
  full: '🧍',
};

const VIEW_LABELS: Record<ViewType, string> = {
  head: 'Face',
  body: 'Body',
  full: 'Full',
};

interface Props {
  /** Current view type */
  currentView: string;
  /** Button position (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Show label next to icon */
  showLabel?: boolean;
  /** Additional CSS class */
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom-right',
  showLabel: false
});

const emit = defineEmits<{
  (e: 'change', view: ViewType): void;
}>();

const currentIcon = computed(() => {
  return VIEW_ICONS[props.currentView as ViewType] || VIEW_ICONS.head;
});

const currentLabel = computed(() => {
  return VIEW_LABELS[props.currentView as ViewType] || VIEW_LABELS.head;
});

const nextView = computed((): ViewType => {
  // View validation - ensure currentView is valid
  const currentIndex = VIEW_CYCLE.indexOf(props.currentView as ViewType);
  if (currentIndex === -1) {
    console.warn(`[ViewToggle] Invalid view: ${props.currentView}, defaulting to 'head'`);
    return VIEW_CYCLE[1]; // Return next after head as default
  }

  const nextIndex = (currentIndex + 1) % VIEW_CYCLE.length;
  return VIEW_CYCLE[nextIndex];
});

const nextViewLabel = computed(() => {
  return VIEW_LABELS[nextView.value];
});

function handleClick() {
  emit('change', nextView.value);
}
</script>

<style scoped>
.view-toggle {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  min-width: 44px;
  min-height: 44px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.view-toggle:hover {
  background: rgba(0, 0, 0, 0.7);
}

.view-toggle:focus {
  outline: 2px solid #4fd1c5;
  outline-offset: 2px;
}

.view-toggle--bottom-right {
  bottom: 0.5rem;
  right: 0.5rem;
}

.view-toggle--bottom-left {
  bottom: 0.5rem;
  left: 0.5rem;
}

.view-toggle--top-right {
  top: 0.5rem;
  right: 0.5rem;
}

.view-toggle--top-left {
  top: 0.5rem;
  left: 0.5rem;
}

.view-toggle__icon {
  font-size: 1.25rem;
}

.view-toggle__label {
  font-size: 0.75rem;
  font-weight: 500;
}
</style>

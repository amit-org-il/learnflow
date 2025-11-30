<template>
  <div
    class="speed-control"
    :class="{ 'speed-control--expanded': isExpanded }"
  >
    <!-- Collapsed state: show current speed badge -->
    <button
      v-if="!isExpanded"
      class="speed-control__badge"
      @click="isExpanded = true"
      :title="`Speaking rate: ${currentSpeed}x (click to change)`"
      :aria-label="`Speaking rate: ${currentSpeed}x, click to change`"
    >
      <span class="speed-control__value">{{ currentSpeed }}x</span>
    </button>

    <!-- Expanded state: show preset buttons -->
    <div v-else class="speed-control__presets" role="group" aria-label="Select speaking rate">
      <button
        v-for="speed in SPEED_PRESETS"
        :key="speed"
        class="speed-control__preset"
        :class="{ 'speed-control__preset--active': currentSpeed === speed }"
        @click="selectSpeed(speed)"
        :aria-pressed="currentSpeed === speed"
        :aria-label="`${speed}x speed`"
      >
        {{ speed }}x
      </button>
      <button
        class="speed-control__close"
        @click="isExpanded = false"
        aria-label="Close speed selector"
      >
        <span aria-hidden="true">x</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const SPEED_PRESETS = [1.0, 1.25, 1.5, 1.75, 2.0] as const;
type SpeedValue = typeof SPEED_PRESETS[number];

interface Props {
  /** Current speaking rate (1.0 - 2.0) */
  currentSpeed: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'change', speed: number): void;
}>();

const isExpanded = ref(false);

function selectSpeed(speed: SpeedValue) {
  emit('change', speed);
  isExpanded.value = false;
}
</script>

<style scoped>
.speed-control {
  /* Position controlled by parent container */
}

.speed-control__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.5rem;
  min-width: 32px;
  min-height: 32px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.75rem;
  font-weight: 600;
}

.speed-control__badge:hover {
  background: rgba(0, 0, 0, 0.7);
}

.speed-control__badge:focus {
  outline: 2px solid #4fd1c5;
  outline-offset: 2px;
}

.speed-control__value {
  font-weight: 600;
}

.speed-control__presets {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.speed-control__preset {
  padding: 0.3rem 0.4rem;
  min-width: 32px;
  min-height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.7rem;
  font-weight: 500;
}

.speed-control__preset:hover {
  background: rgba(255, 255, 255, 0.1);
}

.speed-control__preset:focus {
  outline: 2px solid #4fd1c5;
  outline-offset: 2px;
}

.speed-control__preset--active {
  background: rgba(79, 209, 197, 0.3);
  border-color: rgba(79, 209, 197, 0.5);
}

.speed-control__close {
  padding: 0.3rem;
  min-width: 24px;
  min-height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.75rem;
  margin-left: 0.15rem;
}

.speed-control__close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.speed-control__close:focus {
  outline: 2px solid #4fd1c5;
  outline-offset: 2px;
}
</style>

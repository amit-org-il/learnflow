<template>
  <button
    class="mute-button"
    :class="{ 'mute-button--muted': isMuted }"
    @click="handleClick"
    :title="isMuted ? 'Unmute avatar (enable speech)' : 'Mute avatar (text only)'"
    :aria-label="isMuted ? 'Unmute avatar' : 'Mute avatar'"
    :aria-pressed="isMuted"
  >
    <!-- Speaker icon (unmuted) -->
    <svg
      v-if="!isMuted"
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="mute-button__icon"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
    <!-- Muted icon -->
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="mute-button__icon"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  </button>
</template>

<script setup lang="ts">
interface Props {
  /** Current mute state */
  isMuted: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'change', muted: boolean): void;
}>();

function handleClick() {
  emit('change', !props.isMuted);
}
</script>

<style scoped>
.mute-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  min-width: 32px;
  min-height: 32px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.mute-button:hover {
  background: rgba(0, 0, 0, 0.7);
}

.mute-button:focus {
  outline: 2px solid #4fd1c5;
  outline-offset: 2px;
}

.mute-button--muted {
  background: rgba(220, 38, 38, 0.7);
}

.mute-button--muted:hover {
  background: rgba(220, 38, 38, 0.9);
}

.mute-button__icon {
  width: 0.875rem;
  height: 0.875rem;
}
</style>

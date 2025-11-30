# Phase 9: Polish & Optional Features

**Estimated Time:** 2-3 hours
**Prerequisites:** Phases 1-7 complete
**Priority:** P2 - Nice to have

---

## Tasks

- [ ] **9.1** Create `ViewToggleButton.vue` (1 hour)
- [ ] **9.2** Create `healthService.ts` (1 hour)
- [ ] **9.3** Final testing and bug fixes (1 hour)

---

## Task 9.1: Create ViewToggleButton Component

**File:** `src/components/ViewToggleButton.vue`

**Improvements:** Added aria-label for accessibility and view validation.

```vue
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
  currentView: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showLabel?: boolean;
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
```

**Usage in AvatarContainer:**
```vue
<template>
  <div class="avatar-container">
    <div ref="avatarRef" class="avatar-canvas" />

    <ViewToggleButton
      :current-view="currentView"
      position="bottom-right"
      @change="handleViewChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ViewToggleButton from './ViewToggleButton.vue';

const currentView = ref('head');

function handleViewChange(view: string) {
  currentView.value = view;
  avatar.setView(view);
}
</script>
```

---

## Task 9.2: Create Health Service

**File:** `src/services/healthService.ts`

**Improvements:** Uses shared `getApiBaseUrl()`, fixed timeout cleanup, proper error handling.

```typescript
import { getApiBaseUrl } from '@/config/api';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  azure_configured: boolean;
  region?: string;
  timestamp: number;
  error?: string;
}

export interface HealthCheckOptions {
  checkInterval?: number;  // Default: 30000 (30 seconds)
  timeout?: number;        // Default: 5000 (5 seconds)
  maxRetries?: number;     // Default: 3
  baseUrl?: string;        // Optional override (defaults to getApiBaseUrl())
}

type StatusChangeHandler = (status: HealthStatus) => void;

export class HealthService {
  private baseUrl: string;
  private checkInterval: number;
  private timeout: number;
  private maxRetries: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentStatus: HealthStatus = {
    status: 'unknown',
    azure_configured: false,
    timestamp: Date.now()
  };
  private handlers: StatusChangeHandler[] = [];

  constructor(options: HealthCheckOptions = {}) {
    this.checkInterval = options.checkInterval ?? 30000;
    this.timeout = options.timeout ?? 5000;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseUrl = options.baseUrl || getApiBaseUrl();
  }

  async checkHealth(): Promise<HealthStatus> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal
        });

        // Clear timeout on success
        clearTimeout(timeoutId);
        timeoutId = null;

        if (response.ok) {
          const data = await response.json();
          const newStatus: HealthStatus = {
            status: 'healthy',
            azure_configured: data.azure_configured ?? false,
            region: data.region,
            timestamp: Date.now()
          };

          this.updateStatus(newStatus);
          return newStatus;
        }
      } catch (err) {
        // Clear timeout on error as well
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }

        lastError = err instanceof Error ? err : new Error(String(err));
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    const errorStatus: HealthStatus = {
      status: 'unhealthy',
      azure_configured: false,
      timestamp: Date.now(),
      error: lastError?.message || 'Health check failed'
    };

    this.updateStatus(errorStatus);
    return errorStatus;
  }

  private updateStatus(newStatus: HealthStatus): void {
    const changed = this.currentStatus.status !== newStatus.status;
    this.currentStatus = newStatus;

    if (changed) {
      this.handlers.forEach(handler => handler(newStatus));
    }
  }

  start(): void {
    if (this.intervalId) return;

    // Initial check
    this.checkHealth();

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onStatusChange(handler: StatusChangeHandler): () => void {
    this.handlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  getStatus(): HealthStatus {
    return this.currentStatus;
  }
}

// Singleton instance
export const healthService = new HealthService();
```

**Note:** This service uses the shared `getApiBaseUrl()` function from Phase 5's `src/config/api.ts`.

**Usage:**
```typescript
import { healthService } from '@/services/healthService';
import { onMounted, onUnmounted, ref } from 'vue';

const backendStatus = ref<'healthy' | 'unhealthy' | 'unknown'>('unknown');

onMounted(() => {
  healthService.start();

  const unsubscribe = healthService.onStatusChange((status) => {
    backendStatus.value = status.status;

    if (status.status === 'unhealthy') {
      console.warn('Backend unhealthy:', status.error);
    }
  });

  onUnmounted(() => {
    unsubscribe();
    healthService.stop();
  });
});
```

---

## Task 9.3: Final Testing Checklist

### Avatar Loading
```
[ ] Avatar loads successfully
[ ] Progress shows 0-100%
[ ] Avatar renders in 3D
[ ] No console errors
[ ] Cached load is instant (<100ms)
```

### Azure TTS
```
[ ] Text triggers speech
[ ] Mouth moves with visemes
[ ] Audio plays clearly
[ ] speech_complete sent
```

### Gemini Live
```
[ ] Audio chunks play gaplessly
[ ] Mouth moves with frequency
[ ] Text displays in real-time
[ ] speech_complete after is_final
[ ] Voice input sends audio
[ ] Voice input interrupts avatar
```

### Controls
```
[ ] Gestures work (thumbup, shrug)
[ ] Moods work (happy, sad)
[ ] View toggle works
[ ] Stop button works
[ ] View toggle has accessible aria-label
[ ] Invalid view validation works
```

### Error Handling
```
[ ] Avatar load error shows retry
[ ] Fallback mode works
[ ] Session expiration handles gracefully
[ ] Network errors don't crash app
[ ] Health check timeout clears properly
[ ] Health check retries with exponential backoff
```

### Mobile
```
[ ] Touch interactions work
[ ] Audio plays on mobile
[ ] No layout issues
[ ] Reasonable performance
```

---

## Final File Structure

```
learnflow/packages/chatbot/
├── src/
│   ├── config/
│   │   └── api.ts                 (Shared base URL function)
│   ├── types/
│   │   ├── avatar-websocket.ts
│   │   ├── avatar.ts
│   │   └── talking-head.d.ts
│   ├── composables/
│   │   ├── useAvatarSocket.ts
│   │   ├── useAvatar.ts
│   │   ├── useAzureTTS.ts
│   │   ├── useGeminiLipsync.ts
│   │   ├── useBot.ts
│   │   ├── useChat.ts
│   │   ├── useVoiceRecording.ts
│   │   └── useAvatarPreloader.ts
│   ├── lib/
│   │   ├── talkinghead/
│   │   │   ├── talkinghead.mjs
│   │   │   ├── lipsync-en.mjs
│   │   │   └── dynamicbones.mjs
│   │   ├── audio/
│   │   │   ├── audio-unlock.ts
│   │   │   ├── audio-utils.ts
│   │   │   ├── AudioRecorder.ts
│   │   │   ├── GeminiAudioHandler.ts
│   │   │   └── worklets/
│   │   │       └── smart-mouth-analyzer.ts
│   │   └── cache/
│   │       └── avatarCacheService.ts
│   ├── services/
│   │   └── healthService.ts
│   └── components/
│       ├── AvatarContainer.vue
│       ├── ViewToggleButton.vue
│       ├── VoiceRecorder.vue
│       ├── StreamingText.vue
│       └── FloatingChatbot.vue (modified)
└── package.json (modified)
```

---

## Verification Checklist (Phase 9 Specific)

```
[ ] ViewToggleButton has aria-label for accessibility
[ ] ViewToggleButton validates invalid views (logs warning, defaults gracefully)
[ ] Health check uses shared getApiBaseUrl() function
[ ] Health check timeout is cleared on both success and error
[ ] Health service retries with exponential backoff (3 attempts)
[ ] Health service base URL works in both dev and prod
[ ] All emojis have aria-hidden="true" attribute
```

---

## Summary

| Phase | Time | Priority |
|-------|------|----------|
| 1. Setup | 2 hrs | Required |
| 2. Types | 1.5 hrs | Required |
| 3. Composables | 10.5 hrs | Required |
| 4. Components | 3 hrs | Required |
| 5. API | 2 hrs | Required |
| 6. Voice | 4 hrs | P0 |
| 7. Streaming | 1.5 hrs | P0 |
| 8. Caching | 3 hrs | P1 |
| 9. Polish | 2-3 hrs | P2 |
| **Total** | **29.5-30.5 hrs** | |

---

**Integration complete!**

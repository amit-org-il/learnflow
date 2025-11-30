/**
 * useAvatarPreloader Composable
 *
 * Preloads avatar GLB files to IndexedDB cache for instant loading on repeat visits.
 * Supports both male and female avatars with parallel loading.
 *
 * Features:
 * - Parallel preloading of multiple avatars
 * - Status tracking (pending/loading/loaded/error)
 * - Automatic cleanup of Blob URLs on unmount
 * - Fallback to original URL on error
 */

import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { avatarCacheService } from '../lib/cache/avatarCacheService';

export type PreloadStatus = 'pending' | 'loading' | 'loaded' | 'error';

export interface AvatarPreloadState {
  female: PreloadStatus;
  male: PreloadStatus;
}

export interface CachedAvatarUrls {
  female: string | null;
  male: string | null;
}

export interface AvatarUrls {
  female: string;
  male: string;
}

export interface UseAvatarPreloaderOptions {
  /** URLs to the avatar GLB files */
  avatarUrls: AvatarUrls;
  /** Whether to preload on mount (default: true) */
  preloadOnMount?: boolean;
}

export interface UseAvatarPreloaderReturn {
  /** Current status of each avatar */
  status: ComputedRef<AvatarPreloadState>;
  /** Cached Blob URLs (or null if not cached) */
  cachedUrls: ComputedRef<CachedAvatarUrls>;
  /** Whether any avatar is currently loading */
  isPreloading: ComputedRef<boolean>;
  /** Whether all avatars are loaded */
  isReady: ComputedRef<boolean>;
  /** Whether caching is available (false in private browsing) */
  isCacheAvailable: ComputedRef<boolean>;
  /** Preload all avatars */
  preload: () => Promise<void>;
  /** Get URL for an avatar (cached or original) */
  getAvatarUrl: (gender: 'male' | 'female') => string;
  /** Preload a specific avatar */
  preloadAvatar: (gender: 'male' | 'female') => Promise<void>;
}

export function useAvatarPreloader(options: UseAvatarPreloaderOptions): UseAvatarPreloaderReturn {
  const { avatarUrls, preloadOnMount = true } = options;

  // ========================================
  // STATE
  // ========================================

  const status = ref<AvatarPreloadState>({
    female: 'pending',
    male: 'pending'
  });

  const cachedUrls = ref<CachedAvatarUrls>({
    female: null,
    male: null
  });

  const isCacheAvailable = ref(avatarCacheService.isAvailable());

  // ========================================
  // COMPUTED
  // ========================================

  const isPreloading = computed(() =>
    status.value.female === 'loading' || status.value.male === 'loading'
  );

  const isReady = computed(() =>
    status.value.female === 'loaded' && status.value.male === 'loaded'
  );

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Preload a specific avatar
   */
  async function preloadAvatar(gender: 'male' | 'female'): Promise<void> {
    const url = avatarUrls[gender];
    if (!url) {
      console.warn(`[AvatarPreloader] No URL for ${gender} avatar`);
      return;
    }

    // Skip if cache is not available
    if (!isCacheAvailable.value) {
      console.warn('[AvatarPreloader] IndexedDB not available, using original URLs');
      cachedUrls.value[gender] = url;
      status.value[gender] = 'loaded';
      return;
    }

    status.value[gender] = 'loading';

    try {
      // Try to get from cache first
      let cachedUrl = await avatarCacheService.getCachedUrl(url);

      if (!cachedUrl) {
        // Not in cache, fetch and cache it
        cachedUrl = await avatarCacheService.cacheAvatar(url);
      }

      cachedUrls.value[gender] = cachedUrl;
      status.value[gender] = 'loaded';
      console.log(`[AvatarPreloader] ${gender} avatar ready`);
    } catch (err) {
      console.error(`[AvatarPreloader] Failed to preload ${gender}:`, err);
      status.value[gender] = 'error';
      // Use original URL as fallback
      cachedUrls.value[gender] = url;
    }
  }

  /**
   * Preload all avatars in parallel
   */
  async function preload(): Promise<void> {
    console.log('[AvatarPreloader] Starting preload...');

    // Preload both in parallel
    await Promise.all([
      preloadAvatar('female'),
      preloadAvatar('male')
    ]);

    console.log('[AvatarPreloader] Preload complete');
  }

  /**
   * Get the URL to use for an avatar (cached or original)
   */
  function getAvatarUrl(gender: 'male' | 'female'): string {
    // Return cached URL if available, otherwise original
    return cachedUrls.value[gender] || avatarUrls[gender];
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  // Preload on mount if configured
  if (preloadOnMount) {
    onMounted(() => {
      preload();
    });
  }

  // Cleanup: Revoke Blob URLs on unmount to prevent memory leaks
  onUnmounted(() => {
    console.log('[AvatarPreloader] Cleaning up Blob URLs');
    if (cachedUrls.value.female) {
      avatarCacheService.revokeBlobUrl(avatarUrls.female);
    }
    if (cachedUrls.value.male) {
      avatarCacheService.revokeBlobUrl(avatarUrls.male);
    }
  });

  // ========================================
  // RETURN
  // ========================================

  return {
    status: computed(() => status.value),
    cachedUrls: computed(() => cachedUrls.value),
    isPreloading,
    isReady,
    isCacheAvailable: computed(() => isCacheAvailable.value),
    preload,
    getAvatarUrl,
    preloadAvatar
  };
}

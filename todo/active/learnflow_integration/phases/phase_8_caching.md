# Phase 8: Avatar Caching (IndexedDB)

**Estimated Time:** 3 hours
**Prerequisites:** Phase 4 complete (can run in parallel with Phase 5-7)
**Priority:** P1 - High (UX improvement)

---

## Why This Matters

| Scenario | Without Cache | With Cache |
|----------|---------------|------------|
| First visit | 5-10 seconds | 5-10 seconds |
| Return visit | 5-10 seconds | **~100ms** |
| Switch avatar | 5-10 seconds | **Instant** |

---

## Tasks

- [x] **8.1** Create `avatarCacheService.ts` (2 hours)
- [x] **8.2** Create `useAvatarPreloader.ts` composable (1 hour)

---

## Task 8.1: Create Avatar Cache Service

**File:** `src/lib/cache/avatarCacheService.ts`

**Source:** Enhanced from `frontend/src/lib/cache/avatarCacheService.ts` with retry logic and connection health checks.

```typescript
const DB_NAME = 'avatar-cache-db';
const DB_VERSION = 1;
const STORE_NAME = 'avatars';
const CACHE_VERSION = '1.0.0';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CachedAvatar {
  url: string;            // Original URL (key)
  data: ArrayBuffer;      // GLB file binary
  timestamp: number;      // Cache time
  version: string;        // For invalidation
  size: number;           // File size in bytes
}

export interface CacheStats {
  count: number;
  totalSize: number;
  entries: Array<{
    url: string;
    size: number;
    age: number;          // Days since cached
  }>;
}

class AvatarCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeBlobUrls: Map<string, string> = new Map();

  /**
   * Check if IndexedDB is available (fails in private browsing mode)
   */
  static isAvailable(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      return false;
    }
  }

  /**
   * Retry logic for IndexedDB operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        // Exponential backoff
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Check if database connection is healthy
   */
  private isConnectionHealthy(): boolean {
    return this.db !== null && this.db.objectStoreNames.contains(STORE_NAME);
  }

  /**
   * Initialize IndexedDB connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db && this.isConnectionHealthy()) return this.db;
    if (this.dbPromise) return this.dbPromise;

    if (!AvatarCacheService.isAvailable()) {
      throw new Error('IndexedDB is not available (private browsing?)');
    }

    this.dbPromise = this.withRetry(() => new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[AvatarCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
    }));

    return this.dbPromise;
  }

  /**
   * Get cached avatar as Blob URL
   */
  async getCachedUrl(originalUrl: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      return await this.withRetry(() => new Promise((resolve) => {
        const request = store.get(originalUrl);

        request.onsuccess = () => {
          const cached = request.result as CachedAvatar | undefined;

          if (!cached) {
            resolve(null);
            return;
          }

          // Check version
          if (cached.version !== CACHE_VERSION) {
            console.log('[AvatarCache] Version mismatch, cache invalid');
            resolve(null);
            return;
          }

          // Check TTL
          const age = Date.now() - cached.timestamp;
          if (age > CACHE_TTL_MS) {
            console.log('[AvatarCache] Cache expired');
            resolve(null);
            return;
          }

          // Create Blob URL from ArrayBuffer
          const blob = new Blob([cached.data], { type: 'model/gltf-binary' });
          const blobUrl = URL.createObjectURL(blob);

          // Track for cleanup
          this.activeBlobUrls.set(originalUrl, blobUrl);

          console.log(`[AvatarCache] Hit: ${originalUrl} (${(cached.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(blobUrl);
        };

        request.onerror = () => {
          console.error('[AvatarCache] Read error:', request.error);
          resolve(null);
        };
      }));
    } catch (err) {
      console.error('[AvatarCache] getCachedUrl error:', err);
      return null;
    }
  }

  /**
   * Cache avatar from URL
   */
  async cacheAvatar(url: string): Promise<string> {
    try {
      // Fetch the GLB file
      console.log(`[AvatarCache] Fetching: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const size = arrayBuffer.byteLength;

      // Store in IndexedDB with retry
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const cached: CachedAvatar = {
        url,
        data: arrayBuffer,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        size
      };

      await this.withRetry(() => new Promise<void>((resolve, reject) => {
        const request = store.put(cached);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }));

      // Create Blob URL
      const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
      const blobUrl = URL.createObjectURL(blob);
      this.activeBlobUrls.set(url, blobUrl);

      console.log(`[AvatarCache] Cached: ${url} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      return blobUrl;
    } catch (err) {
      console.error('[AvatarCache] cacheAvatar error:', err);
      // Return original URL as fallback
      return url;
    }
  }

  /**
   * Clear all cached avatars
   */
  async clearCache(): Promise<void> {
    // Revoke all Blob URLs
    this.activeBlobUrls.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
    this.activeBlobUrls.clear();

    // Clear IndexedDB store
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await this.withRetry(() => new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));

    console.log('[AvatarCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return await this.withRetry(() => new Promise((resolve) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = (request.result as CachedAvatar[]).map((cached) => ({
          url: cached.url,
          size: cached.size,
          age: Math.floor((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000))
        }));

        resolve({
          count: entries.length,
          totalSize: entries.reduce((sum, e) => sum + e.size, 0),
          entries
        });
      };

      request.onerror = () => {
        resolve({ count: 0, totalSize: 0, entries: [] });
      };
    }));
  }

  /**
   * Revoke a specific Blob URL
   */
  revokeBlobUrl(originalUrl: string): void {
    const blobUrl = this.activeBlobUrls.get(originalUrl);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.activeBlobUrls.delete(originalUrl);
    }
  }
}

// Singleton instance
export const avatarCacheService = new AvatarCacheService();
```

---

## Task 8.2: Create useAvatarPreloader Composable

**File:** `src/composables/useAvatarPreloader.ts`

**Important:** Includes cleanup on unmount to prevent memory leaks.

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { avatarCacheService } from '@/lib/cache/avatarCacheService';

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
  avatarUrls: AvatarUrls;
  preloadOnMount?: boolean;
}

export function useAvatarPreloader(options: UseAvatarPreloaderOptions) {
  const status = ref<AvatarPreloadState>({
    female: 'pending',
    male: 'pending'
  });

  const cachedUrls = ref<CachedAvatarUrls>({
    female: null,
    male: null
  });

  const isPreloading = computed(() =>
    status.value.female === 'loading' || status.value.male === 'loading'
  );

  const isReady = computed(() =>
    status.value.female === 'loaded' && status.value.male === 'loaded'
  );

  async function preloadAvatar(gender: 'male' | 'female'): Promise<void> {
    const url = options.avatarUrls[gender];
    if (!url) return;

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
    } catch (err) {
      console.error(`[AvatarPreloader] Failed to preload ${gender}:`, err);
      status.value[gender] = 'error';
      // Use original URL as fallback
      cachedUrls.value[gender] = url;
    }
  }

  async function preload(): Promise<void> {
    // Preload both in parallel
    await Promise.all([
      preloadAvatar('female'),
      preloadAvatar('male')
    ]);
  }

  function getAvatarUrl(gender: 'male' | 'female'): string {
    // Return cached URL if available, otherwise original
    return cachedUrls.value[gender] || options.avatarUrls[gender];
  }

  // Preload on mount if configured
  if (options.preloadOnMount !== false) {
    onMounted(() => {
      preload();
    });
  }

  // Cleanup: Revoke Blob URLs on unmount to prevent memory leaks
  onUnmounted(() => {
    if (cachedUrls.value.female) {
      avatarCacheService.revokeBlobUrl(options.avatarUrls.female);
    }
    if (cachedUrls.value.male) {
      avatarCacheService.revokeBlobUrl(options.avatarUrls.male);
    }
  });

  return {
    status: computed(() => status.value),
    cachedUrls: computed(() => cachedUrls.value),
    isPreloading,
    isReady,
    preload,
    getAvatarUrl
  };
}
```

---

## Integration

### In App.vue or Main Layout

```typescript
import { useAvatarPreloader } from '@/composables/useAvatarPreloader';

// Preload avatars as soon as app loads
const { isReady, getAvatarUrl } = useAvatarPreloader({
  avatarUrls: {
    female: 'https://models.readyplayer.me/...',
    male: 'https://models.readyplayer.me/...'
  },
  preloadOnMount: true
});
```

### In AvatarContainer

```typescript
// Use cached URL instead of direct URL
const cachedModelUrl = getAvatarUrl(props.gender);

await avatarInstance.showAvatar({
  url: cachedModelUrl,  // Blob URL from IndexedDB
  body: props.gender === 'male' ? 'M' : 'F'
});
```

---

## Verification Checklist

```
[ ] IndexedDB database creates successfully
[ ] First load fetches and caches avatar
[ ] Second load uses cached Blob URL (~100ms)
[ ] Cache stats show correct count/size
[ ] Cache clears correctly
[ ] 30-day TTL expires old entries
[ ] Version mismatch invalidates cache
[ ] Fallback to original URL on error
[ ] Both male/female preload in parallel
[ ] Blob URLs are revoked on cleanup
[ ] Retry logic works (3 attempts with exponential backoff)
[ ] Connection health check prevents stale DB usage
[ ] IndexedDB availability check prevents errors in private browsing
[ ] Cleanup on unmount prevents memory leaks
```

---

## Next Phase

→ [Phase 9: Polish](./phase_9_polish.md)

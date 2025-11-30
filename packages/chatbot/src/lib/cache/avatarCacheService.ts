/**
 * Avatar Cache Service
 *
 * IndexedDB-based caching for 3D avatar GLB files.
 * Dramatically improves load times on repeat visits (~100ms vs 5-10 seconds).
 *
 * Features:
 * - IndexedDB storage for large binary files
 * - 30-day TTL with version-based invalidation
 * - Retry logic with exponential backoff
 * - Connection health checks
 * - Blob URL management to prevent memory leaks
 */

const DB_NAME = 'avatar-cache-db';
const DB_VERSION = 1;
const STORE_NAME = 'avatars';
const CACHE_VERSION = '1.0.0';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CachedAvatar {
  /** Original URL (key) */
  url: string;
  /** GLB file binary data */
  data: ArrayBuffer;
  /** Cache timestamp */
  timestamp: number;
  /** Cache version for invalidation */
  version: string;
  /** File size in bytes */
  size: number;
}

export interface CacheStats {
  /** Number of cached avatars */
  count: number;
  /** Total size in bytes */
  totalSize: number;
  /** Individual entries */
  entries: Array<{
    url: string;
    size: number;
    /** Days since cached */
    age: number;
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
   * Instance method to check availability
   */
  isAvailable(): boolean {
    return AvatarCacheService.isAvailable();
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
   * @returns Blob URL if cached and valid, null otherwise
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

          // Create Blob URL from ArrayBuffer (NOT from Blob - important!)
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
   * @returns Blob URL to use for loading
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
   * Delete a specific cached avatar
   */
  async deleteCache(url: string): Promise<void> {
    // Revoke Blob URL if exists
    this.revokeBlobUrl(url);

    // Delete from IndexedDB
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await this.withRetry(() => new Promise<void>((resolve, reject) => {
      const request = store.delete(url);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));

    console.log(`[AvatarCache] Deleted: ${url}`);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
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
    } catch {
      return { count: 0, totalSize: 0, entries: [] };
    }
  }

  /**
   * Revoke a specific Blob URL (call when done with an avatar)
   */
  revokeBlobUrl(originalUrl: string): void {
    const blobUrl = this.activeBlobUrls.get(originalUrl);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.activeBlobUrls.delete(originalUrl);
    }
  }

  /**
   * Revoke all active Blob URLs (call on cleanup)
   */
  revokeAllBlobUrls(): void {
    this.activeBlobUrls.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
    this.activeBlobUrls.clear();
  }
}

// Singleton instance
export const avatarCacheService = new AvatarCacheService();

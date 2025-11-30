/**
 * Centralized API base URL configuration
 * Used by all API services and Socket.IO connections
 */

/**
 * Get the backend API base URL
 * Priority:
 * 1. VITE_BACKEND_URL environment variable
 * 2. Development: http://localhost:8001
 * 3. Production: Same origin as frontend
 */
export function getApiBaseUrl(): string {
  // 1. Check environment variable (can be set in .env files)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // 2. Development mode - use localhost:8001
  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';

    if (isDev) {
      const port = import.meta.env.VITE_BACKEND_PORT || '8001';
      return `http://localhost:${port}`;
    }

    // 3. Production - same origin
    return window.location.origin;
  }

  // Fallback for SSR/testing
  return 'http://localhost:8001';
}

/**
 * Get Socket.IO connection URL with namespace
 * @param namespace - Socket.IO namespace (default: '/avatar')
 */
export function getSocketUrl(namespace: string = '/avatar'): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${namespace}`;
}

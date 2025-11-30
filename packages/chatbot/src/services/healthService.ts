/**
 * Health Service
 *
 * Monitors backend health status with periodic checks.
 * Features:
 * - Automatic retry with exponential backoff
 * - Status change notifications
 * - Request timeout handling
 */

import { getApiBaseUrl } from '../config/api';

export interface HealthStatus {
  /** Overall status */
  status: 'healthy' | 'unhealthy' | 'unknown';
  /** Whether Azure TTS is configured on backend */
  azure_configured: boolean;
  /** Azure region (if configured) */
  region?: string;
  /** Timestamp of last check */
  timestamp: number;
  /** Error message (if unhealthy) */
  error?: string;
}

export interface HealthCheckOptions {
  /** Check interval in ms (default: 30000 = 30 seconds) */
  checkInterval?: number;
  /** Request timeout in ms (default: 5000 = 5 seconds) */
  timeout?: number;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Optional override for base URL (defaults to getApiBaseUrl()) */
  baseUrl?: string;
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

  /**
   * Perform a single health check with retries
   */
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

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.intervalId) return;

    // Initial check
    this.checkHealth();

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Subscribe to status changes
   * @returns Unsubscribe function
   */
  onStatusChange(handler: StatusChangeHandler): () => void {
    this.handlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  /**
   * Get current status (synchronous)
   */
  getStatus(): HealthStatus {
    return this.currentStatus;
  }

  /**
   * Check if backend is healthy
   */
  isHealthy(): boolean {
    return this.currentStatus.status === 'healthy';
  }

  /**
   * Update base URL (useful for testing)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

// Singleton instance
export const healthService = new HealthService();

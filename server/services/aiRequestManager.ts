import { logger } from "./loggerService";
import { CircuitBreaker, getGeminiCircuitBreaker } from "./circuitBreaker";

interface PendingRequest<T> {
  promise: Promise<T>;
  abortController: AbortController;
  timestamp: number;
  route: string;
  key: string;
}

interface CachedResponse<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

interface AiRequestManagerConfig {
  defaultCacheTtlMs: number;
  pendingRequestTimeoutMs: number;
  maxConcurrentRequests: number;
  enableCache: boolean;
}

const DEFAULT_CONFIG: AiRequestManagerConfig = {
  defaultCacheTtlMs: 30000, // 30 seconds
  pendingRequestTimeoutMs: 60000, // 60 seconds
  maxConcurrentRequests: 5,
  enableCache: true,
};

/**
 * Centralized AI Request Manager for the CRUNCH backend.
 *
 * Responsibilities:
 * - Deduplicate identical in-flight requests (same route + key)
 * - Cache responses for identical requests
 * - Queue concurrent requests to prevent parallel duplicate generations
 * - Expose request status and cancellation support
 * - Integrate with the Circuit Breaker for quota protection
 *
 * Design: One user action -> One backend request -> One Gemini request.
 * If multiple components request the same AI generation simultaneously,
 * only one request executes and all callers receive the same Promise.
 */
export class AiRequestManager {
  private pending = new Map<string, PendingRequest<any>>();
  private cache = new Map<string, CachedResponse<any>>();
  private activeCount = 0;
  private queue: Array<() => void> = [];
  private config: AiRequestManagerConfig;
  private circuitBreaker: CircuitBreaker;

  constructor(config?: Partial<AiRequestManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreaker = getGeminiCircuitBreaker();
  }

  /**
   * Build a cache key from the request identifier.
   */
  private buildKey(route: string, params?: Record<string, unknown>): string {
    if (!params) return route;
    try {
      // Sort keys for stable hashing, exclude abort signals
      const sorted = Object.entries(params)
        .filter(([k]) => k !== "signal" && k !== "abortController")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join("&");
      return `${route}|${sorted}`;
    } catch {
      return route;
    }
  }

  /**
   * Check if a cached response is still valid.
   */
  private isCacheValid<T>(entry: CachedResponse<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttlMs;
  }

  /**
   * Execute an AI request through the manager.
   *
   * @param route        - Identifier for the AI endpoint (e.g., "morning-brief")
   * @param params       - Request parameters (used for dedup/cache key)
   * @param fn           - The actual async function to execute
   * @param fallback     - Fallback value if circuit breaker is open or request fails
   * @param cacheTtlMs   - Optional override for cache TTL
   * @returns            - Promise resolving to the result or fallback
   */
  async execute<T>(
    route: string,
    params: Record<string, unknown>,
    fn: (signal: AbortSignal) => Promise<T>,
    fallback: T,
    cacheTtlMs?: number
  ): Promise<T> {
    return this.runManaged(route, params, fn, cacheTtlMs, fallback);
  }

  /**
   * Same as execute but propagates errors instead of returning a fallback.
   * Used by callGeminiWithRetry so route handlers can apply their own fallbacks.
   */
  async executeStrict<T>(
    route: string,
    params: Record<string, unknown>,
    fn: (signal: AbortSignal) => Promise<T>,
    cacheTtlMs?: number
  ): Promise<T> {
    return this.runManaged(route, params, fn, cacheTtlMs);
  }

  private async runManaged<T>(
    route: string,
    params: Record<string, unknown>,
    fn: (signal: AbortSignal) => Promise<T>,
    cacheTtlMs?: number,
    fallback?: T
  ): Promise<T> {
    const key = this.buildKey(route, params);
    const ttl = cacheTtlMs ?? this.config.defaultCacheTtlMs;

    if (this.config.enableCache) {
      const cached = this.cache.get(key);
      if (cached && this.isCacheValid(cached)) {
        return cached.data as T;
      }
    }

    const existing = this.pending.get(key);
    if (existing) {
      const age = Date.now() - existing.timestamp;
      if (age < this.config.pendingRequestTimeoutMs) {
        return existing.promise as Promise<T>;
      }
      this.pending.delete(key);
    }

    if (!this.circuitBreaker.canExecute()) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error("Gemini circuit breaker is open");
    }

    await this.acquireSlot();

    const abortController = new AbortController();
    const promise = this.executeInternal<T>(route, key, fn, abortController, ttl, fallback);

    this.pending.set(key, {
      promise,
      abortController,
      timestamp: Date.now(),
      route,
      key,
    });

    return promise;
  }

  private async executeInternal<T>(
    route: string,
    key: string,
    fn: (signal: AbortSignal) => Promise<T>,
    abortController: AbortController,
    ttl: number,
    fallback?: T
  ): Promise<T> {
    try {
      const result = await fn(abortController.signal);

      if (this.config.enableCache) {
        this.cache.set(key, { data: result, timestamp: Date.now(), ttlMs: ttl });
      }

      return result;
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === "AbortError") {
        throw err;
      }

      if (fallback !== undefined) {
        logger.warn(`[AI-Manager] ${route} failed — using fallback. ${e.message ?? ""}`);
        return fallback;
      }

      throw err;
    } finally {
      this.pending.delete(key);
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.config.maxConcurrentRequests) {
      this.activeCount++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  /**
   * Cancel a pending request by its key.
   */
  cancel(key: string): boolean {
    const pending = this.pending.get(key);
    if (pending) {
      pending.abortController.abort();
      this.pending.delete(key);
      logger.info(`[AI-Manager] Cancelled request: ${pending.route}`);
      return true;
    }
    return false;
  }

  /**
   * Get current status for monitoring/observability.
   */
  getStatus(): {
    pendingCount: number;
    cacheSize: number;
    activeCount: number;
    queueLength: number;
    circuitBreaker: ReturnType<CircuitBreaker["getMetrics"]>;
  } {
    return {
      pendingCount: this.pending.size,
      cacheSize: this.cache.size,
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      circuitBreaker: this.circuitBreaker.getMetrics(),
    };
  }

  /**
   * Clear expired cache entries.
   */
  pruneCache(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// Global singleton
let globalManager: AiRequestManager | null = null;

export function getAiRequestManager(): AiRequestManager {
  if (!globalManager) {
    globalManager = new AiRequestManager();
  }
  return globalManager;
}

/**
 * Convenience wrapper for executing a single AI request with the global manager.
 */
export async function executeAiRequest<T>(
  route: string,
  params: Record<string, unknown>,
  fn: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  cacheTtlMs?: number
): Promise<T> {
  return getAiRequestManager().execute(route, params, fn, fallback, cacheTtlMs);
}

export async function executeAiRequestStrict<T>(
  route: string,
  params: Record<string, unknown>,
  fn: (signal: AbortSignal) => Promise<T>,
  cacheTtlMs?: number
): Promise<T> {
  return getAiRequestManager().executeStrict(route, params, fn, cacheTtlMs);
}

/**
 * Cancel a pending request by its key.
 */
export function cancelAiRequest(key: string): boolean {
  return getAiRequestManager().cancel(key);
}

/**
 * Get current AI manager status for monitoring.
 */
export function getAiManagerStatus(): ReturnType<AiRequestManager["getStatus"]> {
  return getAiRequestManager().getStatus();
}

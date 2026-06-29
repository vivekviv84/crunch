import { logger } from "./loggerService";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  failureThreshold: number;     // failures before opening
  recoveryTimeoutMs: number;     // how long to stay open
  halfOpenMaxCalls: number;      // max calls during half-open
}

interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  totalCalls: number;
  totalFailures: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryTimeoutMs: 120000, // 2 minutes
  halfOpenMaxCalls: 1,
};

/**
 * Circuit Breaker for Gemini API calls.
 * Prevents repeated quota failures by opening the circuit after
 * consecutive RESOURCE_EXHAUSTED (429) or other failures.
 * While open: immediately returns local fallback without calling Gemini.
 * After timeout: transitions to half-open to test recovery.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private totalCalls = 0;
  private totalFailures = 0;
  private halfOpenCalls = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
    };
  }

  isOpen(): boolean {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.lastFailureTime || 0);
      if (elapsed >= this.config.recoveryTimeoutMs) {
        this.state = "HALF_OPEN";
        this.halfOpenCalls = 0;
        this.failures = 0;
        this.successes = 0;
        logger.info(
          `[CircuitBreaker:${this.name}] Transitioned OPEN -> HALF_OPEN after ${elapsed}ms`
        );
      }
    }
    return this.state === "OPEN";
  }

  canExecute(): boolean {
    if (this.isOpen()) return false;

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        return false;
      }
      this.halfOpenCalls++;
    }

    return true;
  }

  recordSuccess(): void {
    this.totalCalls++;
    this.failures = 0;
    this.successes++;

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.halfOpenCalls = 0;
      logger.info(`[CircuitBreaker:${this.name}] Transitioned HALF_OPEN -> CLOSED`);
    }
  }

  recordFailure(isQuotaError = false): void {
    this.totalCalls++;
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.halfOpenCalls = 0;
      logger.warn(
        `[CircuitBreaker:${this.name}] HALF_OPEN -> OPEN after failure. Will retry in ${this.config.recoveryTimeoutMs}ms`
      );
      return;
    }

    if (this.state === "CLOSED" && this.failures >= this.config.failureThreshold) {
      this.state = "OPEN";
      logger.warn(
        `[CircuitBreaker:${this.name}] CLOSED -> OPEN after ${this.failures} consecutive failures. ${
          isQuotaError ? "Quota exceeded." : ""
        } Will retry in ${this.config.recoveryTimeoutMs}ms`
      );
    }
  }

  /**
   * Execute a function through the circuit breaker.
   * Returns the fallback if circuit is open or the function throws.
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback: T,
    fallbackReason?: string
  ): Promise<T> {
    if (!this.canExecute()) {
      logger.info(
        `[CircuitBreaker:${this.name}] Circuit OPEN. Skipping call. Using fallback: ${fallbackReason || "default"}`
      );
      return fallback;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err: any) {
      const isQuotaError =
        err.status === 429 ||
        err.statusCode === 429 ||
        (err.message && err.message.includes("RESOURCE_EXHAUSTED")) ||
        (err.message && err.message.includes("429"));
      this.recordFailure(isQuotaError);
      throw err;
    }
  }
}

// Global singleton instance for the Gemini circuit breaker
let geminiCircuitBreaker: CircuitBreaker | null = null;

export function getGeminiCircuitBreaker(): CircuitBreaker {
  if (!geminiCircuitBreaker) {
    geminiCircuitBreaker = new CircuitBreaker("GeminiAPI", {
      failureThreshold: 3,
      recoveryTimeoutMs: 120000, // 2 min
      halfOpenMaxCalls: 1,
    });
  }
  return geminiCircuitBreaker;
}

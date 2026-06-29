import { GoogleGenAI } from "@google/genai";
import { logger } from "./loggerService";
import { getGeminiCircuitBreaker } from "./circuitBreaker";
import { getAiRequestManager } from "./aiRequestManager";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let cachedClient: GoogleGenAI | null = null;

const recentLogs = new Map<string, number>();
const LOG_DEDUP_MS = 5000;

function logOnce(key: string, level: "info" | "warn" | "error", message: string): void {
  const last = recentLogs.get(key) ?? 0;
  if (Date.now() - last < LOG_DEDUP_MS) return;
  recentLogs.set(key, Date.now());
  logger[level](message);
}

export class CircuitOpenError extends Error {
  constructor() {
    super("Gemini circuit breaker is open — using local fallback");
    this.name = "CircuitOpenError";
  }
}

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("Gemini client is not initialized due to missing or invalid API key.");
    this.name = "GeminiNotConfiguredError";
  }
}

/**
 * Returns a cached singleton instance of the unified GoogleGenAI client.
 * Returns null if the API key environment configuration is missing or invalid.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient) return cachedClient;

  let key = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!key) {
    logOnce("no-key", "warn", "[GEMINI] API key not defined in process.env.");
    return null;
  }

  key = key.trim().replace(/^['"]|['"]$/g, "").trim();

  if (key === "" || key === "MY_GEMINI_API_KEY" || key === "undefined" || key === "null") {
    logOnce("invalid-key", "warn", "[GEMINI] API key holds a placeholder/invalid value.");
    return null;
  }

  if (key.length < 10) {
    logOnce("short-key", "warn", "[GEMINI] API key is too short to be valid.");
    return null;
  }

  cachedClient = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  return cachedClient;
}

export interface GeminiTelemetry {
  route: string;
  model: string;
  /** Parameters used for dedup/cache in the AI request manager. */
  cacheParams?: Record<string, unknown>;
  cacheTtlMs?: number;
}

function extractStatusCode(err: unknown): number {
  const e = err as { status?: number; statusCode?: number; message?: string };
  if (e.status) return e.status;
  if (e.statusCode) return e.statusCode;
  const msg = e.message ?? "";
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) return 429;
  return 500;
}

function isQuotaError(err: unknown): boolean {
  const status = extractStatusCode(err);
  const msg = (err as { message?: string }).message ?? "";
  return status === 429 || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429");
}

function isNetworkError(err: unknown): boolean {
  const e = err as { message?: string; name?: string; code?: string };
  return (
    e.message?.includes("fetch failed") === true ||
    e.name === "AbortError" ||
    e.name === "TimeoutError" ||
    e.code === "ECONNRESET" ||
    e.code === "ETIMEDOUT"
  );
}

function extractRetryAfterMs(err: unknown): number | undefined {
  const e = err as {
    headers?: Record<string, string>;
    retryAfter?: number;
    errorDetails?: Array<{ retryDelay?: string }>;
  };
  const header = e.headers?.["retry-after"];
  if (header) {
    const seconds = parseInt(header, 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  if (typeof e.retryAfter === "number") return e.retryAfter * 1000;
  const delay = e.errorDetails?.[0]?.retryDelay;
  if (delay?.endsWith("s")) {
    const seconds = parseFloat(delay);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core Gemini call with circuit breaker and selective retry.
 * Retries only 429 (honoring Retry-After), 503, and transient network errors.
 * Never retries 400, 401, 403, 404. Aborts retries when circuit opens.
 */
async function callGeminiCore<T>(
  telemetry: GeminiTelemetry,
  apiCallFn: (client: GoogleGenAI) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const breaker = getGeminiCircuitBreaker();

  if (breaker.isOpen()) {
    throw new CircuitOpenError();
  }

  if (signal?.aborted) {
    throw new DOMException("Gemini request aborted", "AbortError");
  }

  const client = getGeminiClient();
  if (!client) {
    throw new GeminiNotConfiguredError();
  }

  const maxRetries = 3;
  let attempt = 0;
  let delay = 1000;
  const requestId = Math.random().toString(36).substring(2, 11).toUpperCase();
  const startTime = Date.now();

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Gemini request aborted", "AbortError");
    }
    if (breaker.isOpen()) {
      throw new CircuitOpenError();
    }

    attempt++;
    const attemptStart = Date.now();

    try {
      logOnce(
        `req:${telemetry.route}:${attempt}`,
        "info",
        `[GEMINI] id=${requestId} route=${telemetry.route} attempt=${attempt}/${maxRetries}`
      );

      const result = await apiCallFn(client);
      breaker.recordSuccess();

      logOnce(
        `ok:${telemetry.route}`,
        "info",
        `[GEMINI] id=${requestId} route=${telemetry.route} latency=${Date.now() - startTime}ms`
      );

      return result;
    } catch (err: unknown) {
      const statusCode = extractStatusCode(err);
      const quota = isQuotaError(err);
      const network = isNetworkError(err);
      const retryable = quota || statusCode === 503 || network;
      const clientErrorNoRetry = statusCode >= 400 && statusCode < 500 && statusCode !== 429;

      logOnce(
        `fail:${telemetry.route}:${statusCode}`,
        "warn",
        `[GEMINI] id=${requestId} route=${telemetry.route} status=${statusCode} attempt=${attempt} latency=${Date.now() - attemptStart}ms`
      );

      if (clientErrorNoRetry) {
        throw err;
      }

      if (retryable && attempt < maxRetries && !breaker.isOpen()) {
        const retryAfterMs = quota ? extractRetryAfterMs(err) : undefined;
        const jitter = delay * (0.5 + Math.random());
        const waitMs = retryAfterMs ? Math.max(jitter, retryAfterMs) : jitter;

        logOnce(
          `retry:${telemetry.route}`,
          "info",
          `[GEMINI] id=${requestId} backing off ${Math.round(waitMs)}ms before attempt ${attempt + 1}`
        );

        await sleep(waitMs);
        delay *= 2;
        continue;
      }

      if (quota || statusCode === 503) {
        breaker.recordFailure(quota);
      }

      logOnce(
        `err:${telemetry.route}`,
        "error",
        `[GEMINI] id=${requestId} route=${telemetry.route} failed permanently after ${attempt} attempts (${Date.now() - startTime}ms)`
      );
      throw err;
    }
  }
}

/**
 * Executes a Gemini API call through the centralized AI request manager.
 * Provides deduplication, caching, concurrency queue, and circuit breaker protection.
 */
export async function callGeminiWithRetry<T>(
  telemetry: GeminiTelemetry,
  apiCallFn: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  const cacheParams = telemetry.cacheParams ?? { route: telemetry.route };

  return getAiRequestManager().executeStrict<T>(
    telemetry.route,
    cacheParams,
    (signal) => callGeminiCore(telemetry, apiCallFn, signal),
    telemetry.cacheTtlMs
  );
}

/**
 * Executes a Gemini call with a local fallback when the circuit is open or the call fails.
 */
export async function callGeminiWithFallback<T>(
  telemetry: GeminiTelemetry,
  apiCallFn: (client: GoogleGenAI) => Promise<T>,
  fallback: T
): Promise<T> {
  const cacheParams = telemetry.cacheParams ?? { route: telemetry.route };

  return getAiRequestManager().execute<T>(
    telemetry.route,
    cacheParams,
    (signal) => callGeminiCore(telemetry, apiCallFn, signal),
    fallback,
    telemetry.cacheTtlMs
  );
}

export { runIntakeAgent } from "../../backend/app/services/gemini/intake_agent";
export { runPlanningAgent } from "../../backend/app/services/gemini/planning_agent";
export { runCelebrationAgent } from "../../backend/app/services/gemini/celebration_agent";
export { runDocumentAgent } from "../../backend/app/services/gemini/document_agent";

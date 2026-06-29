import { GoogleGenAI } from "@google/genai";
import { logger } from "./loggerService";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let cachedClient: GoogleGenAI | null = null;

/**
 * Returns a cached singleton instance of the unified GoogleGenAI client.
 * Returns null if the API key environment configuration is missing or invalid.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient) return cachedClient;

  let key = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!key) {
    logger.warn("💡 [GEMINI INFO] GEMINI_API_KEY is not defined in process.env.");
    return null;
  }

  // Clean up any wrapping quotes or whitespace
  key = key.trim().replace(/^['"]|['"]$/g, '').trim();

  if (key === "" || key === "MY_GEMINI_API_KEY" || key === "undefined" || key === "null") {
    logger.warn(`💡 [GEMINI INFO] GEMINI_API_KEY holds a placeholder/invalid value.`);
    return null;
  }

  if (key.length < 10) {
    logger.warn("💡 [GEMINI INFO] GEMINI_API_KEY is too short to be valid.");
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

interface GeminiTelemetry {
  route: string;
  model: string;
}

/**
 * Executes a Gemini API call inside an intelligent retry envelope.
 * Retries up to 3 times on status codes 429, 503, and network timeouts.
 * Emits structured logs preserving user privacy.
 */
export async function callGeminiWithRetry<T>(
  telemetry: GeminiTelemetry,
  apiCallFn: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Gemini client is not initialized due to missing or invalid API key.");
  }

  const maxRetries = 3;
  let attempt = 0;
  let delay = 1000; // Base delay in milliseconds
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 11).toUpperCase();

  while (true) {
    attempt++;
    const attemptStartTime = Date.now();
    try {
      logger.info(`[GEMINI REQ] ID=${requestId} Route=${telemetry.route} Model=${telemetry.model} Attempt=${attempt}/${maxRetries}`);
      
      const result = await apiCallFn(client);
      
      const latency = Date.now() - startTime;
      const attemptLatency = Date.now() - attemptStartTime;
      logger.info(`[GEMINI SUCCESS] ID=${requestId} Route=${telemetry.route} Latency=${latency}ms (Attempt=${attemptLatency}ms)`);
      
      return result;
    } catch (err: any) {
      const attemptLatency = Date.now() - attemptStartTime;
      const statusCode = err.status || err.statusCode || (err.message && err.message.includes("429") ? 429 : 500);
      const isRetryable = statusCode === 429 || statusCode === 503 || err.message?.includes("fetch failed") || err.name === "AbortError" || err.name === "TimeoutError";

      logger.warn(`[GEMINI WARN] ID=${requestId} Attempt Failed. Status=${statusCode} Latency=${attemptLatency}ms Retryable=${isRetryable}. Error: ${err.message || err}`);

      if (isRetryable && attempt < maxRetries) {
        const jitter = delay * (0.5 + Math.random());
        logger.info(`[GEMINI RETRY] ID=${requestId} Backing off for ${Math.round(jitter)}ms before attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, jitter));
        delay *= 2; // Exponential backoff scaling
        continue;
      }

      const latency = Date.now() - startTime;
      logger.error(`[GEMINI ERROR] ID=${requestId} Failed permanently. Attempt=${attempt} Latency=${latency}ms Status=${statusCode}`);
      throw err;
    }
  }
}

// Re-export specific agent runner services for modular clean imports
export { runIntakeAgent } from "../../backend/app/services/gemini/intake_agent";
export { runPlanningAgent } from "../../backend/app/services/gemini/planning_agent";
export { runCelebrationAgent } from "../../backend/app/services/gemini/celebration_agent";
export { runDocumentAgent } from "../../backend/app/services/gemini/document_agent";

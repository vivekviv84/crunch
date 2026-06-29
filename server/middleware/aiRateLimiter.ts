import { logger } from "../services/loggerService";

/**
 * Dedicated AI Rate Limiter for /api/agent/* endpoints.
 *
 * Separate from the global CRUD rate limiter to protect the
 * Gemini free-tier quota while allowing normal app usage.
 *
 * Limits:
 *   - 10 requests per minute per IP for AI endpoints
 *   - 60-second window
 *
 * Does NOT affect standard CRUD routes (/api/v1/tasks, /api/v1/keepNotes, etc.).
 */

interface AiRateLimitEntry {
  count: number;
  resetTime: number;
}

const AI_LIMIT_PER_MINUTE = 10;
const AI_WINDOW_MS = 60000; // 1 minute
const aiRequestCounts = new Map<string, AiRateLimitEntry>();

export function aiRateLimiter(req: any, res: any, next: any) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  const data = aiRequestCounts.get(ip);
  if (!data || now > data.resetTime) {
    aiRequestCounts.set(ip, { count: 1, resetTime: now + AI_WINDOW_MS });
    return next();
  }

  data.count++;
  if (data.count > AI_LIMIT_PER_MINUTE) {
    const retryAfter = Math.ceil((data.resetTime - now) / 1000);
    logger.warn(
      `[AI-RateLimiter] IP ${ip} exceeded AI rate limit (${AI_LIMIT_PER_MINUTE}/${AI_WINDOW_MS / 1000}s). Requests: ${data.count}.`
    );
    return res.status(429).json({
      error: {
        code: 429,
        message: `AI generation rate limit exceeded. Please wait ${retryAfter}s before making more AI requests.`,
        status: "RESOURCE_EXHAUSTED",
        retryAfter,
      },
    });
  }

  next();
}

/**
 * Get current AI rate limiter status for monitoring.
 */
export function getAiRateLimiterStatus(): {
  totalTrackedIps: number;
  limitPerMinute: number;
  windowMs: number;
} {
  return {
    totalTrackedIps: aiRequestCounts.size,
    limitPerMinute: AI_LIMIT_PER_MINUTE,
    windowMs: AI_WINDOW_MS,
  };
}

/**
 * Prune stale entries to prevent memory growth.
 */
export function pruneAiRateLimiter(): number {
  const now = Date.now();
  let removed = 0;
  for (const [ip, entry] of aiRequestCounts) {
    if (now > entry.resetTime) {
      aiRequestCounts.delete(ip);
      removed++;
    }
  }
  return removed;
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const removed = pruneAiRateLimiter();
  if (removed > 0) {
    logger.info(`[AI-RateLimiter] Pruned ${removed} stale IP entries.`);
  }
}, 300000);

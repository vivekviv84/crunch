import { sanitizeInput, checkPromptSafety } from "../services/safetyService";
import { logger } from "../services/loggerService";

/**
 * Centrally sanitizes all incoming request body fields for security (OWASP XSS protection).
 * Scans primary prompt properties for forbidden jailbreak and prompt injection patterns.
 */
export function requestSanitizer(req: any, res: any, next: any) {
  if (req.body && typeof req.body === "object") {
    try {
      for (const key of Object.keys(req.body)) {
        if (typeof req.body[key] === "string") {
          const rawVal = req.body[key];
          const cleaned = sanitizeInput(rawVal);
          req.body[key] = cleaned;

          // Enforce strict prompt injection block lists on primary input keys
          if (["text", "prompt", "dumpText", "brainDump", "description"].includes(key)) {
            const safety = checkPromptSafety(cleaned);
            if (!safety.safe) {
              logger.warn(`[Security Alert] Prompt injection blocked on field "${key}" from IP ${req.ip}`);
              return res.status(400).json({
                error: {
                  code: 400,
                  message: safety.reason,
                  status: "INVALID_ARGUMENT"
                }
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[Security Filter] Error parsing body elements: ${err instanceof Error ? err.message : err}`);
    }
  }

  next();
}

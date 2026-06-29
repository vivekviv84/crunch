import { logger } from "./loggerService";

/**
 * Strips script tags, HTML tags, and other potentially harmful entities to prevent XSS
 */
export function sanitizeInput(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  return cleaned.trim();
}

/**
 * Scans input text for prompt injection signatures and jailbreak attempts
 */
export function checkPromptSafety(text: string): { safe: boolean; reason: string | null } {
  const lowercase = text.toLowerCase();
  
  const promptInjectionSignatures = [
    "ignore previous instructions",
    "ignore all previous",
    "system prompt override",
    "ignore rules",
    "bypass safety",
    "jailbreak",
    "dan mode",
    "do anything now"
  ];

  for (const sig of promptInjectionSignatures) {
    if (lowercase.includes(sig)) {
      logger.warn(`[Safety Filter] Potential prompt injection signature detected: "${sig}"`);
      return { 
        safe: false, 
        reason: `Safety Violation: Prompt contains forbidden instruction modifier ("${sig}").` 
      };
    }
  }

  return { safe: true, reason: null };
}

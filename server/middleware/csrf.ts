import crypto from "crypto";
import { logger } from "../services/loggerService";

/**
 * Generates a random CSRF token if one is not already present in the request cookies.
 * Sets it in the '_csrf' cookie with secure attributes (accessible to client JS so it can send headers).
 */
export function csrfGenerator(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === "test") {
    return next();
  }
  const cookies = parseCookies(req.headers.cookie || "");
  let token = cookies["_csrf"];

  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `_csrf=${token}; Path=/; SameSite=Lax; ${process.env.NODE_ENV === "production" ? "Secure" : ""}`
    );
  }

  next();
}

/**
 * Validates the CSRF token on state-changing requests (POST, PUT, DELETE, PATCH).
 * Rejects with 403 if the token in the 'x-csrf-token' header does not match the '_csrf' cookie.
 */
export function csrfValidator(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === "test") {
    return next();
  }
  const method = req.method;
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(method)) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const cookieToken = cookies["_csrf"];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn(`[CSRF Alert] Rejected request from IP ${req.ip} due to token mismatch (Cookie: ${cookieToken ? "Present" : "Missing"}, Header: ${headerToken ? "Present" : "Missing"})`);
    return res.status(403).json({
      error: {
        code: 403,
        message: "Invalid or missing CSRF token.",
        status: "PERMISSION_DENIED"
      }
    });
  }

  next();
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0].trim();
    const value = parts.slice(1).join("=");
    if (name) {
      list[name] = decodeURIComponent(value);
    }
  });

  return list;
}

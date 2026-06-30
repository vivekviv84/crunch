import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";

// Import custom middleware
import { requestLogger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rateLimiter";
import { aiRateLimiter } from "./middleware/aiRateLimiter";
import { logger } from "./services/loggerService";
import { csrfGenerator, csrfValidator } from "./middleware/csrf";
import { requestSanitizer } from "./middleware/safety";

// Import circuit breaker for health monitoring
import { getAiManagerStatus, getAiRequestManager } from "./services/aiRequestManager";
import { getGeminiCircuitBreaker } from "./services/circuitBreaker";
import { getAiRateLimiterStatus } from "./middleware/aiRateLimiter";

// Production Safety: Catch unhandled promises and exceptions to prevent process crash
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`[Unhandled Rejection] at: ${promise}, reason: ${reason instanceof Error ? reason.stack || reason.message : reason}`);
});

process.on("uncaughtException", (error) => {
  logger.error(`[Uncaught Exception] occurred: ${error.stack || error.message}`);
});

// Import modular routers
import authRouter from "./routes/auth";
import tasksRouter from "./routes/tasks";
import keepRouter from "./routes/keep";
import docsRouter from "./routes/docs";
import calendarRouter from "./routes/calendar";
import agentsRouter from "./routes/agents";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// CORS: restrict to known frontend origins only
const FRONTEND_URLS = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((u) => u.trim());
app.use(cors({
  origin: FRONTEND_URLS,
  credentials: true
}));

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xContentTypeOptions: true,
  xFrameOptions: { action: "deny" },
  xXssProtection: true,
}));

// Reduce default JSON body limit to 5MB. Upload routes that need more (e.g. document
// parsing) should handle their own body parsing via multer, not express.json().
app.use(express.json({ limit: "5mb" }));

// Standard logger middleware
app.use(requestLogger);

// Global request body input sanitizer & prompt safety check
app.use(requestSanitizer);

// CSRF Cookie Generator (global for all requests)
app.use(csrfGenerator);

// Global Rate Limiting for all backend API endpoints
app.use("/api", rateLimiter);

// Dedicated AI Rate Limiting for /api/agent/* endpoints (more restrictive)
// Must be placed AFTER the global rate limiter so AI routes hit BOTH limits.
app.use("/api/agent", aiRateLimiter);

// CSRF Validation specifically protecting state-changing API endpoints
app.use("/api", csrfValidator);

// Register Modular Routers
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/keepNotes", keepRouter);
app.use("/api/v1/parse", docsRouter);
app.use("/api/v1/calendar", calendarRouter);
app.use("/", tasksRouter);   // handles CRUD tasks, microtasks, and legacy aliases
app.use("/", agentsRouter);  // handles AI agents, briefings, outlines, SSE chat streams

// Avoid noise logs from browser assets
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/manifest.json", (req, res) => res.status(204).end());

// Health & monitoring endpoint
app.get("/api/health", (req, res) => {
  const cb = getGeminiCircuitBreaker().getMetrics();
  const aiMgr = getAiManagerStatus();
  const aiRate = getAiRateLimiterStatus();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    gemini: {
      circuitBreaker: {
        state: cb.state,
        failures: cb.failures,
        totalCalls: cb.totalCalls,
        totalFailures: cb.totalFailures,
      },
      aiManager: aiMgr,
      aiRateLimiter: aiRate,
    },
  });
});

// Periodic cache pruning for AI manager (every 60s)
setInterval(() => {
  const removed = getAiRequestManager().pruneCache();
  if (removed > 0) {
    logger.info(`[AI-Manager] Pruned ${removed} expired cache entries.`);
  }
}, 60000);

// Global error handler — catches anything that slipped through route-level try/catch.
// Must be registered AFTER all routes and other middleware.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === "production" && status >= 500
    ? "Internal server error"
    : (err.message || "Internal server error");
  logger.error(`[GlobalError] ${req.method} ${req.url} — ${status}: ${err.message || err}`);
  res.status(status).json({ success: false, error: message });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    logger.info("🚀 Starting development server in Single Page Application (SPA) mode...");
    // Initialize Vite development middleware inside Express
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares); 
  } else {
    logger.info("📦 Starting production server serving static build assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`📡 CRUNCH Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info("[Server] HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("[Server] Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();

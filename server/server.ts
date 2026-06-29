import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";

// Import custom middleware
import { requestLogger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rateLimiter";
import { logger } from "./services/loggerService";
import { csrfGenerator, csrfValidator } from "./middleware/csrf";
import { requestSanitizer } from "./middleware/safety";

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

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false,     // Disable CSP to allow Vite scripts/styles to run locally
  crossOriginEmbedderPolicy: false  // Disable COEP to allow dynamic media elements
}));
app.use(cors({
  origin: true,
  credentials: true
}));

// Enable large JSON payloads (up to 50MB) for file parses/images
app.use(express.json({ limit: "50mb" }));

// Standard logger middleware
app.use(requestLogger);

// Global request body input sanitizer & prompt safety check
app.use(requestSanitizer);

// CSRF Cookie Generator (global for all requests)
app.use(csrfGenerator);

// Global Rate Limiting for all backend API endpoints
app.use("/api", rateLimiter);

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

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`📡 CRUNCH Server running on port ${PORT}`);
  });
}

startServer();

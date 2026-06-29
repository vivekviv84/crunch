import { logger } from "../services/loggerService";

const SKIP_PATHS = ["/favicon.ico", "/manifest.json", "/@vite", "/node_modules", "/src/"];

export function requestLogger(req: any, res: any, next: any) {
  const url = req.url || "";
  if (SKIP_PATHS.some((p) => url.startsWith(p))) {
    return next();
  }
  if (url.startsWith("/api/")) {
    logger.info(`${req.method} ${url.split("?")[0]}`);
  }
  next();
}

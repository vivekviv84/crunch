import { logger } from "../services/loggerService";

export function requestLogger(req: any, res: any, next: any) {
  logger.info(`${req.method} ${req.url}`);
  next();
}

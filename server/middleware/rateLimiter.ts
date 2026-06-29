const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(req: any, res: any, next: any) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const limit = 30; // 30 requests per minute limit
  const windowMs = 60000; // 1 minute window

  const data = ipRequestCounts.get(ip);
  if (!data || now > data.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  data.count++;
  if (data.count > limit) {
    return res.status(429).json({
      error: {
        code: 429,
        message: "You have sent too many requests. Please wait a moment before trying again.",
        status: "RESOURCE_EXHAUSTED"
      }
    });
  }

  next();
}

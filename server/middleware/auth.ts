import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required. Set it in your .env file before starting the server.");
}

const ALLOW_DEV_BYPASS = process.env.ALLOW_DEV_BYPASS === "true";

export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
 
  if (!token) {
    if (ALLOW_DEV_BYPASS && process.env.NODE_ENV === "development") {
      // Explicit dev bypass only when ALLOW_DEV_BYPASS=true and NODE_ENV=development
      req.user = { id: "usr-default", email: "demo@crunch.ai", fullName: "Demo User" };
      return next();
    }
    return res.status(401).json({ error: "Authentication token required" });
  }
 
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired access token" });
    }
    req.user = user;
    next();
  });
}

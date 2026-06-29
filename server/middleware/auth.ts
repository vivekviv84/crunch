import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "crunch-hyper-secure-rescue-pilot-jwt-key-2026";

export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
 
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      // Dev bypass logic: automatically logs in demo profile
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

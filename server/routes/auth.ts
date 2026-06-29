import express from "express";
import jwt from "jsonwebtoken";
import { dbUpsertUser } from "../repositories/taskRepository";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "crunch-hyper-secure-rescue-pilot-jwt-key-2026";

router.post("/google", async (req, res) => {
  const { email, fullName, avatarUrl, firebaseUid } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required for authentication" });
  }

  try {
    const userId = firebaseUid || `usr-${Buffer.from(email).toString("base64").substring(0, 8).toLowerCase()}`;
    const userProfile = {
      id: userId,
      email: email,
      fullName: fullName || email.split("@")[0],
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`
    };

    const savedUser = await dbUpsertUser(userProfile);
    const token = jwt.sign(
      { id: savedUser.id, email: savedUser.email, fullName: savedUser.fullName },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({ user: savedUser, token });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to authenticate session" });
  }
});

router.get("/me", authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

export default router;

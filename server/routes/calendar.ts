import express from "express";
import { authenticateToken } from "../middleware/auth";
import { dbGetTasks } from "../repositories/taskRepository";
import { mapTaskToCalendar } from "../services/calendarService";

const router = express.Router();

router.get("/events", authenticateToken, async (req: any, res) => {
  try {
    const tasks = await dbGetTasks(req.user.id);
    const events = tasks.flatMap((t: any) => mapTaskToCalendar(t));
    res.json({ success: true, data: events });
  } catch (err: any) {
    const message = process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error");
    res.status(500).json({ success: false, error: message });
  }
});

export default router;

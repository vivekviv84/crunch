import express from "express";
import { authenticateToken } from "../middleware/auth";
import { dbGetTasks } from "../repositories/taskRepository";
import { mapTaskToCalendar } from "../services/calendarService";

const router = express.Router();

router.get("/events", authenticateToken, async (req: any, res) => {
  try {
    const tasks = await dbGetTasks(req.user.id);
    const events = tasks.flatMap(t => mapTaskToCalendar(t));
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

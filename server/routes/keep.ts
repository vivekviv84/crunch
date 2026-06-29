import express from "express";
import { authenticateToken } from "../middleware/auth";
import { 
  dbGetKeepNotes, 
  dbSaveKeepNote, 
  dbDeleteKeepNote 
} from "../repositories/taskRepository";

const router = express.Router();

// 1. GET ALL NOTES
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const notes = await dbGetKeepNotes(req.user.id);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CREATE/SAVE NOTE
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const note = {
      ...req.body,
      ownerId: req.user.id,
      updatedAt: new Date().toISOString()
    };
    const saved = await dbSaveKeepNote(note);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. UPDATE NOTE
router.put("/:id", authenticateToken, async (req: any, res) => {
  try {
    const notes = await dbGetKeepNotes(req.user.id);
    const current = notes.find((n: any) => n.id === req.params.id);
    if (!current) {
      return res.status(404).json({ error: "Note not found" });
    }
    const updated = { 
      ...current, 
      ...req.body, 
      id: req.params.id, 
      ownerId: req.user.id, 
      updatedAt: new Date().toISOString() 
    };
    const saved = await dbSaveKeepNote(updated);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE NOTE
router.delete("/:id", authenticateToken, async (req: any, res) => {
  try {
    const success = await dbDeleteKeepNote(req.params.id, req.user.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

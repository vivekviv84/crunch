import express from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { 
  dbGetKeepNotes, 
  dbSaveKeepNote, 
  dbDeleteKeepNote 
} from "../repositories/taskRepository";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas — strict validation with .strict() to reject unknown keys
// (mass-assignment prevention)
// ─────────────────────────────────────────────────────────────────────────────

const keepNoteSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
  color: z.string().max(32).optional(),
  pinned: z.boolean().optional(),
  isChecklist: z.boolean().optional(),
  checklistItems: z.array(z.any()).max(100).optional(),
  labels: z.array(z.string().max(32)).max(20).optional(),
}).strict();

const updateKeepNoteSchema = keepNoteSchema.partial().strict();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function handleError(res: any, err: any, notFoundCheck = false): void {
  const status = err.status || (notFoundCheck && err.message?.includes("not found") ? 404 : 500);
  const message = status >= 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : (err.message || "Internal server error");
  res.status(status).json({ success: false, error: message });
}

// 1. GET ALL NOTES
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const notes = await dbGetKeepNotes(req.user.id, limit, offset);
    res.json({ success: true, data: notes, pagination: { limit, offset, count: notes.length } });
  } catch (err: any) {
    handleError(res, err);
  }
});

// 2. CREATE/SAVE NOTE
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const parsed = keepNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const note = {
      id: parsed.data.id,
      title: parsed.data.title || "",
      content: parsed.data.content || "",
      color: parsed.data.color || "default",
      pinned: parsed.data.pinned || false,
      isChecklist: parsed.data.isChecklist || false,
      checklistItems: parsed.data.checklistItems || [],
      labels: parsed.data.labels || [],
      ownerId: req.user.id,
      updatedAt: new Date().toISOString()
    };
    const saved = await dbSaveKeepNote(note);
    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    handleError(res, err);
  }
});

// 3. UPDATE NOTE
router.put("/:id", authenticateToken, async (req: any, res) => {
  try {
    const parsed = updateKeepNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const notes = await dbGetKeepNotes(req.user.id);
    const current = notes.find((n: any) => n.id === req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }
    const updated = {
      id: req.params.id,
      title: parsed.data.title !== undefined ? parsed.data.title : current.title,
      content: parsed.data.content !== undefined ? parsed.data.content : current.content,
      color: parsed.data.color !== undefined ? parsed.data.color : current.color,
      pinned: parsed.data.pinned !== undefined ? parsed.data.pinned : current.pinned,
      isChecklist: parsed.data.isChecklist !== undefined ? parsed.data.isChecklist : current.isChecklist,
      checklistItems: parsed.data.checklistItems !== undefined ? parsed.data.checklistItems : current.checklistItems,
      labels: parsed.data.labels !== undefined ? parsed.data.labels : current.labels,
      ownerId: req.user.id,
      updatedAt: new Date().toISOString()
    };
    const saved = await dbSaveKeepNote(updated);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    handleError(res, err, true);
  }
});

// 4. DELETE NOTE
router.delete("/:id", authenticateToken, async (req: any, res) => {
  try {
    const success = await dbDeleteKeepNote(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ success: false, error: "Note not found or unauthorized" });
    }
    res.json({ success: true });
  } catch (err: any) {
    handleError(res, err);
  }
});

export default router;

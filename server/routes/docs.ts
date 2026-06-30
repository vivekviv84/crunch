import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth";
import { 
  dbSaveTask, 
  addAgentLog 
} from "../repositories/taskRepository";
import { runDocumentAgent, runPlanningAgent } from "../services/geminiService";

const router = express.Router();

// Allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOC, DOCX, TXT, MD, HTML, PNG, JPEG, WEBP.`));
    }
  }
});

router.post("/document", authenticateToken, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const fileName = req.file.originalname;

    addAgentLog("Document Agent", "ACT", `Parsing file: ${fileName.replace(/[<>'"&]/g, '')} (${mimeType}).`);
    
    // Call Document Agent (using Gemini 1.5 Pro to parse raw syllabus/rubric buffers)
    const docSpecs = await runDocumentAgent(fileBuffer, mimeType, fileName);
    addAgentLog("Document Agent", "OBSERVE", `Parsed: "${docSpecs.title.replace(/[<>'"&]/g, '')}" | Word Count: ${docSpecs.word_count || 'N/A'}`);

    // Call Planning Agent to design a rescue plan automatically
    addAgentLog("Planning Agent", "ACT", `Generating Battle Plan for: "${docSpecs.title.replace(/[<>'"&]/g, '')}"`);
    const plan = await runPlanningAgent(
      docSpecs.title,
      docSpecs.deadline,
      `Deliverables: ${docSpecs.deliverables.join(", ")}. Rubric: ${docSpecs.rubric.join(", ")}`,
      docSpecs.complexity > 7 ? "High" : docSpecs.complexity > 4 ? "Medium" : "Low",
      docSpecs
    );

    // Save task autonomously
    const subtasksFormatted = (plan.subtasks || []).map((st: any, i: number) => ({
      id: `sub-${Date.now()}-${i}`,
      title: st.title,
      durationMin: st.durationMin,
      completed: false,
      implementationIntention: st.implementationIntention || "If I start, I will complete this."
    }));

    const calendarSchedule = (plan.calendarSchedule || []).map((item: any, i: number) => ({
      id: `cal-${Date.now()}-${i}`,
      time: item.time,
      taskTitle: item.taskTitle,
      duration: item.duration
    }));

    const savedTask = {
      id: `task-${Date.now()}`,
      title: docSpecs.title,
      deadline: docSpecs.deadline,
      complexity: docSpecs.complexity > 7 ? "High" : docSpecs.complexity > 4 ? "Medium" : "Low",
      status: "Pending",
      urgencyScore: plan.urgencyScore || 60,
      description: `Deliverables:\n${docSpecs.deliverables.map((d: string) => `- ${d}`).join("\n")}\n\nSubmission requirements:\n${docSpecs.submission_requirements || ""}`,
      starterTask: plan.starterTask,
      subtasks: subtasksFormatted,
      calendarSchedule: calendarSchedule,
      paceState: plan.paceState || "On Track",
      isRescueActive: plan.urgencyScore > 80,
      documentExtractedText: `Word count: ${docSpecs.word_count || 'Unknown'}\nRubric:\n${docSpecs.rubric.join("\n")}`,
      ownerId: req.user.id,
      wordCount: docSpecs.word_count,
      estimatedHours: docSpecs.estimated_hours,
      submissionRequirements: docSpecs.submission_requirements,
      xpGained: 0
    };

    const saved = await dbSaveTask(savedTask);

    addAgentLog("Planning Agent", "OBSERVE", `Saved Battle Plan task successfully with ${subtasksFormatted.length} microtasks!`, req.user.id);
    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    const status = err.status || (err.message?.includes("Unsupported file type") ? 400 : 500);
    const message = status >= 500 && process.env.NODE_ENV === "production"
      ? "Failed to parse document"
      : (err.message || "Failed to parse document");
    res.status(status).json({ success: false, error: message });
  }
});

export default router;

import { z } from "zod";
import * as taskService from "../services/taskService";

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas — strict validation with .strict() to reject unknown keys
// (mass-assignment prevention)
// ─────────────────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(200).optional(),
  deadline: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  complexity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  status: z.enum(["Pending", "In Progress", "Completed", "Blocked"]).optional(),
  urgencyScore: z.number().min(0).max(100).optional(),
  description: z.string().max(5000).optional(),
  starterTask: z.string().max(500).optional(),
  subtasks: z.array(z.any()).max(100).optional(),
  calendarSchedule: z.array(z.any()).max(100).optional(),
  paceState: z.enum(["On Track", "At Risk", "Critical", "Impossible"]).optional(),
  isRescueActive: z.boolean().optional(),
  documentExtractedText: z.string().max(50000).optional(),
  color: z.string().max(32).optional(),
  isRecurring: z.boolean().optional(),
  recurrence: z.string().max(64).optional(),
  ownerId: z.string().max(64).optional(),
  createdAt: z.string().optional(),
  deadlinesList: z.array(z.string()).max(100).optional(),
  deliverablesList: z.array(z.string()).max(100).optional(),
  rubricHighlights: z.string().max(5000).optional(),
  urgencyAssessment: z.string().max(5000).optional(),
  wordCount: z.number().optional(),
  estimatedHours: z.number().optional(),
  submissionRequirements: z.string().max(5000).optional(),
  xpGained: z.number().optional(),
  encouragementMessage: z.string().max(2000).optional(),
}).strict();

const updateTaskSchema = createTaskSchema.omit({ id: true }).partial().strict();

const createMicrotaskSchema = z.object({
  taskId: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  durationMin: z.number().min(1).max(1440).optional(),
  implementationIntention: z.string().max(500).optional(),
  sequenceOrder: z.number().min(0).optional(),
}).strict();

const updateMicrotaskSchema = z.object({
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  durationMin: z.number().min(1).max(1440).optional(),
  implementationIntention: z.string().max(500).optional(),
}).strict();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPagination(req: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { limit, offset };
}

function handleError(res: any, err: any, notFoundCheck = true): void {
  const status = err.status || (notFoundCheck && err.message?.includes("not found") ? 404 : 500);
  const message = status >= 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : (err.message || "Internal server error");
  res.status(status).json({ success: false, error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

export async function getTasksController(req: any, res: any) {
  try {
    const { limit, offset } = getPagination(req);
    const tasks = await taskService.getTasks(req.user.id, limit, offset);
    res.json({ success: true, data: tasks, pagination: { limit, offset, count: tasks.length } });
  } catch (err: any) {
    handleError(res, err, false);
  }
}

export async function getTaskByIdController(req: any, res: any) {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found or unauthorized" });
    }
    res.json({ success: true, data: task });
  } catch (err: any) {
    handleError(res, err, false);
  }
}

export async function createTaskController(req: any, res: any) {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("[Zod Validation Error on createTask]:", JSON.stringify(parsed.error.issues, null, 2));
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const saved = await taskService.createTask(parsed.data, req.user.id);
    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    handleError(res, err, false);
  }
}

export async function updateTaskController(req: any, res: any) {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("[Zod Validation Error on updateTask]:", JSON.stringify(parsed.error.issues, null, 2));
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const saved = await taskService.updateTask(req.params.id, parsed.data, req.user.id);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    handleError(res, err);
  }
}

export async function deleteTaskController(req: any, res: any) {
  try {
    const success = await taskService.deleteTask(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ success: false, error: "Task not found or unauthorized" });
    }
    res.json({ success: true });
  } catch (err: any) {
    handleError(res, err, false);
  }
}

export async function getMicrotasksController(req: any, res: any) {
  try {
    const taskId = req.query.taskId as string | undefined;
    const { limit, offset } = getPagination(req);
    const list = await taskService.getMicrotasks(taskId, req.user.id);
    const paginated = list.slice(offset, offset + limit);
    res.json({ success: true, data: paginated, pagination: { limit, offset, total: list.length } });
  } catch (err: any) {
    handleError(res, err, false);
  }
}

export async function createMicrotaskController(req: any, res: any) {
  try {
    const parsed = createMicrotaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { taskId, title, durationMin, implementationIntention, sequenceOrder } = parsed.data;
    const result = await taskService.createMicrotask(
      taskId,
      title,
      durationMin,
      implementationIntention,
      sequenceOrder,
      req.user.id
    );
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    handleError(res, err);
  }
}

export async function patchMicrotaskController(req: any, res: any) {
  try {
    const parsed = updateMicrotaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const result = await taskService.patchMicrotask(req.params.id, parsed.data, req.user.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    handleError(res, err);
  }
}

export async function deleteMicrotaskController(req: any, res: any) {
  try {
    await taskService.deleteMicrotask(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    handleError(res, err);
  }
}

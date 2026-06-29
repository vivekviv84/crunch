import express from "express";
import { authenticateToken } from "../middleware/auth";
import {
  getTasksController,
  getTaskByIdController,
  createTaskController,
  updateTaskController,
  deleteTaskController,
  getMicrotasksController,
  createMicrotaskController,
  patchMicrotaskController,
  deleteMicrotaskController
} from "../controllers/taskController";

const router = express.Router();

// Standard Scoped API Routes (Tasks CRUD)
router.get("/api/v1/tasks", authenticateToken, getTasksController);
router.get("/api/v1/tasks/:id", authenticateToken, getTaskByIdController);
router.post("/api/v1/tasks", authenticateToken, createTaskController);
router.patch("/api/v1/tasks/:id", authenticateToken, updateTaskController);
router.put("/api/v1/tasks/:id", authenticateToken, updateTaskController);
router.delete("/api/v1/tasks/:id", authenticateToken, deleteTaskController);

// Legacy Compatibility API Aliases (Tasks)
router.get("/api/tasks", authenticateToken, getTasksController);
router.post("/api/tasks", authenticateToken, createTaskController);
router.put("/api/tasks/:id", authenticateToken, updateTaskController);
router.delete("/api/tasks/:id", authenticateToken, deleteTaskController);

// Flat Microtasks Endpoints (supports array and single path matches)
router.get(["/microtasks", "/api/v1/microtasks"], authenticateToken, getMicrotasksController);
router.post(["/microtasks", "/api/v1/microtasks"], authenticateToken, createMicrotaskController);
router.patch(["/microtasks/:id", "/api/v1/microtasks/:id"], authenticateToken, patchMicrotaskController);
router.delete(["/microtasks/:id", "/api/v1/microtasks/:id"], authenticateToken, deleteMicrotaskController);

export default router;

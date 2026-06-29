import * as taskService from "../services/taskService";

export async function getTasksController(req: any, res: any) {
  try {
    const tasks = await taskService.getTasks(req.user.id);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTaskByIdController(req: any, res: any) {
  try {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found or unauthorized" });
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTaskController(req: any, res: any) {
  try {
    const saved = await taskService.createTask(req.body, req.user.id);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTaskController(req: any, res: any) {
  try {
    const saved = await taskService.updateTask(req.params.id, req.body, req.user.id);
    res.json(saved);
  } catch (err: any) {
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTaskController(req: any, res: any) {
  try {
    const success = await taskService.deleteTask(req.params.id, req.user.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMicrotasksController(req: any, res: any) {
  try {
    const taskId = req.query.taskId;
    const list = await taskService.getMicrotasks(taskId, req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createMicrotaskController(req: any, res: any) {
  try {
    const { taskId, title, durationMin, implementationIntention, sequenceOrder } = req.body;
    if (!taskId || !title) {
      return res.status(400).json({ error: "taskId and title are required" });
    }
    const result = await taskService.createMicrotask(
      taskId,
      title,
      durationMin,
      implementationIntention,
      sequenceOrder,
      req.user.id
    );
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

export async function patchMicrotaskController(req: any, res: any) {
  try {
    const id = req.params.id;
    const result = await taskService.patchMicrotask(id, req.body, req.user.id);
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

export async function deleteMicrotaskController(req: any, res: any) {
  try {
    const id = req.params.id;
    await taskService.deleteMicrotask(id, req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

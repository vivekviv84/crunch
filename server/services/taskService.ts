import { 
  dbGetTasks, 
  dbGetTaskById, 
  dbSaveTask, 
  dbDeleteTask,
  addAgentLog
} from "../repositories/taskRepository";
import { runCelebrationAgent } from "../services/geminiService";

export interface TaskInput {
  id?: string;
  title?: string;
  deadline?: string;
  startTime?: string;
  complexity?: string;
  status?: string;
  urgencyScore?: number;
  description?: string;
  starterTask?: string;
  subtasks?: any[];
  calendarSchedule?: any[];
  paceState?: string;
  isRescueActive?: boolean;
  documentExtractedText?: string;
  color?: string;
  isRecurring?: boolean;
  recurrence?: string;
}

export async function getTasks(userId: string) {
  return await dbGetTasks(userId);
}

export async function getTaskById(taskId: string, userId: string) {
  return await dbGetTaskById(taskId, userId);
}

export async function createTask(data: TaskInput, userId: string) {
  const newTask = {
    id: data.id || `task-${Date.now()}`,
    title: data.title || "Untitled Operation",
    deadline: data.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    complexity: data.complexity || "Medium",
    status: data.status || "Pending",
    urgencyScore: data.urgencyScore || 50,
    description: data.description || "",
    starterTask: data.starterTask || "Take a deep breath and open your work file (2 mins)",
    subtasks: data.subtasks || [],
    calendarSchedule: data.calendarSchedule || [],
    paceState: data.paceState || "On Track",
    isRescueActive: data.isRescueActive || false,
    documentExtractedText: data.documentExtractedText || "",
    ownerId: userId,
    color: data.color || "default",
    isRecurring: data.isRecurring || false,
    recurrence: data.recurrence || "none"
  };
  return await dbSaveTask(newTask);
}

export async function updateTask(taskId: string, data: Partial<TaskInput>, userId: string) {
  const current = await dbGetTaskById(taskId, userId);
  if (!current) {
    throw new Error("Task not found or unauthorized");
  }
  const updated = { ...current, ...data, id: taskId, ownerId: userId };
  return await dbSaveTask(updated);
}

export async function deleteTask(taskId: string, userId: string) {
  return await dbDeleteTask(taskId, userId);
}

export async function getMicrotasks(taskId: string | undefined, userId: string) {
  if (taskId) {
    const task = await dbGetTaskById(taskId, userId);
    if (!task) return [];
    return (task.subtasks || []).map((st: any, idx: number) => ({
      id: st.id,
      taskId: task.id,
      title: st.title,
      durationMin: st.durationMin,
      completed: st.completed || false,
      implementationIntention: st.implementationIntention || "",
      sequenceOrder: idx
    }));
  }

  const tasks = await dbGetTasks(userId);
  const list: any[] = [];
  tasks.forEach(t => {
    (t.subtasks || []).forEach((st: any, idx: number) => {
      list.push({
        id: st.id,
        taskId: t.id,
        title: st.title,
        durationMin: st.durationMin,
        completed: st.completed || false,
        implementationIntention: st.implementationIntention || "",
        sequenceOrder: idx
      });
    });
  });
  return list;
}

export async function createMicrotask(
  taskId: string,
  title: string,
  durationMin: number | undefined,
  implementationIntention: string | undefined,
  sequenceOrder: number | undefined,
  userId: string
) {
  const parentTask = await dbGetTaskById(taskId, userId);
  if (!parentTask) {
    throw new Error("Task not found or unauthorized");
  }

  const newMicro = {
    id: `sub-${Date.now()}`,
    title,
    durationMin: durationMin || 20,
    completed: false,
    implementationIntention: implementationIntention || ""
  };

  if (!parentTask.subtasks) parentTask.subtasks = [];
  parentTask.subtasks.push(newMicro);

  await dbSaveTask(parentTask);
  return {
    ...newMicro,
    taskId,
    sequenceOrder: sequenceOrder || (parentTask.subtasks.length - 1)
  };
}

export async function patchMicrotask(microtaskId: string, updateData: any, userId: string) {
  const tasks = await dbGetTasks(userId);
  let parentTask: any = null;
  let subIdx = -1;

  for (const t of tasks) {
    const idx = (t.subtasks || []).findIndex((s: any) => s.id === microtaskId);
    if (idx !== -1) {
      parentTask = t;
      subIdx = idx;
      break;
    }
  }

  if (!parentTask) {
    throw new Error("Microtask not found or unauthorized");
  }

  const subtask = parentTask.subtasks[subIdx];
  const isNowCompleted = updateData.completed !== undefined ? updateData.completed : subtask.completed;
  const wasCompleted = subtask.completed;

  // Update specific subtask fields
  parentTask.subtasks[subIdx] = {
    ...subtask,
    ...updateData,
    id: microtaskId
  };

  let encouragementMessage = "";
  let xpGained = 0;

  if (!wasCompleted && isNowCompleted) {
    xpGained = 25;
    parentTask.xpGained = (parentTask.xpGained || 0) + xpGained;
    
    addAgentLog("Celebration Agent", "ACT", `Generating encouragement for completing microtask "${subtask.title}"`, userId);
    encouragementMessage = await runCelebrationAgent(parentTask.title, subtask.title, xpGained);
    parentTask.encouragementMessage = encouragementMessage;
    addAgentLog("Celebration Agent", "OBSERVE", `Celebration logged: "${encouragementMessage}"`, userId);
  }

  const totalSubtasks = parentTask.subtasks.length;
  const completedSubtasks = parentTask.subtasks.filter((s: any) => s.completed).length;
  const ratio = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) : 0;
  
  if (totalSubtasks > 0) {
    if (ratio === 1) {
      parentTask.status = "Completed";
      parentTask.paceState = "On Track";
    } else {
      parentTask.status = "In Progress";
      
      const remainingMs = new Date(parentTask.deadline).getTime() - Date.now();
      const remainingHours = remainingMs / (1000 * 60 * 60);

      if (remainingHours <= 0) {
        parentTask.paceState = "Impossible";
      } else if (remainingHours < 4 && ratio < 0.5) {
        parentTask.paceState = "Critical";
      } else if (remainingHours < 12 && ratio < 0.3) {
        parentTask.paceState = "Critical";
      } else if (ratio < 0.3) {
        parentTask.paceState = "At Risk";
      } else {
        parentTask.paceState = "On Track";
      }
    }
  }

  await dbSaveTask(parentTask);
  return {
    microtask: {
      ...parentTask.subtasks[subIdx],
      taskId: parentTask.id,
      sequenceOrder: subIdx
    },
    xpGained,
    encouragementMessage
  };
}

export async function deleteMicrotask(microtaskId: string, userId: string) {
  const tasks = await dbGetTasks(userId);
  let parentTask: any = null;

  for (const t of tasks) {
    const exists = (t.subtasks || []).some((s: any) => s.id === microtaskId);
    if (exists) {
      parentTask = t;
      break;
    }
  }

  if (!parentTask) {
    throw new Error("Microtask not found or unauthorized");
  }

  parentTask.subtasks = parentTask.subtasks.filter((s: any) => s.id !== microtaskId);
  await dbSaveTask(parentTask);
  return true;
}

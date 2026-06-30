import { create } from "zustand";
import { Task, AgentLog, TaskStatus, PaceState } from "../types/index";
import { api } from "../services/api";
import * as FirestoreService from "../services/FirestoreService";
import { useUserStore } from "./useUserStore";
import { auth } from "../services/firebase";

function tasksFingerprint(tasks: Task[]): string {
  return tasks
    .map((t) => {
      const completed = t.subtasks?.filter((s) => s.completed).length ?? 0;
      return `${t.id}:${t.status}:${t.paceState}:${completed}/${t.subtasks?.length ?? 0}`;
    })
    .join("|");
}

function logsFingerprint(logs: AgentLog[]): string {
  if (logs.length === 0) return "";
  const latest = logs[0];
  return `${logs.length}:${latest?.timestamp ?? ""}:${latest?.message?.slice(0, 32) ?? ""}`;
}

let fetchTasksInflight: Promise<void> | null = null;
let fetchLogsInflight: Promise<void> | null = null;

interface TaskState {
  tasks: Task[];
  logs: AgentLog[];
  selectedTaskId: string;
  loading: boolean;
  error: string | null;
  
  fetchTasks: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  setSelectedTaskId: (id: string) => void;
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  createTaskFromIntake: (text: string) => Promise<Task>;
  updateTask: (id: string, updateData: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  clearLogs: () => Promise<void>;
  regeneratePlan: (taskId: string) => Promise<void>;
  parseAndCreateTask: (file: File, onProgress: (progress: number) => void) => Promise<Task>;
  toggleMicroTask: (taskId: string, microtaskId: string, completed: boolean) => Promise<{ microtask: any; xpGained: number; encouragementMessage: string }>;
  addMicroTask: (taskId: string, title: string, durationMin: number, implementationIntention: string) => Promise<void>;
  deleteMicroTask: (taskId: string, microtaskId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  logs: [],
  selectedTaskId: "",
  loading: false,
  error: null,

  fetchTasks: async () => {
    if (fetchTasksInflight) return fetchTasksInflight;

    fetchTasksInflight = (async () => {
      const { isAuthenticated, authInitialized, user } = useUserStore.getState();
      const isDemo = user?.id?.startsWith("demo-");
      if (!isAuthenticated || !authInitialized || !user?.id || (!isDemo && !auth.currentUser)) {
        return;
      }

      const alreadyLoading = get().loading;
      if (!alreadyLoading) {
        set({ loading: true, error: null });
      }

      try {
        const userId = user.id;
        const data = await FirestoreService.getAllTasks(userId);
        const prev = get().tasks;
        const nextSelected =
          get().selectedTaskId || (data.length > 0 ? data[0].id : "");

        if (tasksFingerprint(prev) !== tasksFingerprint(data)) {
          set({
            tasks: data,
            loading: false,
            selectedTaskId: nextSelected,
          });
        } else {
          set({ loading: false });
        }
      } catch (err: any) {
        console.error("fetchTasks failed:", err);
        set({ error: err.message || "Failed to fetch tasks", loading: false });
      }
    })().finally(() => {
      fetchTasksInflight = null;
    });

    return fetchTasksInflight;
  },

  fetchLogs: async () => {
    if (fetchLogsInflight) return fetchLogsInflight;

    fetchLogsInflight = (async () => {
      const { isAuthenticated, authInitialized, user } = useUserStore.getState();
      const isDemo = user?.id?.startsWith("demo-");
      if (!isAuthenticated || !authInitialized || !user?.id || (!isDemo && !auth.currentUser)) {
        return;
      }

      try {
        const userId = user.id;
        const logs = await FirestoreService.getAgentLogs(userId);
        const prev = get().logs;
        if (logsFingerprint(prev) !== logsFingerprint(logs)) {
          set({ logs });
        }
      } catch (err: any) {
        console.error("Error fetching logs:", err);
      }
    })().finally(() => {
      fetchLogsInflight = null;
    });

    return fetchLogsInflight;
  },

  setSelectedTaskId: (id: string) => set({ selectedTaskId: id }),

  // Optimistic CreateTask
  createTask: async (taskData) => {
    const previousTasks = get().tasks;
    const tempId = `temp-${Date.now()}`;
    const tempTask: Task = {
      id: tempId,
      title: taskData.title || "Untitled Rescue Operation",
      deadline: taskData.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      complexity: taskData.complexity || "Medium",
      status: taskData.status || "Pending",
      urgencyScore: taskData.urgencyScore || 50,
      description: taskData.description || "",
      starterTask: taskData.starterTask || "Take a deep breath and open your work file (2 mins)",
      subtasks: taskData.subtasks || [],
      calendarSchedule: taskData.calendarSchedule || [],
      paceState: taskData.paceState || "On Track",
      isRescueActive: taskData.isRescueActive || false,
      documentExtractedText: taskData.documentExtractedText || ""
    };

    // Optimistically insert tempTask
    set({
      tasks: [...previousTasks, tempTask],
      selectedTaskId: tempId,
      error: null
    });

    try {
      const userId = useUserStore.getState().user?.id || "usr-default";
      const savedTask = await FirestoreService.createTask(taskData, userId);
      
      // Replace tempTask with savedTask from database
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempId ? savedTask : t)),
        selectedTaskId: state.selectedTaskId === tempId ? savedTask.id : state.selectedTaskId
      }));
      return savedTask;
    } catch (err: any) {
      // Rollback to previous state on failure
      set({ tasks: previousTasks, selectedTaskId: previousTasks[0]?.id || "", error: err.message });
      throw err;
    }
  },

  // Task intake co-pilot triggering Gemini logic + saving in db
  createTaskFromIntake: async (text: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post<any>("/api/v1/tasks/intake", { text });
      let extractedTask = response.data;
      if (extractedTask && typeof extractedTask === "object" && "success" in extractedTask && "data" in extractedTask) {
        extractedTask = extractedTask.data;
      }
      if (Array.isArray(extractedTask)) {
        extractedTask = extractedTask[0];
      }
      
      const userId = useUserStore.getState().user?.id || "usr-default";
      const newTask = await FirestoreService.createTask(extractedTask, userId);
      
      set((state) => ({
        tasks: [...state.tasks, newTask],
        selectedTaskId: newTask.id,
        loading: false
      }));
      
      // Update logs after creation
      await get().fetchLogs();
      return newTask;
    } catch (err: any) {
      set({ 
        error: err.response?.data?.error || err.message || "Failed to parse and save task", 
        loading: false 
      });
      throw err;
    }
  },

  // Optimistic UpdateTask
  updateTask: async (id, updateData) => {
    const previousTasks = get().tasks;
    const task = previousTasks.find(t => t.id === id);
    let finalUpdateData: Partial<Task> = { ...updateData };

    if (task && updateData.status === "Completed" && task.isRecurring) {
      if (task.recurrence === "daily") {
        const currentDeadlineDate = new Date(task.deadline);
        currentDeadlineDate.setDate(currentDeadlineDate.getDate() + 1);
        finalUpdateData.deadline = currentDeadlineDate.toISOString();
        finalUpdateData.status = "Pending";
        if (task.subtasks && task.subtasks.length > 0) {
          finalUpdateData.subtasks = task.subtasks.map(s => ({ ...s, completed: false }));
        }
      } else if (task.recurrence === "weekly") {
        const currentDeadlineDate = new Date(task.deadline);
        currentDeadlineDate.setDate(currentDeadlineDate.getDate() + 7);
        finalUpdateData.deadline = currentDeadlineDate.toISOString();
        finalUpdateData.status = "Pending";
        if (task.subtasks && task.subtasks.length > 0) {
          finalUpdateData.subtasks = task.subtasks.map(s => ({ ...s, completed: false }));
        }
      }
    }
    
    // Optimistically update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...finalUpdateData } : t)),
      error: null
    }));

    try {
      const savedTask = await FirestoreService.updateTask(id, finalUpdateData);
      
      // Re-synchronize with exact server object
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? savedTask : t))
      }));
      return savedTask;
    } catch (err: any) {
      // Rollback on failure
      set({ tasks: previousTasks, error: err.message });
      throw err;
    }
  },

  // Optimistic DeleteTask
  deleteTask: async (id) => {
    const previousTasks = get().tasks;
    const remaining = previousTasks.filter((t) => t.id !== id);
    const nextSelectedId = get().selectedTaskId === id 
      ? (remaining.length > 0 ? remaining[0].id : "") 
      : get().selectedTaskId;

    // Optimistically delete
    set({
      tasks: remaining,
      selectedTaskId: nextSelectedId,
      error: null
    });

    try {
      await FirestoreService.deleteTask(id);
    } catch (err: any) {
      // Rollback on failure
      set({ 
        tasks: previousTasks, 
        selectedTaskId: get().selectedTaskId,
        error: err.message 
      });
      throw err;
    }
  },

  clearLogs: async () => {
    try {
      await api.post("/api/logs/clear");
      set({ logs: [] });
    } catch (err: any) {
      console.error("Failed to clear logs:", err);
    }
  },

  regeneratePlan: async (taskId) => {
    const taskObj = get().tasks.find((t) => t.id === taskId);
    if (!taskObj) return;

    try {
      set({ loading: true });
      const res = await api.post("/api/agent/generate-plan", {
        title: taskObj.title,
        deadline: taskObj.deadline,
        description: taskObj.description,
        complexity: taskObj.complexity
      });
      const planData = res.data;

      const formattedSchedule = (planData.calendarSchedule || []).map((item: any, idx: number) => ({
        id: `cal-${idx}`,
        time: item.time,
        taskTitle: item.taskTitle,
        duration: item.duration
      }));

      await get().updateTask(taskId, {
        starterTask: planData.starterTask,
        subtasks: planData.subtasks?.map((st: any, i: number) => ({
          id: `s-regen-${Date.now()}-${i}`,
          title: st.title,
          durationMin: st.durationMin,
          completed: false,
          implementationIntention: st.implementationIntention || "If I start, I will finish."
        })) || taskObj.subtasks,
        calendarSchedule: formattedSchedule,
        urgencyScore: planData.urgencyScore || taskObj.urgencyScore,
        paceState: planData.paceState || taskObj.paceState
      });
      
      await get().fetchLogs();
    } catch (err: any) {
      console.error("Error regenerating plan:", err);
    } finally {
      set({ loading: false });
    }
  },

  parseAndCreateTask: async (file: File, onProgress: (progress: number) => void) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post<any>("/api/v1/parse/document", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const current = progressEvent.loaded;
          const percent = Math.round((current / total) * 100);
          onProgress(percent);
        }
      });

      let extractedTask = response.data;
      if (extractedTask && typeof extractedTask === "object" && "success" in extractedTask && "data" in extractedTask) {
        extractedTask = extractedTask.data;
      }
      if (Array.isArray(extractedTask)) {
        extractedTask = extractedTask[0];
      }

      const userId = useUserStore.getState().user?.id || "usr-default";
      const newTask = await FirestoreService.createTask(extractedTask, userId);

      set((state) => ({
        tasks: [...state.tasks, newTask],
        selectedTaskId: newTask.id,
        loading: false
      }));

      await get().fetchLogs();
      return newTask;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || err.message || "Failed to parse document",
        loading: false
      });
      throw err;
    }
  },

  toggleMicroTask: async (taskId: string, microtaskId: string, completed: boolean) => {
    try {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");

      const subtasks = task.subtasks.map((st) => {
        if (st.id === microtaskId) {
          return { ...st, completed };
        }
        return st;
      });

      const allDone = subtasks.every((s) => s.completed);
      const status: TaskStatus = allDone ? "Completed" : "In Progress";
      
      let xpGained = 0;
      let encouragementMessage = "Amazing job completing that step! Keep the momentum going! 🚀";

      const wasCompleted = task.subtasks.find(s => s.id === microtaskId)?.completed;
      if (!wasCompleted && completed) {
        xpGained = 25;
      }

      // Re-calculate pace monitoring values (Feature 6)
      const totalSubtasks = subtasks.length;
      const completedSubtasks = subtasks.filter((s: any) => s.completed).length;
      const ratio = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) : 0;
      let paceState: PaceState = task.paceState;
      if (totalSubtasks > 0) {
        if (ratio === 1) {
          paceState = "On Track";
        } else {
          const remainingMs = new Date(task.deadline).getTime() - Date.now();
          const remainingHours = remainingMs / (1000 * 60 * 60);

          if (remainingHours <= 0) {
            paceState = "Impossible";
          } else if (remainingHours < 4 && ratio < 0.5) {
            paceState = "Critical";
          } else if (remainingHours < 12 && ratio < 0.3) {
            paceState = "Critical";
          } else if (ratio < 0.3) {
            paceState = "At Risk";
          } else {
            paceState = "On Track";
          }
        }
      }

      let finalSubtasks = subtasks;
      let finalStatus: TaskStatus = status;
      let finalDeadline = task.deadline;

      if (allDone && task.isRecurring) {
        if (task.recurrence === "daily") {
          finalSubtasks = subtasks.map(s => ({ ...s, completed: false }));
          finalStatus = "Pending";
          const currentDeadlineDate = new Date(task.deadline);
          currentDeadlineDate.setDate(currentDeadlineDate.getDate() + 1);
          finalDeadline = currentDeadlineDate.toISOString();
          encouragementMessage = `🎉 Daily task "${task.title}" reset for tomorrow!`;
        } else if (task.recurrence === "weekly") {
          finalSubtasks = subtasks.map(s => ({ ...s, completed: false }));
          finalStatus = "Pending";
          const currentDeadlineDate = new Date(task.deadline);
          currentDeadlineDate.setDate(currentDeadlineDate.getDate() + 7);
          finalDeadline = currentDeadlineDate.toISOString();
          encouragementMessage = `🎉 Weekly task "${task.title}" reset for next week!`;
        }
      }

      // 1. Optimistic state update: Update Zustand store immediately
      const updatedLocalTask: Task = {
        ...task,
        subtasks: finalSubtasks,
        status: finalStatus as TaskStatus,
        deadline: finalDeadline,
        paceState,
        xpGained: (task.xpGained || 0) + xpGained,
        encouragementMessage
      };

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updatedLocalTask : t))
      }));

      // 2. Perform the Firestore database write and agent triggers in the background (non-blocking)
      (async () => {
        try {
          let finalEncouragement = encouragementMessage;
          if (xpGained > 0 && finalStatus === "Completed") {
            try {
              const res = await api.post("/api/agent/celebrate", {
                taskTitle: task.title,
                microtaskTitle: task.subtasks.find(s => s.id === microtaskId)?.title || "",
                xpGained
              });
              if (res.data?.message) {
                finalEncouragement = res.data.message;
              }
            } catch (e) {
              console.error("Celebration API failed, using fallback:", e);
            }
          }

          const savedTask = await FirestoreService.updateTask(taskId, {
            subtasks: finalSubtasks,
            status: finalStatus as TaskStatus,
            deadline: finalDeadline,
            paceState,
            xpGained: (task.xpGained || 0) + xpGained,
            encouragementMessage: finalEncouragement
          });

          // Prevent stale background Firestore saves from overwriting newer optimistic clicks
          if (finalEncouragement !== encouragementMessage) {
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === taskId ? { ...t, encouragementMessage: finalEncouragement } : t
              )
            }));
          }

          const userId = useUserStore.getState().user?.id || "usr-default";
          if (xpGained > 0) {
            await FirestoreService.addAgentLog({
              agent: "Celebration Agent",
              type: "OBSERVE",
              message: finalEncouragement
            }, userId);
          } else {
            await FirestoreService.addAgentLog({
              agent: "Rescue System",
              type: "ACT",
              message: `Microtask status updated: ${subtasks.find(s => s.id === microtaskId)?.title} is now ${completed ? "Completed" : "Pending"}`
            }, userId);
          }

          await get().fetchLogs();
        } catch (dbErr) {
          console.error("Background Firestore save in toggleMicroTask failed:", dbErr);
        }
      })();

      return {
        microtask: subtasks.find(st => st.id === microtaskId),
        xpGained,
        encouragementMessage
      };
    } catch (err: any) {
      console.error("toggleMicroTask failed:", err);
      throw err;
    }
  },

  addMicroTask: async (taskId: string, title: string, durationMin: number, implementationIntention: string) => {
    try {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");

      const newSubtask = {
        id: `sub-${Date.now()}`,
        title,
        durationMin,
        completed: false,
        implementationIntention
      };

      const updatedTask = await FirestoreService.updateTask(taskId, {
        subtasks: [...task.subtasks, newSubtask]
      });

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t))
      }));

      const userId = useUserStore.getState().user?.id || "usr-default";
      await FirestoreService.addAgentLog({
        agent: "Rescue System",
        type: "ACT",
        message: `Added subtask "${title}" (${durationMin}m) to task "${task.title}"`
      }, userId);

      await get().fetchLogs();
    } catch (err: any) {
      console.error("addMicroTask failed:", err);
      throw err;
    }
  },

  deleteMicroTask: async (taskId: string, microtaskId: string) => {
    try {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");

      const subtasks = task.subtasks.filter((st) => st.id !== microtaskId);
      const deletedTitle = task.subtasks.find((st) => st.id === microtaskId)?.title || "Microtask";

      const updatedTask = await FirestoreService.updateTask(taskId, {
        subtasks
      });

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t))
      }));

      const userId = useUserStore.getState().user?.id || "usr-default";
      await FirestoreService.addAgentLog({
        agent: "Rescue System",
        type: "ACT",
        message: `Deleted subtask "${deletedTitle}" from task "${task.title}"`
      }, userId);

      await get().fetchLogs();
    } catch (err: any) {
      console.error("deleteMicroTask failed:", err);
      throw err;
    }
  }
}));

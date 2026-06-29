import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTaskStore } from "../store/useTaskStore";
import { useUserStore } from "../store/useUserStore";
import RescueModeCockpit from "../components/RescueModeCockpit";
import { RefreshCw } from "lucide-react";

export default function RescueModePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTask, fetchTasks, fetchLogs } = useTaskStore();
  const { isAuthenticated, authInitialized } = useUserStore();

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    if (!task && isAuthenticated && authInitialized) {
      fetchTasks();
    }
  }, [id, task, fetchTasks, isAuthenticated, authInitialized]);

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-xs text-gray-500 font-medium">Retrieving active task metrics...</p>
      </div>
    );
  }

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });

    const allDone = updatedSubtasks.every((st) => st.completed);
    const anyDone = updatedSubtasks.some((st) => st.completed);
    const status = allDone ? "Completed" : anyDone ? "In Progress" : "Pending";

    // Adjust Pace State
    let paceState = task.paceState;
    const doneCount = updatedSubtasks.filter((s) => s.completed).length;
    if (updatedSubtasks.length > 0) {
      const ratio = doneCount / updatedSubtasks.length;
      if (ratio >= 0.7) paceState = "On Track";
      else if (ratio >= 0.4) paceState = "At Risk";
      else paceState = "Critical";
    }

    try {
      await updateTask(task.id, {
        subtasks: updatedSubtasks,
        status,
        paceState
      });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimplifyScope = async (taskId: string, simplifiedData: any) => {
    try {
      await updateTask(taskId, {
        description: `[SIMPLIFIED MVP ACTIVE] ${simplifiedData.description}`,
        starterTask: simplifiedData.starterTask,
        subtasks: simplifiedData.subtasks,
        paceState: "At Risk" // Grace state reset
      });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddLog = (log: any) => {
    console.log("Activity log received:", log);
  };

  return (
    <RescueModeCockpit
      task={task}
      onExit={() => navigate("/dashboard")}
      onToggleSubtask={handleToggleSubtask}
      onSimplifyScope={handleSimplifyScope}
      onAddLog={handleAddLog}
    />
  );
}

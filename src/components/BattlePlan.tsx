import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Bell, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import { useTaskStore } from "../store/useTaskStore";

interface BattlePlanProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onRegeneratePlan: (taskId: string) => void;
  onActivateRescue: (taskId: string) => void;
}

export default function BattlePlan({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleSubtask,
  onRegeneratePlan,
  onActivateRescue
}: BattlePlanProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [optimizingTaskId, setOptimizingTaskId] = useState<string | null>(null);
  
  // Persisted task reminders
  const [reminders, setReminders] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem("crunch_reminders");
    return stored ? JSON.parse(stored) : {};
  });

  // Toast notification for reminders (replaces blocking alert())
  const [toast, setToast] = useState<{ title: string; message: string; visible: boolean } | null>(null);

  // Request browser notification permission
  const requestNotificationPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  // Notification Timer Effect
  useEffect(() => {
    const activeTimers: number[] = [];
    
    Object.entries(reminders).forEach(([taskId, timeStr]: [string, string]) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task || task.status === "Completed") return;
      
      const targetTime = new Date(timeStr).getTime();
      const delay = targetTime - Date.now();
      
      if (delay > 0) {
        const timerId = window.setTimeout(() => {
          if (Notification.permission === "granted") {
            new Notification(`CRUNCH Task Reminder: ${task.title}`, {
              body: `Execution step: ${task.starterTask || "Start on task milestones now!"}`,
              icon: "/favicon.ico"
            });
          }
          // Replaced blocking alert() with non-blocking toast notification
          setToast({
            title: `⏰ REMINDER: ${task.title}`,
            message: task.starterTask || "Open work files and complete milestones.",
            visible: true
          });
          setTimeout(() => setToast(null), 6000);
          
          setReminders(prev => {
            const updated = { ...prev };
            delete updated[taskId];
            localStorage.setItem("crunch_reminders", JSON.stringify(updated));
            return updated;
          });
        }, delay);
        activeTimers.push(timerId);
      }
    });
    
    return () => {
      activeTimers.forEach(id => clearTimeout(id));
    };
  }, [reminders, tasks]);

  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const getHHMM = (isoString: unknown) => {
    try {
      const d = new Date(String(isoString));
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch {
      return "12:00";
    }
  };

  const getYYYYMMDD = (isoString: unknown) => {
    try {
      const d = new Date(String(isoString));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  };

  const updateDeadlineDate = (currentDeadline: string, newDateStr: string) => {
    const date = new Date(currentDeadline);
    const [year, month, day] = newDateStr.split("-").map(Number);
    date.setFullYear(year);
    date.setMonth(month - 1);
    date.setDate(day);
    return date.toISOString();
  };

  const updateDeadlineTime = (currentDeadline: string, newTimeStr: string) => {
    const date = new Date(currentDeadline);
    const [hours, minutes] = newTimeStr.split(":").map(Number);
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    return date.toISOString();
  };

  const handleUpdateDeadline = async (taskId: string, newDeadline: string) => {
    try {
      await updateTask(taskId, { deadline: newDeadline });
    } catch (err) {
      console.error("Failed to update deadline:", err);
    }
  };

  const handleRemoveTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this task?")) {
      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error("Failed to delete task:", err);
      }
    }
  };

  // Separate active vs completed tasks
  const activeTasks = tasks.filter(t => t.status !== "Completed");
  
  // Filter completed tasks: only show completed tasks whose deadline date is today or later
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completedTasks = tasks.filter(t => {
    if (t.status !== "Completed") return false;
    const taskDeadline = new Date(t.deadline);
    return taskDeadline.getTime() >= todayStart.getTime();
  });

  // Filter active tasks to show top 3 prominently unless showAll is active
  const displayedTasks = showAll ? activeTasks : activeTasks.slice(0, 3);

  // Helper to compute time remaining text
  const getRemainingTimeText = (deadlineStr: string) => {
    const remainingMs = new Date(deadlineStr).getTime() - Date.now();
    if (remainingMs < 0) return "Overdue";
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    if (hours < 24) {
      if (hours === 0) {
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${minutes}m left`;
      }
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m left`;
    }
    const days = Math.floor(hours / 24);
    return `${days} days left`;
  };

  // Helper to check if deadline < 24 hours
  const isWithinRescueWindow = (deadlineStr: string) => {
    const remainingMs = new Date(deadlineStr).getTime() - Date.now();
    return remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000;
  };

  const handleOptimizePlan = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setOptimizingTaskId(taskId);
    try {
      await onRegeneratePlan(taskId);
    } catch (err) {
      console.error(err);
    } finally {
      setOptimizingTaskId(null);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  return (
    <>
    <div className="space-y-6" id="battle-plan-container">
      
      {/* 1. Active Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Active tasks ({activeTasks.length})
          </h3>
          {activeTasks.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {showAll ? "Show featured" : `Show all (${activeTasks.length - 3} more)`}
            </button>
          )}
        </div>

        {activeTasks.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">No active tasks</h4>
            <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
              You are completely clear of deadlines. Add a task to start tracking.
            </p>
            <button
              onClick={() => navigate("/task/new")}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Add your first task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const remainingText = getRemainingTimeText(task.deadline);
              const isRescueAvailable = isWithinRescueWindow(task.deadline);
              
              const totalSubtasks = task.subtasks?.length || 0;
              const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
              const pctCompleted = totalSubtasks ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

              // Dot color
              let urgencyColor = "bg-emerald-500";
              if (task.paceState === "Critical" || isRescueAvailable) {
                urgencyColor = "bg-red-500";
              } else if (task.paceState === "At Risk") {
                urgencyColor = "bg-amber-500";
              }

              let cardBg = "bg-white border-gray-200 hover:border-gray-300";
              if (task.color === "yellow") {
                cardBg = "bg-yellow-50/70 border-yellow-200 hover:border-yellow-300";
              } else if (task.color === "red") {
                cardBg = "bg-rose-50/70 border-rose-200 hover:border-rose-300";
              } else if (task.color === "blue") {
                cardBg = "bg-blue-50/70 border-blue-200 hover:border-blue-300";
              } else if (task.color === "green") {
                cardBg = "bg-emerald-50/70 border-emerald-200 hover:border-emerald-300";
              } else if (task.color === "purple") {
                cardBg = "bg-purple-50/70 border-purple-200 hover:border-purple-300";
              } else if (task.color === "teal") {
                cardBg = "bg-teal-50/70 border-teal-200 hover:border-teal-300";
              }

              if (selectedTaskId === task.id) {
                if (task.color === "yellow") cardBg = "bg-yellow-50/90 border-yellow-500 ring-1 ring-yellow-500/20";
                else if (task.color === "red") cardBg = "bg-rose-50/90 border-rose-500 ring-1 ring-rose-500/20";
                else if (task.color === "blue") cardBg = "bg-blue-50/90 border-blue-500 ring-1 ring-blue-500/20";
                else if (task.color === "green") cardBg = "bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500/20";
                else if (task.color === "purple") cardBg = "bg-purple-50/90 border-purple-500 ring-1 ring-purple-500/20";
                else if (task.color === "teal") cardBg = "bg-teal-50/90 border-teal-500 ring-1 ring-teal-500/20";
                else cardBg = "bg-white border-indigo-500 ring-1 ring-indigo-500/20";
              }

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`border transition-all rounded-xl p-4 shadow-xs relative overflow-hidden cursor-pointer ${cardBg}`}
                  id={`task-card-${task.id}`}
                >
                  {/* Main Task Header Row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgencyColor}`} />
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {task.title}
                        </h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          {remainingText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        task.paceState === "Critical" ? "text-red-700 bg-red-50 border border-red-100" :
                        task.paceState === "At Risk" ? "text-amber-700 bg-amber-50 border border-amber-100" :
                        "text-emerald-700 bg-emerald-50 border border-emerald-100"
                      }`}>
                        {task.paceState}
                      </span>

                      {isRescueAvailable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/task/${task.id}/rescue`);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Rescue Mode
                        </button>
                      )}

                      <button
                        onClick={(e) => handleToggleExpand(e, task.id)}
                        className="p-1 text-gray-400 hover:text-gray-900 rounded-lg cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3.5">
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pctCompleted}%` }}
                        className="h-full bg-indigo-600 transition-all duration-300"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1.5 font-medium">
                      <span>{pctCompleted}% complete</span>
                      <span>{completedSubtasks}/{totalSubtasks} milestones</span>
                    </div>
                  </div>

                  {/* Reschedule & Remove Quick Controls (Feature Request) */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Date:</span>
                      <input
                        type="date"
                        value={getYYYYMMDD(task.deadline)}
                        onChange={(e) => {
                          if (e.target.value) {
                            const newDeadline = updateDeadlineDate(task.deadline, e.target.value);
                            handleUpdateDeadline(task.id, newDeadline);
                          }
                        }}
                        className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-455 font-mono cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Time:</span>
                      <input
                        type="time"
                        value={getHHMM(task.deadline)}
                        onChange={(e) => {
                          if (e.target.value) {
                            const newDeadline = updateDeadlineTime(task.deadline, e.target.value);
                            handleUpdateDeadline(task.id, newDeadline);
                          }
                        }}
                        className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-455 font-mono cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={(e) => handleRemoveTask(e, task.id)}
                      className="ml-auto px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>

                  {/* Expandable subtasks checklist */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4 border-t border-gray-100 space-y-4">
                          
                          {/* Task description */}
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Starter Task */}
                          {task.starterTask && (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 text-xs">
                              <span className="font-semibold text-indigo-900 block mb-0.5">Activation Step</span>
                              <p className="text-indigo-700 leading-relaxed">{task.starterTask}</p>
                            </div>
                          )}

                          {/* Task Alarm / Reminder Controls */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <Bell className="w-4 h-4 text-indigo-600" />
                              <span>Task Deadline Alarms</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                              <span className="text-slate-500 font-mono font-medium">
                                {reminders[task.id] 
                                  ? `Alarm: ${new Date(reminders[task.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                                  : "No alarms active"}
                              </span>
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestNotificationPermission();
                                    const targetDate = new Date(task.deadline);
                                    const updated = { ...reminders, [task.id]: targetDate.toISOString() };
                                    setReminders(updated);
                                    localStorage.setItem("crunch_reminders", JSON.stringify(updated));
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-750 border border-indigo-200 font-bold rounded text-[10px] transition-colors cursor-pointer"
                                >
                                  Remind at deadline
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestNotificationPermission();
                                    const targetDate = new Date(new Date(task.deadline).getTime() - 15 * 60 * 1000);
                                    const updated = { ...reminders, [task.id]: targetDate.toISOString() };
                                    setReminders(updated);
                                    localStorage.setItem("crunch_reminders", JSON.stringify(updated));
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-750 border border-indigo-200 font-bold rounded text-[10px] transition-colors cursor-pointer"
                                >
                                  15m Before
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestNotificationPermission();
                                    const targetDate = new Date(Date.now() + 10 * 1000); // 10s timer
                                    const updated = { ...reminders, [task.id]: targetDate.toISOString() };
                                    setReminders(updated);
                                    localStorage.setItem("crunch_reminders", JSON.stringify(updated));
                                  }}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded text-[10px] transition-colors cursor-pointer"
                                >
                                  Set 10s Timer (Test)
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Checklist */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                              Required Sprints
                            </span>
                            {task.subtasks && task.subtasks.length > 0 ? (
                              task.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSubtask(task.id, st.id);
                                  }}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all text-xs cursor-pointer ${
                                    st.completed 
                                      ? "bg-gray-50 border-gray-100 text-gray-400" 
                                      : "bg-white border-gray-100 text-gray-700 hover:border-gray-200"
                                  }`}
                                >
                                  {st.completed ? (
                                    <CheckCircle2 className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                                  ) : (
                                    <Circle className="w-4.5 h-4.5 text-gray-300 hover:text-indigo-500 shrink-0" />
                                  )}
                                  <span className={st.completed ? "line-through" : ""}>
                                    {st.title}
                                  </span>
                                  <span className="ml-auto text-[10px] text-gray-400 font-medium font-mono">
                                    {st.durationMin}m
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 italic">No subtasks generated.</p>
                            )}
                          </div>

                          {/* Quick controls row */}
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <button
                              onClick={(e) => handleOptimizePlan(e, task.id)}
                              disabled={optimizingTaskId === task.id}
                              className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 font-medium cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${optimizingTaskId === task.id ? "animate-spin" : ""}`} />
                              Optimize Checklist
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/task/${task.id}`);
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            >
                              Open workspace →
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div className="pt-4 border-t border-gray-200 space-y-3" id="completed-tasks-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Completed tasks ({completedTasks.length})
          </h3>
          <div className="space-y-2.5 opacity-75">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-xs relative flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-600 text-sm truncate line-through">
                      {task.title}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Completed successfully
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 uppercase tracking-wider">
                  DONE
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>

      {/* Toast Notification — replaces blocking alert() */}
      <AnimatePresence>
        {toast && toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 bg-gray-900 text-white px-5 py-3.5 rounded-xl shadow-2xl max-w-sm w-full border border-gray-700"
          >
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold leading-tight">{toast.title}</h4>
                <p className="text-xs text-gray-300 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-gray-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

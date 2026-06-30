import React, { useState, useEffect, useRef } from "react";
import { Cpu, ShieldAlert, Sparkles, Terminal, Zap, FileEdit, LayoutDashboard, LogOut, Flame, UploadCloud, Award, Bell, Trash2, CheckSquare as CheckSquareIcon, MessageSquare, AlertTriangle, BookOpen, Presentation, Star, Bookmark } from "lucide-react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { CalendarService } from "./services/CalendarService";

// Lazy-loaded components for optimal bundle splitting
const IntakeHub = React.lazy(() => import("./components/IntakeHub"));
const BrainDumpDesk = React.lazy(() => import("./components/BrainDumpDesk"));
const DraftAssistantDesk = React.lazy(() => import("./components/DraftAssistantDesk"));
const DocumentUploadPage = React.lazy(() => import("./pages/DocumentUploadPage"));
const TaskDetailPage = React.lazy(() => import("./pages/TaskDetailPage"));
const RescueModePage = React.lazy(() => import("./pages/RescueModePage"));
const DraftAssistantPage = React.lazy(() => import("./pages/DraftAssistantPage"));
const WhyCrunchPage = React.lazy(() => import("./pages/WhyCrunchPage"));
const GoogleKeepDesk = React.lazy(() => import("./pages/GoogleKeepDesk"));
const CalendarDesk = React.lazy(() => import("./components/CalendarDesk"));
const BattlePlan = React.lazy(() => import("./components/BattlePlan"));
const MorningBriefPanel = React.lazy(() => import("./components/MorningBriefPanel"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const RescueModeCockpit = React.lazy(() => import("./components/RescueModeCockpit"));

import { useTaskStore } from "./store/useTaskStore";
import { useUserStore } from "./store/useUserStore";
import { useSessionStore } from "./store/useSessionStore";
import { useNotificationStore } from "./store/useNotificationStore";

export default function App() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const user = useUserStore((state) => state.user);
  const authInitialized = useUserStore((state) => state.authInitialized);
  const initializeAuth = useUserStore((state) => state.initializeAuth);
  const logout = useUserStore((state) => state.logout);

  const tasks = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchLogs = useTaskStore((state) => state.fetchLogs);
  const setSelectedTaskId = useTaskStore((state) => state.setSelectedTaskId);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const clearLogs = useTaskStore((state) => state.clearLogs);
  const regeneratePlan = useTaskStore((state) => state.regeneratePlan);

  const startFocusSession = useSessionStore((state) => state.startFocusSession);
  const tickTimer = useSessionStore((state) => state.tickTimer);
  const timerActive = useSessionStore((state) => state.timerActive);

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);

  const [activeTab, setActiveTab] = useState<"battle" | "intake" | "braindump" | "draft" | "logs" | "agents" | "why-crunch" | "keep">("battle");
  const [rescueTaskId, setRescueTaskId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside handler for notification dropdown
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const navigate = useNavigate();
  const location = useLocation();

  // Initialize Firebase Auth subscription on app mount (StrictMode-safe cleanup)
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return unsubscribe;
  }, [initializeAuth]);

  // Authentication and routing guard
  useEffect(() => {
    if (!isAuthenticated) {
      if (location.pathname !== "/login" && location.pathname !== "/" && location.pathname !== "/demo" && location.pathname !== "/pitch" && location.pathname !== "/why-crunch") {
        navigate("/login", { replace: true });
      }
    } else {
      if (location.pathname === "/" || location.pathname === "/login") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // Synchronize route paths to the matching cockpit tab state
  useEffect(() => {
    if (!isAuthenticated) return;

    const path = location.pathname;
    if (path === "/dashboard" || path.startsWith("/task/")) {
      if (path === "/task/upload") {
        setActiveTab("upload");
      } else {
        setActiveTab("battle");
      }
    } else if (path === "/task/new") {
      setActiveTab("intake");
    } else if (path === "/braindump") {
      setActiveTab("braindump");
    } else if (path === "/drafts") {
      setActiveTab("draft");
    } else if (path === "/logs") {
      setActiveTab("logs");
    } else if (path === "/why-crunch") {
      setActiveTab("why-crunch");
    } else if (path === "/keep") {
      setActiveTab("keep");
    }
  }, [location.pathname, isAuthenticated]);

  // Focus sprint timer update loop
  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, tickTimer]);

  // Fetch initial tasks and agent logs when authenticated and firebase auth state is resolved
  useEffect(() => {
    if (isAuthenticated && authInitialized) {
      fetchTasks();
      fetchLogs();
      
      // Auto refresh logs to simulate active background ReAct thinking
      const interval = setInterval(() => {
        fetchLogs();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, authInitialized, fetchTasks, fetchLogs]);

  const handleRegeneratePlan = async (taskId: string) => {
    try {
      await regeneratePlan(taskId);
      const updatedTask = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      if (updatedTask && updatedTask.calendarSchedule && updatedTask.calendarSchedule.length > 0) {
        await CalendarService.createCrunchEvents(updatedTask.calendarSchedule, updatedTask.title);
      }
    } catch (err) {
      console.error("Failed to regenerate plan or create calendar events:", err);
    }
  };

  // Called when Task Intake returns a newly extracted task specification
  const handleIntakeSuccess = async (extractedData: any, shouldNavigate = true) => {
    try {
      const created = await createTask({
        title: extractedData.title,
        deadline: extractedData.deadline,
        complexity: extractedData.complexity,
        status: "Pending",
        urgencyScore: extractedData.urgencyScore,
        description: extractedData.description,
        starterTask: extractedData.starterTask,
        color: extractedData.color || "default",
        isRecurring: extractedData.isRecurring || false,
        recurrence: extractedData.recurrence || "none",
        subtasks: extractedData.subtasks?.map((st: any, i: number) => ({
          id: `s-${Date.now()}-${i}`,
          title: st.title,
          durationMin: st.durationMin,
          completed: false,
          implementationIntention: st.implementationIntention
        })) || []
      });

      // Trigger Planning Agent schedule call for this task automatically!
      await handleRegeneratePlan(created.id);
      
      // Return to battle deck if this is the final/only task
      if (shouldNavigate) {
        navigate("/dashboard");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Called when Brain Dump extracts multiple prioritized tasks
  const handleBrainDumpExtracted = async (extractedTasks: any[]) => {
    try {
      for (const t of extractedTasks) {
        const created = await createTask({
          title: t.title,
          deadline: t.deadline,
          complexity: t.complexity,
          status: "Pending",
          urgencyScore: t.urgencyScore,
          description: t.description,
          starterTask: t.starterTask,
          subtasks: t.subtasks?.map((st: any, i: number) => ({
            id: `s-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            title: st.title,
            durationMin: st.durationMin || 25,
            completed: false,
            implementationIntention: st.implementationIntention || `If I sit at my workstation, I will focus entirely on completing: ${st.title}`
          })) || [],
          calendarSchedule: t.calendarSchedule?.map((cs: any, i: number) => ({
            id: `cal-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            time: cs.time,
            taskTitle: cs.taskTitle,
            duration: cs.duration || 30
          })) || []
        });
 
        // Sync to Google Calendar or local fallback immediately
        if (created.calendarSchedule && created.calendarSchedule.length > 0) {
          try {
            await CalendarService.createCrunchEvents(created.calendarSchedule, created.title);
          } catch (calErr) {
            console.error("Failed to sync calendar events during brain dump:", calErr);
          }
        }
      }
      await fetchTasks();
      navigate("/dashboard");
    } catch (e) {
      console.error(e);
    }
  };

  // Checkbox milestone toggler
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const taskObj = tasks.find((t) => t.id === taskId);
    if (!taskObj) return;

    const updatedSubtasks = taskObj.subtasks.map((st) => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });

    // Recalculate status and pacing states
    const allCompleted = updatedSubtasks.every((st) => st.completed);
    const anyCompleted = updatedSubtasks.some((st) => st.completed);
    const status = allCompleted ? "Completed" : anyCompleted ? "In Progress" : "Pending";
    
    // Dynamically adjust Pace State based on progress
    const totalCount = updatedSubtasks.length;
    const doneCount = updatedSubtasks.filter((s) => s.completed).length;
    let paceState = taskObj.paceState;
    if (totalCount > 0) {
      if (doneCount / totalCount >= 0.7) paceState = "On Track";
      else if (doneCount / totalCount >= 0.4) paceState = "At Risk";
    }

    try {
      await updateTask(taskId, {
        subtasks: updatedSubtasks,
        status,
        paceState
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Apply Emergency Simplify
  const handleSimplifyScope = async (taskId: string, simplifiedData: any) => {
    try {
      await updateTask(taskId, {
        description: simplifiedData.description,
        starterTask: simplifiedData.starterTask,
        subtasks: simplifiedData.subtasks,
        paceState: "At Risk" // Simplified from Critical!
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  // If user is not authenticated, guard and show Landing/Login routes
  if (!isAuthenticated) {
    return (
      <React.Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 text-xs font-semibold gap-3">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-pink-500 rounded-full animate-spin"></div>
          Loading secure credentials portal...
        </div>
      }>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    );
  }

  const activeRescueTask = tasks.find((t) => t.id === rescueTaskId);

  // If locked in Rescue Mode cockpit, render the high-alert fullscreen HUD
  if (rescueTaskId && activeRescueTask) {
    return (
      <React.Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-rose-500 text-xs font-semibold gap-3">
          <div className="w-5 h-5 border-2 border-slate-800 border-t-rose-500 rounded-full animate-spin"></div>
          Activating Emergency Cockpit HUD...
        </div>
      }>
        <RescueModeCockpit
          task={activeRescueTask}
          onExit={() => setRescueTaskId(null)}
          onToggleSubtask={handleToggleSubtask}
          onSimplifyScope={handleSimplifyScope}
          onAddLog={fetchLogs}
        />
      </React.Suspense>
    );
  }

  // Auth layout structure
  return (
    <div className="min-h-screen bg-gradient-to-tr from-amber-50/50 via-rose-50/40 to-indigo-50/40 text-slate-800 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900 overflow-x-hidden relative">
      
      {/* Background blobs for a beautiful fluid desktop feel */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-rose-200/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[450px] h-[450px] bg-indigo-200/15 rounded-full filter blur-3xl pointer-events-none" />

      {/* Calm, sticky header */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/60 backdrop-blur-md px-6 py-3.5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-gray-900 lowercase cursor-pointer" onClick={() => navigate("/dashboard")}>
              crunch
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
          </div>
          <span className="hidden sm:inline text-xs text-gray-400 border-l border-gray-200 pl-3">
            Rescue system active
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Simple Notification badge */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
              id="header-notif-bell-btn"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-sans text-[9px] font-bold h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="font-semibold text-xs text-gray-700">Notifications</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => markAllAsRead()}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Read All
                    </button>
                    <button 
                      onClick={() => clearNotifications()}
                      className="text-[10px] text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic text-center py-4">No notifications.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`p-2 rounded-lg border text-xs transition-all cursor-pointer ${
                          notif.read 
                            ? "bg-gray-50/50 border-transparent opacity-60" 
                            : "bg-white border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            notif.type === "rescue" || notif.type === "deadline" ? "text-red-600 bg-red-50 border border-red-100" :
                            notif.type === "completion" ? "text-emerald-600 bg-emerald-50 border border-emerald-100" : "text-amber-600 bg-amber-50 border border-amber-100"
                          }`}>
                            {notif.type}
                          </span>
                        </div>
                        <h5 className="font-medium text-gray-900 mt-1">{notif.title}</h5>
                        <p className="text-gray-500 text-[11px] leading-normal mt-0.5">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Section with sign out text-link */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs" title={user?.fullName || "User"}>
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="hidden md:inline text-xs text-gray-600 font-medium">
                {user?.fullName || "User"}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-gray-900 font-medium transition-colors cursor-pointer"
              id="logout-btn"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Horizontal Nav Tabs */}
      <div className="bg-white/50 border-b border-white/30 backdrop-blur-md sticky top-[53px] z-35 py-2 px-6 shadow-2xs">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/dashboard")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "battle"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-battle-btn"
            >
              Home
            </button>
            <button
              onClick={() => navigate("/task/new")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "intake"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-intake-btn"
            >
              New Task
            </button>
            <button
              onClick={() => navigate("/braindump")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "braindump"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-dump-btn"
            >
              Brain Dump
            </button>
            <button
              onClick={() => navigate("/keep")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "keep"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-keep-btn"
            >
              Keep
            </button>
            <button
              onClick={() => navigate("/task/upload")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "upload"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-upload-btn"
            >
              Upload
            </button>
            <button
              onClick={() => navigate("/drafts")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activeTab === "draft"
                  ? "bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/15"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/60"
              }`}
              id="nav-draft-btn"
            >
              Drafts
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/why-crunch")}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/50 text-xs font-semibold transition-all rounded-full"
              id="nav-why-crunch-btn"
            >
              Why CRUNCH
            </button>
          </div>
        </div>
      </div>

      {/* Main single-column layout */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 flex flex-col justify-stretch relative z-10">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col justify-stretch"
          >
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center p-20 text-slate-400 text-xs font-semibold gap-3 h-full my-auto">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-pink-500 rounded-full animate-spin"></div>
                Loading secure module coordinates...
              </div>
            }>
              <Routes>
                <Route
                  path="/dashboard"
                  element={
                    <div className="space-y-6">
                      {/* Clean and minimal 3 stats cards max */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 p-3.5 rounded-xl text-center shadow-xs">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Active Tasks</span>
                          <span className="text-xl font-bold text-gray-900 mt-0.5 block">{tasks.length}</span>
                        </div>
                        <div className="bg-white border border-gray-200 p-3.5 rounded-xl text-center shadow-xs">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Rescued</span>
                          <span className="text-xl font-bold text-red-600 mt-0.5 block">{tasks.filter(t => t.isRescueActive).length}</span>
                        </div>
                        <div className="bg-white border border-gray-200 p-3.5 rounded-xl text-center shadow-xs">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Milestones</span>
                          <span className="text-xl font-bold text-emerald-600 mt-0.5 block">
                            {tasks.reduce((acc, t) => acc + t.subtasks.filter(s => s.completed).length, 0)}
                          </span>
                        </div>
                      </div>

                      {/* Morning Brief Panel */}
                      <MorningBriefPanel tasks={tasks} />

                      {/* Side-by-side checklist and calendar */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7">
                          <BattlePlan
                            tasks={tasks}
                            selectedTaskId={selectedTaskId}
                            onSelectTask={setSelectedTaskId}
                            onToggleSubtask={handleToggleSubtask}
                            onRegeneratePlan={handleRegeneratePlan}
                            onActivateRescue={(id) => setRescueTaskId(id)}
                          />
                        </div>
                        <div className="lg:col-span-5">
                          <CalendarDesk />
                        </div>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/task/new"
                  element={<IntakeHub onIntakeSuccess={handleIntakeSuccess} />}
                />
                <Route
                  path="/task/upload"
                  element={<DocumentUploadPage />}
                />
                <Route
                  path="/task/:id"
                  element={<TaskDetailPage />}
                />
                <Route
                  path="/task/:id/rescue"
                  element={<RescueModePage />}
                />
                <Route
                  path="/task/:id/draft"
                  element={<DraftAssistantPage />}
                />
                <Route
                  path="/braindump"
                  element={<BrainDumpDesk onTasksExtracted={handleBrainDumpExtracted} />}
                />
                <Route
                  path="/drafts"
                  element={<DraftAssistantDesk tasks={tasks} />}
                />
                <Route
                  path="/keep"
                  element={<GoogleKeepDesk />}
                />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Simple quiet footer */}
      <footer className="border-t border-white/40 py-6 text-center text-xs text-slate-400 bg-white/60 backdrop-blur-md mt-12">
        <span className="font-bold text-slate-500">© 2026 CRUNCH</span>
      </footer>
    </div>
  );
}

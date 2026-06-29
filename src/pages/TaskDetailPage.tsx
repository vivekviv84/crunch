import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Calendar, Shield, Sparkles, CheckSquare, Square, 
  Trash2, Plus, Clock, FileText, Award, BarChart, Compass, CheckCircle2, Flame
} from "lucide-react";
import { useTaskStore } from "../store/useTaskStore";
import { useUserStore } from "../store/useUserStore";
import { motion, AnimatePresence } from "motion/react";
import RescueCommandCenter from "../components/RescueCommandCenter";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, toggleMicroTask, addMicroTask, deleteMicroTask, fetchTasks, updateTask } = useTaskStore();
  const { isAuthenticated, authInitialized } = useUserStore();

  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState(20);
  const [newIntention, setNewIntention] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Celebration pop-ups state
  const [showCelebration, setShowCelebration] = useState(false);
  const [gainedXPAmount, setGainedXPAmount] = useState(0);
  const [celebrationMessage, setCelebrationMessage] = useState("");

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    if (isAuthenticated && authInitialized) {
      fetchTasks();
    }
  }, [fetchTasks, isAuthenticated, authInitialized]);

  if (!task) {
    return (
      <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-900 text-center font-mono">
        <p className="text-rose-400 mb-4">CRITICAL: Task signature not located in secure local database.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-slate-950 border border-slate-900 rounded-lg text-xs text-slate-300 hover:text-white"
        >
          Return to Battle Deck
        </button>
      </div>
    );
  }

  // Pace monitoring calculations (Feature 6)
  const totalTasksCount = task.subtasks.length;
  const completedTasksCount = task.subtasks.filter((s) => s.completed).length;
  const remainingCount = totalTasksCount - completedTasksCount;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Calculate Average completion time (using estimated task lengths)
  const totalMinutesAllocated = task.subtasks.reduce((acc, curr) => acc + curr.durationMin, 0);
  const averageCompletionTimeMin = totalTasksCount > 0 ? Math.round(totalMinutesAllocated / totalTasksCount) : 0;

  // Predicted finish time (sum of remaining incomplete durations starting from now)
  const remainingMinutes = task.subtasks
    .filter((s) => !s.completed)
    .reduce((acc, curr) => acc + curr.durationMin, 0);

  const predictedFinishTime = new Date(Date.now() + remainingMinutes * 60 * 1000);

  // Status mapping colors
  const paceColors = {
    "On Track": { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-900/40" },
    "At Risk": { text: "text-amber-400", bg: "bg-amber-950/40", border: "border-amber-900/40" },
    "Critical": { text: "text-rose-400", bg: "bg-rose-950/40", border: "border-rose-900/40" },
    "Impossible": { text: "text-slate-400", bg: "bg-slate-950", border: "border-slate-800" }
  };

  const selectedPace = paceColors[task.paceState || "On Track"];

  // Toggle MicroTask
  const handleToggle = async (subtaskId: string, currentCompleted: boolean) => {
    try {
      const nextCompleted = !currentCompleted;
      const result = await toggleMicroTask(task.id, subtaskId, nextCompleted);
      
      if (nextCompleted && result.xpGained > 0) {
        setGainedXPAmount(result.xpGained);
        setCelebrationMessage(result.encouragementMessage);
        setShowCelebration(true);
        // Automatically hide celebration banner after 6 seconds
        setTimeout(() => {
          setShowCelebration(false);
        }, 8000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add MicroTask
  const handleAddSubtaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await addMicroTask(task.id, newTitle, newDuration, newIntention);
      setNewTitle("");
      setNewDuration(20);
      setNewIntention("");
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Delete MicroTask
  const handleDeleteSubtask = async (subtaskId: string) => {
    if (confirm("Are you sure you want to delete this microtask?")) {
      try {
        await deleteMicroTask(task.id, subtaskId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="space-y-6" id="task-detail-viewport">
      
      {/* Back to battle deck bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Battle Deck
        </button>
        <div className="text-[10px] text-slate-400 font-mono">
          TASK SIGNATURE ID: <span className="text-slate-500 font-bold">{task.id}</span>
        </div>
      </div>

      {/* Celebration Notification Banner (Feature 7) */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-linear-to-r from-rose-50 to-amber-50 border border-rose-200 p-5 rounded-2xl shadow-md relative overflow-hidden"
            id="xp-celebration-banner"
          >
            <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] bg-rose-500 text-white font-bold rounded-bl-xl">
              MILESTONE SECURED! ✨
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5 shadow-md shadow-rose-500/25">
                <Award className="w-5 h-5 animate-bounce" />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-rose-600">CRITICAL CHECKPOINT COMPLETE!</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg font-bold">
                    +{gainedXPAmount} XP
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed italic bg-white/60 p-3 rounded-xl border border-slate-100 mt-1.5">
                  "{celebrationMessage}"
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Summary Dashboard */}
      <div className="bg-white/70 border border-white/50 p-6 rounded-3xl shadow-sm backdrop-blur-md flex flex-col md:flex-row justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${selectedPace.bg} ${selectedPace.text} ${selectedPace.border}`}>
              ● {task.paceState?.toUpperCase() || "ON TRACK"}
            </span>
            <span className="text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full">
              COMPLEXITY: {task.complexity?.toUpperCase()}
            </span>
            <span className="text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-0.5 rounded-full">
              URGENCY SCORE: {task.urgencyScore}/100
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">{task.title}</h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl whitespace-pre-line bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
            {task.description || "No tactical details supplied."}
          </p>
        </div>

        <div className="md:w-64 bg-white border border-slate-200/80 shadow-xs rounded-2xl p-4 flex flex-col justify-between shrink-0 gap-4">
          <div className="space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-slate-400 font-bold block text-[10px]">TASK DEADLINE 🕒</span>
              <span className="text-rose-500 font-bold block mt-1 flex items-center gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                {new Date(task.deadline).toLocaleDateString()} at {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">URGENCY LEVEL 🔥</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${task.urgencyScore}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-500">{task.urgencyScore}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => navigate(`/task/${task.id}/rescue`)}
              className="w-full py-3 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              id="detail-rescue-trigger-btn"
            >
              <Flame className="w-4 h-4 animate-pulse text-yellow-300 fill-yellow-300" />
              I NEED RESCUE NOW
            </button>
            <button
              onClick={() => navigate(`/task/${task.id}/draft`)}
              className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-rose-500 hover:text-rose-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              id="detail-draft-trigger-btn"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Launch Draft Co-Pilot
            </button>
          </div>
        </div>
      </div>

      {/* SIGNATURE RESCUE COMMAND CENTER */}
      <RescueCommandCenter taskId={task.id} />

      {/* Grid: 1. Pace Monitor  2. Extracted Requirements  3. Micro Task Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">        {/* Left Column: Checklist & Requirements */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Rescue Plan Micro Tasks Checklist */}
          <div className="bg-white/70 border border-white/50 p-6 rounded-3xl shadow-xs backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">Your Action Plan 📋</h3>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
              >
                <Plus className="w-3 h-3" />
                Add Sprint
              </button>
            </div>

            {/* Quick Add Form */}
            {showAddForm && (
              <form onSubmit={handleAddSubtaskSubmit} className="bg-white border border-slate-200 p-4 rounded-2xl mb-4 space-y-3 text-xs shadow-xs">
                <div>
                  <label className="text-slate-500 font-bold block mb-1">Sprint Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Gather document proofs"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-400 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-400 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">Friendly Goal / Motivation</label>
                    <input
                      type="text"
                      value={newIntention}
                      onChange={(e) => setNewIntention(e.target.value)}
                      placeholder="e.g. If I start, I will feel so proud!"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-400 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            )}

            {/* Checklist items */}
            {task.subtasks.length === 0 ? (
              <div className="space-y-2.5">
                <div 
                  className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 group ${
                    task.status === "Completed" 
                      ? "bg-emerald-50/30 border-emerald-250 opacity-80" 
                      : "bg-white border-slate-200 hover:border-rose-250 hover:shadow-2xs"
                  }`}
                >
                  <button
                    onClick={async () => {
                      const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
                      await updateTask(task.id, { status: nextStatus });
                    }}
                    className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-500 transition-all cursor-pointer"
                  >
                    {task.status === "Completed" ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                    ) : (
                      <div className="w-4.5 h-4.5 rounded-lg border border-slate-350 hover:border-emerald-500 flex items-center justify-center text-transparent hover:text-emerald-500 text-[10px] bg-white font-bold">
                        ✓
                      </div>
                    )}
                  </button>
                  
                  <div className="flex-1 text-xs">
                    <span className={`font-bold text-sm ${task.status === "Completed" ? "line-through text-slate-450" : "text-slate-700"}`}>
                      Goal Completed
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Sprints/checkpoints are not yet decided. Mark this task completed directly.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {task.subtasks.map((st, idx) => (
                  <div 
                    key={st.id} 
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 group ${
                      st.completed 
                        ? "bg-slate-50/50 border-slate-200 opacity-60" 
                        : "bg-white border-slate-200 hover:border-rose-250 hover:shadow-2xs"
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(st.id, st.completed)}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                    >
                      {st.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded border border-slate-300 hover:border-rose-500 flex items-center justify-center text-transparent hover:text-rose-500 text-[10px] bg-white">
                          ✓
                        </div>
                      )}
                    </button>
                    
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold ${st.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {idx + 1}. {st.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-all">
                          <span className="px-2 py-0.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                            <Clock className="w-3 h-3 text-rose-500" />
                            {st.durationMin} min
                          </span>
                          <button
                            onClick={() => handleDeleteSubtask(st.id)}
                            className="text-slate-400 hover:text-rose-500 p-0.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {st.implementationIntention && (
                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 text-[10px] text-amber-800 rounded-lg leading-relaxed italic">
                          <span className="text-amber-500 uppercase not-italic font-bold text-[9px] mr-1">MOTIVATION:</span>
                          {st.implementationIntention}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

             {/* Parsed Assignment Requirements */}
          {(task.wordCount || task.estimatedHours || task.submissionRequirements || task.documentExtractedText) && (
            <div className="bg-white/70 border border-white/50 p-6 rounded-3xl shadow-xs backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">Extracted Document Insights 💡</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {task.wordCount !== undefined && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    <span className="text-slate-450 font-bold block text-[10px]">WORD COUNT TARGET</span>
                    <span className="text-slate-700 font-bold block mt-1">{task.wordCount} words</span>
                  </div>
                )}
                {task.estimatedHours !== undefined && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    <span className="text-slate-450 font-bold block text-[10px]">ESTIMATED WORK TIME</span>
                    <span className="text-slate-700 font-bold block mt-1">{task.estimatedHours} focused hours</span>
                  </div>
                )}
                {task.submissionRequirements && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                    <span className="text-slate-450 font-bold block text-[10px]">HOW TO SUBMIT</span>
                    <span className="text-slate-700 font-bold block mt-1 truncate">{task.submissionRequirements}</span>
                  </div>
                )}
              </div>

              {task.documentExtractedText && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <span className="text-slate-800 font-bold block border-b border-slate-100 pb-1.5 text-[10px]">EXTRACTED RUBRIC CHECKLIST</span>
                  <p className="whitespace-pre-line leading-relaxed text-slate-650 font-medium">
                    {task.documentExtractedText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Pace Monitor Dashboard */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Pace Monitor View (Feature 6) */}
          <div className="bg-white/70 border border-white/50 p-6 rounded-3xl shadow-xs backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <BarChart className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-800">Pace Monitor 📈</h3>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Progress Display */}
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[10px] font-bold">
                  <span>PROGRESS COMPLETION</span>
                  <span className="text-rose-500 font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats blocks */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-slate-450 font-bold block text-[9px]">SPRINTS LEFT</span>
                  <span className="text-slate-700 font-bold block mt-1 text-sm">{remainingCount} tasks</span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-slate-450 font-bold block text-[9px]">AVERAGE SPRINT TIME</span>
                  <span className="text-slate-700 font-bold block mt-1 text-sm">{averageCompletionTimeMin} mins</span>
                </div>
              </div>

              {/* Predicted Finish Box */}
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-rose-600 font-bold block">ESTIMATED COMPLETION TIME</span>
                  <span className="text-slate-700 font-bold block text-xs mt-0.5">
                    {remainingCount > 0 
                      ? `Estimated finish in ${remainingMinutes} minutes` 
                      : "Rescue plan fully finalized!"
                    }
                  </span>
                  {remainingCount > 0 && (
                    <span className="text-[10px] text-rose-500 font-bold block mt-1">
                      Target Time: {predictedFinishTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Status indicator description */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl text-[11px] leading-relaxed text-slate-550">
                <span className="text-slate-800 font-bold block mb-1">PACE HELPER ADVICE</span>
                {task.paceState === "On Track" && (
                  <p>You have secured excellent progress and the current pacing indicates you will finish before final deadlines effortlessly.</p>
                )}
                {task.paceState === "At Risk" && (
                  <p>Alert: Remaining task volume is scaling up relative to time constraints. Complete a microtask now to restore equilibrium.</p>
                )}
                {task.paceState === "Critical" && (
                  <p>Urgent Warning: Procrastination loop detected. Activate fullscreen Rescue mode to focus strictly on microtask segments.</p>
                )}
                {task.paceState === "Impossible" && (
                  <p>Deadline exceeded. Simplify target scope instantly using Stress Dump or Emergency Scope reducers.</p>
                )}
              </div>
            </div>
          </div>

          {/* Starter Task Anchor */}
          <div className="bg-linear-to-tr from-amber-50/60 to-rose-50/60 border border-amber-100 p-5 rounded-2xl text-xs">
            <div className="flex items-center gap-1.5 text-rose-600 font-bold mb-2">
              <Compass className="w-4 h-4 text-rose-500" />
              FRICTION BUSTER TASK ✨
            </div>
            <p className="text-slate-755 font-bold leading-relaxed mb-3">
              "{task.starterTask || "Open the editor and name the outline header."}"
            </p>
            <span className="text-[10px] text-slate-450 font-semibold">
              Takes less than 5 minutes to start. Bypass the mental block and do this first!
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}

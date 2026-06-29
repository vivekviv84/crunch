import React, { useState } from "react";
import { Check, Calendar, Clock, Palette, Plus, Trash2, ListPlus, Timer, Zap } from "lucide-react";

interface IntakeHubProps {
  onIntakeSuccess: (taskData: any, shouldNavigate?: boolean) => void;
}

const KEEP_COLORS = [
  { colorCode: "default", name: "Default (Slate)", class: "bg-white" },
  { colorCode: "yellow", name: "Keep Yellow", class: "bg-amber-400" },
  { colorCode: "red", name: "Keep Red", class: "bg-rose-400" },
  { colorCode: "blue", name: "Keep Blue", class: "bg-blue-400" },
  { colorCode: "green", name: "Keep Green", class: "bg-emerald-400" },
  { colorCode: "purple", name: "Keep Purple", class: "bg-purple-400" },
  { colorCode: "teal", name: "Keep Teal", class: "bg-teal-400" },
];

// Returns a color class based on urgency value (0-100)
function urgencyColor(v: number) {
  if (v >= 80) return "from-rose-500 to-red-600";
  if (v >= 55) return "from-amber-400 to-orange-500";
  if (v >= 30) return "from-indigo-400 to-violet-500";
  return "from-teal-400 to-emerald-500";
}

function urgencyLabel(v: number) {
  if (v >= 80) return { text: "Critical", color: "text-rose-600 bg-rose-50 border-rose-200" };
  if (v >= 55) return { text: "High", color: "text-amber-600 bg-amber-50 border-amber-200" };
  if (v >= 30) return { text: "Medium", color: "text-indigo-600 bg-indigo-50 border-indigo-200" };
  return { text: "Low", color: "text-teal-600 bg-teal-50 border-teal-200" };
}

export default function IntakeHub({ onIntakeSuccess }: IntakeHubProps) {
  // --- Date helpers ---
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  // Manual Form States
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  // Start time (optional)
  const [hasStartTime, setHasStartTime] = useState(false);
  const [manualStartDate, setManualStartDate] = useState(todayStr);
  const [manualStartTime, setManualStartTime] = useState("09:00");

  // Due deadline
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualTime, setManualTime] = useState("18:00");

  const [manualComplexity, setManualComplexity] = useState<"Low" | "Medium" | "High">("Medium");
  const [manualUrgency, setManualUrgency] = useState(50);
  const [manualColor, setManualColor] = useState("default");
  const [manualIsRecurring, setManualIsRecurring] = useState(false);
  const [manualRecurrence, setManualRecurrence] = useState<"daily" | "weekly" | "none">("none");

  // Subtasks
  const [manualSubtasks, setManualSubtasks] = useState<{ title: string; durationMin: number }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDuration, setNewSubtaskDuration] = useState(25);

  const handleAddManualSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setManualSubtasks([
      ...manualSubtasks,
      { title: newSubtaskTitle.trim(), durationMin: Number(newSubtaskDuration) || 25 }
    ]);
    setNewSubtaskTitle("");
    setNewSubtaskDuration(25);
  };

  const handleRemoveManualSubtask = (idx: number) => {
    setManualSubtasks(manualSubtasks.filter((_, i) => i !== idx));
  };

  const handleCreateManualTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const deadlineIso = new Date(`${manualDate}T${manualTime}`).toISOString();
    const startTimeIso = hasStartTime
      ? new Date(`${manualStartDate}T${manualStartTime}`).toISOString()
      : undefined;

    const manualTask = {
      title: manualTitle.trim(),
      description: manualDesc.trim(),
      deadline: deadlineIso,
      startTime: startTimeIso,
      complexity: manualComplexity,
      urgencyScore: manualUrgency,
      color: manualColor,
      isRecurring: manualIsRecurring,
      recurrence: manualIsRecurring ? manualRecurrence : "none",
      starterTask: manualSubtasks[0]
        ? `Focus entirely on your first milestone: ${manualSubtasks[0].title} (${manualSubtasks[0].durationMin} mins)`
        : "Take a deep breath and start working (5 mins)",
      subtasks: manualSubtasks.map((st) => ({
        title: st.title,
        durationMin: st.durationMin,
        implementationIntention: `If I sit at my workstation, I will focus entirely on completing: ${st.title}`
      }))
    };

    onIntakeSuccess(manualTask, true);
  };

  const urgencyMeta = urgencyLabel(manualUrgency);
  const urgencyGrad = urgencyColor(manualUrgency);

  return (
    <div
      className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs max-w-xl mx-auto w-full space-y-5"
      id="intake-hub"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-black text-gray-900 flex items-center justify-center gap-1.5">
          <ListPlus className="w-5 h-5 text-indigo-600" />
          Task Generator
        </h2>
        <p className="text-xs text-gray-500">
          Create a task manually to auto-schedule focus sprints and milestones
        </p>
      </div>

      <form onSubmit={handleCreateManualTask} className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Task Title
          </label>
          <input
            type="text"
            required
            placeholder="E.g. Gym, Machine Learning Assignment 3…"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400 font-medium"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Description / Notes
          </label>
          <textarea
            placeholder="Syllabus guidelines, grading rules, workout split, or subtask notes…"
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-xl p-3 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400 resize-none font-medium leading-relaxed"
          />
        </div>

        {/* ── Start Time (optional) ── */}
        <div className="border border-gray-150 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-500" />
              <div>
                <span className="text-[11px] font-bold text-gray-700">Start Time</span>
                <p className="text-[9px] text-gray-400 leading-tight">
                  Optional — track when the activity begins (e.g. gym, class)
                </p>
              </div>
            </div>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setHasStartTime((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer focus:outline-none ${
                hasStartTime ? "bg-indigo-600" : "bg-gray-300"
              }`}
              id="start-time-toggle"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  hasStartTime ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {hasStartTime && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> Start Date
                </label>
                <input
                  type="date"
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-gray-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Start Time
                </label>
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-gray-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Due Date & Time ── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-gray-400" /> Due Date
            </label>
            <input
              type="date"
              required
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-gray-800"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-gray-400" /> Due Time
            </label>
            <input
              type="time"
              required
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-xs bg-gray-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-gray-800"
            />
          </div>
        </div>

        {/* ── Complexity ── */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Complexity
          </label>
          <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200/50">
            {(["Low", "Medium", "High"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setManualComplexity(level)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  manualComplexity === level
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* ── Urgency Score — proper visible bar ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Urgency Score
            </label>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyMeta.color}`}>
              {urgencyMeta.text} · {manualUrgency}
            </span>
          </div>

          {/* Filled gradient track */}
          <div className="relative h-2 bg-gray-200 rounded-full">
            <div
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${urgencyGrad} transition-all`}
              style={{ width: `${manualUrgency}%` }}
            />
            <input
              type="range"
              min="1"
              max="100"
              value={manualUrgency}
              onChange={(e) => setManualUrgency(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="urgency-slider"
            />
          </div>

          {/* Tick marks */}
          <div className="flex justify-between mt-1">
            {["1", "25", "50", "75", "100"].map((t) => (
              <span key={t} className="text-[9px] text-gray-400 font-mono">{t}</span>
            ))}
          </div>
        </div>

        {/* ── Color Palette ── */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <Palette className="w-3.5 h-3.5 text-gray-400" /> Color Theme
          </label>
          <div className="flex gap-2">
            {KEEP_COLORS.map((c) => (
              <button
                key={c.colorCode}
                type="button"
                onClick={() => setManualColor(c.colorCode)}
                className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center ${c.class} ${
                  manualColor === c.colorCode
                    ? "ring-2 ring-indigo-500 border-indigo-500 scale-110"
                    : "border-gray-200 hover:scale-105"
                }`}
                title={c.name}
              >
                {manualColor === c.colorCode && (
                  <Check
                    className={`w-3.5 h-3.5 ${
                      c.colorCode === "default" ? "text-indigo-600" : "text-white"
                    } font-bold`}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Recurring Task ── */}
        <div className="border border-gray-150 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-gray-700">Recurring Task</span>
              <p className="text-[9px] text-gray-400">Automatically repeat task after completion</p>
            </div>
            <input
              type="checkbox"
              checked={manualIsRecurring}
              onChange={(e) => {
                setManualIsRecurring(e.target.checked);
                if (e.target.checked && manualRecurrence === "none") {
                  setManualRecurrence("daily");
                }
              }}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
            />
          </div>

          {manualIsRecurring && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">Recurrence Rule</span>
              <select
                value={manualRecurrence}
                onChange={(e) => setManualRecurrence(e.target.value as any)}
                className="bg-white border border-gray-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="daily">Every Day</option>
                <option value="weekly">Every Week</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Milestones / Subtasks ── */}
        <div className="border border-gray-150 p-4 rounded-2xl space-y-3">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Milestones & Subtasks
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="E.g. Warm-up sets, Review requirements…"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddManualSubtask(); } }}
              className="flex-1 border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
            />
            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 gap-1 shrink-0">
              <input
                type="number"
                min="5"
                max="180"
                value={newSubtaskDuration}
                onChange={(e) => setNewSubtaskDuration(Number(e.target.value))}
                className="w-10 text-xs font-mono text-center focus:outline-none"
              />
              <span className="text-[10px] text-gray-400 font-bold uppercase">m</span>
            </div>
            <button
              type="button"
              onClick={handleAddManualSubtask}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {manualSubtasks.length > 0 && (
            <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto">
              {manualSubtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-medium"
                >
                  <span className="text-gray-700 truncate pr-4">{st.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                      {st.durationMin}m
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveManualSubtask(idx)}
                      className="text-gray-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={!manualTitle.trim()}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          id="manual-task-submit-btn"
        >
          <Check className="w-4 h-4" />
          Create Task & Auto-Schedule Sprints
        </button>
      </form>
    </div>
  );
}

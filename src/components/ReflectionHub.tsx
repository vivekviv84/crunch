import React, { useState, useEffect } from "react";
import { Brain, Sparkles, AlertCircle, History, CheckCircle2, RotateCcw, HelpCircle } from "lucide-react";
import { api } from "../services/api";
import { Task } from "../types";
import { ReflectionSummary } from "../types/agents";

interface ReflectionHubProps {
  tasks: Task[];
}

export default function ReflectionHub({ tasks }: ReflectionHubProps) {
  const [reflections, setReflections] = useState<ReflectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [reflectingTaskId, setReflectingTaskId] = useState<string>("");
  const [reflectingLoading, setReflectingLoading] = useState(false);

  const fetchReflections = async () => {
    setLoading(true);
    try {
      const response = await api.get<ReflectionSummary[]>("/api/agent/reflections");
      setReflections(response.data);
    } catch (err) {
      console.error("Failed to load reflections:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerReflection = async (taskId: string, title: string) => {
    if (!taskId) return;
    setReflectingLoading(true);
    try {
      const res = await api.post<ReflectionSummary>("/api/agent/reflect", {
        taskId,
        taskTitle: title,
      });
      setReflectingTaskId("");
      fetchReflections();
    } catch (err) {
      console.error("Failed to compile reflection:", err);
    } finally {
      setReflectingLoading(false);
    }
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  const completedTasks = tasks.filter((t) => t.status === "Completed" || t.status === "Pending");

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5" id="reflection-hub">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-100">
            Metacognitive Reflection Hub
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          Reflection Count: {reflections.length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Trigger a new reflection */}
        <div className="lg:col-span-4 bg-slate-950 p-4 rounded-lg border border-slate-900/80 space-y-3.5">
          <div className="space-y-1">
            <h4 className="text-xs font-mono font-semibold text-slate-200">Reflect on a Lesson</h4>
            <p className="text-[10px] text-slate-500 font-mono leading-normal">
              Select any completed task or active sprint to trigger a Gemini Metacognitive audit.
            </p>
          </div>

          <div className="space-y-2">
            <select
              value={reflectingTaskId}
              onChange={(e) => setReflectingTaskId(e.target.value)}
              disabled={reflectingLoading || completedTasks.length === 0}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Choose Task --</option>
              {completedTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                const matched = completedTasks.find((t) => t.id === reflectingTaskId);
                if (matched) {
                  triggerReflection(matched.id, matched.title);
                }
              }}
              disabled={reflectingLoading || !reflectingTaskId}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-mono font-bold text-xs uppercase rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Brain className="w-3.5 h-3.5" />
              {reflectingLoading ? "Analyzing..." : "Audit Session"}
            </button>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/20 rounded p-3 text-[10px] font-mono text-emerald-400/90 leading-relaxed">
            <HelpCircle className="w-4 h-4 mb-1 shrink-0 text-emerald-400" />
            Metacognition measures "thinking about thinking". By storing completed failure points, the AI models refine tomorrow's custom time estimates.
          </div>
        </div>

        {/* History of reflections */}
        <div className="lg:col-span-8 space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {loading && reflections.length === 0 ? (
            <div className="text-center py-10 animate-pulse text-xs font-mono text-slate-600">
              Retrieving historical logs...
            </div>
          ) : reflections.length === 0 ? (
            <div className="text-center py-10 text-xs font-mono text-slate-600 italic">
              No reflection audits recorded yet.
            </div>
          ) : (
            reflections.map((ref) => (
              <div key={ref.id} className="bg-slate-950/40 border border-slate-900 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-mono font-bold text-slate-200">{ref.taskTitle}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">{ref.date}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                  <div className="bg-emerald-950/10 p-2 border border-emerald-900/10 rounded">
                    <span className="text-[9px] font-mono font-bold text-emerald-400 block uppercase mb-0.5">What Worked</span>
                    <p className="text-slate-300 font-sans">{ref.whatWorked}</p>
                  </div>
                  <div className="bg-rose-950/10 p-2 border border-rose-900/10 rounded">
                    <span className="text-[9px] font-mono font-bold text-rose-400 block uppercase mb-0.5">What Failed</span>
                    <p className="text-slate-300 font-sans">{ref.whatFailed}</p>
                  </div>
                  <div className="bg-amber-950/10 p-2 border border-amber-900/10 rounded">
                    <span className="text-[9px] font-mono font-bold text-amber-400 block uppercase mb-0.5">Why Stuck</span>
                    <p className="text-slate-300 font-sans">{ref.whyUserGotStuck}</p>
                  </div>
                  <div className="bg-purple-950/10 p-2 border border-purple-900/10 rounded">
                    <span className="text-[9px] font-mono font-bold text-purple-400 block uppercase mb-0.5">Next Iteration override</span>
                    <p className="text-slate-300 font-sans">{ref.whatShouldChangeNextTime}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

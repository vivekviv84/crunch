import React, { useState } from "react";
import { Sparkles, Brain, AlertTriangle, Play, HelpCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "../services/api";

interface TriageTask {
  id: string;
  title: string;
  deadline: string;
  complexity: string;
  urgencyScore: number;
}

interface StressTriageCardProps {
  onTriageComplete: () => void;
}

export default function StressTriageCard({ onTriageComplete }: StressTriageCardProps) {
  const [dumpText, setDumpText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TriageTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dumpText.trim()) return;

    setLoading(true);
    setResults([]);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; tasks: TriageTask[] }>("/api/agent/triage-dump", {
        brainDump: dumpText,
      });

      if (response.data.success) {
        setResults(response.data.tasks);
        setDumpText("");
        onTriageComplete(); // Trigger state refresh in the main store or layout
      } else {
        setError("AI Triage agent was unable to parse input. Please try a different wording.");
      }
    } catch (err) {
      console.error("Triage dump failed:", err);
      setError("Failed to coordinate triage. Our micro-agents are recovering buffers.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5" id="stress-triage-card">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
        <Brain className="w-4 h-4 text-rose-500 animate-pulse" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-100">
          Autonomous Stress Brain-Dump Triage
        </h3>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-slate-400 font-sans leading-relaxed">
          Type or copy your unstructured chaos (e.g., raw lists, calendar overlaps, panic thoughts). The
          autonomous Triage Agent will parse, categorize, estimate effort, detect pipeline blockages, and schedule
          actionable tasks inside your master planner.
        </p>

        <form onSubmit={handleTriage} className="space-y-3.5">
          <textarea
            rows={4}
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            disabled={loading}
            placeholder="e.g., i have to clean up my git repo before 10pm tomorrow, and write a 1000 word paper on neural alignment but i'm completely stuck on the math part and i still need to draft the pdf syllabus outline..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Characters: {dumpText.length} | Real-Time Agent Parsing Enabled
            </span>
            <button
              type="submit"
              disabled={loading || !dumpText.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-mono font-bold text-xs uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "Orchestrating Triage..." : "Trigger Autonomous Triage"}
            </button>
          </div>
        </form>

        {loading && (
          <div className="bg-slate-950/80 border border-slate-900 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Intake Agent sorting thoughts... Planning Agent mapping subtasks...</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 bg-slate-900 rounded animate-pulse w-11/12" />
              <div className="h-2.5 bg-slate-900 rounded animate-pulse w-5/6" />
              <div className="h-2.5 bg-slate-900 rounded animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-xs text-rose-400 font-mono rounded">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-slate-950 border border-slate-900 rounded-lg p-4 space-y-3">
            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">
              Autonomous Instantiated Tasks
            </span>
            <div className="space-y-2">
              {results.map((task) => (
                <div key={task.id} className="flex items-center justify-between border-b border-slate-900/60 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-mono font-semibold text-slate-200">{task.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Deadline: {task.deadline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-rose-400 font-bold">Threat: {task.urgencyScore}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

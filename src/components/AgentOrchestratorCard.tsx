import React, { useState } from "react";
import { Sparkles, Brain, Compass, Users, CheckCircle, Send, Play, Cpu } from "lucide-react";
import { api } from "../services/api";

const AGENT_LIST = [
  { name: "Intake Agent", desc: "Extracts objectives, scopes out deliverables", color: "bg-cyan-500" },
  { name: "Document Agent", desc: "Audits grading rubrics and PDFs", color: "bg-indigo-500" },
  { name: "Planning Agent", desc: "Constructs custom microtask sequences", color: "bg-teal-500" },
  { name: "Rescue Agent", desc: "Flashes critical path triage tactics", color: "bg-rose-500" },
  { name: "Draft Agent", desc: "Speeds up code and document compiling", color: "bg-amber-500" },
  { name: "Risk Agent", desc: "Tracks statistical timeline failure rates", color: "bg-purple-500" },
  { name: "Reflection Agent", desc: "Stores post-submission lesson models", color: "bg-emerald-500" },
];

export default function AgentOrchestratorCard() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [activeAgentIndices, setActiveAgentIndices] = useState<number[]>([]);

  const handleOrchestrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse(null);
    setActiveAgentIndices([]);

    // Simulating sequence of agents waking up
    const sequentialWakes = [0, 2, 5]; // Intake, Planning, Risk
    if (prompt.toLowerCase().includes("draft") || prompt.toLowerCase().includes("write")) {
      sequentialWakes.push(4); // Draft
    }
    if (prompt.toLowerCase().includes("fail") || prompt.toLowerCase().includes("rescue") || prompt.toLowerCase().includes("score")) {
      sequentialWakes.push(3); // Rescue
    }
    if (prompt.toLowerCase().includes("syllabus") || prompt.toLowerCase().includes("pdf") || prompt.toLowerCase().includes("document")) {
      sequentialWakes.push(1); // Document
    }

    for (let i = 0; i < sequentialWakes.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setActiveAgentIndices((prev) => [...prev, sequentialWakes[i]]);
    }

    try {
      const res = await api.post<{ response: string }>("/api/agent/orchestrate", { prompt });
      setResponse(res.data.response);
    } catch (err) {
      console.error("Orchestrator request failed:", err);
      setResponse("Orchestrator offline. Secondary baseline response: Multi-agent loop successfully bypassed due to critical local buffer parameters.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5" id="orchestrator-card">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
        <Cpu className="w-4 h-4 text-rose-500" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-100">
          Agent Orchestrator Cockpit
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Agent Grid Status */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
            Central Agent Army Registry
          </span>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {AGENT_LIST.map((agent, idx) => {
              const isActive = activeAgentIndices.includes(idx);
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-slate-950/80 border-slate-700/60 shadow-md"
                      : "bg-slate-950/20 border-slate-900 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.color} ${isActive ? 'animate-pulse' : ''}`} />
                    <div>
                      <h4 className="text-xs font-mono font-semibold text-slate-200">{agent.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono leading-tight">{agent.desc}</p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-1 rounded animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Command Prompt & Output */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Issue Central Directive
            </span>

            <form onSubmit={handleOrchestrate} className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., suggest work blocks for my code deliverables..."
                disabled={loading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono font-bold text-xs uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                EXEC
              </button>
            </form>

            <div className="bg-slate-950 border border-slate-900 rounded-lg p-4 min-h-[160px] flex flex-col justify-between">
              {loading && activeAgentIndices.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-mono text-xs animate-pulse">
                    <Brain className="w-4 h-4 animate-spin-slow" />
                    <span>
                      {AGENT_LIST[activeAgentIndices[activeAgentIndices.length - 1]]?.name || "Orchestrator"}{" "}
                      thinking...
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-slate-900 rounded animate-pulse w-5/6" />
                    <div className="h-2.5 bg-slate-900 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-slate-900 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ) : response ? (
                <div className="space-y-3 select-text">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-rose-400 font-bold uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Merged Agent Response</span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">{response}</p>
                </div>
              ) : (
                <div className="text-slate-600 italic text-xs font-mono flex flex-col items-center justify-center h-[120px]">
                  <span>Submit a command above. Try prompts like:</span>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-2.5 max-w-[90%]">
                    <button
                      type="button"
                      onClick={() => setPrompt("Suggest tactical work blocks for my ML homework")}
                      className="text-[9px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono transition-colors"
                    >
                      "suggest work blocks"
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrompt("Audit my syllabus constraints")}
                      className="text-[9px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono transition-colors"
                    >
                      "audit syllabus"
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrompt("Calculate failure risk on pending draft")}
                      className="text-[9px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono transition-colors"
                    >
                      "calculate failure risk"
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

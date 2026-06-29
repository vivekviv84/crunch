import React, { useEffect } from "react";
import { Cpu, Users, Layers, ShieldAlert, Sparkles, AlertCircle } from "lucide-react";
import { useTaskStore } from "../store/useTaskStore";
import { useUserStore } from "../store/useUserStore";
import AgentOrchestratorCard from "../components/AgentOrchestratorCard";
import AiProductivityProfile from "../components/AiProductivityProfile";
import ReflectionHub from "../components/ReflectionHub";
import StressTriageCard from "../components/StressTriageCard";
import RescueHistoryTimeline from "../components/RescueHistoryTimeline";
import AgentActivityTerminal from "../components/AgentActivityTerminal";

export default function AgentCommandCenter() {
  const { tasks, fetchTasks } = useTaskStore();
  const { isAuthenticated, authInitialized } = useUserStore();

  useEffect(() => {
    if (isAuthenticated && authInitialized) {
      fetchTasks();
    }
  }, [fetchTasks, isAuthenticated, authInitialized]);

  return (
    <div className="space-y-6" id="agent-command-center-page">
      {/* Page Hero Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-60" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-rose-500" />
              <h1 className="text-sm font-mono font-bold uppercase tracking-widest text-rose-500">
                Agentic Orchestration Deck
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-sans max-w-xl">
              Co-work autonomously with 7 specialized academic micro-agents. Manage long-term cognitive memory, trigger performance reflection audits, and triage stress brain-dumps.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-3.5 py-1.5 border border-slate-800/50 rounded-lg">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-300">
              CO-WORKER LINK LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Orchestrator Deck */}
      <div className="grid grid-cols-1 gap-6">
        {/* 1. Orchestrator Card */}
        <AgentOrchestratorCard />

        {/* 2. Double Column: Profile and History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AiProductivityProfile />
          <RescueHistoryTimeline />
        </div>

        {/* 3. Stress Dump Triage and Activity Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <StressTriageCard onTriageComplete={fetchTasks} />
          </div>
          <div className="lg:col-span-5">
            <AgentActivityTerminal />
          </div>
        </div>

        {/* 4. Reflection Hub */}
        <ReflectionHub tasks={tasks} />
      </div>
    </div>
  );
}

import React from "react";
import { Terminal, Shield, RefreshCw, Trash2, Cpu } from "lucide-react";
import { AgentLog } from "../types";

interface IntelLogsProps {
  logs: AgentLog[];
  onRefresh: () => void;
  onClear: () => void;
}

export default function IntelLogs({ logs, onRefresh, onClear }: IntelLogsProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs text-slate-300 h-full flex flex-col" id="intel-logs-panel">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Cpu className="w-5 h-5 text-rose-500 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-100 tracking-tight">AGENT INTEL FEED</h3>
            <p className="text-[10px] text-slate-500">ReAct Loop: Reason → Act → Observe</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh logs"
            id="refresh-logs-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear Feed"
            id="clear-logs-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[360px] space-y-3 pr-1">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-600 flex flex-col items-center justify-center gap-2">
            <Terminal className="w-8 h-8 text-slate-700" />
            <p>Awaiting agent activation...</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const isReason = log.type === "REASON";
            const isAct = log.type === "ACT";
            const isObserve = log.type === "OBSERVE";

            let typeBadgeColor = "text-indigo-400 bg-indigo-950/60 border-indigo-900";
            if (isAct) typeBadgeColor = "text-amber-400 bg-amber-950/60 border-amber-900";
            if (isObserve) typeBadgeColor = "text-emerald-400 bg-emerald-950/60 border-emerald-900";

            let agentColor = "text-rose-400";
            if (log.agent.includes("Intake")) agentColor = "text-blue-400";
            if (log.agent.includes("Planning")) agentColor = "text-purple-400";
            if (log.agent.includes("Accountability")) agentColor = "text-cyan-400";
            if (log.agent.includes("Draft")) agentColor = "text-amber-400";

            return (
              <div
                key={idx}
                className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg space-y-1.5 hover:border-slate-800 transition-all duration-300 animate-fadeIn"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-semibold ${agentColor}`}>
                    [{log.agent.toUpperCase()}]
                  </span>
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`px-1.5 py-0.2 border rounded text-[9px] uppercase tracking-wider font-semibold ${typeBadgeColor}`}>
                    {log.type}
                  </span>
                  <p className="text-slate-300 leading-relaxed break-words flex-1">
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-800 pt-3 mt-4 text-[10px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          <span>Active Nodes: 5 Agents Online</span>
        </div>
        <span>CRUNCH Core v1.0</span>
      </div>
    </div>
  );
}

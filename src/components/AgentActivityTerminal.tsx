import React, { useState, useEffect } from "react";
import { Terminal, Shield, Sparkles, RefreshCw } from "lucide-react";
import { api } from "../services/api";

interface LogEntry {
  timestamp: string;
  agent: string;
  type: "REASON" | "ACT" | "OBSERVE";
  message: string;
}

export default function AgentActivityTerminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get<LogEntry[]>("/api/agent/activity-feed");
      setLogs(response.data);
    } catch (err) {
      console.error("Failed to fetch agent activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-xl" id="agent-terminal-card">
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
            Live Agent Activity Terminal
          </span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-3.5 max-h-[300px] overflow-y-auto space-y-2.5 font-mono text-[11px] leading-relaxed select-text">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-6">
            Waiting for agent telemetry...
          </div>
        ) : (
          logs.map((log, idx) => {
            const dateStr = new Date(log.timestamp).toLocaleTimeString([], { hour12: false });
            let typeColor = "text-sky-400";
            if (log.type === "ACT") typeColor = "text-amber-400";
            if (log.type === "OBSERVE") typeColor = "text-emerald-400";

            return (
              <div key={idx} className="border-b border-slate-900/60 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                  <span>[{dateStr}]</span>
                  <span className="text-slate-300 font-semibold">{log.agent}</span>
                  <span className={`text-[9px] px-1 bg-slate-900 border border-slate-800 rounded font-bold ${typeColor}`}>
                    {log.type}
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5 whitespace-pre-wrap">{log.message}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

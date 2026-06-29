import React, { useState, useEffect } from "react";
import { TrendingDown, Calendar, Shield, Award, Sparkles, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { RescueHistoryItem } from "../types/agents";

export default function RescueHistoryTimeline() {
  const [history, setHistory] = useState<RescueHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get<RescueHistoryItem[]>("/api/agent/rescue-history");
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to load rescue history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5" id="rescue-history-timeline">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-100">
            Historic Rescue Score Timeline
          </h3>
        </div>
        <button onClick={fetchHistory} disabled={loading} className="text-slate-500 hover:text-slate-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {loading && history.length === 0 ? (
          <div className="text-center py-10 animate-pulse text-xs font-mono text-slate-600">
            Reading deadline records...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-xs font-mono text-slate-600 italic">
            No rescued assignments in database yet.
          </div>
        ) : (
          history.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-slate-950/40 border border-slate-900 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-100">{item.taskTitle}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 rounded">
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {item.date}
                  </span>
                  <span>•</span>
                  <span>Drafts generated: {item.draftsGeneratedCount}</span>
                </div>
              </div>

              {/* Score Reduction Graph */}
              <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-900/60 px-3 py-1.5 rounded-lg shrink-0">
                <div className="text-center">
                  <span className="text-[8px] font-mono text-slate-500 uppercase block">INITIAL RISK</span>
                  <span className="text-xs font-mono font-bold text-rose-500">{item.initialRescueScore}/100</span>
                </div>
                <div className="text-slate-700 font-mono text-xs">→</div>
                <div className="text-center">
                  <span className="text-[8px] font-mono text-slate-500 uppercase block">RESOLVED</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{item.finalRescueScore}/100</span>
                </div>
                <div className="border-l border-slate-900 pl-2">
                  <Award className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

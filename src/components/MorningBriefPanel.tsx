import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, X, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import { Task } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface MorningBriefData {
  topPriority: string;
  biggestRisk: string;
  completionForecast: string;
  motivationQuote: string;
  checklistMVP: string[];
}

interface MorningBriefPanelProps {
  tasks: Task[];
  onStartWorking?: () => void;
}

export default function MorningBriefPanel({ tasks, onStartWorking }: MorningBriefPanelProps) {
  const [brief, setBrief] = useState<MorningBriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(true);

  const fetchBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/api/agent/morning-brief", { tasks });
      setBrief(response.data);
    } catch (err: any) {
      console.error("Failed to fetch Morning Brief:", err);
      setError("Failed to generate AI morning briefing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      fetchBrief();
    } else {
      setBrief({
        topPriority: "Initiate Your First Project Plan",
        biggestRisk: "No active projects tracked. Procrastination sets in when objectives remain undefined.",
        completionForecast: "N/A - Setup a task in the Crisis Intake system first.",
        motivationQuote: "The secret of getting ahead is getting started. Take 2 minutes and dump your thoughts.",
        checklistMVP: ["Create or upload a task syllabus", "Activate Rescue Mode on your top bottleneck"]
      });
    }
  }, [tasks]);

  if (!showBrief) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-indigo-50 border border-indigo-100 rounded-xl p-4.5 relative overflow-hidden shadow-xs"
        id="morning-brief-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Today's focus
              </h4>

              {loading ? (
                <div className="space-y-2 py-1">
                  <div className="h-3.5 bg-indigo-200/50 rounded-md animate-pulse w-48" />
                  <div className="h-3 bg-indigo-200/50 rounded-md animate-pulse w-32" />
                </div>
              ) : error ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {error}
                </p>
              ) : brief ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    {brief.topPriority}
                  </p>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-indigo-900/70 font-medium">
                    {brief.biggestRisk && (
                      <span className="flex items-center gap-1">
                        • Risk: {brief.biggestRisk}
                      </span>
                    )}
                    {brief.motivationQuote && (
                      <span className="italic">
                        • "{brief.motivationQuote}"
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={fetchBrief}
              disabled={loading}
              className="p-1 text-indigo-400 hover:text-indigo-800 rounded-md transition-colors cursor-pointer"
              title="Refresh Brief"
              id="morning-brief-refresh-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowBrief(false)}
              className="p-1 text-indigo-400 hover:text-indigo-800 rounded-md transition-colors cursor-pointer"
              title="Dismiss"
              id="morning-brief-close-btn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

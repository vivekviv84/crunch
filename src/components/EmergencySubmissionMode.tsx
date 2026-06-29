import React, { useState } from "react";
import { ShieldAlert, Zap, CheckCircle2, Scissors, SkipForward, Flame, ArrowUpRight } from "lucide-react";
import { EmergencySubmissionData } from "../types/intelligence";
import { motion, AnimatePresence } from "motion/react";

interface EmergencySubmissionModeProps {
  data: EmergencySubmissionData;
  onActivate?: () => void;
}

export default function EmergencySubmissionMode({ data, onActivate }: EmergencySubmissionModeProps) {
  const { estimatedGradeNow, estimatedGradeAfterPlan, mustComplete, canShorten, canSkip, triageSummary } = data;
  const [isActive, setIsActive] = useState(false);

  const handleToggle = () => {
    setIsActive(!isActive);
    if (onActivate) onActivate();
  };

  return (
    <div 
      className={`relative overflow-hidden border rounded-2xl p-6 backdrop-blur-xl transition-all shadow-xl ${
        isActive 
          ? "bg-rose-950/20 border-rose-500/80 ring-1 ring-rose-500/20" 
          : "bg-slate-900/40 border-slate-800 hover:border-slate-700/80"
      }`}
      id="emergency-submission-mode-root"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.05] bg-red-500 pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            GRADE DEFICIT PROTECTION
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-rose-950/60 border border-rose-900/40 text-rose-400 uppercase font-black tracking-wider animate-pulse">
            EMERGENCY OVERRIDE
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          Grade Maximizer Algorithm v2.0
        </div>
      </div>

      <div className="space-y-6 pt-6">
        
        {/* BIG PULSING BUTTON */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950/50 border border-slate-900 rounded-xl text-center space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white tracking-tight">
              Stuck in a Time Crunch Panic?
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Trigger the Emergency Grade Saver to automatically strip unrated features, focus purely on core rubrics, and rescue your grade.
            </p>
          </div>

          <motion.button
            onClick={handleToggle}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full max-w-xs py-3.5 px-6 rounded-xl font-display font-black tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
              isActive 
                ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-emerald-950/40" 
                : "bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-rose-950/40 animate-pulse hover:animate-none"
            }`}
            id="save-my-grade-btn"
          >
            <Zap className={`w-4 h-4 ${isActive ? "text-white animate-spin" : "text-white animate-bounce"}`} />
            {isActive ? "RESCUE MODE ACTIVE" : "SAVE MY GRADE"}
          </motion.button>

          <span className="text-[9px] font-mono text-slate-500">
            {isActive ? "Minimum Viable Submission checklist loaded." : "Safe, reversible, instantly calculated by Gemini."}
          </span>
        </div>

        {/* GRADE COMPARISON */}
        <div className="grid grid-cols-2 gap-4">
          
          <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 text-center space-y-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase">ESTIMATED GRADE NOW</span>
            <div className="text-2xl font-display font-black text-slate-400">
              {estimatedGradeNow}%
            </div>
            <span className="text-[9px] font-mono text-slate-600">No submission / incomplete</span>
          </div>

          <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl p-4 text-center space-y-1 relative">
            <div className="absolute top-1.5 right-1.5 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-mono text-rose-400 uppercase">EXPECTED GRADE AFTER PLAN</span>
            <div className="text-2xl font-display font-black text-rose-500">
              {estimatedGradeAfterPlan}%
            </div>
            <span className="text-[9px] font-mono text-rose-400 font-semibold uppercase tracking-wider">
              SAFE PASS SEED
            </span>
          </div>

        </div>

        {/* PLAN EXPANSION PANEL */}
        <AnimatePresence initial={false}>
          {isActive && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-4 border-t border-slate-900"
            >
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/30 rounded-xl text-xs text-rose-300 font-sans leading-relaxed">
                <strong>Minimum Viable Submission Plan:</strong> {triageSummary}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* MUST COMPLETE */}
                <div className="space-y-2 bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    MUST COMPLETE
                  </div>
                  <ul className="space-y-1 text-[10px] text-slate-400 leading-normal">
                    {mustComplete.map((item, idx) => (
                      <li key={idx} className="flex gap-1 items-start">
                        <span className="text-emerald-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CAN SHORTEN */}
                <div className="space-y-2 bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 uppercase">
                    <Scissors className="w-3.5 h-3.5" />
                    CAN SHORTEN
                  </div>
                  <ul className="space-y-1 text-[10px] text-slate-400 leading-normal">
                    {canShorten.map((item, idx) => (
                      <li key={idx} className="flex gap-1 items-start">
                        <span className="text-amber-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CAN SKIP */}
                <div className="space-y-2 bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-red-400 uppercase">
                    <SkipForward className="w-3.5 h-3.5" />
                    CAN SKIP
                  </div>
                  <ul className="space-y-1 text-[10px] text-slate-400 leading-normal">
                    {canSkip.map((item, idx) => (
                      <li key={idx} className="flex gap-1 items-start">
                        <span className="text-red-500">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

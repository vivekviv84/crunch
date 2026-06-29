import React, { useState, useEffect } from "react";
import { 
  Compass, RefreshCw, Layers, ShieldAlert, Sparkles, Sliders, Info, CheckCircle, Flame, Clock, Award, Star 
} from "lucide-react";
import { IntelligenceDashboardData } from "../types/intelligence";
import { api } from "../services/api";
import RescueScoreCard from "./RescueScoreCard";
import RiskPredictorCard from "./RiskPredictorCard";
import RescueTimeline from "./RescueTimeline";
import WhatIfSimulator from "./WhatIfSimulator";
import GradeMaximizer from "./GradeMaximizer";
import EmergencySubmissionMode from "./EmergencySubmissionMode";
import { motion, AnimatePresence } from "motion/react";

interface RescueCommandCenterProps {
  taskId: string;
  initialHoursRemaining?: number;
  initialProgress?: number;
}

export default function RescueCommandCenter({ 
  taskId, 
  initialHoursRemaining = 8,
  initialProgress = 33 
}: RescueCommandCenterProps) {
  const [hoursRemaining, setHoursRemaining] = useState(initialHoursRemaining);
  const [progress, setProgress] = useState(initialProgress);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IntelligenceDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diagnostics" | "simulator" | "maximizer" | "differentiation">("diagnostics");

  // Fetch intelligence payload with debounce and request cancellation
  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.post(
          "/api/agent/intelligence-dashboard",
          {
            taskId,
            hoursRemainingOverride: hoursRemaining,
            progressOverride: progress,
            subtasksOverride: {
              total: 6,
              completed: Math.round((progress / 100) * 6),
            },
          },
          {
            signal: abortController.signal,
            dedupeKey: `intelligence-dashboard:${taskId}:${hoursRemaining}:${progress}`,
          }
        );
        if (active) {
          setData(response.data);
          setError(null);
        }
      } catch (err: unknown) {
        const e = err as { name?: string; code?: string };
        if (e.name === "CanceledError" || e.code === "ERR_CANCELED" || !active) return;
        console.error("Error loading intelligence dashboard:", err);
        setError("Failed to coordinate intelligence telemetry.");
      } finally {
        if (active) setLoading(false);
      }
    }, 800);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [taskId, hoursRemaining, progress]);

  const handleTriggerEmergencyPlan = () => {
    // Interactive feedback when SAVE MY GRADE is activated
    setProgress(prev => Math.min(75, prev + 15));
  };

  return (
    <div className="space-y-6" id="command-center-workspace">
      
      {/* 1. DYNAMIC CONTROLLER STRIP */}
      <div className="bg-white/70 border border-white/50 rounded-3xl p-5.5 backdrop-blur-md relative overflow-hidden shadow-xs text-slate-800">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 via-rose-400 to-purple-400" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">
                Interactive Speed & Progress Adjuster ⏱️
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Change your target parameters to see how it affects your completion predictions in real-time!
            </p>
          </div>
 
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 max-w-xl">
            {/* Hours Remaining Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span className="flex items-center gap-1 font-bold">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  HOURS REMAINING:
                </span>
                <span className="text-rose-500 font-extrabold">{hoursRemaining} hours</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="48" 
                value={hoursRemaining}
                onChange={(e) => setHoursRemaining(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
 
            {/* Progress Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span className="flex items-center gap-1 font-bold">
                  <Award className="w-3.5 h-3.5 text-teal-500" />
                  PROGRESS RATE:
                </span>
                <span className="text-teal-500 font-extrabold">{progress}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>
          </div>
        </div>
      </div>
 
      {/* 2. COMMAND NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-px overflow-x-auto">
        {[
          { id: "diagnostics", label: "Productivity Insights 📊" },
          { id: "simulator", label: "Timeline Simulator 🔮" },
          { id: "maximizer", label: "Priority Booster ⚡" },
          { id: "differentiation", label: "Why CRUNCH? 💡" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === tab.id 
                ? "border-rose-500 text-rose-500 font-bold" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. ACTIVE MAIN SECTION VIEW */}
      <AnimatePresence mode="wait">
        {loading && !data ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12 text-center space-y-3"
          >
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
            <p className="text-xs text-slate-500 font-mono">Synchronizing temporal prediction metrics...</p>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            className="p-8 text-center text-red-400 border border-red-950 bg-red-950/20 rounded-xl"
          >
            {error}
          </motion.div>
        ) : data ? (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            
            {/* VIEW A: CRISIS DIAGNOSTICS */}
            {activeTab === "diagnostics" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* FEATURE 1 — RESCUE SCORE */}
                  <RescueScoreCard data={data.rescueScore} />

                  {/* FEATURE 2 — DEADLINE RISK PREDICTOR */}
                  <RiskPredictorCard data={data.riskPredictor} />
                </div>

                {/* FEATURE 3 — RESCUE TIMELINE */}
                <RescueTimeline data={data.rescueTimeline} />

                {/* FEATURE 6 — EMERGENCY SUBMISSION OVERRIDE */}
                <EmergencySubmissionMode 
                  data={data.emergencySubmission} 
                  onActivate={handleTriggerEmergencyPlan} 
                />
              </div>
            )}

            {/* VIEW B: WHAT-IF SIMULATOR */}
            {activeTab === "simulator" && (
              <WhatIfSimulator scenarios={data.whatIf} />
            )}

            {/* VIEW C: GRADE MAXIMIZER */}
            {activeTab === "maximizer" && (
              <GradeMaximizer data={data.gradeMaximizer} />
            )}

            {/* VIEW D: PITCH DIFFERENTIATION (FEATURE 10) */}
            {activeTab === "differentiation" && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden transition-all shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.05] bg-rose-500 pointer-events-none" />
                
                <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-rose-950/60 border border-rose-900/40 text-rose-400 uppercase font-black tracking-wider">
                    CRUNCH vs COMPETITORS
                  </span>
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                    THE PARADIGM SHIFT
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-6 pt-6">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <h4 className="text-lg font-black font-sans tracking-tight text-white leading-tight">
                      Why CRUNCH Is Not a Planner. It is a Rescue Agent.
                    </h4>
                    <p className="text-xs text-slate-400">
                      Traditional task managers list things you are failing to accomplish, generating passive guilt. CRUNCH actively steps into the crisis, taking you by the hand to restructure the syllabus and salvage passing grades.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4">
                    
                    {/* Todoist */}
                    <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-2">
                      <h5 className="text-xs font-black font-mono text-slate-500 uppercase">Todoist</h5>
                      <span className="text-[10px] text-red-400/80 uppercase font-mono tracking-wide font-bold block">Flat Task List</span>
                      <p className="text-[11px] text-slate-500">
                        Keeps piling on tasks. Color codes them red but leaves you to drown in instructions.
                      </p>
                    </div>

                    {/* Notion AI */}
                    <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-2">
                      <h5 className="text-xs font-black font-mono text-slate-500 uppercase">Notion AI</h5>
                      <span className="text-[10px] text-amber-400/80 uppercase font-mono tracking-wide font-bold block">Document Sandbox</span>
                      <p className="text-[11px] text-slate-500">
                        Summarizes paragraphs but doesn't map actionable sprints, pace-indicators, or calendar blocks.
                      </p>
                    </div>

                    {/* Motion */}
                    <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-2">
                      <h5 className="text-xs font-black font-mono text-slate-500 uppercase">Motion</h5>
                      <span className="text-[10px] text-blue-400/80 uppercase font-mono tracking-wide font-bold block">Auto-Scheduler</span>
                      <p className="text-[11px] text-slate-500">
                        Shuffles tasks infinitely when missed, creating planning loops without analyzing assignments.
                      </p>
                    </div>

                    {/* Google Tasks */}
                    <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-2">
                      <h5 className="text-xs font-black font-mono text-slate-500 uppercase">Google Tasks</h5>
                      <span className="text-[10px] text-slate-600 uppercase font-mono tracking-wide font-bold block">Passive Checklist</span>
                      <p className="text-[11px] text-slate-500">
                        Simple checklist with no cognitive mitigation, grade prediction, or copilot draft helpers.
                      </p>
                    </div>

                    {/* CRUNCH */}
                    <div className="bg-rose-950/20 border border-rose-500 p-4 rounded-xl space-y-2 relative">
                      <div className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </div>
                      <h5 className="text-xs font-black font-mono text-rose-400 uppercase">CRUNCH</h5>
                      <span className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider font-extrabold block">AI Decision Engine</span>
                      <p className="text-[11px] text-slate-300">
                        An active tactical cockpit. Uses rubrics to dynamically trim requirements, predict grades, block calendars, and write drafts.
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  );
}

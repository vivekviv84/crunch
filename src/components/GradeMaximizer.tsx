import React from "react";
import { Award, Compass, Star, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { GradeMaximizerData } from "../types/intelligence";
import { motion } from "motion/react";

interface GradeMaximizerProps {
  data: GradeMaximizerData;
}

export default function GradeMaximizer({ data }: GradeMaximizerProps) {
  const { effortAllocation, summary } = data;

  const renderStars = (priority: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star 
        key={i} 
        className={`w-3.5 h-3.5 ${
          i < priority ? "text-amber-400 fill-amber-400" : "text-slate-700"
        }`} 
      />
    ));
  };

  return (
    <div 
      className="bg-white border border-slate-200 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden transition-all shadow-xl hover:border-slate-300"
      id="grade-maximizer-root"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.05] bg-amber-500 pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            RUBRIC CRITERIA ALLOCATION
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-50 border border-amber-200 text-amber-700 uppercase font-black tracking-wider">
            GRADE MAXIMIZER
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5" />
          Marks Distribution
        </div>
      </div>

      <div className="space-y-6 pt-6">
        {/* EXECUTIVE STRATEGY SUMMARY */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">
              Emergency Strategic Advisory
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              {summary}
            </p>
          </div>
        </div>

        {/* SECTION ALLOCATION LIST */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Section Weight & Strategic Triage
          </h4>

          <div className="grid grid-cols-1 gap-3">
            {effortAllocation.map((section, idx) => {
              const isCrit = section.priorityLevel >= 4;
              return (
                <div 
                  key={section.sectionName}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-800">
                        {section.sectionName}
                      </h5>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Priority Rating:</span>
                        <div className="flex items-center gap-0.5">
                          {renderStars(section.priorityLevel)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-[9px] text-slate-500 uppercase block">GRADE WEIGHT</span>
                      <span className="text-sm font-black text-rose-500">{section.weightPercentage}%</span>
                    </div>
                  </div>

                  {/* Weight Progress Bar */}
                  <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full ${isCrit ? "bg-rose-500" : "bg-slate-500"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${section.weightPercentage}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                    />
                  </div>

                  {/* Recommendation Text */}
                  <p className="text-[11px] text-slate-600 font-sans leading-normal">
                    {section.focusRecommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

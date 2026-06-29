import React from "react";
import { Sparkles, HelpCircle, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { RiskPredictorData } from "../types/intelligence";
import { motion } from "motion/react";

interface RiskPredictorCardProps {
  data: RiskPredictorData;
}

export default function RiskPredictorCard({ data }: RiskPredictorCardProps) {
  const { missingProbability, topRiskFactors, summary } = data;

  const isHighRisk = missingProbability > 70;
  const isMediumRisk = missingProbability > 40 && missingProbability <= 70;

  return (
    <div 
      className="bg-white/70 border border-white/50 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden transition-all shadow-xs hover:border-rose-100"
      id="risk-predictor-card-root"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.04] bg-amber-500 pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-bold tracking-widest text-slate-450 uppercase">
            SUCCESS PREDICTOR 🌟
          </span>
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-50 border border-amber-100 text-amber-600 uppercase tracking-wider">
            PACING ASSISTANT
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-450 font-semibold">
          <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
          Realtime Inference
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6 items-center">
        
        {/* PROBABILITY DISPLAY PANEL */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
          <span className="text-[9px] font-bold tracking-widest text-slate-450 uppercase">
            Estimated Deadline Risk
          </span>

          <div className="relative flex items-center justify-center my-2">
            <span className={`text-4xl font-black tracking-tighter ${
              isHighRisk ? "text-rose-500" : isMediumRisk ? "text-amber-500" : "text-emerald-500"
            }`}>
              {missingProbability}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden border border-slate-200/50">
            <motion.div 
              className={`h-full rounded-full ${
                isHighRisk ? "bg-rose-500" : isMediumRisk ? "bg-amber-500" : "bg-emerald-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${missingProbability}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          <div className="text-[10px] font-bold tracking-wide">
            {isHighRisk ? (
              <span className="text-rose-500 uppercase">NEEDS FOCUS</span>
            ) : isMediumRisk ? (
              <span className="text-amber-600 uppercase">GETTING OUT OF PACE</span>
            ) : (
              <span className="text-emerald-600 uppercase">ON TRACK ZONE</span>
            )}
          </div>
        </div>

        {/* ANALYSIS EXPLANATION PANEL */}
        <div className="md:col-span-7 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest">
                Pace Assistant Insights
              </h4>
            </div>
            <p className="text-xs text-slate-655 font-medium leading-relaxed">
              {summary}
            </p>
          </div>

          {/* CRITICAL RISKS LIST */}
          {topRiskFactors && topRiskFactors.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <h5 className="text-[9px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                Key Factors to Help You Win:
              </h5>
              <div className="grid grid-cols-1 gap-2">
                {topRiskFactors.map((risk, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-3xs">
                    <span className="text-rose-500 font-bold text-xs shrink-0 select-none">
                      0{idx + 1}
                    </span>
                    <span className="text-xs text-slate-600 leading-normal font-medium">
                      {risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

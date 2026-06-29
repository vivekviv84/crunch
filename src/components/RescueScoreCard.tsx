import React from "react";
import { ShieldAlert, AlertTriangle, Flame, ShieldCheck, HelpCircle } from "lucide-react";
import { RescueScoreData } from "../types/intelligence";
import { motion } from "motion/react";

interface RescueScoreCardProps {
  data: RescueScoreData;
}

export default function RescueScoreCard({ data }: RescueScoreCardProps) {
  const { score, riskLevel, explanation, riskFactors } = data;
 
  // Determine styles based on riskLevel
  const getRiskStyles = () => {
    switch (riskLevel) {
      case "Critical Rescue Needed":
        return {
          bg: "bg-rose-50 border-rose-100 text-rose-700",
          ring: "ring-rose-500/10",
          icon: <Flame className="w-5 h-5 text-rose-500 animate-pulse" />,
          barColor: "bg-gradient-to-r from-orange-400 to-rose-500",
          badge: "bg-rose-50 border-rose-200 text-rose-600 shadow-3xs"
        };
      case "Danger":
        return {
          bg: "bg-orange-50 border-orange-100 text-orange-700",
          ring: "ring-orange-500/10",
          icon: <ShieldAlert className="w-5 h-5 text-orange-500 animate-bounce" />,
          barColor: "bg-gradient-to-r from-amber-400 to-orange-500",
          badge: "bg-orange-50 border-orange-200 text-orange-600 shadow-3xs"
        };
      case "At Risk":
        return {
          bg: "bg-amber-50 border-amber-100 text-amber-700",
          ring: "ring-amber-500/10",
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          barColor: "bg-gradient-to-r from-amber-300 to-amber-500",
          badge: "bg-amber-50 border-amber-200 text-amber-600 shadow-3xs"
        };
      case "Safe":
      default:
        return {
          bg: "bg-emerald-50 border-emerald-100 text-emerald-700",
          ring: "ring-emerald-500/10",
          icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
          barColor: "bg-gradient-to-r from-teal-400 to-emerald-500",
          badge: "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-3xs"
        };
    }
  };
 
  const styles = getRiskStyles();
 
  return (
    <div 
      className={`relative overflow-hidden bg-white/70 border border-white/50 rounded-3xl p-6 backdrop-blur-md transition-all shadow-xs hover:border-rose-100`}
      id="rescue-score-card-root"
    >
      {/* Glow Backing effect */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.04] bg-rose-500 pointer-events-none`} />
 
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            PRODUCTIVITY ENGINE
          </span>
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-rose-50 border border-rose-100 text-rose-500 uppercase tracking-wider">
            FOCUS METER
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-bold tracking-wider ${styles.badge}`}>
            {styles.icon}
            {riskLevel}
          </span>
        </div>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-6">
        
        {/* BIG RADIAL OR NUMERIC REPRESENTATION */}
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center py-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
            FOCUS INDEX
          </span>
          
          <div className="relative flex items-center justify-center my-3">
            <svg className="w-24 h-24 transform -rotate-95">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="#f1f5f9"
                strokeWidth="6"
                fill="transparent"
              />
              <motion.circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={251.2}
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * score) / 100 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={score > 80 ? "text-rose-500" : score > 60 ? "text-orange-500" : score > 30 ? "text-amber-500" : "text-emerald-500"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tracking-tighter text-slate-800">
                {score}
              </span>
              <span className="text-[9px] font-bold text-slate-400">
                / 100
              </span>
            </div>
          </div>
 
          <div className="text-[10px] font-bold text-slate-500">
            {score <= 30 ? "SAFE ZONE" : score <= 60 ? "AT RISK MODE" : score <= 80 ? "FOCUS CAP" : "CRITICAL ALERT"}
          </div>
        </div>
 
        {/* DETAILS COLUMN */}
        <div className="md:col-span-8 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest pb-1">
              Active Assessment Briefing
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {explanation}
            </p>
          </div>
 
          {/* PROGRESS METRIC BAR */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span>PRIORITY LEVEL</span>
              <span className="text-slate-600 font-bold">{score}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <motion.div 
                className={`h-full rounded-full ${styles.barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
 
          {/* RISK FACTORS BULLETS */}
          {riskFactors && riskFactors.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                Target Action Items:
              </h5>
              <ul className="space-y-1.5">
                {riskFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="text-rose-500 font-bold shrink-0">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
 
      </div>
    </div>
  );
}

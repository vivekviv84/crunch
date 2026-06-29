import React from "react";
import { Clock, Play, AlertCircle, ShieldCheck, Flame, ChevronRight } from "lucide-react";
import { RescueTimelineData } from "../types/intelligence";
import { motion } from "motion/react";

interface RescueTimelineProps {
  data: RescueTimelineData;
}

export default function RescueTimeline({ data }: RescueTimelineProps) {
  const { currentTime, recommendedStart, latestSafeStart, pointOfNoReturn, deadline } = data;

  const steps = [
    {
      id: "now",
      label: "Current Time ⏰",
      time: currentTime,
      icon: <Clock className="w-3.5 h-3.5 text-blue-500" />,
      color: "border-blue-200 text-blue-600 bg-blue-50 shadow-3xs",
      lineColor: "bg-blue-300",
      description: "Active session focus"
    },
    {
      id: "recommended",
      label: "Best Start Time ✨",
      time: recommendedStart,
      icon: <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" />,
      color: "border-emerald-200 text-emerald-600 bg-emerald-50 shadow-3xs",
      lineColor: "bg-emerald-300",
      description: "Maximum grade potential"
    },
    {
      id: "latest",
      label: "Latest Safe Start",
      time: latestSafeStart,
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />,
      color: "border-amber-200 text-amber-600 bg-amber-50 shadow-3xs",
      lineColor: "bg-amber-300",
      description: "Baseline grading cap"
    },
    {
      id: "no-return",
      label: "Point of No Return ⚠️",
      time: pointOfNoReturn,
      icon: <AlertCircle className="w-3.5 h-3.5 text-orange-500 animate-pulse" />,
      color: "border-orange-200 text-orange-600 bg-orange-50 shadow-3xs",
      lineColor: "bg-orange-300",
      description: "Submission collapse risk"
    },
    {
      id: "deadline",
      label: "Final Deadline",
      time: deadline,
      icon: <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />,
      color: "border-rose-200 text-rose-600 bg-rose-50 shadow-3xs",
      lineColor: "bg-rose-300",
      description: "Locked Portal closes"
    }
  ];

  return (
    <div 
      className="bg-white/70 border border-white/50 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden transition-all shadow-xs hover:border-rose-100"
      id="rescue-timeline-root"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.04] bg-rose-500 pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            TIMELINE SPRINTS 🕒
          </span>
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-rose-50 border border-rose-100 text-rose-500 uppercase tracking-wider">
            TIMELINE TRACKER
          </span>
        </div>
        <div className="text-[10px] font-semibold text-slate-400">
          Pace Estimator
        </div>
      </div>

      {/* HORIZONTAL TRACK - DESKTOP VIEW */}
      <div className="hidden lg:block pt-12 pb-6 px-4 relative">
        {/* Dynamic connection background track */}
        <div className="absolute top-[72px] left-8 right-8 h-1 bg-slate-100 rounded-full" />
        
        {/* Fill animation from left to right */}
        <div className="absolute top-[72px] left-8 w-[72%] h-1 bg-gradient-to-r from-blue-300 via-emerald-300 to-amber-300 rounded-full" />

        <div className="grid grid-cols-5 gap-4 relative">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col items-center text-center group">
              
              {/* Floating time text above */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
                  {step.time}
                </span>
              </div>

              {/* Central node bullet */}
              <div 
                className={`w-10 h-10 rounded-full border flex items-center justify-center bg-white z-10 transition-all duration-300 group-hover:scale-110 shadow-xs ${step.color}`}
              >
                {step.icon}
              </div>

              {/* Meta details below */}
              <div className="mt-4 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {step.label}
                </div>
                <div className="text-[10px] text-slate-400 max-w-[130px] leading-normal font-semibold mx-auto">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VERTICAL TRACK - MOBILE VIEW */}
      <div className="block lg:hidden pt-6 space-y-4">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4 items-start bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${step.color}`}>
              {step.icon}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {step.label}
                </span>
                <span className="text-xs font-semibold text-rose-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                  {step.time}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

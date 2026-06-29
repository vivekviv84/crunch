import React from "react";
import { Award, Zap, Shield, Sparkles, AlertTriangle, CheckCircle, ArrowRight, Star, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WhyCrunchPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" id="why-crunch-page">
      {/* Hero Header */}
      <div className="bg-linear-to-r from-pink-500 via-rose-500 to-orange-400 text-white rounded-3xl p-6.5 relative overflow-hidden shadow-lg">
        <div className="max-w-2xl space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-350 fill-yellow-350 animate-pulse" />
            <h1 className="text-xs font-bold uppercase tracking-widest text-yellow-200">
              Why CRUNCH Beats Every Traditional Productivity App
            </h1>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
            An Intelligent AI Decision Engine for Academic Success
          </h2>
          <p className="text-xs text-rose-50 font-medium leading-relaxed">
            CRUNCH is not another standard checklist planner. It is an **AI Decision Engine** built specifically for high-stress semesters, academic deadlines, and timeline optimization.
          </p>
        </div>
      </div>

      {/* Feature Battles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Proactive vs Reactive */}
        <div className="bg-white/70 border border-white/50 rounded-2xl p-5 space-y-3.5 shadow-xs hover:shadow-md transition-all backdrop-blur-md">
          <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
            <Zap className="w-5 h-5 fill-rose-100" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              Proactive Scheduling
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Traditional apps wait for you to type out tasks. **CRUNCH** reads syllabus files, extracts grading parameters, and schedules tactical task checkpoints with exact timers.
            </p>
          </div>
          <ul className="space-y-2 text-[11px] font-semibold border-t border-slate-100 pt-3">
            <li className="flex gap-2 items-center text-slate-400">
              <span className="text-rose-500 font-bold">[!]</span> Todoist: Standard static list
            </li>
            <li className="flex gap-2 items-center text-emerald-600">
              <span className="text-emerald-500 font-bold">[✓]</span> CRUNCH: Autonmous urgency sorting
            </li>
          </ul>
        </div>

        {/* 2. Intelligent Pacing and rescue score */}
        <div className="bg-white/70 border border-white/50 rounded-2xl p-5 space-y-3.5 shadow-xs hover:shadow-md transition-all backdrop-blur-md">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
            <Star className="w-5 h-5 fill-emerald-100" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              Rescue Score™ & Failure Risk
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Standard tools don't map deadline danger. **CRUNCH** calculates a live Failure Risk indicator based on available hours, writing speed, and assignment weight.
            </p>
          </div>
          <ul className="space-y-2 text-[11px] font-semibold border-t border-slate-100 pt-3">
            <li className="flex gap-2 items-center text-slate-400">
              <span className="text-rose-500 font-bold">[!]</span> Notion: Custom databases but no risk math
            </li>
            <li className="flex gap-2 items-center text-emerald-600">
              <span className="text-emerald-500 font-bold">[✓]</span> CRUNCH: Dynamic procrastination alerts
            </li>
          </ul>
        </div>

        {/* 3. True Agentic Autonomy */}
        <div className="bg-white/70 border border-white/50 rounded-2xl p-5 space-y-3.5 shadow-xs hover:shadow-md transition-all backdrop-blur-md">
          <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Brain className="w-5 h-5 fill-amber-100" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              Cooperative Memory
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              CRUNCH features local memory profile, automatic reflections logging, and cooperative co-working across specialized agents (Risk, Planning, Rescue, Reflections).
            </p>
          </div>
          <ul className="space-y-2 text-[11px] font-semibold border-t border-slate-100 pt-3">
            <li className="flex gap-2 items-center text-slate-400">
              <span className="text-rose-500 font-bold">[!]</span> Others: Basic static chat interfaces
            </li>
            <li className="flex gap-2 items-center text-emerald-600">
              <span className="text-emerald-500 font-bold">[✓]</span> CRUNCH: Coordinated multi-agent teamwork
            </li>
          </ul>
        </div>

      </div>

      {/* Feature Table Comparison */}
      <div className="bg-white/70 border border-white/50 backdrop-blur-md rounded-2xl p-5 overflow-hidden shadow-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3.5">
          Feature-By-Feature Breakdown vs. Competitors
        </span>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 pb-2">
                <th className="py-2.5 text-slate-500 font-bold">CRITICAL FEATURE</th>
                <th className="py-2.5 text-slate-400 font-medium">TODOIST / ASANA</th>
                <th className="py-2.5 text-slate-400 font-medium">NOTION AI</th>
                <th className="py-2.5 text-rose-600 font-bold">CRUNCH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-600">
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 text-slate-800 font-bold">Syllabus PDF & Rubric Extraction</td>
                <td className="py-3 text-slate-400">Manual input only</td>
                <td className="py-3 text-slate-400">Simple doc summarization</td>
                <td className="py-3 text-rose-600 font-bold">Autonomous plan builder</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 text-slate-800 font-bold">Rescue Score™ Calculations</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-rose-600 font-bold">Real-time (0-100) indicator</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 text-slate-800 font-bold">Autonomous Stress Triage</td>
                <td className="py-3 text-slate-400">Manual categorizing</td>
                <td className="py-3 text-slate-400">Simple rephrasing</td>
                <td className="py-3 text-rose-600 font-bold">Schedules work blocks instantly</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 text-slate-800 font-bold">What-If Timeline Simulation</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-rose-600 font-bold">Simulates procrastination impact</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 text-slate-800 font-bold">Multi-Agent Cooperation</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-slate-400">None</td>
                <td className="py-3 text-rose-600 font-bold">7 orchestrated agents co-working</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

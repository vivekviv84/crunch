import React, { useState } from "react";
import { HelpCircle, RefreshCw, BarChart2, Shield, Calendar, Sparkles, AlertCircle } from "lucide-react";
import { WhatIfScenario } from "../types/intelligence";
import { motion, AnimatePresence } from "motion/react";

interface WhatIfSimulatorProps {
  scenarios: WhatIfScenario[];
}

export default function WhatIfSimulator({ scenarios }: WhatIfSimulatorProps) {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number | null>(null);

  return (
    <div 
      className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden transition-all shadow-xl hover:border-slate-700/80"
      id="what-if-simulator-root"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.05] bg-teal-500 pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            SIMULATION LAB
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-teal-950/60 border border-teal-900/40 text-teal-400 uppercase font-black tracking-wider">
            WHAT IF SIMULATOR
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
          Predictive Forecasts
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <p className="text-xs text-slate-400 leading-normal">
          Toggle different starting schedules to see how delay directly collapses deliverable success probabilities and elevates overall stress risks.
        </p>

        {/* COMPARISON TABLE */}
        <div className="overflow-x-auto border border-slate-900 rounded-xl bg-slate-950/40">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/80 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <th className="p-4">Action Vector</th>
                <th className="p-4 text-center">Success Probability</th>
                <th className="p-4 text-center">Threat Risk</th>
                <th className="p-4">Expected End</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario, idx) => {
                const isSelected = selectedScenarioIndex === idx;
                const isCrunchPlan = scenario.scenarioName.includes("CRUNCH");
                const isLateStart = scenario.scenarioName.includes("Tomorrow");

                return (
                  <React.Fragment key={scenario.scenarioName}>
                    <tr 
                      onClick={() => setSelectedScenarioIndex(isSelected ? null : idx)}
                      className={`border-b border-slate-900/60 hover:bg-slate-900/40 cursor-pointer transition-all ${
                        isCrunchPlan ? "bg-teal-950/10 hover:bg-teal-950/20" : ""
                      } ${isSelected ? "bg-slate-900/60" : ""}`}
                    >
                      <td className="p-4 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          isCrunchPlan ? "bg-teal-400 animate-pulse" : isLateStart ? "bg-red-500" : "bg-amber-500"
                        }`} />
                        <span className={`text-xs font-semibold ${isCrunchPlan ? "text-teal-400" : "text-slate-200"}`}>
                          {scenario.scenarioName}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-mono font-black ${
                          scenario.successProbability > 75 ? "text-emerald-400" :
                          scenario.successProbability > 40 ? "text-amber-400" : "text-red-500"
                        }`}>
                          {scenario.successProbability}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-mono ${
                          scenario.riskScore > 80 ? "text-red-500 font-bold" :
                          scenario.riskScore > 40 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {scenario.riskScore}/100
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-mono font-medium text-slate-300">
                          {scenario.expectedFinishTime}
                        </span>
                      </td>
                    </tr>

                    {/* EXPANDED DESCRIPTION */}
                    <AnimatePresence>
                      {isSelected && (
                        <tr>
                          <td colSpan={4} className="bg-slate-950/70 p-4 border-b border-slate-900">
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-xs text-slate-400 space-y-2"
                            >
                              <div className="flex gap-2 items-start text-slate-300">
                                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isCrunchPlan ? "text-teal-400" : "text-rose-400"}`} />
                                <span>{scenario.description}</span>
                              </div>
                              <div className="flex items-center gap-3 pt-2 font-mono text-[9px] text-slate-500">
                                <span>COMPILATION PRESSURE: {scenario.riskScore > 80 ? "EXTREME" : "MANAGEABLE"}</span>
                                <span>•</span>
                                <span>DECISION INDEX: {isCrunchPlan ? "HIGHLY STRATEGIC" : "SUB-OPTIMAL"}</span>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

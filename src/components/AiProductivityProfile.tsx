import React, { useState, useEffect } from "react";
import { Shield, Sparkles, AlertTriangle, Clock, Zap, BookOpen, Brain, Save } from "lucide-react";
import { api } from "../services/api";
import { UserMemoryProfile } from "../types/agents";

export default function AiProductivityProfile() {
  const [profile, setProfile] = useState<UserMemoryProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [workHours, setWorkHours] = useState("");
  const [rescueStyle, setRescueStyle] = useState("");

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get<UserMemoryProfile>("/api/agent/user-memory");
      setProfile(response.data);
      setWorkHours(response.data.preferredWorkHours || "");
      setRescueStyle(response.data.preferredRescueStyle || "");
    } catch (err) {
      console.error("Failed to load user productivity profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/api/agent/user-memory", {
        preferredWorkHours: workHours,
        preferredRescueStyle: rescueStyle,
      });
      setEditing(false);
      fetchProfile();
    } catch (err) {
      console.error("Failed to save profile changes:", err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-6 text-center animate-pulse">
        <span className="text-xs font-mono text-slate-500 uppercase">Analyzing cognitive memory profile...</span>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 relative overflow-hidden" id="productivity-profile-card">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
            Cognitive Productivity Profile
          </h3>
        </div>
        <button
          onClick={() => (editing ? handleSave() : setEditing(true))}
          disabled={saving}
          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors uppercase flex items-center gap-1"
        >
          {saving ? (
            "[ SAVING... ]"
          ) : editing ? (
            <>
              <Save className="w-3 h-3" /> [ SAVE PROFILE ]
            </>
          ) : (
            "[ CUSTOMIZE ]"
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Core Settings / Preferences */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Preferred Focus Working Hours
            </span>
            {editing ? (
              <input
                type="text"
                value={workHours}
                onChange={(e) => setWorkHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            ) : (
              <p className="text-xs font-mono text-slate-300">{profile.preferredWorkHours}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Average Completion Velocity
            </span>
            <p className="text-xs font-mono text-slate-300">{profile.averageCompletionSpeed}</p>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Preferred Rescue Accountability Style
            </span>
            {editing ? (
              <select
                value={rescueStyle}
                onChange={(e) => setRescueStyle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Tactical, maximum grade safety first">Tactical, grade safety first</option>
                <option value="Brutalist, high cognitive pressure enforcement">Brutalist, high pressure</option>
                <option value="Encouraging, gamified task completion">Encouraging, gamified</option>
              </select>
            ) : (
              <p className="text-xs font-mono text-slate-300">{profile.preferredRescueStyle}</p>
            )}
          </div>

          <div className="bg-rose-950/20 border border-rose-900/30 rounded p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">
                Primary Failure Vector Detected
              </span>
              <p className="text-xs font-mono text-rose-300 leading-normal">
                {profile.mostCommonFailurePoint}
              </p>
            </div>
          </div>
        </div>

        {/* Cognitive Audit: Strengths & Weaknesses */}
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Observed Cognitive Strengths
            </span>
            <div className="space-y-1.5">
              {profile.strengths?.map((str, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{str}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
              Procrastination Tendency Warnings
            </span>
            <div className="space-y-1.5">
              {profile.commonProcrastinationPatterns?.map((warn, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs font-mono text-slate-400">
                  <span className="text-rose-500 shrink-0 mt-0.5">•</span>
                  <span className="leading-snug">{warn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

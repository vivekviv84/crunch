import React, { useState, useEffect } from "react";
import { AlertCircle, Flame, ArrowLeft, RefreshCw, Send, CheckCircle, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";

interface RescueModeCockpitProps {
  task: Task;
  onExit: () => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSimplifyScope: (taskId: string, simplifiedData: any) => void;
  onAddLog: (log: any) => void;
}

export default function RescueModeCockpit({
  task,
  onExit,
  onToggleSubtask,
  onSimplifyScope,
  onAddLog
}: RescueModeCockpitProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: "00", minutes: "00", seconds: "00" });
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [isEmailGenerating, setIsEmailGenerating] = useState(false);
  const [emailReason, setEmailReason] = useState("Facing critical integration hurdles in the core milestones");
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [copilotInput, setCopilotInput] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([
    { sender: "copilot", text: "RESCUE ADVISOR ONLINE. I've analyzed your project parameters. Let's work together to complete the primary milestones. What blockade is stopping you right now?" }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const activeFocusSubtask = task.subtasks?.find((s) => !s.completed) || task.subtasks?.[task.subtasks.length - 1];

  useEffect(() => {
    const interval = setInterval(() => {
      const msLeft = new Date(task.deadline).getTime() - Date.now();
      if (msLeft <= 0) {
        setTimeLeft({ hours: "00", minutes: "00", seconds: "00" });
        clearInterval(interval);
        return;
      }

      const totalSecs = Math.floor(msLeft / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      setTimeLeft({
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0")
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [task.deadline]);

  const handleSimplify = async () => {
    setIsSimplifying(true);
    try {
      const res = await fetch("/api/agent/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          subtasks: task.subtasks
        })
      });
      const data = await res.json();
      
      onSimplifyScope(task.id, {
        description: data.simplifiedDescription,
        starterTask: data.starterTask,
        subtasks: data.subtasks.map((st: any, i: number) => ({
          id: `simplified-${i}`,
          title: st.title,
          durationMin: st.durationMin,
          completed: false,
          implementationIntention: st.implementationIntention
        }))
      });
      
      setChatMessages((prev) => [
        ...prev,
        { sender: "copilot", text: "🚨 SCOPE OPTIMIZED. Secondary requirements cleared. Your task list has been refined to direct minimal milestones to secure key credits." }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleComposeEmail = async () => {
    setIsEmailGenerating(true);
    setGeneratedEmail(null);
    try {
      const res = await fetch("/api/agent/extension-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          deadline: task.deadline,
          reason: emailReason
        })
      });
      const data = await res.json();
      setGeneratedEmail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEmailGenerating(false);
    }
  };

  const handleSendToCopilot = async () => {
    if (!copilotInput.trim()) return;
    const userMsg = copilotInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setCopilotInput("");
    setIsThinking(true);

    try {
      const res = await fetch("/api/agent/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Provide quick emergency tips for a user stuck during a tight deadline. They are working on "${task.title}" and say: "${userMsg}"`
        })
      });
      const data = await res.json();
      
      const responseTip = data.description || "Take a deep breath. Focus purely on writing mock outputs for this segment. Verify that the previous checks pass.";
      
      setChatMessages((prev) => [
        ...prev,
        { sender: "copilot", text: `💡 ADVISOR TIP:\n${responseTip}\n\nRecommended micro-action: ${data.starterTask || "Compile and check syntax errors."}` }
      ]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        { sender: "copilot", text: "Break this hurdle down. Focus exclusively on coding the direct outputs. Can we mock or simulate the stuck component?" }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopyEmail = () => {
    if (!generatedEmail) return;
    navigator.clipboard.writeText(`${generatedEmail.emailSubject}\n\n${generatedEmail.emailBody}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="min-h-screen bg-red-50/40 text-gray-900 p-6 flex flex-col justify-between relative overflow-hidden" id="crisis-cockpit">
      {/* Subtle Urgent Banner */}
      <div className="bg-red-600 text-white rounded-xl p-4.5 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3.5">
          <div className="bg-white/10 p-2 rounded-lg shrink-0">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide uppercase flex items-center gap-2">
              Rescue Mode Active
              <span className="w-2 h-2 bg-white rounded-full animate-ping" />
            </h1>
            <p className="text-xs text-red-100 font-medium mt-0.5">
              Locking down interface focus. Tap down hurdles, streamline scope, or draft an extension request.
            </p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/10 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          id="exit-crisis-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit Rescue Workspace
        </button>
      </div>

      {/* Main Single Column/Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 z-10">
        {/* Left Focus Column */}
        <div className="lg:col-span-8 space-y-6 flex flex-col">
          
          {/* Giant Countdown Banner Card */}
          <div className="bg-white border border-red-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-xs relative overflow-hidden">
            <span className="text-[10px] font-semibold tracking-wider text-red-600 uppercase mb-2 flex items-center gap-1">
              Time remaining to deadline
            </span>
            
            <div className="flex items-center gap-3 text-5xl sm:text-6xl font-semibold font-mono text-gray-950 tracking-tight">
              <div className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-xl">{timeLeft.hours}</div>
              <span className="text-gray-300">:</span>
              <div className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-xl">{timeLeft.minutes}</div>
              <span className="text-gray-300">:</span>
              <div className="px-3 py-1 bg-red-100 border border-red-200 text-red-600 rounded-xl">{timeLeft.seconds}</div>
            </div>

            <p className="text-xs text-gray-500 mt-3 font-medium">
              Task Focus: <span className="text-gray-900 font-semibold">{task.title}</span>
            </p>
          </div>

          {/* Large Single Focused Task Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex-1 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-4 uppercase tracking-wider">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0" />
                Current Priority Milestone
              </div>

              {activeFocusSubtask ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 tracking-tight">
                    {activeFocusSubtask.title}
                  </h3>
                  <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl text-xs leading-relaxed text-red-950">
                    <strong className="text-red-700 font-semibold block mb-1">If-Then Implementation Intention:</strong>
                    {activeFocusSubtask.implementationIntention || `If you begin to procrastinate on this step, instantly write down the skeleton output structure.`}
                  </div>
                </div>
              ) : (
                <div className="text-emerald-600 text-sm py-12 flex flex-col items-center gap-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-full">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <span className="font-semibold uppercase tracking-wider text-xs">All Milestones Successfully Secured!</span>
                </div>
              )}
            </div>

            {activeFocusSubtask && (
              <div className="pt-5 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={() => onToggleSubtask(task.id, activeFocusSubtask.id)}
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  id="complete-milestone-btn"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete milestone ({activeFocusSubtask.durationMin}m)
                </button>
                <span className="text-[11px] text-gray-500">
                  Mark complete to log progress and compute next focus milestone.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Copilot Advice & Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Rescue Advisor Chat */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 h-[320px] flex flex-col justify-between shadow-xs">
            <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-100 pb-2.5 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-semibold tracking-wider uppercase">Rescue Copilot Advisor</span>
            </div>

            <div className="flex-1 overflow-y-auto text-xs space-y-3.5 pr-1 mb-3">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl leading-relaxed text-xs ${
                    msg.sender === "copilot"
                      ? "bg-indigo-50/70 border border-indigo-100/50 text-indigo-950"
                      : "bg-gray-100 text-gray-800 ml-6"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isThinking && (
                <div className="text-gray-400 text-[11px] italic animate-pulse flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                  Resolving blockades...
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendToCopilot(); }}
                placeholder="Declare bottleneck..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="copilot-input-field"
              />
              <button
                onClick={handleSendToCopilot}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                id="copilot-send-btn"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Panels */}
          <div className="space-y-4">
            
            {/* Trim Scope */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-900">Emergency Simplify</h4>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Imminent cutoff? Direct the AI to trim secondary requirements and focus on core components.
                </p>
              </div>
              <button
                onClick={handleSimplify}
                disabled={isSimplifying}
                className="w-full py-2 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="simplify-scope-btn"
              >
                {isSimplifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Trimming Scope...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Trim Scope Matrix
                  </>
                )}
              </button>
            </div>

            {/* Extension Pitch */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-900">Formal Extension Pitch</h4>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Draft an academic or client extension request outlining development blockades.
                </p>
              </div>

              {!generatedEmail ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={emailReason}
                    onChange={(e) => setEmailReason(e.target.value)}
                    placeholder="E.g. database migration blockades..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="email-reason-field"
                  />
                  <button
                    onClick={handleComposeEmail}
                    disabled={isEmailGenerating || !emailReason}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    id="compose-email-btn"
                  >
                    {isEmailGenerating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating pitch...
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        Compose extension draft
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg h-24 overflow-y-auto text-gray-600 leading-relaxed whitespace-pre-wrap">
                    <strong>Subject: {generatedEmail.emailSubject}</strong>{"\n\n"}{generatedEmail.emailBody}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setGeneratedEmail(null)}
                      className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors font-semibold cursor-pointer"
                      id="reset-email-btn"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleCopyEmail}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      id="copy-email-btn"
                    >
                      {copiedEmail ? "Copied!" : "Copy Pitch"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

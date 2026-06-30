import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTaskStore } from "../store/useTaskStore";
import { useUserStore } from "../store/useUserStore";
import { 
  FileEdit, 
  Sparkles, 
  Copy, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  Cpu,
  BookOpen
} from "lucide-react";

export default function DraftAssistantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, fetchTasks } = useTaskStore();
  const { isAuthenticated, authInitialized } = useUserStore();

  const task = tasks.find((t) => t.id === id);

  // States
  const [format, setFormat] = useState("Experiment Report");
  const [userNotes, setUserNotes] = useState("");
  const [draftText, setDraftText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [draftText]);

  useEffect(() => {
    if (!task && isAuthenticated && authInitialized) {
      fetchTasks();
    }
  }, [id, task, fetchTasks, isAuthenticated, authInitialized]);

  if (!task) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-600 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-rose-500 mb-4" />
        <p className="text-xs text-slate-400 font-bold">Retrieving Document Specs...</p>
      </div>
    );
  }

  // Handle stream generation
  const handleGenerateDraft = (actionType: "generate" | "expand" | "shorten" = "generate") => {
    setDraftText("");
    setIsStreaming(true);
    setCopied(false);

    const title = task.title;
    // Context is combination of extracted rubric document text and user extra notes
    const combinedContext = `Extracted requirements: ${task.documentExtractedText || ""}. User Custom Notes: ${userNotes}`;

    // Build URL query parameters
    let url = `/api/agent/draft?title=${encodeURIComponent(title)}&context=${encodeURIComponent(combinedContext)}&format=${encodeURIComponent(format)}&action=${actionType}`;
    
    if (actionType === "expand" || actionType === "shorten") {
      url += `&draftText=${encodeURIComponent(draftText)}`;
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsStreaming(false);
      } else {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.text) {
            setDraftText((prev) => prev + parsed.text);
          }
        } catch (e) {
          console.error("Error parsing stream chunk:", e);
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Draft Error:", err);
      eventSource.close();
      setIsStreaming(false);
      setDraftText((prev) => prev ? prev : "quota over gemini quota over");
    };
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 flex flex-col justify-between" id="draft-assistant-page">
      {/* Header breadcrumb */}
      <div className="bg-white/70 border border-white/50 backdrop-blur-md rounded-3xl p-5.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-3xs"
            id="back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Task Space</span>
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span className="text-rose-500">{task.title}</span>
            </div>
            <h1 className="text-sm font-bold text-slate-800">
              Draft Co-Pilot Workspace ✍️
            </h1>
          </div>
        </div>

        <button
          onClick={() => navigate(`/task/${task.id}/rescue`)}
          className="px-4 py-2 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          id="go-rescue-cockpit-btn"
        >
          I NEED RESCUE NOW
        </button>
      </div>

      {/* Main Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1 flex-grow items-stretch">
        
        {/* Left Control Panel (5 columns) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-5 bg-white/70 border border-white/50 rounded-3xl p-6 shadow-xs backdrop-blur-md">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileEdit className="w-5 h-5 text-rose-500" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Parameters & Context</h2>
                <p className="text-[10px] text-slate-500">Inject rubrics and specific constraints</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Draft Format */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-slate-450">Deliverable Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-450"
                  id="draft-format-select"
                >
                  <option value="Experiment Report">Experiment Report</option>
                  <option value="Executive Slide Outline">Executive Slide Outline</option>
                  <option value="Response Essay Draft">Response Essay Draft</option>
                  <option value="Respectful Email Request">Respectful Project Email</option>
                  <option value="Technical Documentation">Technical Documentation</option>
                </select>
              </div>

              {/* Automatic Rubric highlight info if loaded */}
              {task.documentExtractedText && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5" />
                    EXTRACTED CRITERIA ACTIVE
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                    {task.documentExtractedText}
                  </p>
                </div>
              )}

              {/* Custom User notes */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-slate-455">User Custom Focus Notes / Prompts</label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="e.g. Focus on vectorizing layers in NumPy. Add specific placeholders for CIFAR accuracy metrics."
                  className="w-full h-36 bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-450 placeholder-slate-400 leading-relaxed resize-none"
                  id="draft-notes-textarea"
                />
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleGenerateDraft("generate")}
              disabled={isStreaming}
              className="w-full py-3 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer uppercase tracking-wider"
              id="generate-draft-btn"
            >
              {isStreaming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Streaming draft specifications...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Structured Outline Draft
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Terminal Output (7 columns) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="bg-white/70 border border-white/50 rounded-3xl p-5 shadow-xs backdrop-blur-md flex flex-col justify-between h-full">
            {/* Toolbar header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-rose-500">
                  Gemini Draft Output Terminal
                </span>
              </div>

              <div className="flex items-center gap-2">
                {draftText && !isStreaming && (
                  <>
                    <button
                      onClick={() => handleGenerateDraft("expand")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                      id="expand-draft-btn"
                    >
                      <Maximize2 className="w-3 h-3 text-rose-500" />
                      Expand
                    </button>
                    <button
                      onClick={() => handleGenerateDraft("shorten")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                      id="shorten-draft-btn"
                    >
                      <Minimize2 className="w-3 h-3 text-rose-500" />
                      Shorten
                    </button>
                  </>
                )}

                {draftText && (
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-150 rounded-xl text-xs font-bold text-indigo-600 flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
                    id="copy-text-btn"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Draft
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Live Text Area */}
            <div className="flex-grow overflow-y-auto text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[460px] pr-2">
              {draftText ? (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl font-medium text-slate-700 leading-relaxed shadow-3xs">
                  {draftText}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic py-24 text-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-slate-350" />
                  <p className="text-[10px] font-semibold">Co-Pilot idle. Fill context parameters and trigger the drafting pipeline.</p>
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>

            {/* Bottom status */}
            <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[9px] text-slate-455 uppercase font-bold">
              <span>Secure workspace connection active</span>
              {isStreaming && <span className="animate-pulse text-rose-500 font-bold">STREAMING CHUNKS...</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

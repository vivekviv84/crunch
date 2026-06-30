import React, { useState, useEffect, useRef } from "react";
import { Copy, CheckCircle, RefreshCw, Sparkles, FileText, Download, Paperclip } from "lucide-react";
import { Task } from "../types";
import { api } from "../services/api";

interface DraftAssistantDeskProps {
  tasks: Task[];
}

export default function DraftAssistantDesk({ tasks }: DraftAssistantDeskProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [format, setFormat] = useState("Syllabus Plan");
  const [tone, setTone] = useState("Polished");
  const [length, setLength] = useState("Standard");
  const [customTitle, setCustomTitle] = useState("");
  const [context, setContext] = useState("");
  
  const [draftText, setDraftText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const outputEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post<any>("/api/v1/parse/document", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      
      const resData = response.data;
      const extracted = resData.success ? resData.data : resData;
      
      let fileContext = `\n\n=== Context from uploaded file: ${file.name} ===\n`;
      if (extracted.title) fileContext += `Document Title: ${extracted.title}\n`;
      if (extracted.deliverables && extracted.deliverables.length > 0) {
        fileContext += `Deliverables:\n${extracted.deliverables.map((d: string) => `- ${d}`).join("\n")}\n`;
      }
      if (extracted.rubric && extracted.rubric.length > 0) {
        fileContext += `Grading Rubric / Criteria:\n${extracted.rubric.map((r: string) => `- ${r}`).join("\n")}\n`;
      }
      if (extracted.submissionRequirements) {
        fileContext += `Submission Requirements:\n${extracted.submissionRequirements}\n`;
      }
      if (extracted.documentExtractedText) {
        fileContext += `Details:\n${extracted.documentExtractedText}\n`;
      }
      fileContext += `=====================================\n`;

      setContext((prev) => prev + fileContext);
    } catch (err: any) {
      console.error("Failed to parse file for context:", err);
      alert(`Error extracting document content: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [draftText]);

  // Set default selection if tasks exist
  useEffect(() => {
    if (tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const handleStartDrafting = () => {
    let title = customTitle;
    if (selectedTaskId && selectedTaskId !== "custom") {
      const taskObj = tasks.find((t) => t.id === selectedTaskId);
      title = taskObj ? taskObj.title : "";
    }

    if (!title && selectedTaskId === "custom") {
      title = "Untitled Document";
    }

    setDraftText("");
    setIsStreaming(true);
    setCopied(false);
    setExported(false);

    // Build query URL with all options (including tone, length)
    const url = `/api/agent/draft?title=${encodeURIComponent(title || "Draft Document")}&context=${encodeURIComponent(context + ` [Tone: ${tone}, Length: ${length}]`)}&format=${encodeURIComponent(format)}`;
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
          console.error("Error parsing streaming chunk:", e);
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
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

  const handleExportToDrafts = () => {
    // Simulate exporting the generated draft to drafts
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  // Simple custom formatter to render basic markdown elements cleanly
  const renderMarkdownText = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h5 key={idx} className="text-sm font-semibold text-gray-900 mt-4 mb-2">{line.replace("### ", "")}</h5>;
      }
      if (line.startsWith("## ")) {
        return <h4 key={idx} className="text-base font-semibold text-gray-900 mt-5 mb-2">{line.replace("## ", "")}</h4>;
      }
      if (line.startsWith("# ")) {
        return <h3 key={idx} className="text-lg font-bold text-gray-900 mt-6 mb-3">{line.replace("# ", "")}</h3>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={idx} className="ml-4 list-disc text-xs text-gray-700 leading-relaxed my-1">{line.substring(2)}</li>;
      }
      if (line.startsWith("```")) {
        return null; // Skip code fence borders for clean document look
      }
      return <p key={idx} className="text-xs text-gray-700 leading-relaxed my-2">{line}</p>;
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="draft-assistant-desk">
      {/* LEFT COLUMN: Controls */}
      <div className="md:col-span-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-xs">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Draft Co-Pilot</h2>
              <p className="text-[11px] text-gray-500">Synthesize outlines, plans, and files with Gemini</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Title / Target selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Target project
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="draft-task-select"
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
                <option value="custom">[Create custom document]</option>
              </select>
            </div>

            {/* Custom title (if selected) */}
            {selectedTaskId === "custom" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Document Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="E.g. Neural Networks Report Outline"
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="draft-custom-title-input"
                />
              </div>
            )}

            {/* Artifact Format Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Artifact Type
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="draft-format-select"
              >
                <option value="Syllabus Plan">Syllabus Plan</option>
                <option value="Email Extension">Email Extension</option>
                <option value="Code Skeleton">Code Skeleton</option>
                <option value="Mindmap Outline">Mindmap Outline</option>
              </select>
            </div>

            {/* Tone Parameter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Tone
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {["Polished", "Urgent", "Minimal"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`py-1.5 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                      tone === t
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Length Parameter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Length
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {["Short", "Standard", "Comprehensive"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={`py-1.5 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                      length === l
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Context/Guidelines Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Context guidelines
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Paperclip className="w-3 h-3" />
                  {isUploading ? "Uploading..." : "Attach Reference File"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.html,.png,.jpeg,.webp"
                />
              </div>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="E.g. address to Prof. Miller, mention backward neural layer setbacks..."
                className="w-full h-24 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white leading-relaxed resize-none"
                id="draft-context-textarea"
              />
            </div>
          </div>

          <button
            onClick={handleStartDrafting}
            disabled={isStreaming || (!selectedTaskId && !customTitle)}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            id="draft-generate-btn"
          >
            {isStreaming ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Streaming Draft Lines...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Draft with Gemini
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Output Panel */}
      <div className="md:col-span-7">
        <div className="bg-white border border-gray-200 rounded-xl p-5 h-full min-h-[400px] flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-indigo-500 animate-pulse" : "bg-gray-300"}`} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Document Output</span>
              </div>

              {draftText && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportToDrafts}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                    id="draft-export-btn"
                  >
                    {exported ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        Exported!
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        Export to Drafts
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                    id="draft-copy-btn"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy markdown
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Document display area */}
            <div className="overflow-y-auto pr-1 max-h-[420px] pb-10">
              {draftText ? (
                <div className="space-y-1 animate-fade-in font-sans">
                  {renderMarkdownText(draftText)}
                </div>
              ) : (
                <div className="text-gray-400 italic h-full flex flex-col items-center justify-center py-20 text-center gap-2">
                  <FileText className="w-8 h-8 text-gray-200" />
                  <p className="text-xs font-medium max-w-xs leading-relaxed">
                    Set options on the left and trigger drafting to generate structured outlines.
                  </p>
                </div>
              )}
              <div ref={outputEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

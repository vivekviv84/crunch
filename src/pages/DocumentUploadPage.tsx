import React, { useState, useRef } from "react";
import { UploadCloud, File, AlertCircle, CheckCircle, Brain, Sparkles, Compass } from "lucide-react";
import { useTaskStore } from "../store/useTaskStore";
import { useNavigate } from "react-router-dom";

export default function DocumentUploadPage() {
  const { parseAndCreateTask, loading, error } = useTaskStore();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusStep, setStatusStep] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (selectedFile: File) => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith(".pdf")) {
      alert("Unsupported file format. Please upload PDF, PNG, JPG or JPEG.");
      return;
    }
    setFile(selectedFile);
    setUploadProgress(10);
    setStatusStep("Uploading document to secure CRUNCH server...");

    try {
      // Simulate nice progression steps to make the AI parsing feel incredibly robust and live
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          if (prev === 30) {
            setStatusStep("Gemini Vision Parser initializing on assignment...");
          } else if (prev === 60) {
            setStatusStep("Extracting rubric milestones, deliverables, and word counts...");
          } else if (prev === 80) {
            setStatusStep("Synthesizing micro-milestones & drafting battle plan...");
          }
          return prev + 10;
        });
      }, 800);

      const createdTask = await parseAndCreateTask(selectedFile, (progress) => {
        // Integrate real upload progression if fast
      });

      clearInterval(interval);
      setUploadProgress(100);
      setStatusStep("Rescue Plan Generated Successfully! Commencing system countdown...");

      setTimeout(() => {
        // Route straight to the newly created Task Detail page!
        navigate(`/task/${createdTask.id}`);
      }, 1500);

    } catch (err) {
      setFile(null);
      setUploadProgress(0);
      setStatusStep("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white/75 p-6 sm:p-8 rounded-3xl border border-white/50 backdrop-blur-xl shadow-[0_20px_50px_rgba(244,63,94,0.06)] flex flex-col justify-between h-full" id="document-upload-container">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl border border-rose-100">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">AI Document Parser 📖</h2>
              <p className="text-xs text-slate-500 font-medium">Upload syllabus, homework instructions, or notes.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-rose-100 rounded-full text-[10px] font-bold text-rose-600 shadow-xs">
            <Compass className="w-3.5 h-3.5 animate-spin text-rose-500" />
            GEMINI VISION ACTIVE
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
          <div className="md:col-span-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200/40 text-xs text-slate-650 flex flex-col justify-between shadow-inner">
            <div>
              <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-1.5 border-b border-slate-200/60 pb-2 text-xs uppercase tracking-wider">
                <Brain className="w-4 h-4 text-rose-500 fill-rose-50" />
                Intelligent Specs
              </h3>
              <p className="mb-3 leading-relaxed font-medium">
                By uploading assignment files directly, <span className="text-slate-800 font-bold">CRUNCH Document Agent</span> uses advanced vision capability to map out structural requirements.
              </p>
              <ul className="space-y-1.5 text-slate-500 font-medium list-disc list-inside">
                <li>Detect grading metrics</li>
                <li>Audit late penalty dates</li>
                <li>Calculate complexity score</li>
                <li>Sequence battle checkpoints</li>
              </ul>
            </div>
            <div className="mt-5 p-3 bg-white/70 rounded-xl border border-slate-100 text-[10px] text-slate-500 font-semibold">
              Supported file extensions:<br />
              <span className="text-rose-600">.pdf, .png, .jpeg, .jpg</span> (max 50MB)
            </div>
          </div>

          <div className="md:col-span-8">
            <form
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] ${
                dragActive 
                  ? "border-rose-450 bg-rose-50/50 text-rose-650 shadow-inner" 
                  : "border-slate-200 hover:border-slate-300 bg-white/80 text-slate-500 shadow-sm"
              } ${loading ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
              id="drag-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                disabled={loading}
              />

              {file ? (
                <div className="text-center">
                  <div className="p-4 bg-rose-50 text-rose-500 rounded-full inline-block mb-3 border border-rose-100">
                    <File className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">{file.name}</h4>
                  <p className="text-xs text-slate-400 font-semibold">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="p-3.5 bg-slate-50 text-slate-400 rounded-full inline-block mb-3 border border-slate-100">
                    <UploadCloud className="w-8 h-8 text-rose-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Drag and drop file here</h4>
                  <p className="text-xs text-slate-400 font-medium mb-4">or click to browse local storage</p>
                  <span className="text-[10px] px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full font-bold text-slate-500">
                    PDF / PNG / JPG / JPEG
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Upload and analysis progress block */}
        {(loading || file) && (
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/50 text-xs font-semibold">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-rose-500 animate-spin" />
                {statusStep || "Processing..."}
              </span>
              <span className="text-rose-600 font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-linear-to-r from-pink-500 to-rose-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2.5 mt-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Extraction Fault Detected</p>
              <p className="opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 text-xs font-bold rounded-xl transition-all shadow-xs"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4.5 py-2.5 bg-linear-to-r from-pink-500 to-rose-500 hover:from-pink-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-pink-500/20"
          disabled={loading}
        >
          Select File
        </button>
      </div>
    </div>
  );
}

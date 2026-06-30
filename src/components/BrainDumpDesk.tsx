import React, { useState } from "react";
import { Mic, RefreshCw, Sparkles, Check, Square, CheckSquare, BrainCircuit, AlertTriangle } from "lucide-react";
import { api } from "../services/api";

interface BrainDumpDeskProps {
  onTasksExtracted: (tasks: any[]) => void;
}

export default function BrainDumpDesk({ onTasksExtracted }: BrainDumpDeskProps) {
  const [dumpText, setDumpText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Decompressed results states
  const [prioritizedTasks, setPrioritizedTasks] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [battlePlanDescription, setBattlePlanDescription] = useState("");
  
  // Interactive checklist selection state
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const simulateVoiceInput = () => {
    setVoiceError(null);
    setIsListening(true);
    setTimeout(() => {
      const mockTranscripts = [
        "I have an ML assignment due tomorrow night at 11:59 PM. I need to write a CNN from scratch.",
        "I need to prepare slides for the presentation in 6 hours.",
        "Write the design draft for the client by tonight."
      ];
      const text = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
      setDumpText(prev => prev ? prev + " " + text : text);
      setIsListening(false);
    }, 1500);
  };

  const handleVoiceInput = () => {
    setVoiceError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event);
      setIsListening(false);
      
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "security") {
        setVoiceError("Microphone permission was denied or is blocked by sandbox permissions. You can simulate a mock voice intake to test the flow.");
      } else {
        setVoiceError(`Voice recognition error: ${event.error || "failed to start"}`);
      }
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDumpText(prev => prev ? prev + " " + transcript : transcript);
    };
    
    try {
      recognition.start();
    } catch (e: any) {
      console.error(e);
      setIsListening(false);
      setVoiceError("Failed to start voice recognition due to sandbox permissions. You can simulate a mock voice intake to test the flow.");
    }
  };

  const handleDecompress = async () => {
    if (!dumpText.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await api.post("/api/agent/brain-dump", { 
        dumpText, 
        currentLocalTime: new Date().toISOString() 
      });
      const data = res.data;
      
      if (data.prioritizedTasks) {
        setPrioritizedTasks(data.prioritizedTasks);
        // Default to selecting all extracted tasks
        setSelectedIndices(data.prioritizedTasks.map((_: any, i: number) => i));
      }
      if (data.conflicts) {
        setConflicts(data.conflicts);
      }
      if (data.battlePlanDescription) {
        setBattlePlanDescription(data.battlePlanDescription);
      }
    } catch (e) {
      console.error("Decompress failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectTask = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleSaveToStack = () => {
    // Only extract the tasks selected by the user
    const tasksToCommit = prioritizedTasks.filter((_, idx) => selectedIndices.includes(idx));
    if (tasksToCommit.length > 0) {
      onTasksExtracted(tasksToCommit);
    }
    setPrioritizedTasks([]);
    setConflicts([]);
    setBattlePlanDescription("");
    setDumpText("");
    setSelectedIndices([]);
  };

  const handleReset = () => {
    setPrioritizedTasks([]);
    setConflicts([]);
    setBattlePlanDescription("");
    setSelectedIndices([]);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs max-w-xl mx-auto w-full space-y-6" id="braindump-desk">
      <div className="text-center space-y-1">
        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
          <BrainCircuit className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Brain Dump</h2>
        <p className="text-xs text-gray-500">Unload raw chaotic thoughts and let AI extract actionable tasks</p>
      </div>

      {prioritizedTasks.length === 0 ? (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={dumpText}
              onChange={(e) => setDumpText(e.target.value)}
              placeholder="Dump your raw, messy thoughts about your task, project, or schedule here... Let Gemini organize it into a structured plan."
              className="w-full h-44 border border-gray-200 rounded-xl p-4 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white leading-relaxed resize-none font-sans"
              id="braindump-textarea"
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute right-3 bottom-3 p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isListening
                  ? "bg-indigo-50 border-indigo-500 text-indigo-600 animate-pulse"
                  : "bg-white border-gray-100 text-gray-400 hover:text-gray-700"
              }`}
              title={isListening ? "Listening... Speak now" : "Voice Input"}
              id="braindump-voice-btn"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
          {voiceError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 space-y-2 flex flex-col items-start">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Voice recognition issue</span>
              </div>
              <p className="text-red-700 leading-normal">{voiceError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={simulateVoiceInput}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Simulate Voice Input
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleDecompress}
            disabled={isProcessing || !dumpText.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            id="braindump-decompress-btn"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Organizing chaos...
              </>
            ) : (
              <>
                Organize chaos
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {/* Summary */}
          {battlePlanDescription && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900 block mb-1">Cerebral Summary</span>
              <p>{battlePlanDescription}</p>
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs leading-relaxed text-amber-900 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Scheduling conflicts detected</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {conflicts.map((conflict, i) => (
                    <li key={i}>{conflict}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Parsed Checklist Items */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Extracted workspace tasks
            </span>
            <div className="space-y-2">
              {prioritizedTasks.map((task, idx) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleSelectTask(idx)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected 
                        ? "bg-indigo-50/50 border-indigo-200 text-gray-900" 
                        : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                      ) : (
                        <Square className="w-4.5 h-4.5 text-gray-300 hover:text-indigo-500" />
                      )}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-semibold truncate leading-tight">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-normal line-clamp-2">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] font-medium text-gray-400">
                        <span>Pacing: {task.suggestedSchedule || "Today"}</span>
                        <span>•</span>
                        <span>Score: {task.urgencyScore || 60}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleReset}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              id="braindump-reset-btn"
            >
              Clear Space
            </button>
            <button
              onClick={handleSaveToStack}
              disabled={selectedIndices.length === 0}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              id="braindump-commit-btn"
            >
              Commit ({selectedIndices.length}) to stack
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

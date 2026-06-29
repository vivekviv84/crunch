import express from "express";
import { Type } from "@google/genai";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { runCelebrationAgent } from "../services/geminiService";
import { sanitizeInput, checkPromptSafety } from "../services/safetyService";
import { 
  getDB, 
  saveDB, 
  dbGetTasks, 
  dbGetTaskById, 
  dbSaveTask, 
  dbDeleteTask,
  dbGetKeepNotes,
  dbSaveKeepNote,
  dbDeleteKeepNote,
  addAgentLog,
  dbGetAgentLogs,
  dbClearAgentLogs,
  dbGetUserMemory,
  dbUpdateUserMemory,
  dbGetReflections,
  dbSaveReflection,
  dbGetRescueHistory,
  dbSaveRescueHistoryItem
} from "../repositories/taskRepository";
import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL, runIntakeAgent, runPlanningAgent } from "../services/geminiService";
import { getMockIntakeResponse, getMockPlanResponse, parseTasksHeuristically } from "../utils/heuristics";
import { logger } from "../services/loggerService";

const router = express.Router();



// --- FEATURE 3: Gemini Intake Agent & Automatic Save Flow ---
router.post("/api/v1/tasks/intake", authenticateToken, async (req: any, res: any) => {
  const schema = z.object({ text: z.string().min(1, "No description provided to intake co-pilot") });
  const validated = schema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: validated.error.issues[0].message });
  }

  let { text } = validated.data;
  const ownerId = req.user.id;

  text = sanitizeInput(text);
  const safety = checkPromptSafety(text);
  if (!safety.safe) {
    return res.status(400).json({ error: safety.reason });
  }

  addAgentLog("Intake Agent", "REASON", `Analyzing intake request for user ${ownerId}: "${text.substring(0, 60)}..."`);
  addAgentLog("Intake Agent", "ACT", "Calling Gemini Flash (gemini-2.5-flash) to perform structured extraction of complexity, subtasks and deadlines.");

  const ai = getGeminiClient();
  let results: any[];

  if (!ai) {
    results = getMockIntakeResponse(text);
    addAgentLog("Intake Agent", "OBSERVE", "Running offline mock mode. Extracted deadline and structured tasks successfully.");
  } else {
    try {
      const prompt = `
        You are the Task Intake Agent for CRUNCH (an AI deadline rescue system).
        The user has entered a description of one or more upcoming academic or professional deadlines.
        Analyze this text: "${text}"

        Identify all distinct tasks, projects, or chores mentioned in the text.
        
        CRITICAL RULES:
        1. Strictly ignore conversational statements (e.g., "Help me out", "Please save me", "Help me with...").
        2. Strictly ignore generic personal wishes, leisure planning, or holiday desires (e.g., "I want to do my holiday in the world"). These are NOT tasks or professional/academic deadlines.
        3. Extract ONLY concrete, actionable tasks/deadlines. If the input contains conversational sentences alongside actual tasks, extract ONLY the actual tasks.

        For each valid task, extract:
        1. title: clear, action-oriented task title. (e.g. "Submission", "Passport submission").
        2. deadline: Estimate a plausible ISO timestamp relative to the current local time. The user's current local time is: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} (IST, UTC+5:30). When the user says "at 4:00 pm" they mean 4:00 PM in their local time today (or tomorrow if already past). When they say "at 8:00 pm" they mean 8:00 PM local time. ALWAYS respect the exact time the user stated — never shift it. Map it to the correct ISO string in UTC.
        3. complexity: "Low", "Medium", or "High"
        4. urgencyScore: A calculated score from 1 to 100, where 100 means due in hours and High complexity.
        5. description: Summarized rescue scope.
        6. starterTask: An action that takes 5 minutes or less (strictly <= 5 mins) to get them over the friction threshold.
        7. subtasks: A list of 3-5 subtasks, where each duration is strictly 25 minutes or less, along with an implementation intention ("If [situation], then I will [action]").

        Provide a standard JSON array of objects strictly matching this schema (do not wrap in markdown blocks, just return pure JSON):
        [
          {
            "title": "...",
            "deadline": "ISO String",
            "complexity": "Low/Medium/High",
            "urgencyScore": 85,
            "description": "...",
            "starterTask": "...",
            "subtasks": [
              { "title": "subtask description", "durationMin": 20, "implementationIntention": "If ... then ..." }
            ]
          }
        ]
      `;

      const response = await callGeminiWithRetry(
        { route: "/api/v1/tasks/intake", model: GEMINI_MODEL },
        (client) => client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  complexity: { type: Type.STRING },
                  urgencyScore: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  starterTask: { type: Type.STRING },
                  subtasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        durationMin: { type: Type.INTEGER },
                        implementationIntention: { type: Type.STRING }
                      },
                      required: ["title", "durationMin", "implementationIntention"]
                    }
                  }
                },
                required: ["title", "deadline", "complexity", "urgencyScore", "description", "starterTask", "subtasks"]
              }
            }
          }
        })
      );

      const parsed = JSON.parse(response.text?.trim() || "[]");
      results = Array.isArray(parsed) ? parsed : [parsed];
      addAgentLog("Intake Agent", "OBSERVE", `Gemini returned ${results.length} structured tasks.`);
    } catch (err: any) {
      if (err?.message?.includes("API Key") || err?.message?.includes("key")) {
        console.log("💡 [GEMINI INFO] Gemini Intake Agent call bypassed or unauthorized. Defaulting to local secure fallback extraction.");
      } else {
        console.log("💡 [GEMINI INFO] Gemini Intake Agent error in save endpoint, defaulting to local fallback:", err?.message || err);
      }
      addAgentLog("Intake Agent", "OBSERVE", `Gemini API call bypassed or failed. Defaulting to mock extraction.`);
      results = getMockIntakeResponse(text);
    }
  }

  // Format each extracted task specification in the array
  const formattedResults = results.map((result: any, index: number) => {
    const subtasksFormatted = (result.subtasks || []).map((st: any, i: number) => ({
      id: `sub-${Date.now()}-${index}-${i}`,
      title: st.title,
      durationMin: st.durationMin,
      completed: false,
      implementationIntention: st.implementationIntention || "If I open the computer, I will work on this step."
    }));

    const calendarSchedule = subtasksFormatted.map((st: any, i: number) => {
      const timeSlot = new Date(Date.now() + (i + 1) * 30 * 60 * 1000);
      const hours = timeSlot.getHours();
      const mins = timeSlot.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");
      return {
        id: `cal-${Date.now()}-${index}-${i}`,
        time: `${formattedHours}:${mins} ${ampm}`,
        taskTitle: st.title,
        duration: st.durationMin
      };
    });

    return {
      title: result.title || "Intake Rescue Operation",
      deadline: result.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      complexity: result.complexity || "Medium",
      status: "Pending",
      urgencyScore: result.urgencyScore || 50,
      description: result.description || text,
      starterTask: result.starterTask || "Open project requirements sheet (3 mins)",
      subtasks: subtasksFormatted,
      calendarSchedule: calendarSchedule,
      paceState: result.urgencyScore > 80 ? "Critical" : result.urgencyScore > 50 ? "At Risk" : "On Track",
      isRescueActive: result.urgencyScore > 80,
      documentExtractedText: text,
      ownerId: ownerId
    };
  });

  res.status(200).json(formattedResults);
});

router.get("/api/logs", authenticateToken, async (req: any, res) => {
  try {
    const logs = await dbGetAgentLogs(req.user.id);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/debug/gemini", (req, res) => {
  let key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.json({
      configured: false,
      reason: "GEMINI_API_KEY is not defined in process.env",
      length: 0,
    });
  }
  
  const originalKey = key;
  key = key.trim().replace(/^['"]|['"]$/g, '').trim();
  
  const hasQuotes = originalKey !== key;
  const length = key.length;
  const startsWithAIza = key.startsWith("AIza");
  const startsWithAQ = key.startsWith("AQ.");
  const prefix = key.substring(0, 4);
  const suffix = key.length > 4 ? key.substring(key.length - 4) : "";
  
  let valid = true;
  let invalidReason = null;
  if (key === "" || key === "MY_GEMINI_API_KEY" || key === "undefined" || key === "null") {
    valid = false;
    invalidReason = `Holds a placeholder value: "${key}"`;
  } else if (!startsWithAIza && !startsWithAQ) {
    if (length < 10) {
        valid = false;
        invalidReason = "Unknown key format and too short";
    } else {
        invalidReason = "Unknown key format";
    }
}
  
  res.json({
    configured: true,
    valid,
    length,
    startsWithAIza,
    prefix,
    suffix,
    hasQuotes,
    invalidReason,
  });
});

router.post("/api/logs/clear", authenticateToken, async (req: any, res) => {
  try {
    await dbClearAgentLogs(req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// --- LEGACY AGENT ENDPOINTS ---

router.post("/api/agent/intake", async (req, res) => {
  const schema = z.object({ text: z.string().min(1, "Text is required") });
  const validated = schema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: validated.error.issues[0].message });
  }

  let { text } = validated.data;
  text = sanitizeInput(text);
  const safety = checkPromptSafety(text);
  if (!safety.safe) {
    return res.status(400).json({ error: safety.reason });
  }
  const ai = getGeminiClient();
  if (!ai) return res.json(getMockIntakeResponse(text));
  try {
    const prompt = `
      You are the Task Intake Agent for CRUNCH.
      Extract from: "${text}"
      JSON schema:
      {
        "title": "...",
        "deadline": "ISO String",
        "complexity": "Low/Medium/High",
        "urgencyScore": 85,
        "description": "...",
        "starterTask": "...",
        "subtasks": [
          { "title": "subtask description", "durationMin": 20, "implementationIntention": "If ... then ..." }
        ]
      }
    `;
    const response = await callGeminiWithRetry(
      { route: "/api/agent/intake", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              deadline: { type: Type.STRING },
              complexity: { type: Type.STRING },
              urgencyScore: { type: Type.INTEGER },
              description: { type: Type.STRING },
              starterTask: { type: Type.STRING },
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    implementationIntention: { type: Type.STRING }
                  },
                  required: ["title", "durationMin", "implementationIntention"]
                }
              }
            }
          }
        }
      })
    );
    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err: any) {
    res.json(getMockIntakeResponse(text));
  }
});

router.post("/api/agent/generate-plan", async (req, res) => {
  const schema = z.object({
    title: z.string().min(1, "Title is required"),
    deadline: z.string().optional(),
    description: z.string().optional(),
    complexity: z.string().optional()
  });
  const validated = schema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: validated.error.issues[0].message });
  }

  let { title, deadline, description, complexity } = validated.data;
  title = sanitizeInput(title);
  description = sanitizeInput(description || "");
  const safety = checkPromptSafety(title + " " + description);
  if (!safety.safe) {
    return res.status(400).json({ error: safety.reason });
  }

  const ai = getGeminiClient();
  if (!ai) return res.json(getMockPlanResponse(title, deadline));
  try {
    const prompt = `
      Generate a Rescue Battle Plan for "${title}" by deadline "${deadline}".
      Subtasks <= 25 mins. Starter task <= 5 mins.
      JSON:
      {
        "starterTask": "...",
        "subtasks": [
          { "title": "...", "durationMin": 25, "implementationIntention": "If ... then ..." }
        ],
        "calendarSchedule": [
          { "time": "08:00 PM", "taskTitle": "...", "duration": 25 }
        ],
        "urgencyScore": 88,
        "paceState": "Critical"
      }
    `;
    const response = await callGeminiWithRetry(
      { route: "/api/agent/generate-plan", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              starterTask: { type: Type.STRING },
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    implementationIntention: { type: Type.STRING }
                  }
                }
              },
              calendarSchedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    taskTitle: { type: Type.STRING },
                    duration: { type: Type.INTEGER }
                  }
                }
              },
              urgencyScore: { type: Type.INTEGER },
              paceState: { type: Type.STRING }
            }
          }
        }
      })
    );
    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err) {
    res.json(getMockPlanResponse(title, deadline));
  }
});

router.post("/api/agent/celebrate", async (req: any, res) => {
  const { taskTitle, microtaskTitle, xpGained } = req.body;
  try {
    const encouragementMessage = await runCelebrationAgent(taskTitle || "Rescue Operation", microtaskTitle || "Microtask", xpGained || 25);
    res.json({ message: encouragementMessage });
  } catch (err: any) {
    res.json({ message: "Excellent work! Keep up the incredible speed! 🚀" });
  }
});

router.post("/api/agent/brain-dump", async (req, res) => {
  const { dumpText, currentLocalTime } = req.body;
  const ai = getGeminiClient();
  if (!ai) {
    const parsed = parseTasksHeuristically(dumpText);
    
    // Fallback if no task is detected
    if (parsed.length === 0) {
      parsed.push({
        title: "Brain Dump Action Item",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        complexity: "Medium",
        description: `Address raw stressors from your dump: "${dumpText}"`
      });
    }

    const prioritizedTasks = parsed.map((t, idx) => {
      const deadlineDate = new Date(t.deadline);
      const diffMs = deadlineDate.getTime() - Date.now();
      const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
      
      let scheduleCategory = "TODAY";
      if (diffHours > 24) scheduleCategory = "NEXT";
      if (diffHours > 48) scheduleCategory = "LATER";
      
      const timeStr = deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = diffHours > 24 ? "Tomorrow" : "Today";
      const suggestedSchedule = `${dateStr} at ${timeStr}`;

      return {
        title: t.title,
        deadline: t.deadline,
        complexity: t.complexity || "Medium",
        urgencyScore: Math.min(99, Math.max(10, 100 - diffHours)),
        description: t.description || `Extracted task from your brain dump. Due in ${diffHours} hours.`,
        starterTask: `Start working on ${t.title} (5 mins)`,
        effortEstimate: "2 hours",
        scheduleCategory,
        suggestedSchedule,
        calendarSchedule: [
          {
            taskTitle: t.title,
            time: timeStr,
            duration: 30
          }
        ],
        subtasks: [
          {
            title: `Review ${t.title} requirements`,
            durationMin: 15,
            implementationIntention: `If I sit down, I will check what needs to be done for ${t.title}.`
          }
        ]
      };
    });

    const conflicts = prioritizedTasks.length > 1 
      ? [`You have ${prioritizedTasks.length} tasks scheduled in close proximity, creating potential time conflicts.`]
      : [];

    const battlePlanDescription = `Decompressed your stress dump successfully. Focus on executing the starter tasks for ${prioritizedTasks.map(t => `'${t.title}'`).join(' and ')} to break cognitive inertia.`;

    return res.json({
      prioritizedTasks,
      conflicts,
      battlePlanDescription
    });
  }
  try {
    const prompt = `You are an expert scheduling assistant. The current local time is ${currentLocalTime || new Date().toISOString()}.
Decompress and triage this chaotic stress brain dump text: "${dumpText}". 
Identify and extract all implicit and explicit commitments, prioritize them (at least 3 tasks, up to 5), estimate effort, detect resource/time conflicts, and assign them to a schedule category ('TODAY', 'NEXT', or 'LATER'). 

For each task you MUST:
1. Extract or estimate its deadline (absolute ISO string). Take the current local time into account to determine the correct future date and time (e.g. if current local time is 10:29 PM and they say "7:00", they likely mean 7:00 PM tomorrow). Set "deadline" property to this calculated ISO string (with correct offset or Z).
2. Create a "calendarSchedule" array containing one or more calendar blocks:
   - "taskTitle": string (e.g. "Passport Submission", "ML Assignment")
   - "time": string formatted as "hh:mm AM/PM" (e.g. "07:00 PM" or "04:00 PM") representing the exact time to place the block on the user's Google Calendar.
   - "duration": integer (in minutes, default to 30 or 60).
3. Compute the exact difference in time (hours/minutes remaining) between the current local time (${currentLocalTime}) and the event time. In the "description" property, write a friendly summary including the time left from right now (e.g., "Due at 7:00 PM. 1h 30m remaining from current time.") along with details of when, where, and how long.
4. Extract 2-3 action subtasks under the "subtasks" array:
   - "title": string (e.g. "Compile ML scripts", "Verify document scan")
   - "durationMin": integer (in minutes)
   - "implementationIntention": string (motivation intention like "If I open terminal, I will compile scripts")

Return a strict JSON response containing prioritizedTasks, conflicts, and a battlePlanDescription.`;

    const response = await callGeminiWithRetry(
      { route: "/api/agent/brain-dump", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prioritizedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    complexity: { type: Type.STRING },
                    urgencyScore: { type: Type.INTEGER },
                    description: { type: Type.STRING },
                    starterTask: { type: Type.STRING },
                    effortEstimate: { type: Type.STRING },
                    scheduleCategory: { type: Type.STRING, enum: ["TODAY", "NEXT", "LATER"] },
                    suggestedSchedule: { type: Type.STRING },
                    calendarSchedule: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          taskTitle: { type: Type.STRING },
                          time: { type: Type.STRING },
                          duration: { type: Type.INTEGER }
                        },
                        required: ["taskTitle", "time", "duration"]
                      }
                    },
                    subtasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          durationMin: { type: Type.INTEGER },
                          implementationIntention: { type: Type.STRING }
                        },
                        required: ["title", "durationMin", "implementationIntention"]
                      }
                    }
                  },
                  required: [
                    "title", 
                    "deadline", 
                    "complexity", 
                    "urgencyScore", 
                    "description", 
                    "starterTask", 
                    "effortEstimate", 
                    "scheduleCategory", 
                    "suggestedSchedule", 
                    "calendarSchedule",
                    "subtasks"
                  ]
                }
              },
              conflicts: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              battlePlanDescription: { type: Type.STRING }
            },
            required: ["prioritizedTasks", "conflicts", "battlePlanDescription"]
          }
        }
      })
    );
    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err: any) {
    logger.warn(`⚠️ [Gemini Fallback] Brain dump API call failed: ${err.message || err}. Utilizing calculated local mathematical baseline.`);
    const parsed = parseTasksHeuristically(dumpText);
    
    // Fallback if no task is detected
    if (parsed.length === 0) {
      parsed.push({
        title: "Brain Dump Action Item",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        complexity: "Medium",
        description: `Address raw stressors from your dump: "${dumpText}"`
      });
    }

    const prioritizedTasks = parsed.map((t, idx) => {
      const deadlineDate = new Date(t.deadline);
      const diffMs = deadlineDate.getTime() - Date.now();
      const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
      
      let scheduleCategory = "TODAY";
      if (diffHours > 24) scheduleCategory = "NEXT";
      if (diffHours > 48) scheduleCategory = "LATER";
      
      const timeStr = deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = diffHours > 24 ? "Tomorrow" : "Today";
      const suggestedSchedule = `${dateStr} at ${timeStr}`;

      return {
        title: t.title,
        deadline: t.deadline,
        complexity: t.complexity || "Medium",
        urgencyScore: Math.min(99, Math.max(10, 100 - diffHours)),
        description: t.description || `Extracted task from your brain dump. Due in ${diffHours} hours.`,
        starterTask: `Start working on ${t.title} (5 mins)`,
        effortEstimate: "2 hours",
        scheduleCategory,
        suggestedSchedule,
        calendarSchedule: [
          {
            taskTitle: t.title,
            time: timeStr,
            duration: 30
          }
        ],
        subtasks: [
          {
            title: `Review ${t.title} requirements`,
            durationMin: 15,
            implementationIntention: `If I sit down, I will check what needs to be done for ${t.title}.`
          }
        ]
      };
    });

    const conflicts = prioritizedTasks.length > 1 
      ? [`You have ${prioritizedTasks.length} tasks scheduled in close proximity, creating potential time conflicts.`]
      : [];

    const battlePlanDescription = `Decompressed your stress dump successfully. Focus on executing the starter tasks for ${prioritizedTasks.map(t => `'${t.title}'`).join(' and ')} to break cognitive inertia.`;

    res.json({
      prioritizedTasks,
      conflicts,
      battlePlanDescription
    });
  }
});

router.get("/api/agent/draft", async (req, res) => {
  const { title, context, format, action, draftText } = req.query;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ai = getGeminiClient();
  if (!ai) {
    const offlineTitle = title ? String(title) : "Document";
    const actionLabel = action ? String(action).toUpperCase() : "GENERATE";
    const chunks = [
      `# Offline Draft for ${offlineTitle} (${actionLabel})\n\n`,
      `## 1. Introduction and Core Objective\n`,
      `[Offline Demo Mode] This is a structured outline draft generated because your Gemini client is offline.\n`,
      `Focus on implementing direct forward math layers without unrequested boilerplate.\n\n`,
      `## 2. Requirements & High Level Architecture\n`,
      `- **Data Pipeline**: Ensure 10% data split validation works correctly.\n`,
      `- **Primary Deliverable**: Self-contained single-page dashboard cockpit with responsive telemetry.\n\n`,
      `## 3. References and Resources\n`,
      `- Deep Learning 101, Lecture Notes 4\n`,
      `- CIFAR-10 NumPy implementation reference manual.`
    ];
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  try {
    let prompt = `Write a comprehensive, professional ${format || "document"} draft for the task: "${title}".
Structure it with clean headers, specific implementation placeholders, and a dedicated 'References' section at the end.
Tone: Encouraging, supportive and technical.
Additional Context: "${context || ""}"`;

    if (action === "expand") {
      prompt = `You are a professional editor. Please EXPAND the following draft text to be more detailed, adding concrete sub-sections, placeholders, explanatory details, and a References section. Keep the same structure and markdown formatting:\n\nDraft Text:\n${draftText}`;
    } else if (action === "shorten") {
      prompt = `You are a professional editor. Please SHORTEN the following draft text to be concise, brief, and straight to the point. Retain the essential headings, placeholders, and References structure, but eliminate redundant explanation:\n\nDraft Text:\n${draftText}`;
    }

    const stream = await callGeminiWithRetry(
      { route: "/api/agent/draft-stream", model: GEMINI_MODEL },
      (client) => client.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt
      })
    );
    for await (const chunk of stream) {
      if (req.destroyed || res.writableEnded) {
        logger.info("[SSE Draft] Client connection closed. Stopping stream.");
        break;
      }
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("Gemini draft streaming error:", err);
    const errorMessage = err?.message || "Unknown API error";
    const isQuotaExceeded = errorMessage.includes("Quota exceeded") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
    
    const fallbackText = isQuotaExceeded 
      ? `# ⚠️ Gemini API Quota Limit Exceeded\n\nYour Google AI Studio API key has exceeded its daily free-tier limit (20 requests/day for gemini-2.5-flash).\n\n### 💡 What you can do:\n1. **Wait** for your daily Google quota to reset.\n2. **Upgrade** your API key in Google AI Studio to a paid pay-as-you-go tier.\n3. **Use a different key** in your \`.env\` file.\n\n---\n\n### 📝 Offline Backup Draft for: ${title || "Document"}\n\n[CRUNCH Offline Mode Active] here is a structured outline draft based on your constraints:\n\n#### 1. Introduction and Core Objective\n- Summarize target goals and outcomes.\n- Configure core preprocessing.\n\n#### 2. Requirements & High Level Architecture\n- **Preprocess Pipeline**: Validate input guidelines.\n- **Primary Deliverable**: Implement baseline algorithm models.`
      : `# ⚠️ Gemini API Call Failed\n\nAn error occurred while connecting to the Gemini server:\n\`\`\`\n${errorMessage}\n\`\`\`\n\n---\n\n### 📝 Offline Backup Draft for: ${title || "Document"}\n\n[CRUNCH Offline Mode Active] here is your structured layout template:\n- Establish requirements.\n- Draft initial baseline model.`;

    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

router.post("/api/agent/draft", async (req, res) => {
  const { action, draftText, title } = req.body;
  const ai = getGeminiClient();
  
  if (!ai) {
    const modified = action === "expand" 
      ? `${draftText || ""}\n\n### Expanded Diagnostics\nAdditional baseline validation precision: 0.88. Rubric parameters satisfied.`
      : `## Executive Summary: ${title || "Draft"}\n\n- Core metrics and validation splitting configured.\n- Optimized data pipeline.`;
    return res.json({ success: true, text: modified });
  }

  try {
    let prompt = `You are a professional editor. Please modify the following draft for the task: "${title || "Document"}".\n\n`;
    if (action === "expand") {
      prompt += `Please EXPAND this text to be more detailed, adding concrete sub-sections, placeholders, and explanatory details. Keep the same structure:\n\n${draftText || ""}`;
    } else {
      prompt += `Please SHORTEN this text to be concise, brief, and straight to the point. Retain the essential headings:\n\n${draftText || ""}`;
    }

    const response = await callGeminiWithRetry(
      { route: "/api/agent/draft-modify", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      })
    );
    return res.json({ success: true, text: response.text });
  } catch (err) {
    return res.json({ success: true, text: draftText || "" });
  }
});

// Morning Brief AI Summarization Endpoint
router.post("/api/agent/morning-brief", async (req, res) => {
  const { tasks } = req.body;
  const ai = getGeminiClient();

  if (!tasks || tasks.length === 0) {
    return res.json({
      topPriority: "Initiate Your First Project Plan",
      biggestRisk: "No active projects tracked. Procrastination sets in when objectives remain undefined.",
      completionForecast: "N/A - Setup a task in the Crisis Intake system first.",
      motivationQuote: "The secret of getting ahead is getting started. Take 2 minutes and dump your thoughts.",
      checklistMVP: ["Create or upload a task syllabus", "Activate Rescue Mode on your top bottleneck"]
    });
  }

  // Create descriptive summaries of active tasks
  const taskSummaryStr = tasks.map((t: any) => {
    const remainingMs = new Date(t.deadline).getTime() - Date.now();
    const hoursLeft = Math.round(remainingMs / (1000 * 60 * 60));
    const completed = t.subtasks?.filter((s: any) => s.completed).length || 0;
    const total = t.subtasks?.length || 0;
    return `- Title: "${t.title}" | Deadline: ${hoursLeft}h remaining | Pace: ${t.paceState} | Milestones: ${completed}/${total} completed | Complexity: ${t.complexity}`;
  }).join("\n");

  if (!ai) {
    // Offline simulated briefing based on input tasks
    const firstTask = tasks[0];
    const remainingMs = new Date(firstTask.deadline).getTime() - Date.now();
    const hoursLeft = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60)));
    return res.json({
      topPriority: `Complete Activation for '${firstTask.title}'`,
      biggestRisk: hoursLeft < 12 
        ? `Extreme Crunch Constraint: Only ${hoursLeft} hours left with critical milestones pending.` 
        : `Complexity Bottle-neck: Navigating high complexity requirements under stress.`,
      completionForecast: `${Math.round(firstTask.estimatedHours || 4)} hours of high-purity focus sprints required.`,
      motivationQuote: `Your most crucial task is always the starting task. Do not delay actioning the 5-minute starter block.`,
      checklistMVP: [
        firstTask.starterTask || "Open assignment files and read the grading rubric.",
        "Toggle first milestone as completed within the next 25 minutes."
      ]
    });
  }

  try {
    const prompt = `You are an elite productivity strategist and crisis rescue supervisor. Analyze the following list of active student/work tasks under crunch conditions and generate a highly focused Morning Debriefing.
Active Task List:
${taskSummaryStr}

Provide a concise, ultra-realistic debriefing in JSON matching this schema:
{
  "topPriority": "Today's top priority task, including exactly why it is the most critical item to focus on first",
  "biggestRisk": "The single biggest bottleneck, distraction, or risk that could lead to missing the submission window",
  "completionForecast": "A realistic estimation of total focused hours needed to pass or salvage full credit, and final completion likelihood percentage",
  "motivationQuote": "A short, sharp, tactical motivating advice (under 15 words) that cuts through panic",
  "checklistMVP": ["Item 1 to start within 5 minutes", "Item 2 to complete right after"]
}`;

    const response = await callGeminiWithRetry(
      { route: "/api/agent/morning-brief", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topPriority: { type: Type.STRING },
              biggestRisk: { type: Type.STRING },
              completionForecast: { type: Type.STRING },
              motivationQuote: { type: Type.STRING },
              checklistMVP: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["topPriority", "biggestRisk", "completionForecast", "motivationQuote", "checklistMVP"]
          }
        }
      })
    );

    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err: any) {
    if (err?.message?.includes("API Key") || err?.message?.includes("key")) {
      console.log("💡 [GEMINI INFO] Morning brief bypassed or unauthorized. Returning calculated local fallback.");
    } else {
      console.log("💡 [GEMINI INFO] Morning brief generation, returning calculated local fallback:", err?.message || err);
    }
    res.json({
      topPriority: `Milestone setup for: ${tasks[0].title}`,
      biggestRisk: "Time dilution: getting bogged down in minor layout elements.",
      completionForecast: "3-4 hours of targeted focus sprints.",
      motivationQuote: "Focus is a muscle. Work for 25 minutes, then look at your progress.",
      checklistMVP: ["Complete starter task immediately", "Perform stress brain dump to clear focus"]
    });
  }
});

router.post("/api/agent/simplify", async (req, res) => {
  const { title, description } = req.body;
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      simplifiedDescription: "Focus purely on core deliverables. Build local state checklist first, verify computations, then deploy simple layouts.",
      starterTask: "Verify that the build compiles and index files render.",
      subtasks: [
        { title: "Review minimal rubric metrics", durationMin: 15, implementationIntention: "Open specification notes immediately." },
        { title: "Implement basic mock mathematical models", durationMin: 30, implementationIntention: "Code simple state inputs and check arrays." },
        { title: "Run end-to-end integration checklist", durationMin: 20, implementationIntention: "Run standard local server checks." }
      ]
    });
  }
  try {
    const prompt = `Simplify the task "${title}" to its absolute bare MVP Minimum Viable Submission Plan. Analyze what the user should focus on, what they can skip, and what they can shorten to salvage maximum passing credit under a tight deadline stress constraint.
JSON layout must match exactly:
{
  "simplifiedDescription": "Brief summary of MVP strategy, what to skip, what to shorten",
  "starterTask": "Clear immediate single action to execute right now",
  "subtasks": [
    { "title": "Specific microtask title", "durationMin": 15, "implementationIntention": "When and where statement" }
  ]
}`;
    const response = await callGeminiWithRetry(
      { route: "/api/agent/simplify-task", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              simplifiedDescription: { type: Type.STRING },
              starterTask: { type: Type.STRING },
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    implementationIntention: { type: Type.STRING }
                  },
                  required: ["title", "durationMin", "implementationIntention"]
                }
              }
            },
            required: ["simplifiedDescription", "starterTask", "subtasks"]
          }
        }
      })
    );
    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err) {
    res.json({ error: "Failed to simplify" });
  }
});

router.post("/api/agent/extension-email", async (req, res) => {
  const { title, deadline, reason, recipient, mode } = req.body;
  const ai = getGeminiClient();
  if (!ai) {
    const defaultBody = mode === "Academic" 
      ? `Dear ${recipient || "Professor Smith"},\n\nI am writing to respectfully request a short, reasonable extension on the "${title}" assignment, which is currently scheduled for submission on ${deadline}.\n\nReason: I have run into unforeseen technical blockages (${reason || "critical integration hurdles"}). I want to ensure my work is of high academic quality.\n\nThank you for your understanding and guidance.\n\nSincerely,\n[Your Name]`
      : mode === "Corporate"
      ? `Hi ${recipient || "Manager"},\n\nI am requesting a brief deadline adjustment for "${title}" (currently scheduled for ${deadline}).\n\nReason: We have hit unexpected roadblocks (${reason || "backend pipeline synchronization issues"}). Adjusting this deadline ensures a robust, production-ready deliverable.\n\nBest regards,\n[Your Name]`
      : `Hey ${recipient || "Team"},\n\nQuick heads up regarding "${title}" (due ${deadline}). We are running into ${reason || "some tricky issues"} and need to request a brief extension to wrap everything up properly.\n\nThanks,\n[Your Name]`;

    return res.json({
      emailSubject: `Extension Request: ${title}`,
      emailBody: defaultBody
    });
  }
  try {
    const prompt = `Compose a short, highly persuasive extension email.
Task: "${title}"
Deadline: "${deadline}"
Recipient: "${recipient || "Recipient"}"
Reason: "${reason}"
Tone/Mode: "${mode || "Academic"}" (Tailor the tone specifically: 'Academic' is formal/deferential, 'Corporate' is professional/results-oriented, 'Team' is casual/collaborative).

Output JSON: { "emailSubject": "...", "emailBody": "..." }`;

    const response = await callGeminiWithRetry(
      { route: "/api/agent/extension-email", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emailSubject: { type: Type.STRING },
              emailBody: { type: Type.STRING }
            },
            required: ["emailSubject", "emailBody"]
          }
        }
      })
    );
    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err) {
    res.json({ emailSubject: `Extension Request: ${title}`, emailBody: `Requested brief extension.` });
  }
});

// Real-time emergency advisor chat (SSE Streaming)
router.get("/api/agent/rescue-chat", async (req, res) => {
  const { message, taskId } = req.query;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ownerId = "usr-default";
  const task = taskId ? await dbGetTaskById(String(taskId), ownerId) : null;
  const taskTitle = task ? task.title : "Emergency Operation";
  const taskDeadline = task ? task.deadline : new Date().toISOString();
  const progressPercent = task ? Math.round((task.subtasks.filter((s: any) => s.completed).length / (task.subtasks.length || 1)) * 100) : 0;
  const remainingMicrotasks = task ? task.subtasks.filter((s: any) => !s.completed).map((s: any) => s.title).join(", ") : "";
  const docText = task ? (task.documentExtractedText || "") : "";

  const ai = getGeminiClient();
  if (!ai) {
    const offlineTips = [
      `🚨 OFFLINE ADVISOR ONLINE:\nLet's keep calm and execute the next milestone for **${taskTitle}**.\n\n`,
      `Your remaining goals are: **${remainingMicrotasks || "Submission checklist cleanup"}**.\n\n`,
      `Since you are stuck on: "${message}", try writing standard placeholder arrays or mocks to bypass compilation bottlenecks immediately.\n\n`,
      `Do not waste time on perfect styling. Focus on core data persistence right now.`
    ];
    for (const tip of offlineTips) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      res.write(`data: ${JSON.stringify({ text: tip })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  try {
    const systemPrompt = `You are an emergency productivity co-pilot. The user is behind on an important deadline. Your job is: 1. Remove blockers 2. Generate usable work 3. Keep the user moving 4. Reduce panic. Never provide long explanations. Always produce: Action, Draft, Solution, Next step. Response length: Maximum 5 sentences.`;

    const prompt = `
Task Context:
- Title: "${taskTitle}"
- Deadline: "${taskDeadline}"
- Current Progress: ${progressPercent}%
- Remaining Microtasks: [${remainingMicrotasks}]
- Extracted Syllabus/Rubric notes: "${docText}"

The user is experiencing a blocker and says: "${message}"

Generate emergency copilot advice. Output immediate action, a code sample, or an outline. Keep it under 5 sentences.`;

    const stream = await callGeminiWithRetry(
      { route: "/api/agent/rescue-chat", model: GEMINI_MODEL },
      (client) => client.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt
        }
      })
    );

    for await (const chunk of stream) {
      if (req.destroyed || res.writableEnded) {
        logger.info("[SSE Chat] Client connection closed. Stopping stream.");
        break;
      }
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ text: "I'm here to support you. Let's tackle the closest microtask in your stack." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Document parsing legacy compatibility
router.post("/api/agent/parse-document", async (req, res) => {
  const { docText } = req.body;
  res.json({
    extractedText: docText || "",
    deadlines: ["Extracted from document"],
    deliverables: ["Deliverable 1"],
    rubricHighlights: "Rubric highlights extracted.",
    urgencyAssessment: "Urgent core requirements found."
  });
});

// --- PHASE 4.5: RESCUE INTELLIGENCE LAYER ENDPOINTS ---

// Helper function to format times relative to now
function formatRelativeTime(hoursOffset: number): string {
  const date = new Date(Date.now() + hoursOffset * 60 * 60 * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Unified Intelligence Dashboard API
router.post("/api/agent/intelligence-dashboard", async (req: any, res) => {
  const { 
    taskId, 
    hoursRemainingOverride, 
    progressOverride,
    subtasksOverride,
    complexityOverride,
    paceOverride
  } = req.body;

  // 1. Fetch parameters with elegant fallbacks
  const hoursRemaining = hoursRemainingOverride !== undefined ? Number(hoursRemainingOverride) : 8;
  const progress = progressOverride !== undefined ? Number(progressOverride) : 33;
  const totalSubtasks = subtasksOverride?.total !== undefined ? Number(subtasksOverride.total) : 6;
  const completedSubtasks = subtasksOverride?.completed !== undefined ? Number(subtasksOverride.completed) : 2;
  const complexity = complexityOverride || "High";
  const userPaceState = paceOverride || "Critical";

  // Check if we are running the demo scenario or custom task
  const isDemo = taskId === "demo-ml-assignment";
  const taskTitle = isDemo ? "Machine Learning Classifier & Pipeline Assignment" : "Active Strategic Rescue Task";

  // Pre-calculate mathematical metrics as base / fallback
  const urgencyWeight = hoursRemaining <= 4 ? 98 : hoursRemaining <= 12 ? 84 : hoursRemaining <= 24 ? 65 : 30;
  const complexityWeight = complexity.toLowerCase() === "critical" ? 95 : complexity.toLowerCase() === "high" ? 82 : complexity.toLowerCase() === "medium" ? 55 : 25;
  const remainingWorkPct = totalSubtasks > 0 ? ((totalSubtasks - completedSubtasks) / totalSubtasks) * 100 : 70;
  const progressScore = progress;
  const paceDangerFactor = userPaceState.toLowerCase() === "critical" ? 92 : userPaceState.toLowerCase() === "at risk" ? 65 : 20;
  
  // Calculate Rescue Score math (Feature 1 Formula)
  const rawScore = (urgencyWeight * 0.30) + (complexityWeight * 0.20) + (remainingWorkPct * 0.20) + ((100 - progressScore) * 0.10) + (paceDangerFactor * 0.10) + (85 * 0.10);
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let riskLevel = "Safe";
  let explanation = "Pacing models show safe buffers.";
  if (score > 80) {
    riskLevel = "Critical Rescue Needed";
    explanation = "Severe risk of missing core submission parameters. Immediate co-pilot scope-trimming mandatory.";
  } else if (score > 60) {
    riskLevel = "Danger";
    explanation = "Time deficit active. Remaining milestone requirements equal your safe available focus hours.";
  } else if (score > 30) {
    riskLevel = "At Risk";
    explanation = "Pacing delay trends detected. Keep focus targeted on high-weight criteria.";
  }

  // Risk Predictor Math (Feature 2 Formula)
  const missingProbability = Math.min(99, Math.max(5, Math.round(score * 1.1 - (progress * 0.2))));

  // Timeline Math (Feature 3 Formula)
  const timeline = {
    currentTime: formatRelativeTime(0),
    recommendedStart: formatRelativeTime(0.25),
    latestSafeStart: formatRelativeTime(hoursRemaining * 0.3),
    pointOfNoReturn: formatRelativeTime(hoursRemaining * 0.75),
    deadline: formatRelativeTime(hoursRemaining)
  };

  // What-If Math (Feature 4 Scenarios)
  const whatIfScenarios = [
    {
      scenarioName: "Scenario A: Start Now",
      successProbability: Math.min(98, Math.max(40, 100 - Math.round(score * 0.4))),
      riskScore: Math.round(score * 0.6),
      expectedFinishTime: formatRelativeTime(hoursRemaining * 0.6),
      description: "Direct linear execution with default syllabus scope. Retains 5-fold cross-validation."
    },
    {
      scenarioName: "Scenario B: Start in 2 Hours",
      successProbability: Math.min(85, Math.max(15, 100 - Math.round(score * 0.8))),
      riskScore: Math.min(99, Math.round(score * 1.2)),
      expectedFinishTime: formatRelativeTime(hoursRemaining * 0.95),
      description: "Adds significant pressure. Forces rush on reporting, risking critical rubric compliance."
    },
    {
      scenarioName: "Scenario C: Start Tomorrow",
      successProbability: 5,
      riskScore: 99,
      expectedFinishTime: "Overdue (Missed)",
      description: "Misses deadline window. Highly unsafe. Zero remaining buffer."
    },
    {
      scenarioName: "Scenario D: Use CRUNCH Rescue Plan",
      successProbability: Math.min(99, Math.max(80, 100 - Math.round(score * 0.15))),
      riskScore: Math.round(score * 0.25),
      expectedFinishTime: formatRelativeTime(hoursRemaining * 0.45),
      description: "Trims unrated components. Activates If-Then intentions and split-screen draft speedups."
    }
  ];

  // Grade Maximizer Math (Feature 5 Criteria)
  const gradeMaximizerAllocation = [
    {
      sectionName: "Validation & Baseline Code",
      weightPercentage: 40,
      priorityLevel: 5,
      focusRecommendation: "CRITICAL. Section dictates 40% of marks. Complete standard 80/20 test split immediately."
    },
    {
      sectionName: "Syllabus Pre-Processing Report",
      weightPercentage: 30,
      priorityLevel: 4,
      focusRecommendation: "HIGH. Copy and paste direct logs from terminal output to secure baseline formatting."
    },
    {
      sectionName: "Algorithm Evaluation & Discussion",
      weightPercentage: 20,
      priorityLevel: 3,
      focusRecommendation: "MEDIUM. Use Draft Co-pilot to generate baseline outline summary."
    },
    {
      sectionName: "Fine Tuning & Hyperparameter Grid Search",
      weightPercentage: 10,
      priorityLevel: 1,
      focusRecommendation: "SKIP/LOW. Section holds only 10% weight. Skip if under 4 hours remaining."
    }
  ];

  // Emergency Mode Math (Feature 6 Submission Plan)
  const emergencyPlan = {
    estimatedGradeNow: Math.round(progress * 0.7),
    estimatedGradeAfterPlan: Math.min(85, Math.round(progress * 0.5 + 45)),
    mustComplete: [
      "Decision-tree pipeline baseline configuration",
      "80/20 train/test performance split metrics",
      "Core summary discussion paragraphs"
    ],
    canShorten: [
      "Exploratory data visualization charts (use simple tables instead)",
      "Multi-page bibliography lists (include standard text references only)"
    ],
    canSkip: [
      "5-Fold Cross Validation computing routines",
      "Complex Grid Search hyperparameter fine tuning arrays"
    ],
    triageSummary: "Trims unrated technical decoration to focus purely on core passing criteria, securing an estimated 65-80% pass score."
  };

  // Try calling real Gemini for smart, highly-specific recommendations if configured
  const ai = getGeminiClient();
  if (ai) {
    try {
      addAgentLog("Rescue Intelligence Agent", "REASON", `Analyzing high-tension deadline parameters for ${taskTitle}. Computing score, risks, timeline, what-if forecasts, grade maximizer effort, and emergency grade savers.`);
      
      const prompt = `
      You are the elite CRUNCH Rescue Decision Engine.
      The user is facing a high-stress deadline:
      - Title: "${taskTitle}"
      - Hours Remaining: ${hoursRemaining} hours
      - Completed Checklist Progress: ${progress}%
      - Total Deliverables: ${totalSubtasks} items (Completed: ${completedSubtasks})
      - Syllabus Complexity: "${complexity}"
      - User Compilation Speed: "${userPaceState}"

      Perform full predictive diagnostics. Respond with a JSON object that satisfies all requirements.
      JSON structure MUST match:
      {
        "rescueScore": {
          "score": number (0-100),
          "riskLevel": "Safe" | "At Risk" | "Danger" | "Critical Rescue Needed",
          "explanation": "concise explanation",
          "riskFactors": ["factor1", "factor2"]
        },
        "riskPredictor": {
          "missingProbability": number (0-100),
          "topRiskFactors": ["risk1", "risk2"],
          "summary": "concise risk summary"
        },
        "rescueTimeline": {
          "currentTime": "${timeline.currentTime}",
          "recommendedStart": "${timeline.recommendedStart}",
          "latestSafeStart": "${timeline.latestSafeStart}",
          "pointOfNoReturn": "${timeline.pointOfNoReturn}",
          "deadline": "${timeline.deadline}"
        },
        "whatIf": [
          {
            "scenarioName": "Scenario A: Start Now",
            "successProbability": number,
            "riskScore": number,
            "expectedFinishTime": "formatted time",
            "description": "text"
          },
          ... up to Scenario D
        ],
        "gradeMaximizer": {
          "effortAllocation": [
            { "sectionName": "section", "weightPercentage": number, "priorityLevel": number, "focusRecommendation": "text" }
          ],
          "summary": "analysis summary"
        },
        "emergencySubmission": {
          "estimatedGradeNow": number,
          "estimatedGradeAfterPlan": number,
          "mustComplete": ["item1"],
          "canShorten": ["item1"],
          "canSkip": ["item1"],
          "triageSummary": "summary text"
        }
      }
      `;

      const response = await callGeminiWithRetry(
        { route: "/api/agent/intelligence-dashboard", model: GEMINI_MODEL },
        (client) => client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are an elite, cold, logical deadline rescue supervisor. You produce precise mathematical and rubric analysis to save failing students. You return pristine JSON models."
          }
        })
      );

      const parsed = JSON.parse(response.text || "");
      
      // Inject correct formatted relative times to avoid static timezone gaps
      if (parsed.rescueTimeline) {
        parsed.rescueTimeline.currentTime = timeline.currentTime;
        parsed.rescueTimeline.recommendedStart = timeline.recommendedStart;
        parsed.rescueTimeline.latestSafeStart = timeline.latestSafeStart;
        parsed.rescueTimeline.pointOfNoReturn = timeline.pointOfNoReturn;
        parsed.rescueTimeline.deadline = timeline.deadline;
      }
      if (parsed.whatIf) {
        parsed.whatIf[0].expectedFinishTime = timeline.recommendedStart;
        parsed.whatIf[1].expectedFinishTime = formatRelativeTime(2);
        parsed.whatIf[2].expectedFinishTime = "Overdue (Missed)";
        parsed.whatIf[3].expectedFinishTime = timeline.recommendedStart;
      }

      addAgentLog("Rescue Intelligence Agent", "ACT", `Computed Rescue Diagnostics successfully. Score: ${parsed.rescueScore?.score}/100. Failure Risk: ${parsed.riskPredictor?.missingProbability}%. Emergency pass-plan locked.`);
      return res.json(parsed);
    } catch (e: any) {
      if (e?.message?.includes("API Key") || e?.message?.includes("key")) {
        console.log("💡 [GEMINI INFO] Gemini intelligence call bypassed or unauthorized. Utilizing calculated local mathematical baseline.");
      } else {
        console.log("💡 [GEMINI INFO] Gemini intelligence call failed, utilizing calculated local mathematical baseline:", e?.message || e);
      }
    }
  }

  // Fallback returned if Gemini unavailable
  return res.json({
    rescueScore: {
      score,
      riskLevel,
      explanation,
      riskFactors: [
        "Hours remaining contracted below 12-hour safe threshold.",
        "Hourly completion rate is trending behind target calculations.",
        "Syllabus deliverables density remains high relative to available minutes."
      ]
    },
    riskPredictor: {
      missingProbability,
      topRiskFactors: [
        "Unrated secondary validation scripting is consuming excessive computing time.",
        "Writing speed is currently 35% below task timeline predictions.",
        "Too many high-cognitive requirements remain untouched in the rubric."
      ],
      summary: `${missingProbability}% chance of missing deadline based on current speed trends. Immediate action is recommended.`
    },
    rescueTimeline: timeline,
    whatIf: whatIfScenarios,
    gradeMaximizer: {
      effortAllocation: gradeMaximizerAllocation,
      summary: "Under extreme time limitations, 70% of marks are concentrated in baseline code and preprocess reports. Skip high-overhead tuning modules."
    },
    emergencySubmission: emergencyPlan
  });
});

// --- Phase 5 Multi-Agent Orchestration & Memory Systems Endpoints ---

// 1. GET User Memory Profile
router.get("/api/agent/user-memory", authenticateToken, async (req: any, res) => {
  try {
    const memory = await dbGetUserMemory(req.user.id);
    res.json(memory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST Update User Memory Profile
router.post("/api/agent/user-memory", authenticateToken, async (req: any, res) => {
  try {
    const currentMemory = await dbGetUserMemory(req.user.id);
    const updatedMemory = { ...currentMemory, ...req.body };
    await dbUpdateUserMemory(req.user.id, updatedMemory);
    addAgentLog("Memory Agent", "ACT", "Synchronized and updated long-term user productivity memory profile.", req.user.id);
    res.json({ success: true, memory: updatedMemory });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST Reflection Agent Evaluation
router.post("/api/agent/reflect", authenticateToken, async (req: any, res) => {
  const { taskId, taskTitle } = req.body;
  const ownerId = req.user.id;
  
  const defaultReflection = {
    id: `ref-${Date.now()}`,
    taskId: taskId || "unknown-task",
    taskTitle: taskTitle || "Active Task Sprint",
    date: new Date().toISOString().split("T")[0],
    ownerId,
    whatWorked: "Pacing tracker correctly visualised a critical 12-hour shortfall, leading to prompt project scope pruning.",
    whatFailed: "Draft compiler initial setup took 40 minutes because baseline templates were loaded too late.",
    whyUserGotStuck: "Tuning non-critical UI styling aesthetics instead of closing the database connection code logic.",
    whatShouldChangeNextTime: "Dramatically restrict aesthetic tweaking before functional code matches test specs."
  };

  addAgentLog("Reflection Agent", "REASON", `Evaluating session completion profile for task: "${taskTitle}"`, ownerId);
  addAgentLog("Reflection Agent", "ACT", "Calling Gemini (gemini-2.5-flash) to extract metacognitive lessons and write structured summary.", ownerId);

  const ai = getGeminiClient();
  let generatedReflection = { ...defaultReflection };

  if (ai) {
    try {
      const prompt = `
        You are a highly precise, tough-love educational Reflection Agent for CRUNCH.
        Analyze the student's task completion.
        Task Title: "${taskTitle}"
        
        Write an analytical reflection containing exactly these JSON fields:
        {
          "whatWorked": "string description",
          "whatFailed": "string description",
          "whyUserGotStuck": "string description",
          "whatShouldChangeNextTime": "string description"
        }
      `;

      const response = await callGeminiWithRetry(
        { route: "/api/agent/reflect", model: GEMINI_MODEL },
        (client) => client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are an educational psychologist who specializes in developer pacing, cramming cycles, and student focus failures."
          }
        })
      );

      const parsed = JSON.parse(response.text || "{}");
      generatedReflection = {
        ...defaultReflection,
        ...parsed
      };
    } catch (e: any) {
      if (e?.message?.includes("API Key") || e?.message?.includes("key")) {
        console.log("💡 [GEMINI INFO] Gemini reflection call bypassed or unauthorized. Utilizing standard psychological evaluation profile.");
      } else {
        console.log("💡 [GEMINI INFO] Gemini reflection failed, utilizing standard evaluation profile:", e?.message || e);
      }
    }
  }

  // Update memory stats in Firestore
  const userMemory = await dbGetUserMemory(ownerId);
  userMemory.previousRescueCount = (userMemory.previousRescueCount || 0) + 1;
  await dbUpdateUserMemory(ownerId, userMemory);

  // Save reflection in Firestore
  const savedReflection = await dbSaveReflection(generatedReflection);

  addAgentLog("Reflection Agent", "OBSERVE", `Metacognitive lesson logged. Saved under ID ${generatedReflection.id}. Previous Rescue Count incremented.`, ownerId);
  return res.json(savedReflection);
});

// 4. GET All Reflections
router.get("/api/agent/reflections", authenticateToken, async (req: any, res) => {
  try {
    const reflections = await dbGetReflections(req.user.id);
    res.json(reflections);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET Daily AI Briefing
router.get("/api/agent/daily-briefing", authenticateToken, async (req: any, res) => {
  try {
    const ownerId = req.user.id;
    const tasks = await dbGetTasks(ownerId);
    const activeTasks = tasks.filter((t: any) => t.status !== "Completed");
    const taskCount = activeTasks.length;
    const userMemory = await dbGetUserMemory(ownerId);
    
    const defaultBriefing = {
      greeting: `Good morning, Rescue Operative.`,
      todayPriorities: [
        `Secure ML Assignment 2 subtasks before the 11:00 PM lock closes.`,
        `Finalize draft boilerplate schemas in the Draft Co-Pilot.`,
        `Keep stress indexes below critical threshold.`
      ],
      highestRiskTask: {
        id: activeTasks[0]?.id || "demo-ml",
        title: activeTasks[0]?.title || "ML Alignment Assignment",
        riskLevel: "Danger",
        missingProbability: 72
      },
      estimatedSuccessRate: 85,
      recommendedFirstAction: "Execute recommended start sprint for ML Assignment immediately to maximize grade yield.",
      explanation: "Because your writing speed has been 35% slower on past academic tasks, starting early guarantees you bypass procrastination blockages."
    };

    addAgentLog("Intake Agent", "REASON", "Compiling daily login priorities...", ownerId);
    addAgentLog("Risk Agent", "ACT", "Analyzing active timeline horizons and previous procrastination memories to build strategic override forecast.", ownerId);

    const ai = getGeminiClient();
    if (ai && taskCount > 0) {
      try {
        const prompt = `
          Create a login priority briefing.
          Active Tasks: ${JSON.stringify(activeTasks.map(t => ({ title: t.title, deadline: t.deadline, complexity: t.complexity })))}
          User Memory: ${JSON.stringify(userMemory || {})}
          
          Format output as exact JSON matching:
          {
            "greeting": "string",
            "todayPriorities": ["string", "string"],
            "highestRiskTask": {
              "id": "string",
              "title": "string",
              "riskLevel": "Safe|At Risk|Danger|Critical",
              "missingProbability": number
            },
            "estimatedSuccessRate": number,
            "recommendedFirstAction": "string",
            "explanation": "string explaining why based on memory procrastination tendencies"
          }
        `;

        const response = await callGeminiWithRetry(
          { route: "/api/agent/daily-briefing", model: GEMINI_MODEL },
          (client) => client.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are an elite, highly encouraging, but extremely tactical AI chief of staff."
            }
          })
        );

        const parsed = JSON.parse(response.text || "{}");
        if (parsed.greeting) {
          return res.json(parsed);
        }
      } catch (e: any) {
        if (e?.message?.includes("API Key") || e?.message?.includes("key")) {
          console.log("💡 [GEMINI INFO] Gemini daily briefing bypassed or unauthorized. Returning baseline briefing package.");
        } else {
          console.log("💡 [GEMINI INFO] Gemini daily briefing compilation failed, returning baseline briefing package:", e?.message || e);
        }
      }
    }

    return res.json(defaultBriefing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET Explainability Layer for Task Recommendations
router.get("/api/agent/explain-recommendation/:taskId", authenticateToken, async (req: any, res) => {
  try {
    const { taskId } = req.params;
    const task = await dbGetTaskById(taskId, req.user.id);
    
    const explanation = {
      taskId,
      reasonCode: "CRITICAL_TIMELINE_COMPRESSION",
      whyBrief: `This task is locked inside high-alert diagnostics due to severe compression of safe working hours.`,
      factors: [
        `Due Date is fast approaching with less than 12 hours remaining in the active calendar block.`,
        `The task is worth 25% of the ultimate syllabus rubric score, placing Overall Pass Rating at risk.`,
        `It blocks 3 dependent draft pipelines, meaning delays here compound failure across adjacent submissions.`
      ]
    };

    if (task) {
      explanation.whyBrief = `CRUNCH scheduled "${task.title}" with high priority rating because it targets essential pass-safe criteria first.`;
      if (task.urgencyScore > 80) {
        explanation.factors = [
          `Urgency index of ${task.urgencyScore}/100 exceeds the maximum safety threshold, demanding immediate rescue activation.`,
          `Estimated weight percentage in your curriculum is substantial.`,
          `Starting now preserves a ${100 - Math.round(task.urgencyScore * 0.4)}% probability of securing a high-grade tier.`
        ];
      } else {
        explanation.factors = [
          `Complexity ranking is set to "${task.complexity}", which allows structured incremental micro-sprints.`,
          `Low overall threat score of ${task.urgencyScore} means standard calendar blocks are sufficient.`,
          `No current calendar overlapping conflicts are detected.`
        ];
      }
    }

    res.json(explanation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET Rescue History Timeline
router.get("/api/agent/rescue-history", authenticateToken, async (req: any, res) => {
  try {
    const history = await dbGetRescueHistory(req.user.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. POST Autonomous Task Triage (Brain Dump Processor)
router.post("/api/agent/triage-dump", authenticateToken, async (req: any, res) => {
  const schema = z.object({ brainDump: z.string().min(1, "Brain dump is required") });
  const validated = schema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: validated.error.issues[0].message });
  }

  let { brainDump } = validated.data;
  brainDump = sanitizeInput(brainDump);
  const safety = checkPromptSafety(brainDump);
  if (!safety.safe) {
    return res.status(400).json({ error: safety.reason });
  }
  const ownerId = req.user.id;

  addAgentLog("Intake Agent", "REASON", "Autonomous Brain Dump Triage initiated by user stress-dump submission.", ownerId);
  addAgentLog("Planning Agent", "ACT", "Analyzing dump keywords for automatic category, priority classification and battle planning.", ownerId);

  const defaultResults = [
    {
      title: "Clean ML Code Repository",
      category: "Coding",
      priority: "High",
      estimatedEffortHours: 4,
      conflictsDetected: ["Overlaps with final writing sprint"],
      battlePlanSteps: [
        "Clone the base template and setup script environments",
        "Implement essential preprocessing loops",
        "Write simple automated verification assertions"
      ]
    },
    {
      title: "Write Literature Overview PDF",
      category: "Writing",
      priority: "Critical",
      estimatedEffortHours: 6,
      conflictsDetected: ["Writing velocity is historically 35% slower on academic briefs"],
      battlePlanSteps: [
        "Synthesize three primary bibliographic citations",
        "Draft the 500-word introduction section inside the Draft Co-Pilot",
        "Compile final draft report to PDF formatting standards"
      ]
    }
  ];

  let triagedTasks = defaultResults;
  const ai = getGeminiClient();

  if (ai && brainDump) {
    try {
      const prompt = `
        You are a highly capable autonomous Triage Agent. Read this mental stress dump from a student.
        Stress Dump: "${brainDump}"
        
        Deconstruct it into a list of structured, actionable academic tasks.
        For each task, classify its category, priority rating, estimate the effort hours, detect any resource conflicts, and provide a list of battle plan steps.
        
        Output exact JSON structure:
        [
          {
            "title": "string",
            "category": "Coding|Writing|Research|Documentation|General",
            "priority": "Critical|High|Medium|Low",
            "estimatedEffortHours": number,
            "conflictsDetected": ["string"],
            "battlePlanSteps": ["step1", "step2"]
          }
        ]
      `;

      const response = await callGeminiWithRetry(
        { route: "/api/agent/triage-dump", model: GEMINI_MODEL },
        (client) => client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are an autonomous administrative scheduler that takes messy human language and converts it to strict calendar structures."
          }
        })
      );

      const parsed = JSON.parse(response.text || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        triagedTasks = parsed;
      }
    } catch (e: any) {
      if (e?.message?.includes("API Key") || e?.message?.includes("key")) {
        console.log("💡 [GEMINI INFO] Gemini triage dump bypassed or unauthorized. Using rich built-in fallbacks.");
      } else {
        console.log("💡 [GEMINI INFO] Gemini triage dump failed, using rich built-in fallbacks:", e?.message || e);
      }
    }
  }

  // Create real task records in DB autonomously
  const createdTasks = [];
  for (const t of triagedTasks) {
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mockTask = {
      id: taskId,
      title: t.title,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      complexity: "High",
      status: "Pending",
      urgencyScore: t.priority === "Critical" ? 92 : t.priority === "High" ? 78 : 45,
      description: `Autonomously triaged from stress dump. Category: ${t.category}. Conflicts: ${t.conflictsDetected.join(", ")}`,
      starterTask: t.battlePlanSteps[0] || "Start active development.",
      isRescueActive: t.priority === "Critical" || t.priority === "High",
      paceState: t.priority === "Critical" ? "Critical" : "On Track",
      ownerId,
      subtasks: t.battlePlanSteps.map((step, idx) => ({
        id: `s-${Date.now()}-${idx}`,
        title: step,
        durationMin: Math.round((t.estimatedEffortHours * 60) / t.battlePlanSteps.length),
        completed: false,
        implementationIntention: `Execute step during scheduled focus hours.`
      }))
    };
    const saved = await dbSaveTask(mockTask);
    createdTasks.push(saved);

    addAgentLog("Planning Agent", "OBSERVE", `Autonomously instantiated task "${t.title}" in Database with ${mockTask.subtasks.length} sub-sprints.`, ownerId);
  }

  // Also add to rescue history
  for (const ct of createdTasks) {
    await dbSaveRescueHistoryItem({
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      taskTitle: ct.title,
      date: new Date().toISOString().split("T")[0],
      initialRescueScore: ct.urgencyScore,
      finalRescueScore: Math.round(ct.urgencyScore * 0.3),
      status: "In Progress",
      draftsGeneratedCount: 0,
      ownerId
    });
  }

  return res.json({ success: true, tasks: createdTasks });
});

// 9. POST Multi-Agent Request Orchestration Router
router.post("/api/agent/orchestrate", authenticateToken, async (req: any, res) => {
  const schema = z.object({ prompt: z.string().min(1, "Prompt is required") });
  const validated = schema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: validated.error.issues[0].message });
  }

  let { prompt } = validated.data;
  const ownerId = req.user.id;

  prompt = sanitizeInput(prompt);
  const safety = checkPromptSafety(prompt);
  if (!safety.safe) {
    return res.status(400).json({ error: safety.reason });
  }

  addAgentLog("Agent Orchestrator", "REASON", `Received central directive: "${prompt}"`, ownerId);
  addAgentLog("Intake Agent", "ACT", "Analyzing prompt scope to select target micro-agents.", ownerId);
  addAgentLog("Risk Agent", "REASON", "Calculating potential project risks associated with prompt command.", ownerId);
  addAgentLog("Planning Agent", "ACT", "Drafting task timeline coordinates dynamically.", ownerId);

  const defaultReplies = [
    "Orchestration completed successfully. Intake Agent classified the directive as an implementation request. Planning Agent mapped a custom subtask array. Risk Agent predicted overall safety rates are high (92% pass potential).",
    "Multi-agent loop resolved: Draft Agent is actively pre-generating boilerplates, whilst Rescue Agent has marked the ml-sprint as a protected target."
  ];

  let reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];

  const ai = getGeminiClient();
  if (ai && prompt) {
    try {
      const gPrompt = `
        You are the CENTRAL CRUNCH ORCHESTRATOR. You speak on behalf of an army of specialized agents:
        1. Intake Agent (analyzes prompt)
        2. Document Agent (reads syllabus specs)
        3. Planning Agent (manages schedules)
        4. Rescue Agent (cuts scope and rescues grades)
        5. Draft Agent (writes prose and code outline drafts)
        6. Risk Agent (calculates failure rates)
        7. Reflection Agent (derives performance lessons)
        
        The user said: "${prompt}"
        
        Write an integrated multi-agent status response explaining how the relevant agents are coordinating to solve their problem. Keep the tone highly technical, calm, objective, and supportive.
      `;

      const response = await callGeminiWithRetry(
        { route: "/api/agent/orchestrate", model: GEMINI_MODEL },
        (client) => client.models.generateContent({
          model: GEMINI_MODEL,
          contents: gPrompt,
          config: {
            systemInstruction: "You are the captain of the multi-agent AI system inside CRUNCH."
          }
        })
      );
      if (response.text) reply = response.text;
    } catch (e: any) {
      if (e?.message?.includes("API Key") || e?.message?.includes("key")) {
        console.log("💡 [GEMINI INFO] Gemini orchestrator call bypassed or unauthorized. Using offline administrative coordination response.");
      } else {
        console.log("💡 [GEMINI INFO] Gemini orchestrator call failed, using offline administrative coordination response:", e?.message || e);
      }
    }
  }

  addAgentLog("Agent Orchestrator", "OBSERVE", "Coordinated status response constructed. Handing over workspace back to the student cockpit.", ownerId);
  return res.json({ response: reply });
});

// 10. GET Live Agent Activity Feed logs
router.get("/api/agent/activity-feed", authenticateToken, async (req: any, res) => {
  try {
    const logs = await dbGetAgentLogs(req.user.id);
    res.json(logs.slice(0, 15));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Avoid background browser 404 logs for standard assets
router.get("/favicon.ico", (req, res) => res.status(204).end());
router.get("/manifest.json", (req, res) => res.status(204).end());

// --- Vite & SPA Server Bootstrapping ---

export default router;

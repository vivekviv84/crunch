import { Type } from "@google/genai";
import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL } from "./gemini_client";
import { runSelfCorrectingLoop } from "../../../../server/services/evaluationService";

export interface RescuePlanSubtask {
  title: string;
  durationMin: number;
  implementationIntention: string;
}

export interface RescuePlanResult {
  starterTask: string;
  subtasks: RescuePlanSubtask[];
  calendarSchedule: {
    time: string;
    taskTitle: string;
    duration: number;
  }[];
  urgencyScore: number;
  paceState: "On Track" | "At Risk" | "Critical" | "Impossible";
}

export async function runPlanningAgent(
  title: string,
  deadline: string,
  description: string,
  complexity: string,
  documentSpecs?: any
): Promise<RescuePlanResult> {
  const ai = getGeminiClient();
  if (!ai) {
    return getMockPlanningResponse(title, deadline);
  }

  const docContext = documentSpecs 
    ? `Document Specs: Deliverables: ${JSON.stringify(documentSpecs.deliverables)}, Rubric: ${JSON.stringify(documentSpecs.rubric)}, Word count: ${documentSpecs.word_count}, Complexity: ${documentSpecs.complexity}, Estimated hours: ${documentSpecs.estimated_hours}`
    : "No extra document uploaded.";

  const inputContext = `Task: ${title}, Deadline: ${deadline}, Complexity: ${complexity}, Description: ${description}. ${docContext}`;

  const rules = [
    "The starterTask must take 5 minutes or less (strictly <= 5 mins).",
    "Every subtask must take 25 minutes or less (strictly <= 25 mins).",
    "Every subtask must have a valid implementationIntention formatted as: 'If [situation], then I will [action]'.",
    "The calendarSchedule times must match the order and durations of the subtasks sequentially.",
    "The paceState must be one of 'On Track', 'At Risk', 'Critical', 'Impossible' and align with the urgencyScore."
  ];

  const generateFn = async (feedbackPrompt?: string) => {
    const feedback = feedbackPrompt ? `\n\nCRITICAL FIX REQUIRED:\n${feedbackPrompt}` : "";

    const prompt = `
      You are the Rescue Planning Agent for CRUNCH.
      The user is facing an urgent deadline: "${title}" due on "${deadline}".
      Current system local time is: ${new Date().toISOString()}.
      Complexity description: "${complexity}".
      Context/Description: "${description}"
      ${docContext}
      ${feedback}

      Generate a tactical, low-friction Rescue Battle Plan consisting of sequential microtasks.
      
      CRITICAL RULES:
      1. The first task (the "starterTask") MUST take 5 minutes or less (strictly <= 5 mins) to shatter procrastination inertia.
      2. Every other microtask MUST take 25 minutes or less (strictly <= 25 mins).
      3. For every microtask, write an "implementationIntention" using the "If [situation], then I will [action]" format. Make them highly contextual and vivid!
      4. Sequence the microtasks realistically. Create 3 to 6 microtasks.
      5. Generate a "calendarSchedule" listing specific time blocks (e.g. "02:00 PM", "02:25 PM") starting from now for each microtask.
      6. Assess the "urgencyScore" (1 to 100) and decide the "paceState" ("On Track" | "At Risk" | "Critical" | "Impossible").

      Return a JSON object strictly matching this schema:
      {
        "starterTask": "...",
        "subtasks": [
          { "title": "...", "durationMin": 25, "implementationIntention": "If ... then ..." }
        ],
        "calendarSchedule": [
          { "time": "hh:mm AM/PM", "taskTitle": "...", "duration": 25 }
        ],
        "urgencyScore": 85,
        "paceState": "Critical"
      }
    `;

    const response = await callGeminiWithRetry(
      { route: "planning-agent", model: GEMINI_MODEL },
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
                  },
                  required: ["title", "durationMin", "implementationIntention"]
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
                  },
                  required: ["time", "taskTitle", "duration"]
                }
              },
              urgencyScore: { type: Type.INTEGER },
              paceState: { type: Type.STRING, enum: ["On Track", "At Risk", "Critical", "Impossible"] }
            },
            required: ["starterTask", "subtasks", "calendarSchedule", "urgencyScore", "paceState"]
          }
        }
      })
    );

    return JSON.parse(response.text?.trim() || "{}");
  };

  try {
    const parsed = await runSelfCorrectingLoop("Planning Agent", inputContext, generateFn, rules);
    return {
      starterTask: parsed.starterTask || "Open blank workspace and draft 1 line of title (3 mins)",
      subtasks: parsed.subtasks || [],
      calendarSchedule: parsed.calendarSchedule || [],
      urgencyScore: parsed.urgencyScore || 75,
      paceState: parsed.paceState || "At Risk"
    };
  } catch (err: any) {
    console.log("💡 [GEMINI INFO] Gemini self-correcting planning agent failed, using mock fallback: ", err.message || err);
    return getMockPlanningResponse(title, deadline);
  }
}

function getMockPlanningResponse(title: string, deadline: string): RescuePlanResult {
  return {
    starterTask: "Open blank report document and type out title header (4 mins)",
    subtasks: [
      { title: "Sift through project requirements and outline 5 core report sections", durationMin: 15, implementationIntention: "If I sit at my keyboard, I will write Section headings in bold." },
      { title: "Draft Section 1: Intro and Problem Statement background", durationMin: 25, implementationIntention: "If the headings are ready, I will immediately type the first paragraph." },
      { title: "Compile evaluation stats and insert high-contrast tables", durationMin: 20, implementationIntention: "If intro is complete, I will transfer numerical values from logs." },
      { title: "Review conclusions and format standard citations checklist", durationMin: 15, implementationIntention: "If tables are inserted, I will paste citation links at the bottom." }
    ],
    calendarSchedule: [
      { time: "01:00 PM", taskTitle: "Review instructions & outline sections", duration: 15 },
      { time: "01:15 PM", taskTitle: "Draft Section 1 (Intro)", duration: 25 },
      { time: "01:40 PM", taskTitle: "Compile stats & tables", duration: 20 },
      { time: "02:00 PM", taskTitle: "Format citations & finalize conclude", duration: 15 }
    ],
    urgencyScore: 82,
    paceState: "Critical"
  };
}

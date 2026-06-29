import { Type } from "@google/genai";
import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL } from "./gemini_client";

export interface IntakeResult {
  title: string;
  deadline: string;
  complexity: "Low" | "Medium" | "High";
  status: "Pending" | "In Progress" | "Completed";
  components: string[];
  urgency_score: number;
  description: string;
  starterTask: string;
  subtasks: {
    title: string;
    durationMin: number;
    implementationIntention: string;
  }[];
}

export async function runIntakeAgent(text: string): Promise<IntakeResult> {
  const ai = getGeminiClient();
  if (!ai) {
    return getMockIntakeResponse(text);
  }

  try {
    const prompt = `
      You are the Task Intake Agent for CRUNCH (an AI deadline rescue system).
      The user has entered a frantic description of an upcoming academic or professional deadline.
      Analyze this text: "${text}"

      Extract:
      1. title: clear, action-oriented task title.
      2. deadline: Estimate a plausible ISO timestamp relative to the current local time (${new Date().toISOString()}). If they say "Friday" or "tomorrow", calculate the accurate ISO datetime.
      3. complexity: "Low", "Medium", or "High".
      4. status: Must be "Pending".
      5. components: Major deliverable list or components (array of strings).
      6. urgency_score: A calculated score from 1 to 100, where 100 means due in hours and High complexity.
      7. description: Summarized rescue scope.
      8. starterTask: An action that takes 5 minutes or less (strictly <= 5 mins) to get them over the friction threshold.
      9. subtasks: A list of 3-5 subtasks, where each duration is strictly 25 minutes or less, along with an implementation intention ("If [situation], then I will [action]").

      Provide a standard JSON object strictly matching this schema.
    `;

    const response = await callGeminiWithRetry(
      { route: "intake-agent", model: GEMINI_MODEL },
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
              complexity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              status: { type: Type.STRING },
              components: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              urgency_score: { type: Type.INTEGER },
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
            required: ["title", "deadline", "complexity", "status", "components", "urgency_score", "description", "starterTask", "subtasks"]
          }
        }
      })
    );

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return {
      title: parsed.title || "Intake Rescue Operation",
      deadline: parsed.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      complexity: (parsed.complexity as any) || "Medium",
      status: "Pending",
      components: parsed.components || [],
      urgency_score: parsed.urgency_score || 50,
      description: parsed.description || text,
      starterTask: parsed.starterTask || "Open the folder and review instructions (2 mins)",
      subtasks: parsed.subtasks || []
    };
  } catch (err: any) {
    console.log("💡 [GEMINI INFO] Gemini intake agent bypassed or failed, using mock fallback: ", err.message || err);
    return getMockIntakeResponse(text);
  }
}

function getMockIntakeResponse(text: string): IntakeResult {
  const containsML = text.toLowerCase().includes("ml") || text.toLowerCase().includes("machine") || text.toLowerCase().includes("learning");
  return {
    title: containsML ? "Machine Learning Model Setup & Evaluation" : "Urgent Project Deliverable",
    deadline: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(), // 22 hours from now
    complexity: "High",
    status: "Pending",
    components: ["Report Draft", "Source Code", "Visualization Plots"],
    urgency_score: 92,
    description: `Extracted from prompt: "${text}". Real-time recovery schedule designed under extreme constraints.`,
    starterTask: "Create main.py and outline major library imports (3 mins)",
    subtasks: [
      { title: "Review instructions and download baseline datasets", durationMin: 15, implementationIntention: "If I open the editor, I will load sample configurations first." },
      { title: "Implement core algorithm loops and validation tests", durationMin: 25, implementationIntention: "If loading works, I will run the primary validation loops." },
      { title: "Document findings and save loss curve figures", durationMin: 20, implementationIntention: "If test is completed, I will immediately export charts to the reports folder." }
    ]
  };
}

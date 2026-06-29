import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL } from "./gemini_client";

export async function runCelebrationAgent(
  taskTitle: string,
  subtaskTitle: string,
  xpAwarded: number
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    return `🔥 Mission Control: "${subtaskTitle}" is complete! +${xpAwarded} XP logged. Your tactical momentum is skyrocketing!`;
  }

  try {
    const prompt = `
      You are the Tactical Co-Pilot / Celebration Agent for CRUNCH.
      The user just completed a microtask: "${subtaskTitle}" 
      under the urgent parent rescue operation: "${taskTitle}".
      They have earned +${xpAwarded} XP.

      Generate a brief, punchy, high-energy, encouraging message of celebration.
      Acknowledge their grit, break through academic despair, and fuel momentum for the next step.
      Keep it short (1 to 2 sentences max) and themed with a tactical cockpit vibe.
    `;

    const response = await callGeminiWithRetry(
      { route: "celebration-agent", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      })
    );

    return response.text?.trim() || `🔥 Boom! "${subtaskTitle}" checked off. +${xpAwarded} XP secured. Keep pushing!`;
  } catch (err) {
    return `🔥 Mission Control: "${subtaskTitle}" is complete! +${xpAwarded} XP logged. Keep executing!`;
  }
}

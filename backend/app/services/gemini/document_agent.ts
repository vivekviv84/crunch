import { Type } from "@google/genai";
import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL } from "./gemini_client";

export interface ExtractedDocumentSpecs {
  title: string;
  deadline: string;
  deliverables: string[];
  rubric: string[];
  word_count?: number;
  complexity: number; // 1 to 10
  estimated_hours: number;
  submission_requirements?: string;
}

export async function runDocumentAgent(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocumentSpecs> {
  const ai = getGeminiClient();
  if (!ai) {
    return getMockDocumentResponse(fileName);
  }

  try {
    const prompt = `
      You are the Document Agent for CRUNCH.
      Extract assignment metadata, structures, and requirements from the uploaded document file.
      
      Extract:
      1. title: Assignment Title (clear, concise)
      2. deadline: Extract any explicit due dates/times and format as an ISO string, or relative to current date ${new Date().toISOString()} if not fully clear.
      3. deliverables: Detailed list of specific files or milestones to submit.
      4. rubric: Specific highlights of what is graded (e.g. "Data structures 20%, analysis 40%").
      5. word_count: If there is a specified word limit or target word count, extract it (integer).
      6. complexity: Score from 1 (simple) to 10 (exceptionally advanced).
      7. estimated_hours: Suggested focused hours required to complete from scratch.
      8. submission_requirements: Specific platforms (Canvas, Gradescope, GitHub) or formatting rules.

      Return a strict JSON object matching the schema.
    `;

    // Convert Buffer to base64
    const base64Data = fileBuffer.toString("base64");

    const response = await callGeminiWithRetry(
      { route: "document-agent", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              deadline: { type: Type.STRING },
              deliverables: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              rubric: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              word_count: { type: Type.INTEGER },
              complexity: { type: Type.INTEGER },
              estimated_hours: { type: Type.INTEGER },
              submission_requirements: { type: Type.STRING }
            },
            required: ["title", "deadline", "deliverables", "rubric", "complexity", "estimated_hours"]
          }
        }
      })
    );

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return {
      title: parsed.title || "Uploaded Assignment Spec",
      deadline: parsed.deadline || new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      deliverables: parsed.deliverables || [],
      rubric: parsed.rubric || [],
      word_count: parsed.word_count || undefined,
      complexity: parsed.complexity || 7,
      estimated_hours: parsed.estimated_hours || 10,
      submission_requirements: parsed.submission_requirements || "Standard Submission"
    };
  } catch (err: any) {
    console.log("💡 [GEMINI INFO] Gemini document agent bypassed or failed, using mock fallback: ", err.message || err);
    return getMockDocumentResponse(fileName);
  }
}

function getMockDocumentResponse(fileName: string): ExtractedDocumentSpecs {
  const isML = fileName.toLowerCase().includes("ml") || fileName.toLowerCase().includes("machine") || fileName.toLowerCase().includes("learning") || fileName.toLowerCase().includes("assignment");
  return {
    title: isML ? "Machine Learning Final Project Report" : "Advanced Academic Research Project",
    deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    deliverables: [
      "10-page research report paper (PDF format)",
      "Source code repository with evaluation notebooks",
      "Saved model weights and hyperparameters configuration sheet"
    ],
    rubric: [
      "Data ingestion, cleaning and preprocessing pipelines (15%)",
      "Architecture design and convolutional layer modeling (30%)",
      "Ablation testing and hyperparameter verification (35%)",
      "Clarity of report analysis, charts, and metrics (20%)"
    ],
    word_count: 3500,
    complexity: 8,
    estimated_hours: 15,
    submission_requirements: "Submit on Canvas as a ZIP file. Code must compile without errors on standard environment."
  };
}

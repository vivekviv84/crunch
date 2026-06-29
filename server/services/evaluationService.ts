import { getGeminiClient, callGeminiWithRetry, GEMINI_MODEL } from "../services/geminiService";
import { db } from "../repositories/taskRepository";
import { logger } from "../services/loggerService";

export interface EvaluationResult {
  qualityScore: number;
  passed: boolean;
  violations: string[];
  feedback: string;
}

export async function evaluateResponse(
  agentName: string,
  inputContext: string,
  outputJson: any,
  rules: string[]
): Promise<EvaluationResult> {
  const ai = getGeminiClient();
  const defaultResult: EvaluationResult = {
    qualityScore: 100,
    passed: true,
    violations: [],
    feedback: "Self-eval completed successfully. No violations found."
  };

  if (!ai) {
    logger.warn(`[AI Eval] Gemini client offline. Bypassing validation for ${agentName}.`);
    return defaultResult;
  }

  try {
    const prompt = `
      You are an autonomous AI Quality Judge and Evaluation Agent.
      Your task is to critique the output of the "${agentName}" to ensure it is correct, safe, and meets all architectural criteria.

      Input Context:
      """
      ${inputContext}
      """

      Generated Output:
      """
      ${JSON.stringify(outputJson, null, 2)}
      """

      Architectural Rules to Enforce:
      ${rules.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")}

      Evaluate the output against these rules. Rate the quality on a scale of 0 to 100.
      If the score is below 80, set "passed" to false.

      Format your response as a strict JSON object:
      {
        "qualityScore": number (0-100),
        "passed": boolean,
        "violations": ["string description of any rule violated"],
        "feedback": "constructive feedback string indicating exactly what needs to be changed to fix it"
      }
    `;

    const response = await callGeminiWithRetry(
      { route: "ai-evaluation", model: GEMINI_MODEL },
      (client) => client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are a tough, objective, and precise software engineering code and prompt evaluator."
        }
      })
    );

    const result: EvaluationResult = JSON.parse(response.text || "{}");
    
    // Log evaluation metrics to Firestore under "aiEvaluations" collection for audit
    try {
      await db.collection("aiEvaluations").add({
        timestamp: new Date().toISOString(),
        agentName,
        qualityScore: result.qualityScore,
        passed: result.passed,
        violations: result.violations || [],
        feedback: result.feedback,
        inputContext: inputContext.slice(0, 1000),
        outputJson
      });
      logger.info(`[AI Eval] Logged evaluation for ${agentName} (Score: ${result.qualityScore}%, Passed: ${result.passed})`);
    } catch (dbErr) {
      logger.error(`[AI Eval] Failed to log metrics to Firestore: ${dbErr instanceof Error ? dbErr.message : dbErr}`);
    }

    return result;
  } catch (err) {
    logger.error(`[AI Eval] Evaluation failed: ${err instanceof Error ? err.message : err}`);
    return defaultResult;
  }
}

/**
 * Executes a self-correcting generation loop.
 * If the generated response fails evaluation, it automatically prompts Gemini again to fix the violations.
 */
export async function runSelfCorrectingLoop(
  agentName: string,
  inputContext: string,
  generateFn: (feedbackPrompt?: string) => Promise<any>,
  rules: string[]
): Promise<any> {
  logger.info(`[Self-Correction] Starting generation loop for ${agentName}...`);
  
  // 1. Initial Generation
  let output = await generateFn();
  
  // 2. First Evaluation
  let evalResult = await evaluateResponse(agentName, inputContext, output, rules);
  
  if (evalResult.passed) {
    logger.info(`[Self-Correction] Generation PASSED first-pass validation (Score: ${evalResult.qualityScore}%).`);
    return output;
  }

  logger.warn(`[Self-Correction] Generation FAILED validation (Score: ${evalResult.qualityScore}%). Violations: ${evalResult.violations.join(", ")}`);
  logger.info(`[Self-Correction] Triggering LLM auto-correction iteration...`);

  // 3. Correction / Regeneration with Feedback
  const correctionPrompt = `
    Your previous response was rejected by the Quality Evaluator with a score of ${evalResult.qualityScore}%.
    
    Violations found:
    ${evalResult.violations.map(v => `- ${v}`).join("\n")}
    
    Feedback for fix:
    ${evalResult.feedback}
    
    Please regenerate the output, strictly correcting these issues.
  `;

  try {
    const refinedOutput = await generateFn(correctionPrompt);
    
    // 4. Second Evaluation
    const refinedEvalResult = await evaluateResponse(agentName, inputContext, refinedOutput, rules);
    
    if (refinedEvalResult.passed) {
      logger.info(`[Self-Correction] Refined output PASSED second-pass validation (Score: ${refinedEvalResult.qualityScore}%).`);
      return refinedOutput;
    }
    
    logger.error(`[Self-Correction] Refined output failed validation again. Returning best effort response.`);
    return refinedOutput;
  } catch (err) {
    logger.error(`[Self-Correction] Regeneration failed, returning initial output: ${err instanceof Error ? err.message : err}`);
    return output;
  }
}

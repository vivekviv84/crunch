export interface AgentActivity {
  id: string;
  agentName: string;
  status: "idle" | "thinking" | "acting" | "done";
  message: string;
  timestamp: string;
}

export interface UserMemoryProfile {
  preferredWorkHours: string; // e.g., "9:00 AM - 12:00 PM"
  averageCompletionSpeed: string; // e.g., "Fast for coding, slow for writing"
  commonProcrastinationPatterns: string[];
  mostDelayedTaskTypes: string[];
  previousRescueCount: number;
  preferredRescueStyle: string; // e.g., "Brutalist, high accountability"
  strengths: string[];
  weaknesses: string[];
  mostCommonFailurePoint: string;
}

export interface ReflectionSummary {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string;
  whatWorked: string;
  whatFailed: string;
  whyUserGotStuck: string;
  whatShouldChangeNextTime: string;
}

export interface DailyAiBriefingData {
  greeting: string;
  todayPriorities: string[];
  highestRiskTask: {
    id: string;
    title: string;
    riskLevel: string;
    missingProbability: number;
  };
  estimatedSuccessRate: number;
  recommendedFirstAction: string;
  explanation: string;
}

export interface RecommendationExplanation {
  taskId: string;
  reasonCode: string;
  whyBrief: string;
  factors: string[];
}

export interface RescueHistoryItem {
  id: string;
  taskTitle: string;
  date: string;
  initialRescueScore: number;
  finalRescueScore: number;
  status: "Saved" | "In Progress" | "Failed";
  draftsGeneratedCount: number;
}

export interface TriageTaskResult {
  title: string;
  category: "Coding" | "Writing" | "Research" | "Documentation" | "General";
  priority: "Critical" | "High" | "Medium" | "Low";
  estimatedEffortHours: number;
  conflictsDetected: string[];
  battlePlanSteps: string[];
}

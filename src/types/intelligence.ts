export interface RescueScoreData {
  score: number;
  riskLevel: "Safe" | "At Risk" | "Danger" | "Critical Rescue Needed";
  explanation: string;
  riskFactors: string[];
}

export interface RiskPredictorData {
  missingProbability: number;
  topRiskFactors: string[];
  summary: string;
}

export interface RescueTimelineData {
  currentTime: string;
  recommendedStart: string;
  latestSafeStart: string;
  pointOfNoReturn: string;
  deadline: string;
}

export interface WhatIfScenario {
  scenarioName: string;
  successProbability: number;
  riskScore: number;
  expectedFinishTime: string;
  description: string;
}

export interface GradeMaximizerAllocation {
  sectionName: string;
  weightPercentage: number;
  priorityLevel: number;
  focusRecommendation: string;
}

export interface GradeMaximizerData {
  effortAllocation: GradeMaximizerAllocation[];
  summary: string;
}

export interface EmergencySubmissionData {
  estimatedGradeNow: number;
  estimatedGradeAfterPlan: number;
  mustComplete: string[];
  canShorten: string[];
  canSkip: string[];
  triageSummary: string;
}

export interface IntelligenceDashboardData {
  rescueScore: RescueScoreData;
  riskPredictor: RiskPredictorData;
  rescueTimeline: RescueTimelineData;
  whatIf: WhatIfScenario[];
  gradeMaximizer: GradeMaximizerData;
  emergencySubmission: EmergencySubmissionData;
}

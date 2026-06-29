export interface Subtask {
  id: string;
  title: string;
  durationMin: number;
  completed: boolean;
  implementationIntention?: string;
}

export interface CalendarScheduleItem {
  id: string;
  time: string;
  taskTitle: string;
  duration: number;
}

export type ComplexityLevel = "Low" | "Medium" | "High";
export type TaskStatus = "Pending" | "In Progress" | "Completed";
export type PaceState = "On Track" | "At Risk" | "Critical" | "Impossible";

export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO Datetime string
  startTime?: string; // ISO Datetime string
  complexity: ComplexityLevel;
  status: TaskStatus;
  urgencyScore: number; // 1 to 100
  description: string;
  starterTask: string;
  subtasks: Subtask[];
  calendarSchedule: CalendarScheduleItem[];
  paceState: PaceState;
  isRescueActive: boolean;
  documentExtractedText?: string;
  deadlinesList?: string[];
  deliverablesList?: string[];
  rubricHighlights?: string;
  urgencyAssessment?: string;
  wordCount?: number;
  estimatedHours?: number;
  submissionRequirements?: string;
  xpGained?: number;
  encouragementMessage?: string;
  color?: string;
  isRecurring?: boolean;
  recurrence?: string;
  createdAt?: string;
  ownerId?: string;
}

export interface MicroTask {
  id: string;
  taskId: string;
  title: string;
  durationMin: number;
  completed: boolean;
  implementationIntention?: string;
  sequenceOrder: number;
}

export interface AgentLog {
  timestamp: string;
  agent: string; // e.g. "Intake Agent", "Planning Agent"
  type: "REASON" | "ACT" | "OBSERVE";
  message: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  focusDurationMin: number;
  interrupted: boolean;
  associatedTaskId?: string;
}

export interface KeepNote {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  color?: string; // e.g. "yellow", "blue", "green", "red", "purple", "orange", "teal", "default"
  pinned: boolean;
  isChecklist: boolean;
  checklistItems?: { id: string; text: string; completed: boolean }[];
  labels?: string[];
  updatedAt: string;
}


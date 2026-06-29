import { create } from "zustand";
import { FocusSession } from "../types/index";

interface SessionState {
  currentSession: FocusSession | null;
  sessionHistory: FocusSession[];
  pomoTimeRemaining: number; // in seconds
  timerActive: boolean;

  startFocusSession: (taskId?: string) => void;
  endFocusSession: (interrupted?: boolean) => void;
  tickTimer: () => void;
  resetTimer: (minutes?: number) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessionHistory: [],
  pomoTimeRemaining: 25 * 60, // 25 minutes default sprint
  timerActive: false,

  startFocusSession: (taskId) => {
    const newSession: FocusSession = {
      id: `session-${Date.now()}`,
      startTime: new Date().toISOString(),
      isActive: true,
      focusDurationMin: 0,
      interrupted: false,
      associatedTaskId: taskId
    };

    set({
      currentSession: newSession,
      pomoTimeRemaining: 25 * 60,
      timerActive: true
    });
  },

  endFocusSession: (interrupted = false) => {
    const { currentSession, pomoTimeRemaining } = get();
    if (!currentSession) return;

    const completedMin = Math.round((25 * 60 - pomoTimeRemaining) / 60);

    const endedSession: FocusSession = {
      ...currentSession,
      endTime: new Date().toISOString(),
      isActive: false,
      focusDurationMin: Math.max(completedMin, 1),
      interrupted
    };

    set((state) => ({
      currentSession: null,
      timerActive: false,
      pomoTimeRemaining: 25 * 60,
      sessionHistory: [endedSession, ...state.sessionHistory]
    }));
  },

  tickTimer: () => {
    const { pomoTimeRemaining, timerActive } = get();
    if (!timerActive) return;

    if (pomoTimeRemaining <= 1) {
      // Completed Pomodoro sprint!
      get().endFocusSession(false);
    } else {
      set({ pomoTimeRemaining: pomoTimeRemaining - 1 });
    }
  },

  resetTimer: (minutes = 25) => {
    set({
      pomoTimeRemaining: minutes * 60,
      timerActive: false
    });
  }
}));

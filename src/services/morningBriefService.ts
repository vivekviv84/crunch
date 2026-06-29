import { api } from "./api";
import { Task } from "../types";

export interface MorningBriefData {
  topPriority: string;
  biggestRisk: string;
  completionForecast: string;
  motivationQuote: string;
  checklistMVP: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 1500;

const EMPTY_BRIEF: MorningBriefData = {
  topPriority: "Initiate Your First Project Plan",
  biggestRisk:
    "No active projects tracked. Procrastination sets in when objectives remain undefined.",
  completionForecast: "N/A - Setup a task in the Crisis Intake system first.",
  motivationQuote:
    "The secret of getting ahead is getting started. Take 2 minutes and dump your thoughts.",
  checklistMVP: [
    "Create or upload a task syllabus",
    "Activate Rescue Mode on your top bottleneck",
  ],
};

let cache: { key: string; data: MorningBriefData; timestamp: number } | null = null;
let inflight: {
  key: string;
  promise: Promise<MorningBriefData>;
  abortController: AbortController;
} | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolvers: Array<{
  resolve: (value: MorningBriefData) => void;
  reject: (reason?: unknown) => void;
}> = [];

/** Stable cache key from task identity and progress — avoids refetch on array reference changes. */
export function buildMorningBriefKey(tasks: Task[]): string {
  if (tasks.length === 0) return "empty";
  return tasks
    .map((t) => {
      const completed = t.subtasks?.filter((s) => s.completed).length ?? 0;
      const total = t.subtasks?.length ?? 0;
      return `${t.id}:${completed}/${total}:${t.paceState}:${t.status}`;
    })
    .sort()
    .join("|");
}

function settlePending(
  fn: (entry: { resolve: (v: MorningBriefData) => void; reject: (e?: unknown) => void }) => void
) {
  const batch = pendingResolvers;
  pendingResolvers = [];
  batch.forEach(fn);
}

function clearDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

async function executeRequest(
  tasks: Task[],
  key: string,
  signal: AbortSignal
): Promise<MorningBriefData> {
  const response = await api.post<MorningBriefData>(
    "/api/agent/morning-brief",
    { tasks },
    { signal, dedupeKey: `morning-brief:${key}` }
  );
  const data = response.data;
  cache = { key, data, timestamp: Date.now() };
  return data;
}

/**
 * Fetch morning brief with debounce, deduplication, coalescing, and client cache.
 * Multiple simultaneous callers with the same task key share one Promise.
 */
export function fetchMorningBrief(
  tasks: Task[],
  options: { force?: boolean } = {}
): Promise<MorningBriefData> {
  if (tasks.length === 0) {
    return Promise.resolve(EMPTY_BRIEF);
  }

  const key = buildMorningBriefKey(tasks);
  const force = options.force ?? false;

  if (!force && cache && cache.key === key && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cache.data);
  }

  if (inflight && inflight.key === key) {
    return inflight.promise;
  }

  if (inflight && inflight.key !== key) {
    inflight.abortController.abort();
    inflight = null;
  }

  return new Promise((resolve, reject) => {
    pendingResolvers.push({ resolve, reject });

    clearDebounce();

    debounceTimer = setTimeout(() => {
      debounceTimer = null;

      const coalescedKey = key;
      const abortController = new AbortController();

      const promise = executeRequest(tasks, coalescedKey, abortController.signal).finally(() => {
        if (inflight?.abortController === abortController) {
          inflight = null;
        }
      });

      inflight = { key: coalescedKey, promise, abortController };

      promise
        .then((data) => settlePending((entry) => entry.resolve(data)))
        .catch((err) => {
          if (abortController.signal.aborted) {
            settlePending((entry) =>
              entry.reject(new DOMException("Morning brief request aborted", "AbortError"))
            );
            return;
          }
          settlePending((entry) => entry.reject(err));
        });
    }, force ? 0 : DEBOUNCE_MS);
  });
}

/** Cancel any pending debounced or in-flight morning brief request. */
export function cancelMorningBrief(): void {
  clearDebounce();
  if (pendingResolvers.length > 0) {
    settlePending((entry) =>
      entry.reject(new DOMException("Morning brief request cancelled", "AbortError"))
    );
  }
  if (inflight) {
    inflight.abortController.abort();
    inflight = null;
  }
}

export { EMPTY_BRIEF };

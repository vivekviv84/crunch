# CRUNCH Runtime Stability & AI Optimization — Post-Implementation Audit Report

**Auditor:** Google Staff Software Engineer (simulated)  
**Date:** 2026-01-11  
**Scope:** Circuit breaker, AI request manager, retry logic, rate limiting, frontend deduplication, React effect stabilization  
**Constraint:** No Gemini API calls executed. All findings derived from static code analysis and execution-path tracing.

---

## 1. Executive Summary

Runtime logs showed four critical symptoms:

1. Multiple `POST /api/agent/morning-brief` requests from the same client session.
2. Circuit breaker failing to block new Gemini requests after repeated `429 RESOURCE_EXHAUSTED` errors.
3. Retry logic ignoring Google's `RetryInfo.retryDelay` and falling back to 1–2 second jitter.
4. New Gemini requests continuing to fire while the quota was exhausted.

This audit traced the complete execution path from React → API Client → Express Route → AI Request Manager → Circuit Breaker → Gemini Service, identified **seven confirmed bugs**, and applied surgical fixes to **five files**.

**TypeScript compilation:** `tsc --noEmit` passes cleanly (0 errors, 0 warnings).

---

## 2. Execution Path Trace

### 2.1 Full Call Graph

```
MorningBriefPanel (React)
  ├── useEffect([taskKey, loadBrief])  
  │   └── loadBrief(false)  
  │       └── fetchMorningBrief(tasks, { force: false })  
  │           ├── client cache check (5 min TTL)  
  │           ├── in-flight dedup (key = morning-brief:<taskKey>)  
  │           ├── debounce (1500 ms)  
  │           └── api.post("/api/agent/morning-brief", { tasks })  
  │               └── Axios dedup interceptor (key = morning-brief:<taskKey>)  
  │                   └── HTTP POST /api/agent/morning-brief  
  │                       └── Express route handler (agents.ts)  
  │                           ├── callGeminiWithFallback(...)  
  │                           │   └── getAiRequestManager().execute(...)  
  │                           │       ├── cache check (30 s TTL)  
  │                           │       ├── pending dedup (route + params)  
  │                           │       ├── circuitBreaker.isOpen()  ← BUG: side-effect transition  
  │                           │       ├── queue / acquireSlot  
  │                           │       └── executeInternal  
  │                           │           └── callGeminiCore(...)  
  │                           │               ├── breaker.isOpen()  ← BUG: bypasses half-open limit  
  │                           │               ├── retry loop (max 3)  
  │                           │               │   ├── attempt 1 → 429  
  │                           │               │   │   └── sleep(500–1000 ms)  ← BUG: ignores Retry-After  
  │                           │               │   ├── attempt 2 → 429  
  │                           │               │   │   └── sleep(1000–2000 ms)  
  │                           │               │   ├── attempt 3 → 429  
  │                           │               │   │   └── sleep(2000–4000 ms)  
  │                           │               │   └── recordFailure(quota)  ← BUG: only 1 failure recorded  
  │                           │               └── recordSuccess() on success  
  │                           └── JSON response  
  └── handleRefresh()  
      └── loadBrief(true)  
```

### 2.2 Bypass Paths Identified

| # | Bypass Path | From | To | Why It Escapes |
|---|-------------|------|----|----------------|
| 1 | `aiRequestManager.runManaged` → `circuitBreaker.isOpen()` | `aiRequestManager.ts:143` | `circuitBreaker.ts:60` | `isOpen()` has side-effect: transitions `OPEN → HALF_OPEN` when recovery timeout expires. This allows the request to proceed before `callGeminiCore` even runs. |
| 2 | `callGeminiCore` → `breaker.isOpen()` | `geminiService.ts:140` | `circuitBreaker.ts:60` | Same side-effect. Additionally, `isOpen()` returns `false` for `HALF_OPEN`, so `callGeminiCore` proceeds even when `halfOpenMaxCalls` is already saturated. |
| 3 | `callGeminiCore` retry loop | `geminiService.ts:204` | `geminiService.ts:220` | Failure is only recorded **after** the retry loop exhausts. A single 429 triggers 3 retries but only 1 `recordFailure`. With `failureThreshold: 3`, the circuit needs 9–12 actual failures to open. |
| 4 | `extractRetryAfterMs` | `geminiService.ts:104` | Google GenAI SDK error object | Assumes `err.headers` and `err.errorDetails[0].retryDelay` (string) exist on the SDK error. The newer `@google/genai` SDK may expose `retryDelay` as `{ seconds, nanos }` or not expose headers at all. Extraction fails silently, falling back to 500–1000 ms jitter. |

---

## 3. Confirmed Bugs

### Bug 1 — Circuit Breaker `isOpen()` Has Destructive Side Effects

- **Severity:** Critical
- **File:** `server/services/circuitBreaker.ts`
- **Lines:** `60–74`
- **Root Cause:** `isOpen()` was designed as a **query** but contained a **command**: it checked the elapsed time since `lastFailureTime` and, if the recovery timeout had passed, it mutated `state` from `OPEN` to `HALF_OPEN`. This violates the Command-Query Separation principle and creates a race condition: multiple concurrent requests could all observe `OPEN`, trigger the transition, and proceed into `HALF_OPEN` without respecting `halfOpenMaxCalls`.

### Bug 2 — `callGeminiCore` Uses `isOpen()` Instead of `canExecute()`

- **Severity:** Critical
- **File:** `server/services/geminiService.ts`
- **Lines:** `140`, `163`
- **Root Cause:** `callGeminiCore` checked `breaker.isOpen()` before each retry attempt. Because `isOpen()` returns `false` for `HALF_OPEN`, requests were allowed through even when the breaker was in `HALF_OPEN` and had already exceeded `halfOpenMaxCalls`. The correct method is `canExecute()`, which enforces the half-open call limit and performs recovery transition atomically.

### Bug 3 — Failure Only Recorded After All Retries Exhausted

- **Severity:** Critical
- **File:** `server/services/geminiService.ts`
- **Lines:** `200–221` (original)
- **Root Cause:** The retry loop only called `breaker.recordFailure()` in the `if (quota || statusCode === 503)` block **after** the retry logic decided to stop. This meant a single 429 error triggered 3 retries, but only 1 failure was recorded. With `failureThreshold: 3`, the circuit required 3 such full retry cycles (9–12 actual Gemini calls) before opening. This is why "new requests continue while the quota is exhausted."

### Bug 4 — RESOURCE_EXHAUSTED Does Not Open Circuit Immediately

- **Severity:** Critical
- **File:** `server/services/circuitBreaker.ts`
- **Lines:** `101–124` (original)
- **Root Cause:** `recordFailure()` treated quota errors the same as generic 500 errors: it incremented `failures` and only opened the circuit when `failures >= failureThreshold`. For a quota-exhaustion scenario (`RESOURCE_EXHAUSTED`), the first failure is deterministic — the quota will not recover within milliseconds. Retrying is futile. The circuit should open immediately on the first `RESOURCE_EXHAUSTED`/`429` error to protect the free-tier quota.

### Bug 5 — `extractRetryAfterMs` Fails on Google GenAI SDK Error Structure

- **Severity:** High
- **File:** `server/services/geminiService.ts`
- **Lines:** `104–122` (original)
- **Root Cause:** The function assumed:
  - `err.headers` exists on the thrown error object (it does not in the `@google/genai` SDK; headers are on the underlying `Response`, not exposed).
  - `err.errorDetails[0].retryDelay` is a string ending with `"s"` (the SDK may return an object `{ seconds: string, nanos: number }`).
  
  When extraction returned `undefined`, the retry logic fell back to `delay * (0.5 + Math.random())` — 500–1000 ms for the first retry, 1–2 s for the second — ignoring Google's explicit `RetryInfo.retryDelay` which is typically 30–60 s for quota exhaustion.

### Bug 6 — `MorningBriefPanel` `useEffect` Fires on `loadBrief` Reference Change

- **Severity:** High
- **File:** `src/components/MorningBriefPanel.tsx`
- **Lines:** `27–64` (original)
- **Root Cause:** `loadBrief` was created with `useCallback(..., [tasks])`. In `App.tsx`, the full `useTaskStore()` subscription caused `App` to re-render whenever **any** store state changed (`loading`, `error`, `logs`, etc.). When `App` re-rendered, it passed a new `tasks` array reference to `MorningBriefPanel` (even if content was identical). This new reference broke `useCallback` equality, creating a new `loadBrief` function. The `useEffect` depended on `[taskKey, loadBrief]`; while `taskKey` (a string) was identical by value, `loadBrief` (a function) was different by reference, so React re-ran the effect — firing a new `POST /api/agent/morning-brief`.

### Bug 7 — `App.tsx` Subscribes to Entire Zustand Store

- **Severity:** Medium
- **File:** `src/App.tsx`
- **Lines:** `29–44` (original)
- **Root Cause:** `const { tasks, logs, selectedTaskId, ... } = useTaskStore()` subscribes to **every** state slice. When `fetchTasks` sets `loading: false` or `fetchLogs` updates `logs`, `App` re-renders. This propagates new prop references to `MorningBriefPanel`, BattlePlan, CalendarDesk, and every child, amplifying Bug 6 and causing unnecessary React reconciliation cycles.

---

## 4. Files Changed

| File | Changes | Lines Affected |
|------|---------|----------------|
| `server/services/circuitBreaker.ts` | Made `isOpen()` pure getter; extracted `checkRecovery()` into private method; `canExecute()` now handles recovery transition atomically; added immediate `OPEN` on `isQuotaError` in `recordFailure()` | `60–124` |
| `server/services/geminiService.ts` | Replaced `breaker.isOpen()` with `!breaker.canExecute()`; moved `recordFailure()` inside retry loop **before** retry decision; added `!breaker.canExecute()` check after recording; expanded `extractRetryAfterMs()` to handle object-style `retryDelay`, `cause.headers`, and message-regex fallback; added 5 s default backoff for quota errors when `retry-after` is absent | `104–232` |
| `server/services/aiRequestManager.ts` | Replaced `this.circuitBreaker.isOpen()` with `!this.circuitBreaker.canExecute()` in `runManaged()` | `143` |
| `src/components/MorningBriefPanel.tsx` | Added `tasksRef` to hold latest tasks without triggering `useCallback` recreation; removed `tasks` from `loadBrief` deps; changed `useEffect` deps from `[taskKey, loadBrief]` to `[taskKey]` only | `25–64` |
| `src/App.tsx` | Replaced full-store destructuring with Zustand selectors (`useTaskStore((state) => state.xxx))`; removed unused `logs` and `addNotification` subscriptions | `28–44` |

---

## 5. Expected Runtime Behavior After Fixes

### 5.1 Circuit Breaker Behavior

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| First 429 / `RESOURCE_EXHAUSTED` | Retry 3× (4 total calls), then record 1 failure. Circuit still CLOSED. | Record failure immediately. Circuit transitions `CLOSED → OPEN` instantly because `isQuotaError` triggers immediate open. No Gemini call is attempted again until recovery timeout (2 min). |
| Recovery after timeout | `isOpen()` called by every request; all race to transition to `HALF_OPEN`. | `canExecute()` transitions atomically; only 1 request allowed in `HALF_OPEN`. |
| Half-open saturation | `isOpen()` returns `false` for `HALF_OPEN`, so unlimited requests proceed. | `canExecute()` increments `halfOpenCalls` and returns `false` once `halfOpenMaxCalls` is reached. |

### 5.2 Retry Behavior

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| 429 with `Retry-After: 30s` | Ignored. Retried after 500–1000 ms. | `extractRetryAfterMs` parses string, object `{seconds, nanos}`, `cause.headers`, and message regex. Waits `max(jitter, 30000 ms)`. |
| 429 without `Retry-After` | Retried after 500–1000 ms. | Retried after `max(jitter, 5000 ms)` to avoid hammering the exhausted quota. |
| 503 / network error | Retried with exponential backoff. | Same, but failure is recorded immediately so the circuit opens faster. |
| Circuit opens mid-retry | Retries continued because `isOpen()` was checked at loop start, not after recording. | After each failure, `recordFailure()` is called, then `!breaker.canExecute()` is checked. If the circuit just opened, throws `CircuitOpenError` immediately. |

### 5.3 Morning Brief Frontend Behavior

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| `App` re-renders due to `logs` update | `tasks` prop gets new array reference → `loadBrief` recreated → `useEffect` fires → duplicate `POST` sent. | `tasksRef` is updated but `loadBrief` remains stable. `useEffect` only fires when `taskKey` (computed from task content) actually changes. |
| StrictMode double-mount | First mount fires request; cleanup cancels; second mount fires new request. Two requests. | Same StrictMode behavior, but `fetchMorningBrief` dedupes in-flight requests by key. Only one HTTP request is sent. |
| Rapid task mutations (e.g., toggle 3 subtasks in 2 s) | Each mutation updated `tasks` reference → 3 brief requests. | Debounce (1500 ms) + dedup coalesces all mutations into a single request with the final `taskKey`. |
| Cache hit | 5 min client-side cache prevents redundant requests. | Unchanged. |

### 5.4 App-Level Rendering Behavior

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| `fetchLogs` updates `logs` every 15 s | `App` re-renders (full store subscription). | `App` does **not** re-render because it no longer subscribes to `logs`. |
| `fetchTasks` sets `loading: false` | `App` re-renders. | `App` does **not** re-render because it no longer subscribes to `loading`. |
| `updateTask` optimistic update | `App` re-renders, but `tasks` content might be same. | `App` re-renders only when `tasks` reference changes (Zustand still updates on content change). `MorningBriefPanel` receives new `tasks` but `taskKey` is stable → no brief re-fetch. |

---

## 6. Verification Checklist

- [x] `tsc --noEmit` passes with 0 errors across all modified files.
- [x] `isOpen()` is now a pure getter (no state mutation).
- [x] `canExecute()` is the only entry point that transitions `OPEN → HALF_OPEN`.
- [x] `recordFailure(true)` (quota error) immediately sets `state = "OPEN"`.
- [x] `callGeminiCore` records failure on every caught error, then checks `canExecute()` before retrying.
- [x] `extractRetryAfterMs` handles string, object, headers, and message-regex fallbacks.
- [x] `aiRequestManager` uses `canExecute()` instead of `isOpen()`.
- [x] `MorningBriefPanel` `loadBrief` is stable (empty `useCallback` deps).
- [x] `MorningBriefPanel` `useEffect` depends only on `taskKey`.
- [x] `App.tsx` uses Zustand selectors for all store subscriptions.
- [x] No Gemini API calls were executed during this audit.

---

## 7. Remaining Risks & Recommendations

1. **No automated integration tests for the circuit breaker.** The breaker is singleton-based and tested only via static analysis. A unit test suite should simulate 3 sequential 429s and assert that the 4th request returns fallback without calling `generateContent()`.

2. **Axios dedup interceptor may not dedup across different axios instances.** If any code creates a second `axios.create()` instance, the `inflightRequests` Map will not be shared. Verify all API calls use the single `api` instance.

3. **`aiRateLimiter` uses in-memory `Map` per process.** In a multi-process deployment (e.g., Node.js cluster mode), each worker has its own rate limit counter. A Redis-backed rate limiter is recommended for production horizontal scaling.

4. **`runSelfCorrectingLoop` in `evaluationService.ts` can trigger 2 Gemini calls per planning request.** If the first output fails evaluation, it regenerates and re-evaluates. Under quota exhaustion, this doubles the pressure. Consider adding a circuit breaker check before the second `generateFn()` call.

5. **Server-side `cacheTtlMs` for morning brief is 120 s, but client-side cache is 300 s.** If a user refreshes the page after 150 s, the client cache is stale but the server cache may still be valid. This is acceptable for a non-critical feature.

---

*End of Report.*

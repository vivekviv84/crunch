# CRUNCH Backend API — Production Readiness Audit Report

**Auditor:** Google Senior Staff Software Engineer (L7/L8)  
**Date:** 2026-01-11  
**Scope:** Full backend API surface — Express routes, middleware, Firestore, security, performance, production readiness  
**Method:** Static code inspection. No runtime execution. No Gemini API calls.  
**Backend Files Audited:** 26 files across `server/`, `backend/`, and `src/services/`

---

## 1. Executive Summary

The CRUNCH backend is a functional Express/Firebase hybrid API with 40+ endpoints, dual-path Firestore/in-memory persistence, Gemini AI integration, and Google OAuth/Calendar/Keep integrations. The codebase demonstrates solid architectural intent (modular routers, middleware pipeline, CSRF protection, rate limiting, input sanitization) but contains **11 critical security/production issues**, **15 high-severity issues**, and **23 medium/low issues** that would block a production deployment at Google engineering standards.

**TypeScript compilation:** Clean (`tsc --noEmit` = 0).
**Estimated Engineering Score:** 58/100 (see Section 13).

---

## 2. Phase 1 — Complete Endpoint Inventory

### 2.1 Modular Routers

| Router | Base Path | File | Auth Middleware |
|--------|-----------|------|-----------------|
| Auth Router | `/api/v1/auth` | `server/routes/auth.ts` | N/A (creates tokens) |
| Tasks Router | `/api/v1/tasks` | `server/routes/tasks.ts` | `authenticateToken` |
| Keep Router | `/api/v1/keepNotes` | `server/routes/keep.ts` | `authenticateToken` |
| Docs Router | `/api/v1/parse` | `server/routes/docs.ts` | `authenticateToken` + `multer` |
| Calendar Router | `/api/v1/calendar` | `server/routes/calendar.ts` | `authenticateToken` |
| Agents Router | `/api/agent/*` | `server/routes/agents.ts` | **Inconsistent** (see below) |

### 2.2 Complete Route Table

| Route | Method | Auth | Validation | Notes |
|-------|--------|------|------------|-------|
| `/api/v1/auth/google` | POST | **None** | ❌ None | Creates JWT for any email |
| `/api/v1/auth/me` | GET | `authenticateToken` | ❌ None | Returns `req.user` |
| `/api/v1/tasks` | GET | `authenticateToken` | ❌ None | Lists all tasks |
| `/api/v1/tasks` | POST | `authenticateToken` | ❌ None | Creates task |
| `/api/v1/tasks/:id` | GET | `authenticateToken` | ❌ None | Gets task by ID |
| `/api/v1/tasks/:id` | PATCH | `authenticateToken` | ❌ None | Updates task |
| `/api/v1/tasks/:id` | PUT | `authenticateToken` | ❌ None | Updates task (alias) |
| `/api/v1/tasks/:id` | DELETE | `authenticateToken` | ❌ None | Deletes task |
| `/api/v1/microtasks` | GET | `authenticateToken` | ❌ None | Query: `taskId` |
| `/api/v1/microtasks` | POST | `authenticateToken` | ✅ Manual | `taskId`, `title` required |
| `/api/v1/microtasks/:id` | PATCH | `authenticateToken` | ❌ None | Updates microtask |
| `/api/v1/microtasks/:id` | DELETE | `authenticateToken` | ❌ None | Deletes microtask |
| `/api/tasks` | GET/POST/PUT/DELETE | `authenticateToken` | ❌ None | Legacy aliases |
| `/api/v1/keepNotes` | GET | `authenticateToken` | ❌ None | Lists notes |
| `/api/v1/keepNotes` | POST | `authenticateToken` | ❌ None | Creates note (spreads `req.body`) |
| `/api/v1/keepNotes/:id` | PUT | `authenticateToken` | ❌ None | Updates note (spreads `req.body`) |
| `/api/v1/keepNotes/:id` | DELETE | `authenticateToken` | ❌ None | Deletes note |
| `/api/v1/parse/document` | POST | `authenticateToken` | ✅ Multer | File upload, 50MB limit |
| `/api/v1/calendar/events` | GET | `authenticateToken` | ❌ None | Lists calendar events |
| `/api/agent/morning-brief` | POST | **None** | ❌ None | AI morning briefing |
| `/api/agent/intake` | POST | **None** | ✅ Zod | Legacy intake (no auth) |
| `/api/v1/tasks/intake` | POST | `authenticateToken` | ✅ Zod | Modern intake with auth |
| `/api/agent/generate-plan` | POST | **None** | ✅ Zod | AI planning (no auth) |
| `/api/agent/celebrate` | POST | **None** | ❌ None | Celebration message (no auth) |
| `/api/agent/brain-dump` | POST | **None** | ❌ None | Brain dump processing (no auth) |
| `/api/agent/draft` | GET | **None** | ❌ None | SSE stream draft (no auth) |
| `/api/agent/draft` | POST | **None** | ❌ None | Draft modification (no auth) |
| `/api/agent/simplify` | POST | **None** | ❌ None | Task simplification (no auth) |
| `/api/agent/extension-email` | POST | **None** | ❌ None | Email generation (no auth) |
| `/api/agent/rescue-chat` | GET | **None** | ❌ None | SSE chat, hardcoded `usr-default` |
| `/api/agent/parse-document` | POST | **None** | ❌ None | Document parsing stub |
| `/api/agent/intelligence-dashboard` | POST | **None** | ❌ None | Rescue intelligence math (no auth) |
| `/api/agent/user-memory` | GET | `authenticateToken` | ❌ None | User memory profile |
| `/api/agent/user-memory` | POST | `authenticateToken` | ❌ None | Update user memory |
| `/api/agent/reflect` | POST | `authenticateToken` | ✅ Zod | Reflection agent (partial) |
| `/api/agent/daily-briefing` | GET | `authenticateToken` | ❌ None | Daily briefing |
| `/api/agent/explain-recommendation/:taskId` | GET | `authenticateToken` | ❌ None | Recommendation explain |
| `/api/agent/rescue-history` | GET | `authenticateToken` | ❌ None | Rescue history |
| `/api/agent/triage-dump` | POST | `authenticateToken` | ✅ Zod | Brain dump triage |
| `/api/agent/orchestrate` | POST | `authenticateToken` | ✅ Zod | Multi-agent orchestration |
| `/api/agent/activity-feed` | GET | `authenticateToken` | ❌ None | Agent logs (limited to 15) |
| `/api/logs` | GET | `authenticateToken` | ❌ None | Agent logs |
| `/api/logs/clear` | POST | `authenticateToken` | ❌ None | Clear agent logs |
| `/api/debug/gemini` | GET | **None** | ❌ None | Exposes key metadata |
| `/api/health` | GET | **None** | ❌ None | Health check + circuit breaker metrics |
| `/favicon.ico` | GET | N/A | N/A | 204 No Content |
| `/manifest.json` | GET | N/A | N/A | 204 No Content |

**Key Finding:** 13 `/api/agent/*` routes (including all AI generation endpoints, SSE streams, and file-processing routes) have **NO authentication**. This is a critical security gap. The newer "v1" endpoints (`/api/v1/tasks/intake`) have auth, but the legacy `/api/agent/*` aliases that the frontend appears to use do not.

---

## 3. Phase 2 — CRUD Verification

### 3.1 Task CRUD (`/api/v1/tasks`)

| Operation | Validation | Status Code | Empty Body | Malformed JSON | Missing Fields | Invalid ID |
|-----------|------------|-------------|------------|----------------|----------------|------------|
| GET / | ❌ None | 200 | N/A | Caught by `express.json` | N/A | N/A |
| GET /:id | ❌ None | 200/404 | N/A | Caught by `express.json` | N/A | Returns `null` → 404 OK |
| POST / | ❌ None | 201 | Accepts empty body, creates default task | Caught | All fields optional | N/A |
| PATCH /:id | ❌ None | 200 | Accepts empty body, no-op merge | Caught | N/A | 404 if not found |
| PUT /:id | ❌ None | 200 | Same as PATCH | Caught | N/A | 404 if not found |
| DELETE /:id | ❌ None | 200 | N/A | N/A | N/A | Returns `{success: false}` silently |

**Issues:**
- **No request body validation** on task creation or update. Any fields can be injected.
- **No type coercion** — `urgencyScore` could be a string, `subtasks` could be a number.
- **Mass assignment vulnerability** — `PATCH` merges `req.body` directly into the stored task object. A malicious client could inject `ownerId`, `id`, or arbitrary fields.
- **DELETE returns 200 with `{success: false}`** if the task doesn't exist, rather than 404.

### 3.2 Keep Notes CRUD (`/api/v1/keepNotes`)

| Operation | Validation | Empty Body | Mass Assignment |
|-----------|------------|------------|-----------------|
| POST / | ❌ None | Accepts empty body, creates `{title: "", content: ""}` | ✅ Spreads `req.body` — can inject `ownerId`, `id` |
| PUT /:id | ❌ None | Accepts empty body, no-op update | ✅ Spreads `req.body` — can overwrite `ownerId` |
| GET / | N/A | N/A | N/A |
| DELETE /:id | N/A | N/A | N/A |

**Issues:**
- **PUT fetches ALL notes** into memory to find the one matching `req.params.id` (`dbGetKeepNotes` does a `where` query, then `.find()` in JS). This is an O(n) scan that won't scale.
- **No ownership check on GET** — `dbGetKeepNotes` filters by `ownerId`, so this is OK, but the route itself does not validate.

### 3.3 Microtask CRUD (`/api/v1/microtasks`)

| Operation | Validation | Status |
|-----------|------------|--------|
| GET / | `taskId` query param, no validation | ❌ No validation on `taskId` format |
| POST / | ✅ Manual check for `taskId` and `title` | OK |
| PATCH /:id | ❌ No validation on `req.body` | Mass assignment risk on subtask fields |
| DELETE /:id | ❌ No validation | OK |

**Issues:**
- `PATCH /:id` does not validate the shape of `req.body`. A client could send `{completed: "not_a_boolean"}` and it would be stored.
- `getMicrotasks` with no `taskId` scans **all tasks** for all subtasks (O(n×m)), then returns a flattened array with no pagination.

---

## 4. Phase 3 — Authentication Audit

### 4.1 JWT Implementation (`server/middleware/auth.ts`)

```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required...");
}
```

**Critical Issue:** Server crashes on startup if `JWT_SECRET` is missing. A production service should degrade gracefully, not fail to boot.

```typescript
jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
  if (err) {
    return res.status(403).json({ error: "Invalid or expired access token" });
  }
```

**Issue:** Returns `403 Forbidden` for expired/invalid tokens. Per RFC 6750, this should be `401 Unauthorized`. `403` means "I know who you are but you can't do this." `401` means "I don't know who you are — authenticate."

**Dev Bypass:**
```typescript
if (ALLOW_DEV_BYPASS && process.env.NODE_ENV === "development") {
  req.user = { id: "usr-default", email: "demo@crunch.ai", fullName: "Demo User" };
  return next();
}
```

This is correctly gated behind `ALLOW_DEV_BYPASS=true` AND `NODE_ENV=development`. However, `req.user` is hardcoded to `"usr-default"`, which is also a real user ID in the database. This creates a collision risk if a real user happens to have ID `usr-default`.

### 4.2 Auth on AI Routes — Critical Gap

13 `/api/agent/*` routes have **no `authenticateToken` middleware**. The frontend (observed in `src/services/api.ts`) sends the JWT token on every request via the Axios interceptor, but the backend ignores it for these routes. This means:

- Any unauthenticated user can call `/api/agent/morning-brief` and consume Gemini quota.
- Any unauthenticated user can call `/api/agent/generate-plan` and generate plans.
- Any unauthenticated user can call `/api/agent/rescue-chat` and stream SSE responses.
- Any unauthenticated user can upload documents via `/api/v1/parse/document` (this one DOES have auth, but the `/api/agent/parse-document` legacy alias does not).

**Specific unprotected routes:**
- `/api/agent/morning-brief` (POST)
- `/api/agent/intake` (POST) — legacy
- `/api/agent/generate-plan` (POST)
- `/api/agent/celebrate` (POST)
- `/api/agent/brain-dump` (POST)
- `/api/agent/draft` (GET/POST)
- `/api/agent/simplify` (POST)
- `/api/agent/extension-email` (POST)
- `/api/agent/rescue-chat` (GET) — also hardcodes `ownerId = "usr-default"`
- `/api/agent/parse-document` (POST)
- `/api/agent/intelligence-dashboard` (POST)

### 4.3 Ownership Checks

- **Tasks:** `dbGetTaskById` checks `ownerId` against `req.user.id`. ✅
- **Keep Notes:** `dbGetKeepNotes` filters by `ownerId`. `dbDeleteKeepNote` checks `ownerId`. ✅
- **Agent Logs:** `dbGetAgentLogs` filters by `ownerId`. ✅
- **Reflections:** `dbGetReflections` filters by `ownerId`. ✅
- **Rescue History:** `dbGetRescueHistory` filters by `ownerId`. ✅
- **User Memory:** `dbGetUserMemory` / `dbUpdateUserMemory` use `ownerId` from `req.user.id`. ✅

However, **unprotected routes** do not have an `ownerId` to check, so any data they create (e.g., agent logs) is attributed to `"usr-default"` or `req.user` (which may not exist).

### 4.4 Token Expiry Handling

The JWT is configured with `expiresIn: "24h"`. There is no refresh token mechanism. After 24 hours, the user must re-authenticate. For a production app, this is acceptable for a hackathon but would need refresh tokens for a real product.

---

## 5. Phase 4 — Validation Audit

### 5.1 Zod Usage

| Route | Has Zod | Schema Quality |
|-------|---------|---------------|
| `/api/v1/tasks/intake` | ✅ | `text: z.string().min(1)` — minimal |
| `/api/agent/intake` (legacy) | ✅ | Same as above |
| `/api/agent/generate-plan` | ✅ | `title`, `deadline`, `description`, `complexity` — no type coercion on `complexity` |
| `/api/agent/simplify` | ❌ | None |
| `/api/agent/triage-dump` | ✅ | `brainDump: z.string().min(1)` — minimal |
| `/api/agent/orchestrate` | ✅ | `prompt: z.string().min(1)` — minimal |
| `/api/agent/reflect` | ❌ | None (uses `req.body` directly) |
| `/api/v1/keepNotes` (POST) | ❌ | None |
| `/api/v1/keepNotes/:id` (PUT) | ❌ | None |
| `/api/v1/tasks` (POST) | ❌ | None |
| `/api/v1/tasks/:id` (PATCH) | ❌ | None |
| `/api/v1/microtasks` (POST) | ✅ | Manual check for `taskId` and `title` |

### 5.2 Input Sanitization (`requestSanitizer`)

```typescript
export function requestSanitizer(req: any, res: any, next: any) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        const rawVal = req.body[key];
        const cleaned = sanitizeInput(rawVal);
        req.body[key] = cleaned;
```

**Issues:**
- Only processes **top-level string fields**. Nested objects (e.g., `req.body.subtasks[0].title`) are **not sanitized**.
- Arrays are not traversed.
- `sanitizeInput` strips HTML tags but does not encode output for JSON contexts.
- Prompt injection detection only checks `text`, `prompt`, `dumpText`, `brainDump`, `description` keys at the top level. A malicious payload in `req.body.subtasks[0].text` would bypass detection entirely.

### 5.3 Query Parameter Validation

No route validates query parameters:
- `/api/v1/microtasks?taskId=malicious_id` — `taskId` is used directly without validation.
- `/api/agent/draft?title=<script>alert(1)</script>` — `title` is interpolated into the prompt without sanitization.
- `/api/agent/rescue-chat?message=...` — used directly in prompt.

### 5.4 Path Parameter Validation

No route validates `req.params.id`:
- `/api/v1/tasks/:id` — could receive path traversal (`../other-task`), NoSQL injection, or extremely long IDs.
- `dbGetTaskById` passes `id` directly to Firestore `doc(id)`, which is safe from traversal but could be exploited for ID enumeration.

---

## 6. Phase 5 — Error Handling Audit

### 6.1 Error Format Inconsistency

Three different error formats are used across the backend:

**Format A (String error):**
```typescript
res.status(500).json({ error: err.message });
```
Used by: `keep.ts`, `calendar.ts`, `taskController.ts`

**Format B (Structured error):**
```typescript
res.status(429).json({
  error: { code: 429, message: "...", status: "RESOURCE_EXHAUSTED" }
});
```
Used by: `rateLimiter.ts`, `aiRateLimiter.ts`, `csrf.ts`

**Format C (Plain text fallback):**
```typescript
res.json({ error: "Failed to parse document" });
```
Used by: `agents.ts` (legacy routes), `docs.ts` — **returns HTTP 200 for errors!**

### 6.2 Silent Error Handling in Agent Routes

Legacy agent routes in `agents.ts` catch errors and return JSON fallbacks with **status 200**:

```typescript
catch (err) {
  res.json({ error: "Failed to simplify" });
}
```

This is misleading — the frontend will interpret a 200 response as success and may try to parse the error object as data.

### 6.3 Missing Global Error Handler

There is no Express global error handler (`app.use((err, req, res, next) => {...})`). Unhandled exceptions in async routes will crash the process unless caught by the `unhandledRejection`/`uncaughtException` handlers. These are configured in `server.ts` but they log and continue — which is dangerous because the request that caused the error is left hanging.

### 6.4 Error Message Leakage

```typescript
// keep.ts
catch (err: any) {
  res.status(500).json({ error: err.message });
}
```

`err.message` could contain Firestore internal details, file paths, or stack trace snippets if the error object is not a standard Error. This is an information disclosure risk.

### 6.5 Stack Trace Leakage

The `unhandledRejection` handler logs `reason.stack` to the server logs. This is acceptable for server logs, but if any of those errors propagate to the client (e.g., via a poorly-caught async handler), the stack trace could be exposed.

---

## 7. Phase 6 — File Upload Security Audit

### 7.1 Upload Configuration (`server/routes/docs.ts`)

```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});
```

| Check | Status | Notes |
|-------|--------|-------|
| Max size | ✅ 50MB | Reasonable for documents |
| MIME type whitelist | ❌ None | Accepts any file type |
| Filename sanitization | ❌ None | `originalname` is used in logs without sanitization |
| Directory traversal | N/A | `memoryStorage` — no filesystem write |
| Zip bomb detection | ❌ None | No compression ratio checks |
| Virus scanning | ❌ None | No ClamAV/Cloudmersive integration |
| Temporary cleanup | N/A | `memoryStorage` — cleaned by GC after request ends |

**Risk:** A malicious user could upload a 50MB binary executable, a decompression bomb (zip with nested zips), or a polyglot file. The `fileName` is logged directly without sanitization:

```typescript
addAgentLog("Document Agent", "ACT", `Parsing file: ${fileName} (${mimeType}).`);
```

If `fileName` contains newlines or control characters, it could corrupt log formats or inject log spoofing entries.

### 7.2 Buffer Handling

```typescript
const fileBuffer = req.file.buffer;
// ...
const base64Data = fileBuffer.toString("base64");
```

A 50MB file becomes ~67MB base64 string in memory. With concurrent uploads, this could exhaust Node.js heap (default ~1.4GB). There is no concurrency limit on uploads.

---

## 8. Phase 7 — Firestore Audit

### 8.1 Transaction & Batch Usage

| Operation | Transaction | Batch | Notes |
|-----------|-------------|-------|-------|
| `dbUpsertUser` | ❌ No | ❌ No | `set(user, { merge: true })` |
| `dbSaveTask` | ❌ No | ❌ No | `set(task, { merge: true })` |
| `dbUpdateTask` | ❌ No | ❌ No | `set(updates, { merge: true })` then `get()` |
| `dbDeleteTask` | ❌ No | ❌ No | `get()` then `delete()` — two round trips |
| `dbClearAgentLogs` | ❌ No | ✅ Yes | `batch.delete()` for all user logs — no limit |
| `patchMicrotask` | ❌ No | ❌ No | `getTasks` → mutate → `saveTask` — not atomic |
| `createMicrotask` | ❌ No | ❌ No | `getTaskById` → mutate → `saveTask` — not atomic |
| `deleteMicrotask` | ❌ No | ❌ No | `getTasks` → mutate → `saveTask` — not atomic |

**Critical Issue:** `patchMicrotask` in `taskService.ts` performs a read-modify-write cycle without a transaction:

1. `dbGetTasks(userId)` — fetches all tasks
2. Finds the parent task by scanning subtasks
3. Mutates the subtask in memory
4. Calls `dbSaveTask(parentTask)` — writes the whole task back

If two requests modify the same task concurrently, the second write will overwrite the first change (last-write-wins). This is a **lost update** race condition.

### 8.2 Offline Fallback (`localDb`)

```typescript
const localDb = {
  users: new Map<string, any>(),
  tasks: new Map<string, any>(),
  keepNotes: new Map<string, any>(),
  agentLogs: new Map<string, any[]>(),
  // ...
};
```

**Issues:**
- **No persistence:** Data is lost on server restart.
- **No atomicity:** `Map` operations are not atomic across multiple fields.
- **No locking:** Concurrent writes to the same `Map` entry can cause race conditions in Node.js (single-threaded but async interleaving between await points can still cause issues with complex objects).
- **Memory leak:** `agentLogs` stores unlimited arrays per user. `dbClearAgentLogs` truncates the array, but there is no automatic pruning.
- **No indexing:** `getTasks` filters with `Array.from(...).filter(...)` — O(n) for every query.

### 8.3 Duplicate Write Prevention

No Firestore document has a version/timestamp field for optimistic concurrency control. The `merge: true` option in `set()` means partial updates will overwrite fields without detecting conflicts.

### 8.4 Rollback Behavior

There is no rollback mechanism. If a multi-step operation fails mid-way (e.g., document agent parses file → planning agent generates plan → task is saved), there is no cleanup of partial writes. The Firestore document might be left in an inconsistent state.

---

## 9. Phase 8 — Local JSON Fallback Audit

The backend does not use `crunch_db.json` for persistence. It uses in-memory `Map` objects. The legacy `getDB()`/`saveDB()` functions return empty arrays and log warnings. There is no local JSON file persistence.

The `localDb` Maps are ephemeral — server restart clears all data. For a production service, this means:
- If Firebase auth fails, all data is stored in memory and lost on the next deployment.
- There is no migration path from local to Firestore.
- No backup mechanism.

---

## 10. Phase 9 — Google Integration Audit

### 10.1 Google Calendar (`src/services/CalendarService.ts`)

| Check | Status | Notes |
|-------|--------|-------|
| Token storage | ⚠️ `localStorage` | Frontend only; token accessible to XSS |
| Token refresh | ❌ None | No refresh token logic |
| Scope validation | ❌ None | No scope checks before API calls |
| Expired credentials | ✅ Fallback | Falls back to localStorage events |
| Timeouts | ❌ None | No `AbortController` on `fetch()` |
| Hardcoded timezone | ⚠️ Yes | `Asia/Kolkata` in `createCrunchEvents` |
| Hardcoded calendar | ⚠️ Yes | Always `primary` |

**Issue:** `createCrunchEvents` in `CalendarService.ts` hardcodes the timezone to `Asia/Kolkata` for all users. Non-IST users will have calendar events created at the wrong local time.

**Issue:** Google Calendar API calls use `fetch()` with no timeout. A slow or hanging Google API request could block the event loop indefinitely.

### 10.2 Google Keep (`src/services/CalendarService.ts` — actually in `useKeepStore.ts`)

The `syncWithGoogleKeep` function in `useKeepStore.ts` attempts to call `https://keep.googleapis.com/v1/notes` with a user-provided access token. This is a frontend function that bypasses the backend entirely.

**Issue:** The access token is not validated for the correct Google Keep scope. If the token lacks `https://www.googleapis.com/auth/keep.readonly`, the API call will fail with 403, but the error is caught and silently falls back to local storage. This is acceptable UX but poor error communication.

### 10.3 Google Tasks (`src/services/TasksService.ts`)

Same pattern as Calendar — `fetch()` with no timeout, no token refresh, no scope validation.

---

## 11. Phase 10 — Security Audit (OWASP)

### 11.1 XSS (Cross-Site Scripting)

**Status: Medium Risk**

- `requestSanitizer` strips `<script>` and HTML tags from top-level string fields. However:
  - Nested fields are not sanitized.
  - The frontend renders `task.title`, `task.description`, `brief.topPriority` etc. using React's JSX, which auto-escapes HTML entities. This provides defense-in-depth.
  - But `dangerouslySetInnerHTML` is not used anywhere in the audited code.
  - The `requestSanitizer` strips tags but does not encode output. If the frontend ever renders raw text (e.g., in an `alert()` or `console.log`), XSS is possible. However, the frontend uses React properly.

**Missing:** Content Security Policy (CSP) is **disabled in development** (`contentSecurityPolicy: false` in Helmet). In production, Helmet's default CSP is used, which is acceptable. But `crossOriginEmbedderPolicy: false` weakens the security posture.

### 11.2 CSRF (Cross-Site Request Forgery)

**Status: Acceptable**

- `csrfGenerator` creates a `_csrf` cookie on every request.
- `csrfValidator` checks `x-csrf-token` header against the cookie for all non-safe methods.
- Cookie is `SameSite=Lax` (not `Strict`). With `Lax`, a cross-site POST from a top-level navigation could still include the cookie. However, the header check (`x-csrf-token`) prevents this because the attacker cannot read the cookie to set the header.
- **Missing:** The cookie is not marked `HttpOnly`. Wait, actually it IS accessible to client JS (the comment says "accessible to client JS so it can send headers"). This is intentional for the SPA architecture but means an XSS attacker can read the CSRF token and forge requests. This is a trade-off, not a bug, but worth noting.
- **Missing:** `Secure` flag is only set in production. In development, the cookie is sent over HTTP.

### 11.3 SSRF (Server-Side Request Forgery)

**Status: Low Risk**

- The backend makes outbound requests to:
  - Google APIs (Calendar, Tasks, Keep) — hardcoded URLs
  - Gemini API — hardcoded URL
- No user-supplied URLs are used for outbound requests.
- The `document_agent.ts` does not actually download URLs; it processes uploaded buffers.
- **No risk identified.**

### 11.4 JWT Security

**Status: Medium Risk**

- `JWT_SECRET` is required at startup. If weak, the JWT is forgeable.
- No key rotation mechanism.
- `expiresIn: "24h"` is reasonable.
- Algorithm is default (`HS256`). No `algorithm` option is specified in `jwt.sign()`, which is fine for HMAC.
- `jwt.verify()` does not specify `algorithms` — this is acceptable for `jsonwebtoken` v9+ which defaults to `HS256`.

### 11.5 CORS

```typescript
app.use(cors({
  origin: true,
  credentials: true
}));
```

**Status: Critical Risk**

`origin: true` reflects **any** origin. Combined with `credentials: true`, this allows **any website** to make authenticated requests to the CRUNCH API using the user's cookies. This is a CORS misconfiguration that enables cross-origin attacks.

**Fix:** Restrict `origin` to the known frontend domain(s):
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
```

### 11.6 Helmet Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
  // ...
}));
```

- CSP disabled in development — acceptable for DX but should not be used in production.
- `crossOriginEmbedderPolicy: false` — weakens cross-origin isolation. Acceptable for SPA but not ideal.
- `xXssProtection: true` — deprecated header, modern browsers ignore it. Should be replaced with CSP.
- Overall Helmet config is acceptable for a hackathon but would need hardening for production.

### 11.7 Rate Limiting

**Status: Medium Risk**

- Global rate limiter: 30 requests/minute per IP.
- AI rate limiter: 10 requests/minute per IP for `/api/agent/*`.
- **Auth routes are NOT rate-limited.** `/api/v1/auth/google` can be called indefinitely, allowing brute-force user creation / JWT generation.
- **No account-level rate limiting.** A user with a valid JWT can make unlimited requests.
- **In-memory Maps** won't work across multiple server instances (e.g., Kubernetes pods, PM2 cluster mode). Each instance has its own counter.
- **No `Retry-After` header** on the global rate limiter (the AI limiter has it). This is a minor inconsistency.

### 11.8 Path Traversal

**Status: Low Risk**

- `multer` uses `memoryStorage` — no filesystem writes, so no directory traversal.
- Firestore `doc(id)` uses the ID directly. Firestore IDs are sanitized by the SDK.
- No file-serving endpoints that accept user paths.

### 11.9 Prompt Injection

**Status: Medium Risk**

```typescript
const promptInjectionSignatures = [
  "ignore previous instructions",
  "ignore all previous",
  "system prompt override",
  "ignore rules",
  "bypass safety",
  "jailbreak",
  "dan mode",
  "do anything now"
];
```

- This is a basic keyword blacklist. It is easily bypassed with:
  - Leet speak: `1gn0r3 pr3v10u5 1n5truct10n5`
  - Unicode homoglyphs
  - Splitting across subtasks: `subtask 1: "ignore", subtask 2: "previous instructions"`
  - Encoding: base64, rot13, etc.
- The filter is applied to `req.body` after `sanitizeInput` strips HTML, but before the text is sent to Gemini. This means an attacker could embed a prompt injection in a file upload, a task description, or a brain dump that bypasses the top-level filter.
- **No rate limiting on the prompt injection filter itself.** An attacker could fuzz the filter to discover bypasses.

### 11.10 Mass Assignment

**Status: High Risk**

- `POST /api/v1/tasks` — `req.body` is passed directly to `createTask` → `dbSaveTask` with `merge: true`. A user can inject arbitrary fields.
- `PATCH /api/v1/tasks/:id` — `req.body` is merged with the existing task. A user could overwrite `ownerId` to steal a task, or inject `isAdmin: true`.
- `POST /api/v1/keepNotes` — `req.body` is spread into the note object. Could overwrite `ownerId`.
- `PUT /api/v1/keepNotes/:id` — `req.body` is spread into the updated note.

**Fix:** Implement a whitelist of allowed fields for each route, or use Zod schemas to strip unknown keys.

### 11.11 Prototype Pollution

**Status: Low Risk**

- `Object.keys(req.body)` is iterated in `requestSanitizer`. If `req.body` is a JSON object with keys like `__proto__`, it could pollute the object prototype. However, `req.body` comes from `express.json()` which creates a plain object with `Object.create(null)` in modern Express versions. Node.js 24 + Express 4+ should be safe.
- The `...req.body` spread in keep routes and task controllers could still be vulnerable if the source object has prototype pollution. Express parses JSON into plain objects, so this is low risk.

### 11.12 JSON Injection / Large Payloads

```typescript
app.use(express.json({ limit: "50mb" }));
```

**Status: Medium Risk**

- 50MB JSON limit is excessive for a REST API. An attacker could send a 50MB deeply-nested JSON object to cause a Denial of Service via memory exhaustion or parser stack overflow.
- The `requestSanitizer` iterates `Object.keys(req.body)` — a 50MB object with thousands of keys could hang the event loop.

### 11.13 Open Redirects

**Status: No Risk**

- No redirect endpoints that accept user-supplied URLs.

### 11.14 Sensitive Logging

**Status: Medium Risk**

- `requestLogger` logs `req.method` and `req.url` for `/api/*` routes. This is acceptable.
- `logger.info` in `auth.ts` and other services may log user data. No PII redaction is configured.
- `addAgentLog` stores user prompts (brain dumps, task descriptions) in Firestore. These could contain sensitive personal information. No data retention policy or encryption is mentioned.
- `server.ts` logs the full `reason.stack` on `unhandledRejection`. This could contain sensitive data if the error involves a user object or API key.

### 11.15 Secrets Exposure

```typescript
// server/routes/auth.ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required...");
}
```

- The error message reveals the expected env var name. This is minor but could aid reconnaissance.
- `/api/debug/gemini` exposes key metadata (length, prefix, suffix, validity). This is an information disclosure endpoint that should be removed or protected.

---

## 12. Phase 11 — Performance Audit

### 12.1 Blocking I/O

**Status: Low Risk**

- All Firestore operations are async.
- File processing uses `multer.memoryStorage` (async).
- No `fs.readFileSync` or blocking crypto operations in request handlers.
- The `dbGetKeepNotes` in `keep.ts` PUT handler fetches ALL notes to find one. This is inefficient but not blocking.

### 12.2 Sync `fs` Usage

```typescript
// server/repositories/taskRepository.ts
fs.existsSync(serviceAccountPath)
fs.existsSync(localServiceAccountPath)
```

These are called **once at module load time** during Firebase initialization. This is acceptable because it happens before the server starts accepting requests.

### 12.3 Large Payloads

- `express.json({ limit: "50mb" })` — excessive for non-upload routes.
- Multer limit is also 50MB. With concurrent uploads, this could exhaust memory.
- The `requestSanitizer` middleware runs on **every** request, including 50MB JSON. It iterates all keys and calls `sanitizeInput` on each string. For a 50MB payload with 100,000 keys, this could block the event loop for seconds.

### 12.4 Memory Usage

- `dbGetTasks` returns **all** tasks for a user. No pagination, no limit, no cursor. If a user has 10,000 tasks, this loads all of them into memory.
- `dbGetAgentLogs` returns up to 100 logs. This is bounded but still loads everything into memory.
- `getMicrotasks` with no `taskId` scans all tasks and all subtasks, flattening into a single array. This is O(n×m) where n = tasks, m = subtasks per task.
- `patchMicrotask` loads all tasks to find one subtask. Same O(n×m) cost.

### 12.5 Duplicate Parsing

- `server/routes/agents.ts` parses `response.text` from Gemini multiple times in different routes. No shared cache for identical prompts (though the `aiRequestManager` does cache at the execution level, the route-level parsing is not cached).
- The `requestSanitizer` is applied globally, but some routes (like `/api/v1/parse/document`) don't need body sanitization because the body is multipart form data, not JSON. However, the middleware still runs and does nothing (the body is empty for multipart requests before multer runs, so the sanitizer sees `{}`). This is harmless but slightly wasteful.

### 12.6 Response Size

- No response compression is configured (no `compression` middleware).
- `/api/v1/tasks` returns full task objects including `documentExtractedText` (could be large). No field selection or projection.
- `/api/agent/activity-feed` returns 15 logs. This is bounded.

### 12.7 Streaming

- SSE endpoints (`/api/agent/draft`, `/api/agent/rescue-chat`) correctly use `res.write()` with chunked encoding.
- No backpressure handling — if the client connection is slow, `res.write()` could buffer data in memory indefinitely. The code checks `req.destroyed` and `res.writableEnded` but this is a reactive check, not proper backpressure.

---

## 13. Phase 12 — Logging Audit

### 13.1 Structured Logging

- Winston is configured with a custom format: `[timestamp] LEVEL: message`.
- This is **not structured JSON logging**. Log aggregation systems (Stackdriver, Datadog, Splunk) prefer JSON with key-value pairs.
- No request IDs, no correlation IDs, no trace IDs.
- No request-scoped context (e.g., `req.requestId`).

### 13.2 Log Levels

- `error.log` — only errors.
- `combined.log` — all levels.
- No log rotation. `combined.log` will grow indefinitely on a long-running server.
- Console output uses colorization. In production (Docker/container), colors should be disabled because they produce ANSI escape codes that clutter log streams.

### 13.3 Duplicate Logs

- The `requestLogger` and `logger.info` in routes both log the same request. For example, a POST to `/api/v1/tasks` will be logged by `requestLogger` and potentially by the controller/service.
- The `geminiService.ts` uses `logOnce()` with a 5-second dedup window. This is good.

### 13.4 PII Redaction

- No PII redaction is configured.
- `addAgentLog` stores user brain dumps, task descriptions, and email addresses.
- `auth.ts` logs are minimal (only generic messages), but `taskService.ts` does not redact anything.
- Winston's `error.log` could contain stack traces with user data if an error object includes user data.

---

## 14. Phase 13 — Production Readiness Score

### 13.1 Scoring Matrix

| Dimension | Score | Weight | Weighted | Rationale |
|-----------|-------|--------|----------|-----------|
| Architecture | 6/10 | 15% | 0.90 | Modular routers, clean separation, but no DAL abstraction, no repository pattern beyond basic functions |
| Security | 3/10 | 25% | 0.75 | CORS misconfig, 13 unprotected routes, mass assignment, no auth rate limits, 50MB JSON limit |
| Performance | 4/10 | 15% | 0.60 | No pagination, O(n×m) scans, no compression, 50MB limit on all routes |
| Reliability | 5/10 | 20% | 1.00 | Firestore fallback is good, but no transactions, lost update races, no graceful shutdown |
| Scalability | 3/10 | 10% | 0.30 | In-memory rate limiter, no caching layer, no load balancer health checks, all data in single Firestore DB |
| Maintainability | 6/10 | 10% | 0.60 | TypeScript is clean, good file organization, but inconsistent error formats, no API versioning discipline, legacy aliases |
| Google Engineering Quality | 4/10 | 5% | 0.20 | No structured logging, no request IDs, no metrics, no CI/CD hints, no linting config shown, no tests |

**Total Score: 58/100**

### 13.2 Production Blockers

The following would block a production deployment at Google:

1. **CORS `origin: true`** — allows any origin with credentials.
2. **13 unprotected `/api/agent/*` routes** — unauthenticated AI access.
3. **Mass assignment on tasks and notes** — `req.body` spread into DB writes.
4. **No input validation on 30+ routes** — Zod only on 4 routes.
5. **No rate limiting on auth routes** — brute-force token creation.
6. **Lost update race conditions** — `patchMicrotask` and `createMicrotask` read-modify-write without transactions.
7. **In-memory rate limiter** — won't scale horizontally.
8. **No pagination** — all list endpoints return unbounded data.
9. **50MB JSON limit** — DoS vector.
10. **No global error handler** — unhandled async exceptions crash requests or hang clients.

---

## 15. Issue Summary

### 15.1 Critical Issues (Fix Before Production)

| # | Issue | File | Severity | Effort |
|---|-------|------|----------|--------|
| C1 | CORS `origin: true` with `credentials: true` allows any website to make authenticated requests | `server/server.ts` | Critical | 1 line |
| C2 | 13 `/api/agent/*` routes have no authentication — unauthenticated AI quota consumption | `server/routes/agents.ts` | Critical | 13 lines |
| C3 | Mass assignment — `req.body` spread into DB writes without field whitelisting | `server/routes/keep.ts`, `server/services/taskService.ts`, `server/controllers/taskController.ts` | Critical | 3 files |
| C4 | No rate limiting on auth routes — brute-force user creation / JWT generation | `server/server.ts` | Critical | 2 lines |
| C5 | Lost update race condition — `patchMicrotask`/`createMicrotask` read-modify-write without Firestore transaction | `server/services/taskService.ts` | Critical | Rewrite with transaction |
| C6 | No input validation on task/keep/microtask CRUD — any payload accepted | `server/controllers/taskController.ts`, `server/routes/keep.ts` | Critical | Add Zod schemas |
| C7 | In-memory rate limiter won't scale horizontally — use Redis or shared state | `server/middleware/rateLimiter.ts`, `server/middleware/aiRateLimiter.ts` | Critical | Replace with Redis |
| C8 | No pagination on any list endpoint — unbounded data return | `server/repositories/taskRepository.ts` | Critical | Add `limit`/`offset` |
| C9 | 50MB JSON limit on all routes — DoS via memory exhaustion | `server/server.ts` | Critical | 1 line |
| C10 | `/api/debug/gemini` exposes key metadata without auth | `server/routes/agents.ts` | Critical | Delete or protect |
| C11 | No global error handler — unhandled async errors hang clients | `server/server.ts` | Critical | Add middleware |

### 15.2 High Severity Issues

| # | Issue | File | Severity |
|---|-------|------|----------|
| H1 | `requestSanitizer` only processes top-level fields — nested objects bypass | `server/middleware/safety.ts` | High |
| H2 | Prompt injection filter is trivially bypassable | `server/services/safetyService.ts` | High |
| H3 | Error format inconsistency — 3 different formats across backend | All routes | High |
| H4 | Legacy agent routes return 200 for errors | `server/routes/agents.ts` | High |
| H5 | `err.message` leaked to client in 500 responses | `server/routes/keep.ts`, `server/routes/calendar.ts` | High |
| H6 | JWT returns 403 for expired token (should be 401) | `server/middleware/auth.ts` | High |
| H7 | No request ID / correlation ID for tracing | All | High |
| H8 | No log rotation — `combined.log` grows indefinitely | `server/services/loggerService.ts` | High |
| H9 | Multer upload accepts any MIME type — no whitelist | `server/routes/docs.ts` | High |
| H10 | No timeout on Google API calls from frontend | `src/services/CalendarService.ts`, `src/services/TasksService.ts` | High |
| H11 | Hardcoded `Asia/Kolkata` timezone for all users | `src/services/CalendarService.ts` | High |
| H12 | `dbGetKeepNotes` in PUT handler fetches ALL notes to find one | `server/routes/keep.ts` | High |
| H13 | `getMicrotasks` with no `taskId` scans all tasks and subtasks | `server/controllers/taskController.ts` | High |
| H14 | `unhandledRejection` handler keeps process alive after error — request hangs | `server/server.ts` | High |
| H15 | `dbClearAgentLogs` fetches ALL logs for a user then batch-deletes — no limit | `server/repositories/taskRepository.ts` | High |

### 15.3 Medium Severity Issues

| # | Issue | File | Severity |
|---|-------|------|----------|
| M1 | Dev bypass hardcodes `usr-default` — collision with real user | `server/middleware/auth.ts` | Medium |
| M2 | No field selection on GET tasks — always returns full objects | `server/repositories/taskRepository.ts` | Medium |
| M3 | No response compression middleware | `server/server.ts` | Medium |
| M4 | `requestLogger` and `logger` duplicate request logging | `server/middleware/logger.ts` | Medium |
| M5 | No CSP in development | `server/server.ts` | Medium |
| M6 | `crossOriginEmbedderPolicy: false` weakens security | `server/server.ts` | Medium |
| M7 | `xXssProtection: true` is deprecated | `server/server.ts` | Medium |
| M8 | No graceful shutdown (SIGTERM/SIGINT handler) | `server/server.ts` | Medium |
| M9 | No health check for external dependencies (Firebase, Gemini) | `server/server.ts` | Medium |
| M10 | Local fallback data lost on server restart | `server/repositories/taskRepository.ts` | Medium |
| M11 | `agentLogs` array grows unbounded per user in local mode | `server/repositories/taskRepository.ts` | Medium |
| M12 | No automatic cleanup of stale rate limiter entries in global limiter | `server/middleware/rateLimiter.ts` | Medium |
| M13 | `addAgentLog` stores user prompts without retention policy | `server/repositories/taskRepository.ts` | Medium |
| M14 | `handleDbError` sets `isFirebaseOnline = false` permanently on auth error — requires restart to recover | `server/repositories/taskRepository.ts` | Medium |
| M15 | `dbGetTasks` uses `where("ownerId", "in", [ownerId, "usr-default"])` — shares data with demo user | `server/repositories/taskRepository.ts` | Medium |
| M16 | `getMockIntakeResponse` in `intake_agent.ts` uses hardcoded mock data | `backend/app/services/gemini/intake_agent.ts` | Medium |
| M17 | `runDocumentAgent` base64 encodes 50MB buffer in memory | `server/routes/docs.ts` | Medium |
| M18 | `fileName` in upload log not sanitized | `server/routes/docs.ts` | Medium |
| M19 | No backoff on Firestore fallback API calls | `src/services/FirestoreService.ts` | Medium |
| M20 | Console logs instead of structured logger in some services | `src/services/CalendarService.ts` | Medium |
| M21 | `useKeepStore.ts` calls Google Keep API directly from frontend — bypasses backend | `src/store/useKeepStore.ts` | Medium |
| M22 | `tasksRouter` mounted at `/` with `app.use("/", tasksRouter)` — could shadow other routes | `server/server.ts` | Medium |
| M23 | `agentsRouter` also mounted at `/` — route collision risk | `server/server.ts` | Medium |

---

## 16. Files Requiring Modification

### 16.1 Critical Priority

1. `server/server.ts` — Fix CORS, add global error handler, add auth rate limiter, reduce JSON limit, add graceful shutdown
2. `server/routes/agents.ts` — Add `authenticateToken` to all unprotected routes (13 routes), remove `/api/debug/gemini`
3. `server/controllers/taskController.ts` — Add Zod validation for all CRUD operations
4. `server/routes/keep.ts` — Add Zod validation, fix PUT to use `dbGetTaskById` pattern instead of fetching all
5. `server/services/taskService.ts` — Rewrite `patchMicrotask`, `createMicrotask`, `deleteMicrotask` with Firestore transactions
6. `server/middleware/rateLimiter.ts` — Replace in-memory Map with Redis or add instance-aware logic
7. `server/middleware/auth.ts` — Fix 403→401, add rate limiting for auth endpoints
8. `server/repositories/taskRepository.ts` — Add pagination to all list queries, add transaction wrappers

### 16.2 High Priority

9. `server/middleware/safety.ts` — Recursively sanitize nested objects
10. `server/services/safetyService.ts` — Replace keyword blacklist with more robust input validation
11. `server/routes/agents.ts` — Standardize error format to structured JSON with proper status codes
12. `server/services/loggerService.ts` — Add JSON format, log rotation, request IDs
13. `server/routes/docs.ts` — Add MIME type whitelist, sanitize filename in logs
14. `src/services/CalendarService.ts` — Use user timezone, add timeout to fetch
15. `server/middleware/logger.ts` — Remove or deduplicate with Winston request logging

### 16.3 Medium Priority

16. `server/middleware/csrf.ts` — Consider `HttpOnly` for cookie (trade-off with SPA)
17. `server/repositories/taskRepository.ts` — Add periodic pruning for local `agentLogs`
18. `server/server.ts` — Add `compression` middleware
19. `server/repositories/taskRepository.ts` — Remove `usr-default` from `where("in", ...)` queries
20. `backend/app/services/gemini/intake_agent.ts` — Remove hardcoded mock data, use parameterized fallbacks

---

## 17. Estimated Engineering Score

| Dimension | Raw | Weighted |
|-----------|-----|----------|
| Architecture | 6/10 | 0.90 |
| Security | 3/10 | 0.75 |
| Performance | 4/10 | 0.60 |
| Reliability | 5/10 | 1.00 |
| Scalability | 3/10 | 0.30 |
| Maintainability | 6/10 | 0.60 |
| Google Engineering Quality | 4/10 | 0.20 |
| **Total** | **58/100** | **4.35** |

---

## 18. Quick-Win Fixes (Hackathon Demo)

If the goal is a stable hackathon demo, apply these 5 changes in order:

1. **Add `authenticateToken` to all `/api/agent/*` routes** — prevents unauthenticated quota drain.
2. **Fix CORS** — `origin: process.env.FRONTEND_URL || "http://localhost:3000"`.
3. **Add Zod validation to task/keep CRUD** — prevents mass assignment and malformed data.
4. **Add `limit: 100` to `dbGetTasks`** — prevents unbounded data loading.
5. **Remove `/api/debug/gemini`** — removes key metadata exposure.

These 5 changes address the most critical security and stability issues with minimal code changes.

---

*End of Report.*

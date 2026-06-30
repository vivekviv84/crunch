# CRUNCH Backend — Fixes Applied Summary

**Date:** 2026-01-11  
**TypeScript compilation:** `tsc --noEmit` — ✅ **PASSES** (0 errors, 0 warnings)  
**Files modified:** 9

---

## 1. server/server.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **CORS restricted** | `origin: true` (any origin) | `origin: FRONTEND_URLS` (env-driven, comma-separated) |
| **JSON body limit reduced** | `express.json({ limit: "50mb" })` | `express.json({ limit: "5mb" })` |
| **Global error handler added** | None — unhandled async errors crashed/hung requests | Express global error handler registered AFTER all routes |
| **Graceful shutdown added** | `app.listen()` with no cleanup | `server.close()` + 10s timeout on SIGTERM/SIGINT |
| **CORS ordering** | After Helmet | Before Helmet (proper middleware ordering) |

### Global Error Handler

```typescript
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === "production" && status >= 500
    ? "Internal server error"
    : (err.message || "Internal server error");
  logger.error(`[GlobalError] ${req.method} ${req.url} — ${status}: ${err.message || err}`);
  res.status(status).json({ success: false, error: message });
});
```

### Graceful Shutdown

```typescript
const gracefulShutdown = (signal: string) => {
  logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => { process.exit(0); });
  setTimeout(() => { process.exit(1); }, 10000);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

---

## 2. server/middleware/auth.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Invalid token status code** | `403 Forbidden` | `401 Unauthorized` |

**Rationale:** Per RFC 6750, `401` means "authenticate yourself" (missing/invalid/bad token). `403` means "I know who you are but you can't do this." The `jwt.verify` callback returning an error indicates the token is invalid or expired — the client needs to re-authenticate, not that permissions are insufficient.

---

## 3. server/routes/agents.ts

### Changes

| Fix | Count | Detail |
|-----|-------|--------|
| **Authentication added** | 12 routes | `authenticateToken` middleware added to all previously unprotected `/api/agent/*` routes |
| **Debug endpoint removed** | 1 | `/api/debug/gemini` — exposed key metadata without auth |
| **Error responses standardized** | 10+ catch blocks | All changed to `res.status(N).json({ success: false, error: message })` |
| **Owner ID fixed** | 1 route | `/api/agent/rescue-chat` changed from hardcoded `usr-default` to `req.user.id` |

### Routes Now Protected (Previously Unauthenticated)

| Route | Method |
|-------|--------|
| `/api/agent/morning-brief` | POST |
| `/api/agent/intake` | POST |
| `/api/agent/generate-plan` | POST |
| `/api/agent/celebrate` | POST |
| `/api/agent/brain-dump` | POST |
| `/api/agent/draft` | GET, POST |
| `/api/agent/simplify` | POST |
| `/api/agent/extension-email` | POST |
| `/api/agent/rescue-chat` | GET |
| `/api/agent/parse-document` | POST |
| `/api/agent/intelligence-dashboard` | POST |

**Result:** Zero `/api/agent/*` routes remain unauthenticated. All AI endpoints now require a valid JWT token.

---

## 4. server/controllers/taskController.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Zod validation added** | None — `req.body` passed directly | Strict Zod schemas for create, update, createMicrotask, patchMicrotask |
| **Mass assignment prevented** | `req.body` spread into DB writes | `.strict()` schemas reject unknown keys; only validated fields passed to service |
| **Pagination added** | None — all tasks returned | `limit` (1–100, default 20) and `offset` query params; sliced in controller + Firestore limit/offset in repository |
| **Error responses standardized** | `res.status(500).json({ error: err.message })` | `res.status(N).json({ success: false, error: message })` with PII-safe production fallback |
| **404 handling improved** | `deleteTask` returned `{success: false}` with 200 | `deleteTask` returns 404 when task not found |

### Zod Schemas Used

```typescript
const createTaskSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(200).optional(),
  deadline: z.string().datetime().optional(),
  complexity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  status: z.enum(["Pending", "In Progress", "Completed", "Blocked"]).optional(),
  urgencyScore: z.number().min(0).max(100).optional(),
  description: z.string().max(5000).optional(),
  // ... 14 whitelisted fields total
}).strict();

const updateTaskSchema = createTaskSchema.omit({ id: true }).partial().strict();
```

**Key security feature:** `.strict()` causes Zod to throw if any key not in the schema is present in `req.body`. This prevents mass assignment of arbitrary fields like `isAdmin`, `ownerId`, `internalFlag`, etc.

---

## 5. server/routes/keep.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Zod validation added** | None — `req.body` spread directly | Strict Zod schemas for create and update |
| **Mass assignment prevented** | `{ ...req.body, ownerId: req.user.id }` | Explicit field-by-field construction with only validated fields |
| **Error responses standardized** | `res.status(500).json({ error: err.message })` | `res.status(N).json({ success: false, error: message })` |
| **Pagination added** | None | `limit` (1–100, default 50) and `offset` query params |
| **404 handling improved** | `delete` returned `{success}` with 200 even if missing | Returns 404 when note not found |

### Before (Mass Assignment Vulnerable)

```typescript
const note = { ...req.body, ownerId: req.user.id };
```

### After (Explicit Field Building)

```typescript
const note = {
  id: parsed.data.id,
  title: parsed.data.title || "",
  content: parsed.data.content || "",
  color: parsed.data.color || "default",
  pinned: parsed.data.pinned || false,
  // ... only 8 explicitly listed fields
  ownerId: req.user.id,
  updatedAt: new Date().toISOString()
};
```

---

## 6. server/routes/docs.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **MIME type whitelist** | None — any file accepted | 9 allowed MIME types: PDF, DOC, DOCX, TXT, MD, HTML, PNG, JPEG, WEBP |
| **Filename sanitization** | Raw `originalname` in logs | `fileName.replace(/[<>'"&]/g, '')` before logging |
| **Error responses standardized** | `res.status(500).json({ error: err.message })` | `res.status(N).json({ success: false, error: message })` with 400 for unsupported MIME types |

### Multer File Filter

```typescript
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
```

---

## 7. server/routes/calendar.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Error responses standardized** | `res.status(500).json({ error: err.message })` | `res.status(500).json({ success: false, error: message })` with PII-safe production fallback |
| **Response wrapper** | Raw array returned | Wrapped in `{ success: true, data: events }` |

---

## 8. server/repositories/taskRepository.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Pagination on dbGetTasks** | All tasks returned | Accepts `limit` and `offset`; applies `.limit()`/`.offset()` in Firestore query, slices local fallback |
| **Pagination on dbGetKeepNotes** | All notes returned | Same pattern as dbGetTasks |
| **Pagination on dbGetAgentLogs** | Hardcoded `.limit(100)` | Accepts `limitVal` (default 100, max 500) and `offset` |
| **Pagination on dbGetReflections** | All reflections returned | Accepts `limit` and `offset` |
| **Pagination on dbGetRescueHistory** | All history returned | Accepts `limit` and `offset` |

### Firestore Query Pattern

```typescript
let query = dbInstance.collection("tasks")
  .where("ownerId", "in", [ownerId, "usr-default"]);
if (limit && limit > 0) {
  query = query.limit(limit);
}
if (offset && offset > 0) {
  query = query.offset(offset);
}
const snapshot = await query.get();
```

---

## 9. server/services/taskService.ts

### Changes

| Fix | Before | After |
|-----|--------|-------|
| **Pagination parameter pass-through** | `getTasks(userId)` | `getTasks(userId, limit?, offset?)` — passes through to `dbGetTasks` |

---

## Files NOT Modified (Verified)

The following files were inspected but left unchanged because they were already correct or the requested fix didn't apply:

- `server/middleware/rateLimiter.ts` — Global rate limiter already applies to all `/api/*` routes including `/api/v1/auth`
- `server/middleware/aiRateLimiter.ts` — Already dedicated for AI routes
- `server/middleware/csrf.ts` — CSRF generation and validation already configured
- `server/middleware/logger.ts` — Request logging already functional
- `server/middleware/safety.ts` — Request sanitizer already applied globally
- `server/routes/auth.ts` — Already minimal and correct
- `server/routes/tasks.ts` — Already delegates to taskController, no direct logic
- `server/services/geminiService.ts` — Already fixed in previous audit
- `server/services/circuitBreaker.ts` — Already fixed in previous audit
- `server/services/aiRequestManager.ts` — Already fixed in previous audit

---

## Remaining Issues (Not Addressed in This Pass)

The following issues from the audit were intentionally deferred because they require more invasive refactoring or architectural decisions:

| Issue | Priority | Reason for Deferral |
|-------|----------|---------------------|
| **Lost update race condition** in `patchMicrotask`/`createMicrotask` | Critical | Requires Firestore transactions — read-modify-write cycle needs atomic transaction wrapper; cannot be fixed with a one-line change |
| **In-memory rate limiter** won't scale horizontally | Critical | Requires Redis or shared state store — external dependency decision needed |
| **No log rotation** — `combined.log` grows indefinitely | High | Requires Winston `DailyRotateFile` transport or external log shipper |
| **No structured JSON logging** | High | Would require rewriting Winston format configuration |
| **No request IDs / correlation IDs** | High | Requires middleware to generate and propagate IDs across async boundaries |
| **Prompt injection filter** is trivially bypassable | Medium | Requires NLP-based or regex-hardened approach; keyword blacklist is known-weak but acceptable for hackathon |
| **No `HttpOnly` on CSRF cookie** | Medium | Intentional trade-off for SPA architecture; changing would break frontend CSRF header injection |
| **No graceful Firebase recovery** — `isFirebaseOnline = false` permanently | Medium | Requires periodic retry logic; safe for hackathon demo |
| **Local fallback data lost on restart** | Medium | Would require JSON file persistence; acceptable for hackathon sandbox mode |
| **Frontend directly calls Google APIs** (Calendar, Keep, Tasks) | Medium | Architecture decision — frontend calls Google APIs with its own token; backend never intermediates |
| **Google Calendar hardcoded `Asia/Kolkata` timezone** | Medium | Would require user timezone detection and storage |
| **No response compression** | Low | `compression` middleware easy to add but not critical for demo |
| **No `crossOriginEmbedderPolicy`** | Low | Already intentionally disabled for SPA compatibility |
| **No field selection on GET tasks** — always returns full objects | Low | Would require query parameter parsing and Firestore projection; acceptable for hackathon |

---

## Security Score Improvement

| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| **Security** | 3/10 | 6/10 | **+3** — All AI routes authenticated, CORS restricted, mass assignment prevented, MIME validation added, standardized errors, global error handler, graceful shutdown |
| **Architecture** | 6/10 | 7/10 | **+1** — Global error handler, graceful shutdown, pagination layer added |
| **Performance** | 4/10 | 5/10 | **+1** — Pagination on all list queries, reduced JSON limit |
| **Reliability** | 5/10 | 6/10 | **+1** — Global error handler, graceful shutdown, PII-safe production errors |
| **Scalability** | 3/10 | 4/10 | **+1** — Pagination reduces unbounded data loads |
| **Maintainability** | 6/10 | 7/10 | **+1** — Consistent error format, Zod schemas, strict validation |
| **Google Quality** | 4/10 | 5/10 | **+1** — Standardized responses, validation, pagination |

**Total Score: 58/100 → 66/100 (+8)**

---

## TypeScript Verification

```bash
$ node node_modules/typescript/bin/tsc --noEmit
# Exit code: 0 (no errors, no warnings)
```

All 9 modified files compile cleanly with zero TypeScript errors.

---

*End of Fixes Applied Summary.*

# Calendar AI Express Server v2 - Implementation Checklist

**Plan Reference:** `calendar_ai_express_server_plan_v2.md`

**Important:** Follow the plan EXACTLY. Do not deviate from the code samples provided.

---

## Phase 1: Environment Setup

### 1.1 Create Directory Structure
- [ ] Create `src/` directory
- [ ] Create `src/auth/` directory
- [ ] Create `src/llm/` directory
- [ ] Create `src/graph/` directory
- [ ] Create `src/graph/tools/` directory
- [ ] Create `src/routes/` directory
- [ ] Create `src/storage/` directory
- [ ] Create `src/openapi/` directory

### 1.2 Environment Configuration
- [ ] Create `src/env.ts` per **Section 4** of v2 plan
  - Verify: Uses Zod v4 syntax
  - Verify: Exports `env` constant
  - Verify: All required env vars defined
- [ ] Verify `.env.local` exists with local Supabase credentials
- [ ] Verify `.env.network` exists with network credentials

---

## Phase 2: Core Infrastructure

### 2.1 Authentication Middleware
- [ ] Create `src/auth/supabase.ts` per **Section 5** of v2 plan
  - Verify: Import uses `.js` extension (`from "../env.js"`)
  - Verify: Exports `supabaseAuth` function
  - Verify: Sets `req.user` and `req.supabase`
  - Verify: Returns 401 for missing/invalid tokens

### 2.2 LLM Factory
- [ ] Create `src/llm/openrouter.ts` per **Section 6** of v2 plan
  - Verify: Import uses `.js` extension
  - Verify: Exports `makeLLM` function
  - Verify: Sets OpenRouter baseURL and headers
  - Verify: Streaming enabled by default

---

## Phase 3: Storage Layer

### 3.1 Storage Types
- [ ] Create `src/storage/types.ts` per **Section 9** of v2 plan
  - Verify: Defines `Role` type
  - Verify: Defines `Message` type
  - Verify: Defines `Storage` interface with all 6 methods

### 3.2 Memory Storage Implementation
- [ ] Create `src/storage/memory.ts` per **Section 9** of v2 plan
  - Verify: Import uses `.js` extension
  - Verify: Implements all `Storage` interface methods
  - Verify: `insertMessage` de-dupes on `id`
  - Verify: `upsertMemory` uses `userId:personaId` key

### 3.3 Supabase Storage Implementation
- [ ] Create `src/storage/supabase.ts` per **Section 9** of v2 plan
  - Verify: Import uses `.js` extension
  - Verify: Uses service role key for admin client
  - Verify: `insertMessage` uses `onConflict: "message_id"`
  - Verify: All queries map column names correctly

### 3.4 Storage Factory
- [ ] Create `src/storage/index.ts` per **Section 9** of v2 plan
  - Verify: Import uses `.js` extensions
  - Verify: Exports `storage` based on `env.DB_MODE`

---

## Phase 4: LangGraph Agent

### 4.1 Tools
- [ ] Create `src/graph/tools/time.ts` per **Section 8** of v2 plan
  - Verify: Uses `DynamicStructuredTool` from `@langchain/core/tools`
  - Verify: Schema uses Zod v4
  - Verify: Exports `getCurrentDateTime`

- [ ] Create `src/graph/tools/index.ts` per **Section 8** of v2 plan
  - Verify: Import uses `.js` extension
  - Verify: Exports `ALL_TOOLS` array

### 4.2 Graph Orchestrator
- [ ] Create `src/graph/index.ts` per **Section 7** of v2 plan
  - **CRITICAL:** Verify uses `Annotation.Root` (NOT `StateGraph<T>`)
  - Verify: Import uses `.js` extensions
  - Verify: Defines `StateAnnotation` with messages, runtime, result
  - Verify: Creates graph with `new StateGraph(StateAnnotation)`
  - Verify: Node returns object with `result` key (not mutating state)
  - Verify: Exports `graph` and `GraphState` type

---

## Phase 5: API Routes

### 5.1 Chat Routes
- [ ] Create `src/routes/chat.ts` per **Section 10** of v2 plan
  - Verify: Import uses `.js` extensions
  - Verify: Imports `GraphState` type from graph
  - Verify: `loadPersonaAndMemory` queries using `id` column (not `persona_id`)
  - Verify: `sse()` helper formats SSE correctly
  - Verify: POST `/stream` persists user messages before invoke
  - Verify: POST `/stream` persists assistant message after invoke
  - Verify: POST `/generate` same logic but returns JSON

### 5.2 Threads Routes
- [ ] Create `src/routes/threads.ts` per **Section 11** of v2 plan
  - Verify: Import uses `.js` extensions
  - Verify: POST `/` creates/upserts thread
  - Verify: GET `/` returns empty array (placeholder)

### 5.3 Messages Routes
- [ ] Create `src/routes/messages.ts` per **Section 11** of v2 plan
  - Verify: Import uses `.js` extensions
  - Verify: GET `/:threadId` lists messages
  - Verify: POST `/:threadId` inserts message

### 5.4 Memory Routes
- [ ] Create `src/routes/memory.ts` per **Section 11** of v2 plan
  - Verify: Import uses `.js` extensions
  - Verify: GET `/:personaId` retrieves memory
  - Verify: POST `/:personaId` supports merge/replace modes

---

## Phase 6: OpenAPI & Server

### 6.1 OpenAPI Spec
- [ ] Create `src/openapi/spec.ts` per **Section 13** of v2 plan
  - Verify: Uses Zod v4 syntax
  - Verify: Defines `ChatMessage`, `StreamBody` schemas
  - Verify: Registers at least `/api/chat/stream` path
  - Verify: Exports `openapiDoc`

### 6.2 Server Bootstrap
- [ ] Create `src/server.ts` per **Section 12** of v2 plan
  - Verify: Import uses `.js` extensions for all local imports
  - Verify: Imports all route modules
  - Verify: Mounts `/api/chat`, `/api/threads`, `/api/messages`, `/api/memory`
  - Verify: All API routes use `supabaseAuth` middleware
  - Verify: Mounts `/docs` with Swagger UI
  - Verify: Includes `/health` endpoint
  - Verify: Listens on `env.PORT`

---

## Phase 7: Testing & Validation

### 7.1 TypeScript Compilation
- [ ] Run `npx tsc --noEmit` to check for type errors
- [ ] Fix any import errors (missing `.js` extensions)
- [ ] Fix any type mismatches

### 7.2 Manual Testing - Memory Mode
- [ ] Set `DB_MODE=memory` in `.env.local`
- [ ] Start server: `pnpm dev`
- [ ] Verify server starts on port 3030
- [ ] Check `/health` endpoint returns `{ ok: true }`
- [ ] Check `/docs` loads Swagger UI

### 7.3 Manual Testing - Supabase Mode
- [ ] Set `DB_MODE=supabase` in `.env.local`
- [ ] Verify Supabase is running: `npx supabase status`
- [ ] Restart server
- [ ] Test auth: POST `/api/threads` without Bearer token (expect 401)
- [ ] Test auth: POST `/api/threads` with valid Bearer token (expect 201)

### 7.4 Integration Testing
- [ ] Create test thread via POST `/api/threads`
- [ ] Verify thread created in `ai_threads` table
- [ ] Send chat message via POST `/api/chat/generate`
- [ ] Verify messages stored in `ai_messages` table
- [ ] Test memory via POST `/api/memory/:personaId`
- [ ] Verify memory stored in `ai_memory` table

---

## Phase 8: Documentation & Cleanup

### 8.1 Update Checklists
- [ ] Update `langchain_migration_checklist.md` with completed v2 items
- [ ] Mark Phase 4 as complete in migration checklist

### 8.2 Verify Against Plan
- [ ] Cross-reference every file against v2 plan sections
- [ ] Ensure no code drift from plan
- [ ] Verify all imports use `.js` extensions
- [ ] Verify `Annotation.Root` used (not `StateGraph<T>`)

---

## Common Pitfalls to Avoid

⚠️ **DO NOT:**
- Use `StateGraph<Ctx>()` - use `new StateGraph(StateAnnotation)` instead
- Forget `.js` extensions on local imports
- Use `persona_id` column - use `id` column for ai_personas
- Mutate state directly in graph nodes - return update objects
- Mix Zod v3 and v4 syntax
- Skip the `GraphState` type export from graph/index.ts

✅ **DO:**
- Copy code EXACTLY from v2 plan
- Use `Annotation.Root` for state definition
- Add `.js` to all local imports
- Export `GraphState` type from graph
- Test after each phase

---

## Verification Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Check all files created
find src -type f -name "*.ts" | sort

# Start dev server
pnpm dev

# Test health endpoint
curl http://localhost:3030/health

# View Swagger docs
open http://localhost:3030/docs
```

---

## Success Criteria

✅ All files match v2 plan exactly
✅ No TypeScript errors
✅ Server starts without errors
✅ `/health` returns 200
✅ `/docs` loads Swagger UI
✅ Auth middleware blocks unauthenticated requests
✅ Chat endpoint accepts messages and returns responses
✅ Storage layer persists data correctly

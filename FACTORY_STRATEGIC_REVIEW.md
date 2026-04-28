# Factory Core — Strategic Review & World-Class Roadmap

**Date:** April 28, 2026  
**Audience:** Technical Leadership & Product Strategy  
**Purpose:** Assessment of current capabilities + roadmap to world-class platform

---

## Executive Summary

**Current State:** Production-grade **infrastructure library** (19 packages @ v0.2.0)  
**Missing:** Browser-based **admin experience** for non-technical operators  
**Gap:** No AI-powered code editing without VS Code + GitHub Copilot

### The Ask

> "Can I do code AI chat queries from the admin dashboard? I need an easier way to edit and admin the site from the factory that is not dependent on GitHub Copilot or VS Code."

**Answer:** Not currently, but **architecturally possible**. Requires Phase 8+ expansion.

---

## Current Capabilities Assessment

### ✅ What Factory Core Has TODAY

| Capability | Status | Evidence |
|---|---|---|
| **Infrastructure as Code** | ✅ Production | 19 packages published to npm |
| **Backend API Admin** | ✅ Scaffolded | `@adrper79-dot/admin` package routes |
| **Database Admin** | ✅ Working | User management, event querying via API |
| **Content Management** | ✅ Library | `@adrper79-dot/content` for CMS entities |
| **LLM Integration** | ✅ Working | `@adrper79-dot/llm` (Claude → Grok → Groq) |
| **Deploy Automation** | ✅ CI/CD | GitHub Actions → Wrangler → Cloudflare |
| **Monitoring** | ✅ Integrated | Sentry errors + PostHog analytics |
| **Multi-tenant Support** | ✅ Library | RLS policies + tenant isolation |

### ❌ What Factory Core LACKS for "World Class"

| Missing Capability | Impact | Complexity | Priority |
|---|---|---|---|
| **Browser-Based Code Editor** | Cannot edit code without VS Code | High | P0 |
| **AI Chat Interface** | Cannot query AI without Copilot | Medium | P0 |
| **Visual CMS UI** | Content editing requires API calls | Medium | P1 |
| **Live Preview Environment** | No instant preview of changes | Medium | P1 |
| **No-Code Workflow Builder** | Non-technical users blocked | High | P2 |
| **Visual Schema Designer** | Database changes require Drizzle code | Medium | P2 |
| **Deployment UI** | Deploy requires terminal/GitHub | Low | P3 |
| **Log Aggregation UI** | Must use Sentry dashboard | Low | P3 |

---

## Current Admin Dashboard Scope

### What `@adrper79-dot/admin` Provides (API Routes Only)

```typescript
GET  /admin                  → Dashboard summary (users, events)
GET  /admin/users            → Paginated user list
GET  /admin/users/:id        → User detail
POST /admin/users/:id/suspend → Suspend user
GET  /admin/events           → Recent factory_events
GET  /admin/health           → Database connectivity check
```

**What's Missing:**
- ❌ No frontend UI (just JSON API routes)
- ❌ No code editor
- ❌ No AI chat interface
- ❌ No content editing forms
- ❌ No deployment controls
- ❌ No visual analytics

---

## Phase 8: Factory Admin Dashboard (Planned)

From [STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md#phase-8-factory-admin-dashboard):

### Planned Features

```
factory-admin/
└── src/routes/
    ├── overview.ts   # Cross-app MRR, users, error rates
    ├── apps.ts       # Per-app health, deploy status
    ├── crm.ts        # Cross-app lead funnel
    └── events.ts     # Cross-app factory_events stream
```

**Still API-only, no UI.** The plan stops at JSON endpoints.

---

## Architectural Blueprint: AI-Powered Browser Admin

To achieve your vision, Factory needs **Phase 8.5: Admin UI + AI Studio**.

### Required Components

#### 1. Frontend Application (`factory-admin-ui`)

**Tech Stack:**
- **Framework:** React + Vite (or Remix on Cloudflare Pages)
- **Deployment:** Cloudflare Pages (serves static assets + functions)
- **Auth:** JWT from `@adrper79-dot/auth` (same tokens as API)

**Key Views:**
```
/dashboard          → Cross-app metrics (MRR, users, errors)
/apps/:id           → Per-app management
/apps/:id/content   → Content CMS (visual editor)
/apps/:id/code      → Code editor (Monaco + AI copilot)
/apps/:id/deploy    → Deployment controls
/ai-studio          → AI chat interface for code generation
/logs               → Aggregated Sentry + analytics
```

#### 2. Code Editor Component (`/apps/:id/code`)

**Implementation:**
- **Monaco Editor** (same as VS Code, runs in browser)
- **LSP Integration:** TypeScript language server via WebAssembly
- **Git Integration:** Push commits via GitHub API (no local git)

**Workflow:**
```
User edits src/index.ts in Monaco
  → Save triggers GitHub API: Create new branch
  → Commit changes via GitHub REST API
  → Trigger GitHub Actions workflow
  → Watch deployment status via WebSocket
  → Show live logs in UI
```

**Required APIs:**
```typescript
// In factory-admin Worker (new routes)
POST /api/code/edit
  → Creates feature branch + commits file
  → Returns: { branch, commitSha, deployUrl }

GET /api/code/files/:app/:path
  → Fetches file content from GitHub

POST /api/code/deploy/:app/:branch
  → Triggers GitHub Actions workflow dispatch
  → Returns: { workflowRunId, status }

GET /api/code/deploy/:app/:workflowRunId/status
  → Polls deployment status
  → Returns: { status: 'pending' | 'success' | 'failed', logs }
```

#### 3. AI Chat Interface (`/ai-studio`)

**Architecture:**
```
User types: "Add a /contacts endpoint that returns all contacts"
  ↓
Browser → factory-admin Worker → LLM (via @adrper79-dot/llm)
  ↓
LLM generates code → Display in Monaco editor
  ↓
User reviews → Click "Deploy" → Commits via GitHub API
```

**Implementation:**
```typescript
// New route in factory-admin
POST /api/ai/chat
Body: {
  app: 'wordis-bond',
  message: 'Add a /contacts endpoint',
  context: { files: ['src/index.ts', 'src/db/schema.ts'] }
}

Response: {
  reply: "I'll add a contacts endpoint...",
  code: "router.get('/contacts', async (c) => { ... })",
  filePath: 'src/routes/contacts.ts'
}
```

**Dependencies:**
- Uses existing `@adrper79-dot/llm` package (already integrated)
- Streams responses via Server-Sent Events (SSE)
- Code diffs shown in Monaco with syntax highlighting

#### 4. Content Management UI (`/apps/:id/content`)

**Features:**
- Visual editor for content items (WYSIWYG)
- Status workflow: draft → review → approved → published
- Scheduling calendar
- SEO metadata fields

**Implementation:**
```typescript
// Uses existing @adrper79-dot/content package
import { createContent, updateContent } from '@adrper79-dot/content';

// New UI routes in factory-admin
GET  /apps/:id/content           → List all content items
GET  /apps/:id/content/:itemId   → Edit single item
POST /apps/:id/content           → Create new item
PUT  /apps/:id/content/:itemId   → Update item
POST /apps/:id/content/:itemId/publish → Trigger publish workflow
```

---

## Technical Feasibility Analysis

### Can This Be Built on Cloudflare Workers?

| Component | Feasible? | Notes |
|---|---|---|
| Monaco Editor | ✅ Yes | Runs 100% client-side in browser |
| AI Chat | ✅ Yes | `@adrper79-dot/llm` already works in Workers |
| GitHub API Integration | ✅ Yes | REST API calls from Worker |
| TypeScript LSP | ⚠️ Partial | WebAssembly version available (performance concerns) |
| Live Deployment Preview | ✅ Yes | Deploy to staging, poll health endpoint |
| Code Execution Sandbox | ❌ No | Workers cannot run arbitrary user code |

**Blocker:** Cannot run user code in Workers for security reasons.  
**Workaround:** All code execution happens via GitHub Actions (CI/CD pipeline).

### Deployment Flow Comparison

**Current (Terminal-Based):**
```
Edit in VS Code → git commit → git push → GitHub Actions → Wrangler deploy
```

**Proposed (Browser-Based):**
```
Edit in Monaco → Save button → GitHub API commit → Workflow dispatch → Poll status
```

**Key Difference:** Same CI/CD pipeline, just triggered via API instead of git push.

---

## Implementation Phases

### Phase 8.5: Admin UI Foundation (2 weeks)

**Owner:** Frontend Engineer + Backend Engineer  
**Deliverables:**
- ✅ `factory-admin-ui` React app deployed to Cloudflare Pages
- ✅ JWT authentication flow (login → dashboard)
- ✅ Dashboard view (uses existing API routes)
- ✅ User management UI (CRUD operations)
- ✅ Event log viewer (filterable by app)

**No code editing yet** — just visualizes existing API data.

### Phase 8.6: Code Editor Integration (3 weeks)

**Owner:** Frontend Specialist + DevOps Engineer  
**Deliverables:**
- ✅ Monaco Editor embedded in UI
- ✅ GitHub API file browser (list files in repo)
- ✅ File editing + save (creates branch + commit)
- ✅ Deployment trigger UI (dispatches GitHub Actions)
- ✅ Live status polling (shows workflow logs)

**User can now edit and deploy code from browser.**

### Phase 8.7: AI Chat Copilot (2 weeks)

**Owner:** AI/ML Engineer + Frontend Engineer  
**Deliverables:**
- ✅ Chat interface in admin UI
- ✅ AI generates code based on prompts
- ✅ Code diffs shown in Monaco
- ✅ One-click commit + deploy
- ✅ Context awareness (reads current files)

**User can now generate code via AI chat.**

### Phase 8.8: Visual CMS (1 week)

**Owner:** Frontend Engineer  
**Deliverables:**
- ✅ WYSIWYG content editor (Slate.js or TipTap)
- ✅ Content workflow (draft → publish)
- ✅ Scheduling calendar
- ✅ SEO metadata forms

**User can now manage content visually.**

---

## Cost-Benefit Analysis

### Investment Required

| Phase | Duration | Cost (est.) | Value Delivered |
|---|---|---|---|
| 8.5: Admin UI | 2 weeks | $15K | Basic dashboard (non-technical users) |
| 8.6: Code Editor | 3 weeks | $30K | In-browser editing (replaces VS Code) |
| 8.7: AI Copilot | 2 weeks | $20K | AI code generation (replaces Copilot) |
| 8.8: Visual CMS | 1 week | $10K | Content management |
| **Total** | **8 weeks** | **$75K** | **Complete browser-based admin** |

### Break-Even Analysis

**Assumptions:**
- Current: GitHub Copilot = $10/user/month × 3 users = $30/month
- Proposed: Self-hosted AI = $0 (uses existing LLM integration)
- **Savings:** $360/year (negligible)

**Real Value:** Not cost savings — **operational velocity**

| Metric | Current | With Admin UI | Improvement |
|---|---|---|---|
| Time to edit code | Open VS Code → clone → edit → commit → push (5 min) | Click edit → save (30 sec) | **10x faster** |
| Onboard new admin | Install git, VS Code, Copilot, wrangler (2 hours) | Send URL + password (5 min) | **24x faster** |
| Non-technical content edits | Requires developer | Self-service via CMS | **Unblocks team** |
| Deploy time | Terminal + manual verification (10 min) | Click button + auto-verify (2 min) | **5x faster** |

**ROI:** If admin makes 10 code changes/week, saves **45 minutes/week** = **40 hours/year** = $4,000 value/year (at $100/hour).  
**Payback period:** 18 months (but real value is velocity + team autonomy).

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Monaco performance issues on large files | Medium | Medium | Lazy-load, virtual scrolling |
| GitHub API rate limits (5,000 req/hour) | Low | High | Cache file tree, batch commits |
| TypeScript LSP crashes in browser | Medium | Low | Fallback to syntax highlighting only |
| Security: user can commit malicious code | **High** | **Critical** | ✅ **Enforce code review + CI checks** |
| Deploy failures invisible to user | Medium | Medium | Real-time logs via SSE |

**Critical Security Requirement:**
```
All commits from browser MUST:
1. Create a feature branch (never commit to main)
2. Trigger CI checks (typecheck + lint + test)
3. Require manual PR approval before production deploy
```

**No direct-to-production deploys from browser.**

### Product Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Users prefer VS Code (familiar) | High | Medium | Make admin UI optional, not mandatory |
| AI generates buggy code | **High** | Medium | Show diffs, require review before commit |
| Non-technical users break apps | Medium | High | Sandbox staging environment, easy rollback |
| Feature creep (users request IDE parity) | High | Medium | Stay focused on 80% use cases |

---

## Competitive Landscape

### How Does Factory Compare?

| Platform | Code Editor | AI Copilot | CMS | Deploy UI | Pricing |
|---|---|---|---|---|---|
| **Factory (proposed)** | ✅ Monaco | ✅ Self-hosted | ✅ Custom | ✅ Yes | Self-hosted |
| **Vercel** | ❌ No | ❌ No | ❌ No | ✅ Yes | $20/user/month |
| **Netlify** | ❌ No | ❌ No | ⚠️ Basic | ✅ Yes | $19/user/month |
| **Cloudflare Dashboard** | ❌ No | ❌ No | ❌ No | ✅ Yes | Free (but no AI) |
| **Replit** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | $20/user/month |
| **StackBlitz** | ✅ Yes | ⚠️ Limited | ❌ No | ❌ No | $12/user/month |
| **GitHub Codespaces** | ✅ VS Code | ✅ Copilot | ❌ No | ❌ No | $8–10/month |

**Factory's Unique Position:**
- Only platform combining: browser IDE + self-hosted AI + CMS + Cloudflare Workers deploy
- No per-user seat licensing (self-hosted)
- Integrated with existing `@adrper79-dot/*` packages

---

## Recommended Next Steps

### Option A: Incremental Build (Low Risk)

**Timeline:** 8 weeks  
**Approach:** Build admin UI in phases (8.5 → 8.6 → 8.7 → 8.8)

**Pros:**
- Validate user demand at each phase
- Pause/pivot if ROI unclear
- Smaller upfront investment

**Cons:**
- Slower time-to-value
- Users wait 8 weeks for full experience

### Option B: MVP Sprint (High Risk, High Reward)

**Timeline:** 4 weeks  
**Approach:** Build minimal viable admin in one sprint

**MVP Scope:**
- Dashboard + user management
- Monaco editor (read-only files)
- AI chat (code generation only, no commits)
- Manual copy-paste to VS Code for deployment

**Pros:**
- Validate AI chat demand immediately
- Lower investment ($30K vs. $75K)
- Users see value in 1 month

**Cons:**
- Still requires VS Code for deploys
- May feel incomplete

### Option C: Partner Integration (Lowest Risk)

**Timeline:** 2 weeks  
**Approach:** Embed existing tools instead of building from scratch

**Tools:**
- **Code Editor:** Embed GitHub.dev (GitHub's web editor)
- **AI Chat:** Integrate OpenAI Assistants API (no self-hosting)
- **CMS:** Use Contentful/Sanity headless CMS (API integration)

**Pros:**
- 10x faster implementation
- Battle-tested tools
- Lower maintenance burden

**Cons:**
- Dependency on third-party services
- Higher per-user costs ($10–30/user/month)
- Less control over UX

---

## Final Recommendation

### Start with Option B (MVP Sprint) → Iterate to Option A

**Rationale:**
1. **Validate demand** for browser-based admin before committing $75K
2. **AI chat is the killer feature** — users want this most
3. **Monaco editor** proves feasibility without full deployment integration
4. **4 weeks** is fast enough to maintain momentum

**Phase 1 MVP (4 weeks, $30K):**
- Dashboard UI (user management, events, metrics)
- AI chat interface (code generation + diffs in Monaco)
- Read-only file viewer (Monaco)
- Manual copy-paste workflow (interim solution)

**Success Metrics:**
- 80%+ of code edits done via AI chat (not manual)
- Users log in 3+ times/week
- Net Promoter Score > 8/10

**If successful → Phase 2 (4 weeks, $45K):**
- GitHub API commit integration
- Deployment UI with live status
- Visual CMS
- Full parity with VS Code workflow

---

## Conclusion

### Can Factory Do This?

**Yes — architecturally sound.** All components (LLM, Monaco, GitHub API, Cloudflare deploy) are proven and compatible.

### Should Factory Do This?

**Depends on strategic priorities:**

| Priority | Recommendation |
|---|---|
| **Maximize velocity for solo founder** | ✅ **Yes** — saves 45 min/week |
| **Enable non-technical team** | ✅ **Yes** — unblocks content/ops team |
| **Compete with Replit/Vercel** | ⚠️ **Maybe** — niche market (self-hosted AI) |
| **Minimize maintenance burden** | ❌ **No** — adds frontend complexity |
| **Sell Factory as product** | ✅ **Yes** — differentiator vs. competitors |

### Next Action

**Decide:**
1. Build it (MVP sprint starts next week)
2. Defer it (focus on core 6 apps first, revisit in Q3)
3. Partner (integrate GitHub.dev + OpenAI Assistants)

**Recommended:** **MVP sprint** → validate → scale or pivot.

---

_Last updated: April 28, 2026_  
_Author: GitHub Copilot (Claude Sonnet 4.5)_  
_Status: Strategic Review — Awaiting Decision_

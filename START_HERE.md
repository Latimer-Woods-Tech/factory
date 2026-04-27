# Factory Core: START HERE

**Status:** ✅ Ready to Execute Phase 6  
**Last Updated:** [Today]  
**Next Action:** Infrastructure provisioning (Phase 6)

---

## What Is This?

Factory Core is a shared infrastructure monorepo for 6 Cloudflare Worker apps. All 19 core packages are published. Infrastructure provisioning (Phase 6) is the next critical step.

---

## I'm The Infrastructure Engineer — What Do I Do?

### Right Now (Next 2 hours)

1. **Read:** [PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md) (5 min read)
2. **Gather credentials:**
   - GitHub PAT (repo scope)
   - CloudFlare API token + account ID
   - Neon connection strings (or API key)
   - Sentry auth token (optional)
   - PostHog API key (optional)
3. **Test:** `node scripts/phase-6-orchestrator.mjs --dry-run`
4. **Execute:** `node scripts/phase-6-orchestrator.mjs`
5. **Verify:** Follow checklist in [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)

### Full Details

- **Checklist:** [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md) — Complete step-by-step guide
- **Timeline:** [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) — What happens when
- **Architecture:** [STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md) — Why it's built this way

---

## I'm An App Agent — What Do I Do?

### Phase 7 (After Phase 6 Completes)

1. **Wait for Phase 6 infrastructure** (Infrastructure Engineer runs it first)
2. **Get assigned an app:** wordis-bond, cypher-healing, prime-self, ijustus, the-calling, or neighbor-aid
3. **Read:** [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md#per-agent-workflow) (10 min read)
4. **Run one command:**
   ```bash
   npm run phase-7:scaffold -- {your-app-name} \
     --hyperdrive-id $HYPERDRIVE_ID \
     --rate-limiter-id $RATE_LIMITER_ID
   ```
5. **Test locally, push to GitHub**
6. **Verify CI passes and staging deployment succeeds**

### Full Details

- **Timeline:** [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) — All agent workflows
- **Ready State:** [PHASE_6_7_READY_STATE.md](./PHASE_6_7_READY_STATE.md) — What's already prepared

---

## I'm A Tech Lead — What Do I Need to Know?

### Current State
- ✅ All 19 core packages published (v0.2.0)
- ✅ 6 app repositories created
- ✅ All automation scripts ready
- ✅ All documentation complete

### Blocker
**Phase 6 infrastructure provisioning** must complete before anything else. Without it, Phase 7 agents can't scaffold apps.

### Timeline (Wall-Clock)
- Phase 6: 4–6 hours (Infrastructure Engineer)
- Phase 7: 2–3 days (6 app agents in parallel)
- Phase 8–10: Parallel with Phase 7 or after
- **Total:** 3–4 days

### Success Criteria
- [ ] All 7 Neon databases created + factory_core DDL applied
- [ ] All 7 Hyperdrive instances created
- [ ] All 6 GitHub app repos created
- [ ] All 6 Sentry + PostHog projects created
- [ ] All secrets wired (GitHub Actions + Wrangler)
- [ ] CI passing on all 6 app repos
- [ ] All 6 apps scaffolded to staging
- [ ] Administrators can access Factory Admin Dashboard
- [ ] Documentation deployed

See [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) for full details.

---

## Quick Links

### For Infrastructure Engineer
| Document | Purpose | Read Time |
|---|---|---|
| [PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md) | How to run the orchestrator | 5 min |
| [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md) | Complete step-by-step | 20 min |
| [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) | Understand the flow | 10 min |

### For App Agents
| Document | Purpose | Read Time |
|---|---|---|
| [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md#per-agent-workflow) | Your exact workflow | 10 min |
| [PHASE_6_7_READY_STATE.md](./PHASE_6_7_READY_STATE.md) | What's prepared | 15 min |
| [CLAUDE.md](./CLAUDE.md#hard-constraints) | Hard constraints to follow | 5 min |

### For Tech Lead
| Document | Purpose | Read Time |
|---|---|---|
| [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) | Full timeline + parallel workflow | 15 min |
| [PHASE_6_7_READY_STATE.md](./PHASE_6_7_READY_STATE.md#success-criteria) | Success criteria | 5 min |
| [STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md) | Architecture decisions | 30 min |

---

## Key Numbers

- **19** core packages (published v0.2.0)
- **6** production apps (coming in Phase 7)
- **7** Neon databases (to create in Phase 6)
- **7** Hyperdrive instances (to create in Phase 6)
- **6** app agents (Phase 7, parallel)
- **3–4** days total (Phases 6–7)

---

## Critical Commands

```bash
# Phase 6: Test (safe, no infrastructure created)
node scripts/phase-6-orchestrator.mjs --dry-run

# Phase 6: Execute (creates real infrastructure)
node scripts/phase-6-orchestrator.mjs

# Phase 7: Scaffold one app
npm run phase-7:scaffold -- {app-name} \
  --hyperdrive-id $ID \
  --rate-limiter-id $RATE_LIMITER_ID

# Phase 7: Validate all apps
node scripts/phase-7-validate.js --all
```

---

## Automation Scripts Available

| Script | Purpose | Lines |
|---|---|---|
| `scripts/phase-6-orchestrator.mjs` | Orchestrate all Phase 6 provisioning | 400+ |
| `scripts/phase-7-scaffold-template.mjs` | Scaffold app with schemas + migrations | 650+ |
| `scripts/phase-7-validate.js` | Validate app repos are ready | 300+ |
| `scripts/phase-6-setup.js` | Credential management (legacy) | 380+ |

---

## Documentation Structure

```
Factory Core (root)
├── CLAUDE.md                        ← Standing orders + automation links
├── PHASE_6_QUICK_START.md          ← Start here (Infrastructure Engineer)
├── PHASE_6_CHECKLIST.md            ← Complete Phase 6 playbook
├── PHASE_6_7_TIMELINE.md           ← Master timeline for Phases 6–10
├── PHASE_6_7_READY_STATE.md        ← Summary of all deliverables
├── STAGE_6_ONWARDS_PLAN.md         ← Architecture + design decisions
├── scripts/
│   ├── phase-6-orchestrator.mjs    ← Main infrastructure automation
│   ├── phase-7-scaffold-template.mjs ← App scaffolding for 6 agents
│   └── phase-7-validate.js         ← Pre-deployment validation
└── docs/
    ├── runbooks/                   ← 5 operational guides
    ├── APP_README_TEMPLATE.md      ← Template for each app
    └── sql/                        ← DDL scripts
```

---

## Status Dashboard

| Phase | Status | Blocker | Owner |
|---|---|---|---|
| **Phase 6** | ✅ Automated | — | Infrastructure Engineer |
| **Phase 7** | ✅ Templated | Awaits Phase 6 | 6 App Agents |
| **Phase 8** | ✅ Can start | Optional | Admin Dashboard Agent |
| **Phase 9** | ✅ Can start | Optional | Docs Agent |
| **Phase 10** | ✅ Ready | Awaits Phase 7 | DevOps Engineer |

**Blocker Logic:** Phase 6 must complete before Phase 7 starts (infrastructure is prerequisite).

---

## Getting Started Right Now

### If you're the Infrastructure Engineer:

```bash
# 1. Read the quick start
cat PHASE_6_QUICK_START.md

# 2. Test the orchestrator (safe)
node scripts/phase-6-orchestrator.mjs --dry-run

# 3. When ready, execute
node scripts/phase-6-orchestrator.mjs
```

### If you're an App Agent:

```bash
# Wait for Phase 6 to complete, then:
npm run phase-7:scaffold -- {your-app-name} \
  --hyperdrive-id {from-phase-6} \
  --rate-limiter-id {from-phase-6}
```

### If you're a Tech Lead:

```bash
# Review the timeline
cat PHASE_6_7_TIMELINE.md

# Monitor Phase 6 progress
watch "gh run list --repo adrper79-dot/Factory --limit 1"
```

---

## Questions?

1. **"How do I start Phase 6?"** → Read [PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md)
2. **"What exactly do I need to do step-by-step?"** → Read [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)
3. **"When do things run?"** → Read [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md)
4. **"Why is it built this way?"** → Read [STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md)
5. **"What constraints do I need to follow?"** → Read [CLAUDE.md#hard-constraints](./CLAUDE.md#hard-constraints)

---

## Ready?

**Infrastructure Engineer:** Start with [PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md)

**App Agents:** Wait for Phase 6, then run the scaffold command above.

**Tech Lead:** Monitor [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) for progress.

---

✨ **The Factory Core is ready. Let's build!** ✨

# Factory Core — Master Index

**Status:** Phase 5 Complete | Phase 6-7 Automation Ready | Open Work Register Active  
**Date:** April 29, 2026  
**Audience:** All team members

> **Jump to:** [Infrastructure Engineer](#for-infrastructure-engineer) | [Tech Lead](#for-tech-lead) | [App Agents](#for-app-agents) | [Docs Team](#for-docs-team)

**Canonical execution source:** [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](./WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) now owns the open work register, project/repo inventory, done/undone/unrealized status, and multi-agent coordination process. Root-level `*_SUMMARY.md` / `*_COMPLETE.md` files are historical only.

---

## ⚡ Quick Links (by Role)

### For Infrastructure Engineer

**Your next task:** Execute Phase 6 infrastructure provisioning (6-8 hours)

1. **Start here:** [PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md) — Step-by-step guide
2. **Get credentials:** [docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md) — How to gather tokens
3. **Quick reference:** [PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md)
4. **Detailed checklist:** [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)
5. **Timeline:** [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) — Shows parallelizable tasks
6. **Scripts:**
   - `node scripts/phase-6-orchestrator.mjs --dry-run` (test plan)
   - `node scripts/phase-6-orchestrator.mjs` (execute)
   - `node scripts/phase-7-validate.js --all` (verify)

**Troubleshooting:** [docs/runbooks/lessons-learned.md](./docs/runbooks/lessons-learned.md)

### For Tech Lead

**Your next task:** Oversee Phase 6-7 execution, verify readiness

1. **Project status:** [PROJECT_STATUS.md](./PROJECT_STATUS.md) — Complete overview
2. **Owner manual:** [docs/ESSENTIAL_OWNERS_GUIDE.md](./docs/ESSENTIAL_OWNERS_GUIDE.md) — How Factory works in practice
2. **Delivery summary:** [DELIVERY_SUMMARY.md](./DELIVERY_SUMMARY.md) — What was delivered
3. **Ready state:** [PHASE_6_7_READY_STATE.md](./PHASE_6_7_READY_STATE.md) — Deliverables inventory
4. **Timeline:** [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) — Parallel execution plan
5. **Verify readiness:** `npm run phase-6:preflight` (runs 15 automated checks)

**Key metrics:**
- ✅ All 19 packages implemented + published at v0.2.0
- ✅ All 6 app repos created + pre-scaffolded
- ✅ All Phase 6-7 automation scripts tested + verified
- ✅ 15/15 preflight checks pass

### For App Agents

**Your next task:** Deploy apps using Phase 7 scaffolding (starts after Phase 6 complete)

1. **What's available:** [PROJECT_STATUS.md](./PROJECT_STATUS.md#what's-next) — Post-Phase 6 setup
2. **Quick setup:** Phase 7 scaffold template is ready in `scripts/phase-7-scaffold-template.mjs`
3. **App repo template:** Each app has:
   - Pre-configured Hono router
   - Hyperdrive database binding
   - Drizzle ORM schemas
   - GitHub Actions CI/CD
   - Environment verification scripts

**Once Phase 6 complete, for each app:**
```bash
git clone https://github.com/adrper79-dot/{app-name}
npm ci
npm run verify:env
npm run dev
```

### For Docs Team

**Your next task:** Create app-specific documentation

1. **Reference:** [docs/APP_README_TEMPLATE.md](./docs/APP_README_TEMPLATE.md) — Use as basis for app READMEs
2. **Factory Core docs:** [factory_core_architecture.md](./factory_core_architecture.md)
3. **Central runbooks:** [docs/runbooks/](./docs/runbooks/) — Available for linking

---

## 📚 Complete Documentation Map

### Master References
- **[START_HERE.md](./START_HERE.md)** — Overview for all roles (5 min read)
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — Complete project summary (15 min read)
- **[DELIVERY_SUMMARY.md](./DELIVERY_SUMMARY.md)** — What was delivered (10 min read)
- **[CLAUDE.md](./CLAUDE.md)** — Standing orders for all team members

### Infrastructure (Phase 6-7)
- **[PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md)** — Step-by-step execution guide
- **[PHASE_6_QUICK_START.md](./PHASE_6_QUICK_START.md)** — Quick reference (TL;DR format)
- **[PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)** — 250+ line detailed checklist
- **[PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md)** — Master timeline with parallelization
- **[PHASE_6_7_READY_STATE.md](./PHASE_6_7_READY_STATE.md)** — Deliverables inventory

### World Class 360 Execution
- **[docs/operations/WORLD_CLASS_360_TASK_DASHBOARD.md](./docs/operations/WORLD_CLASS_360_TASK_DASHBOARD.md)** — Active W360 work queue
- **[docs/operations/FACTORY_MODULAR_OPERATING_SYSTEM_ARCHITECTURE.md](./docs/operations/FACTORY_MODULAR_OPERATING_SYSTEM_ARCHITECTURE.md)** — Modular Factory OS architecture based on the real repo surfaces, shared engines, Admin Studio, registries, tests, and sellability model
- **[docs/operations/W360_TOMORROW_ACTION_PLAN_2026-05-02.md](./docs/operations/W360_TOMORROW_ACTION_PLAN_2026-05-02.md)** — May 2 execution plan for closing the highest-value W360 blockers with evidence
- **[docs/operations/W360_FACTORY_REPO_HARDENING_PLAN.md](./docs/operations/W360_FACTORY_REPO_HARDENING_PLAN.md)** — Detailed hardening program for control-plane, workflows, docs, and quality gates
- **[docs/operations/W360_FACTORY_REPO_HARDENING_SPRINT_PLAN.md](./docs/operations/W360_FACTORY_REPO_HARDENING_SPRINT_PLAN.md)** — 2-week sprint mapping, board columns, risk register, and evidence cadence for FRH-01..FRH-10
- **[docs/operations/W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md](./docs/operations/W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md)** — Ready-to-open FRH-01..FRH-10 issue titles and scope anchors (+ deferred FRH-11 append item)

### Runbooks (Troubleshooting & Reference)
- **[docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md)** — Gather GitHub, CloudFlare, Neon, Sentry, PostHog credentials
- **[docs/runbooks/github-secrets-and-tokens.md](./docs/runbooks/github-secrets-and-tokens.md)** — GitHub Actions secrets inventory
- **[docs/runbooks/lessons-learned.md](./docs/runbooks/lessons-learned.md)** — Common errors + fixes
- **[docs/runbooks/environment-isolation-and-verification.md](./docs/runbooks/environment-isolation-and-verification.md)** — Environment safety checks
- **[docs/runbooks/deployment.md](./docs/runbooks/deployment.md)** — Staging vs. production
- **[docs/runbooks/secret-rotation.md](./docs/runbooks/secret-rotation.md)** — Token rotation schedule

### Architecture & Design
- **[factory_core_architecture.md](./factory_core_architecture.md)** — System design + dependency graph
- **[STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md)** — How the system works (high-level)

### Stage Milestones
- **[STAGE_5_COMPLETE.md](./STAGE_5_COMPLETE.md)** — Previous milestone (19 packages shipped)
- **[STAGE_0_COMPLETE.md](./STAGE_0_COMPLETE.md)** — Bootstrap complete

---

## 🤖 Automation Scripts

All scripts located in `scripts/`:

| Script | Purpose | Time | Command |
|--------|---------|------|---------|
| **phase-6-orchestrator.mjs** | Complete Phase 6 infrastructure provisioning | 3-4 hrs | `node scripts/phase-6-orchestrator.mjs` |
| **phase-6-orchestrator.mjs** | Test Phase 6 plan (safe, no side effects) | 15 min | `node scripts/phase-6-orchestrator.mjs --dry-run` |
| **phase-7-scaffold-template.mjs** | Scaffold an app with Drizzle schemas + migrations | ~30 min/app | `npm run phase-7:scaffold -- {app-name} --hyperdrive-id {id}` |
| **phase-7-validate.js** | Validate all 6 apps are properly scaffolded | ~10 min | `node scripts/phase-7-validate.js --all` |
| **phase-6-setup.js** | Manage credentials for orchestrator | — | `node scripts/phase-6-setup.js` |
| **phase-6-preflight.js** | Verify all deliverables are in place (15 checks) | ~30 sec | `npm run phase-6:preflight` |

---

## ✅ Verification Checklist

Before executing Phase 6:

- [ ] Read [PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md)
- [ ] Run preflight: `npm run phase-6:preflight` → should show ✅ 15/15
- [ ] Gather credentials per [docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md)
- [ ] Test credentials: `gh auth status` + CloudFlare token verification
- [ ] Run dry-run: `node scripts/phase-6-orchestrator.mjs --dry-run`
- [ ] Review plan in dry-run output
- [ ] Execute: `node scripts/phase-6-orchestrator.mjs`
- [ ] Verify Phase 7: `node scripts/phase-7-validate.js --all`
- [ ] First app deployment via GitHub Actions

---

## 📊 Project Status Summary

### ✅ Completed (Phase 5)

| Component | Count | Version | Status |
|-----------|-------|---------|--------|
| Core packages | 19 | v0.2.0 | ✅ Published |
| Test coverage | All packages | 90%+ lines | ✅ Passing |
| TypeScript strict | All packages | strict mode | ✅ Zero errors |
| ESLint compliance | All packages | --max-warnings 0 | ✅ Zero warnings |

### ✅ Ready for Execution (Phase 6-7)

| Component | Status | Verification |
|-----------|--------|---------------|
| Documentation | 7 files creating (11 total) | ✅ All present |
| Automation scripts | 5 scripts created | ✅ All tested |
| Infrastructure orchestrator | Ready | ✅ All 15 preflight checks pass |
| App scaffolding template | Ready | ✅ Recognizes all 6 apps |
| Validation tool | Ready | ✅ Checks 6 validation points |

### 🚀 Ready for Deployment (Phase 8+)

Once Phase 6-7 complete:

| Component | Status | Next Step |
|-----------|--------|-----------|
| Neon databases | 7 provisioned | Connect via Hyperdrive |
| Hyperdrive bindings | 7 created | Reference in wrangler.jsonc |
| App repos | 6 ready | `npm ci` + `npm run dev` |
| CI/CD workflows | Pre-configured | Trigger on first commit |
| Secrets management | GitHub Actions | Auto-injected via CI/CD |

---

## 🎯 Success Criteria

Phase 6-7 is successful when:

1. ✅ Preflight verification: 15/15 checks pass
2. ✅ Dry-run execution: Shows complete infrastructure plan
3. ✅ Phase 6 execution: All infrastructure provisioned (6-8 hours)
4. ✅ Phase 7 validation: All 6 apps pass validation checks
5. ✅ First app deployment: `npm run dev` works with preconfigured database + auth
6. ✅ Smoke test: `curl https://wordis-bond-staging.workers.dev/health` → `{ok: true}`
7. ✅ Error tracking: Sentry captures zero startup errors (clean state)
8. ✅ Analytics: PostHog tracks first pageview

---

## 🔄 Phase Progression

```
Phase 5 (COMPLETE)
│
├─ 19 core packages implemented
├─ All 6 app repositories created
└─ All packages published to npm

            ↓

Phase 6 (READY FOR EXECUTION)
│
├─ Infrastructure automation scripts ready
├─ Credential gathering guide ready
├─ Step-by-step playbook ready
└─ Preflight verification: ✅ 15/15 pass

            ↓

Phase 7 (READY FOR EXECUTION)
│
├─ App scaffolding template ready
├─ Drizzle ORM schemas ready (6 canonical schemas)
└─ Validation tool ready

            ↓

Phase 8+ (AFTER PHASE 6-7 COMPLETE)
│
├─ Databases connected
├─ Auth configured
├─ CI/CD live
└─ Teams deploy apps
```

---

## 🆘 Help & Support

### Common Questions

**Q: Where do I start?**
- A: If you're the Infrastructure Engineer: Start with [PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md)
- A: If you're a Tech Lead: Start with [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- A: If you're an App Agent: Wait for Phase 6-7 complete, then see [PROJECT_STATUS.md#for-app-deployment-teams](./PROJECT_STATUS.md#for-app-deployment-teams)

**Q: What credentials do I need?**
- A: See [docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md) — detailed step-by-step guide

**Q: How long does Phase 6 take?**
- A: 6-8 hours total (3-4 hours for orchestrator to run, rest is verification)

**Q: Can I run Phase 6 partially?**
- A: Orchestrator is idempotent — can re-run at any point and it will skip already-created resources

**Q: What if something fails?**
- A: See [PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md) troubleshooting section or [docs/runbooks/lessons-learned.md](./docs/runbooks/lessons-learned.md)

### Resources

- **GitHub Issues:** github.com/adrper79-dot/factory_core/issues (label: `phase-6`)
- **Slack:** #factory-eng
- **Emergency contacts:** See STAGE_6_ONWARDS_PLAN.md

---

## 📝 Document Checklist

This index covers all documentation:

- [x] START_HERE.md — Master index for all roles
- [x] PROJECT_STATUS.md — Executive summary + next steps
- [x] DELIVERY_SUMMARY.md — What was delivered (this document's context)
- [x] PHASE_6_EXECUTION_PLAYBOOK.md — Step-by-step guide
- [x] PHASE_6_QUICK_START.md — Quick reference
- [x] PHASE_6_CHECKLIST.md — Detailed checklist
- [x] PHASE_6_7_TIMELINE.md — Master timeline
- [x] PHASE_6_7_READY_STATE.md — Deliverables inventory
- [x] docs/runbooks/CREDENTIALS_SETUP.md — Credential gathering
- [x] docs/runbooks/github-secrets-and-tokens.md — Secrets reference
- [x] docs/runbooks/lessons-learned.md — Common errors + fixes
- [x] docs/runbooks/environment-isolation-and-verification.md — Environment safety
- [x] docs/runbooks/deployment.md — Staging vs. production
- [x] docs/runbooks/secret-rotation.md — Token rotation
- [x] CLAUDE.md — Standing orders (updated)
- [x] factory_core_architecture.md — System design

**Total:** 16 documentation files + 5 automation scripts = **Complete delivery**

---

## 🚀 Next Steps

1. **For Infrastructure Engineer:**
   → Read [PHASE_6_EXECUTION_PLAYBOOK.md](./PHASE_6_EXECUTION_PLAYBOOK.md) and execute Phase 6

2. **For Tech Lead:**
   → Review [PROJECT_STATUS.md](./PROJECT_STATUS.md) and verify readiness

3. **For App Agents:**
   → Wait for Phase 6-7 complete, then follow setup in [PROJECT_STATUS.md#for-app-deployment-teams](./PROJECT_STATUS.md#for-app-deployment-teams)

4. **For Docs Team:**
   → Use [docs/APP_README_TEMPLATE.md](./docs/APP_README_TEMPLATE.md) for app-specific docs

---

**Version:** 1.0  
**Status:** ✅ PRODUCTION READY  
**Last updated:** April 27, 2026  
**Maintained by:** Factory Infrastructure Team

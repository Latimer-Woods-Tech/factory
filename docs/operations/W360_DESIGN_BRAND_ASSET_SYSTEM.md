# W360 Design & Brand Asset System

**W360-037 · Owner: D03, D04, D08, D14**  
**Status**: Active · Last updated: 2026-04-29

---

## Objective

Create a single inventory for reusable design/brand assets, define app-specific boundaries, and tie all assets to launch templates so each new app can ship with consistent quality and identity.

---

## 1) Reusable asset inventory

### Foundation tokens (Factory-wide)

| Asset | Path | Scope | Reuse policy |
|---|---|---|---|
| Semantic color/spacing/typography/motion/focus tokens | `packages/design-tokens/src/` | All Factory apps | Required baseline for new UI work |
| Token docs and usage examples | `packages/design-tokens/README.md` | All Factory apps | Canonical reference |

### UI primitives (Factory-wide)

| Asset | Path | Scope | Reuse policy |
|---|---|---|---|
| Shared UI components (`Button`, `Input`, `Label`, `Alert`, `Dialog`, `Toast`, `Card`, `EmptyState`, `LoadingState`, `Tabs`, `FormField`) | `packages/ui/src/index.ts` | All React app surfaces | Prefer shared primitives before app-local components |
| UI package docs and accessibility guidance | `packages/ui/README.md` | All React app surfaces | Canonical component behavior reference |

### Video template system (shared engine + app-level content)

| Asset | Path | Scope | Reuse policy |
|---|---|---|---|
| Remotion composition engine | `apps/video-studio/src/` | Video pipelines | Shared engine + rendering contract |
| Composition definitions (`MarketingVideo`, `TrainingVideo`, `WalkthroughVideo`) | `apps/video-studio/README.md` | Practitioner/Xico media outputs | Reuse composition IDs + props contract |
| Render entrypoint | `apps/video-studio/src/render.ts` | CI/GitHub Actions render pipeline | Required integration path |

### Operational templates (shared)

| Asset | Path | Scope | Reuse policy |
|---|---|---|---|
| Worker scaffold template | `docs/templates/worker-basic/` | New Worker services | Required starter template |
| API contract template | `docs/templates/openapi/template.yaml` | Public/internal APIs | Required when introducing routes |
| Architecture decision template | `docs/templates/adr/template.md` | Cross-team decisions | Required for structural changes |
| Brand pack template | `docs/templates/BRAND_PACK_TEMPLATE.md` | App launch branding | Required before launch sign-off |

---

## 2) App-specific design boundaries

The rule is: **shared principles and primitives in Factory; app voice and visual identity at app scope**.

| Surface | Shared from Factory | App-specific ownership |
|---|---|---|
| `apps/admin-studio-ui` | design tokens, UI primitives, accessibility baseline | operator-focused information hierarchy, role-state UX, audit visual language |
| `apps/video-studio` | render engine conventions, composition contracts, pipeline hooks | per-app visual storytelling, brand color/accent/logo inputs |
| `apps/videoking` | shared standards + reusable UI patterns | app-level brand personality, marketing layouts, launch narrative visuals |
| `apps/prime-self-reference` | shared standards + reference scaffolds | reference examples only (no mandatory brand inheritance) |
| `apps/prime-self-smoke` | smoke/a11y patterns | none (quality gate surface) |

Boundary guardrails:
- Do not hardcode app brand colors in shared packages (`packages/design-tokens`, `packages/ui`).
- App-specific logos and campaign assets stay in app repos or app-scoped directories.
- Shared package changes must preserve cross-app neutrality and accessibility guarantees.

---

## 3) Launch template linkage

To tie design/brand assets to launch readiness, each launch PR must include:

1. Completed `BRAND_PACK_TEMPLATE.md` artifact for the app.
2. Token usage confirmation against `packages/design-tokens`.
3. UI primitive usage statement (or documented exception).
4. Video template mapping (if the app renders video) using `apps/video-studio` composition IDs.
5. Accessibility evidence link (axe or equivalent gate).

Minimum launch artifact set:
- `docs/templates/BRAND_PACK_TEMPLATE.md`
- `docs/templates/openapi/template.yaml` (if route/API changes)
- `docs/templates/adr/template.md` (if architecture decision needed)

---

## 4) Current gaps and follow-ups

| Gap | Impact | Action |
|---|---|---|
| No centralized in-repo logo binary library | Harder to discover existing marks | Keep logo assets app-scoped and referenced in app brand packs |
| No automated check that launch PRs include brand pack | Process drift risk | Add CI checklist item in future W360 quality pass |
| App-specific Figma references not codified in repo | Design handoff fragmentation | Add Figma URL fields to each app brand pack document |

---

## 5) Definition of done for W360-037

- Reusable design/brand assets inventoried with concrete paths.
- App-specific boundaries explicitly defined.
- Launch linkage documented through required templates.
- Brand pack template created and available under `docs/templates/`.

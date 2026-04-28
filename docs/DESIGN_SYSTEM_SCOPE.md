# Design System Scope & Reuse Strategy

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T1.4 — Define Design System Scope  
**Reference:** T1.1 (Design Quality Rubric), T4.2 (Frontend Standards)

---

## Mission

Decide **which design decisions are shared** (one implementation for all apps) vs **which are app-specific** (each app owns its own), so:
- **Shared components** are reusable, tested once, maintained centrally
- **App-specific components** allow brand differentiation (VideoKing unique look, future app X unique look)
- **Consistency within each app** through shared tokens + shared component patterns
- **Consistency across apps** for user expectations (buttons work the same everywhere)

---

## Part 1: The Matrix — What's Shared vs App-Specific

### Tier 0: Non-Negotiable Shared (Factory Core)

These **MUST be shared** across all apps; no exceptions.

| Asset | Reason | Location |
|-------|--------|----------|
| **Typography Scale** | Users should recognize heading hierarchy across apps | `@adrper79-dot/design-tokens` |
| **Color Accessibility** | WCAG 4.5:1 contrast ratios are universal | `@adrper79-dot/design-tokens` |
| **Motion Timing** | Reduces cognitive load if modals/toasts animate identically | `@adrper79-dot/design-tokens` |
| **Spacing Scale** (8px grid) | CSS consistency; easier to reason about alignment | `@adrper79-dot/design-tokens` |
| **Focus Styles** | Keyboard navigation must look consistent | `@adrper79-dot/design-tokens` |
| **Error Colors** (red), **Success** (green), **Info** (blue) | Users expect status to look the same | `@adrper79-dot/design-tokens` |
| **Dark Mode Support** | If any app supports it, all must handle color tokens identically | `@adrper79-dot/design-tokens` |
| **Component API** (forwardRef, className) | One pattern for component consumption across apps | TypeScript spec |

### Tier 1: Recommended Shared (Most Apps)

These **SHOULD be shared** unless you have a specific reason not to.

| Asset | Why It's Shared | When It's App-Specific | Location |
|-------|---|---|---|
| **Button Component** (primary/secondary/tertiary) | Same interaction everywhere | If app needs unique visual language (e.g., game UI) | `@adrper79-dot/ui` |
| **Input Component** (text, email, password) | Same form UX everywhere | If app uses unconventional input paradigm | `@adrper79-dot/ui` |
| **Modal Component** | Consistent dialog behavior | If app needs custom modal animation/layout | `@adrper79-dot/ui` |
| **Toast/Notification** | Consistent placement + exit timing | If app needs unique notification style | `@adrper79-dot/ui` |
| **Navigation Patterns** (tabs, breadcrumbs, drawer) | Users learn once; works everywhere | If app uses unique navigation model | `@adrper79-dot/ui` |
| **Loading Spinner** | Familiar loading indication | If app has branded loader | `@adrper79-dot/ui` |
| **Form Validation Patterns** | Real-time feedback, error messages | If app has domain-specific validation UX | `@adrper79-dot/ui` |
| **Checkbox, Radio, Select** | Standard form controls | Rarely needs overrides | `@adrper79-dot/ui` |

### Tier 2: Likely App-Specific

These **SHOULD NOT be shared**; each app owns them.

| Asset | Why It's App-Specific | When It IS Shared | Location |
|-------|---|---|---|
| **Hero Section / Landing Page Layout** | App-specific brand; unique value prop on hero | Never | `apps/{app}/src/components/` |
| **Empty State Illustrations** | App-specific tone + brand | If exact same message (rare) | `apps/{app}/src/assets/` |
| **Product-Specific Components** (e.g., video player, creator profile card) | Core app differentiation | Never (even if future app X also has video) | `apps/{app}/src/components/` |
| **Pricing / Checkout UX** | Monetization model is app-specific | Only the base payment input | `apps/{app}/src/components/` |
| **Creator Dashboard Layout** | Unique to creator experience | If future creator app exists, maybe | `apps/{app}/src/components/` |
| **Color Palette** (beyond WCAG essentials) | Brand identity | Only if multiple apps share brand | `apps/{app}/tailwind.config.js` |
| **Page-Specific Navigation** | App routing + information architecture | Common patterns (tabs) shared | `apps/{app}/src/` |

### Tier 3: Package-Specific (Not Shared)

These belong in Factory **packages**, not design system.

| Asset | Package Owner | Why |
|-------|---|---|
| **Operator Table** | `@adrper79-dot/admin-ui` | Only admin apps use it; consumer apps don't |
| **Moderation UI** | `@adrper79-dot/admin-ui` | Domain-specific tooling |
| **Video Player** | `@adrper79-dot/video` | Complex stateful component; versioned with video backend |
| **Analytics Dashboard** | `@adrper79-dot/analytics` | Specialized visualization patterns |

---

## Part 2: Design System Architecture

### Factory-Level Components (`@adrper79-dot/ui`)

✅ **Shared across all apps.**

**Version:** Semantic versioning; breaking changes require coordination

**Components:**

```
@adrper79-dot/ui/
├── Button
│   ├── Button.tsx
│   ├── Button.stories.tsx
│   ├── Button.test.tsx
│   └── types.ts
├── Input
├── Checkbox
├── Radio
├── Select
├── Modal
├── Toast
├── Spinner
├── Breadcrumbs
├── Tabs
├── Card
├── ...
└── index.ts
```

**Tokens Package (`@adrper79-dot/design-tokens`):**

```
@adrper79-dot/design-tokens/
├── colors/
│   ├── semantic.json (error, success, info, warning)
│   ├── wcag.json (accessible color pairs)
│   └── utilities.json (gray scale)
├── typography/
│   ├── scale.json (h1-h4, body, caption)
│   └── weights.json (400, 600, 700)
├── spacing/
│   └── scale.json (8px grid: 8, 16, 24, 32, 40, ...)
├── motion/
│   └── timing.json (fast: 100ms, normal: 300ms, slow: 500ms)
└── tailwind-config.js (exports tokens for Tailwind CSS)
```

**Installation in App:**

```bash
npm install @adrper79-dot/ui @adrper79-dot/design-tokens
```

**Usage:**

```typescript
import { Button } from '@adrper79-dot/ui';
import { colors, spacing } from '@adrper79-dot/design-tokens';

<Button variant="primary" size="lg">
  Save
</Button>

<div style={{ color: colors.semantic.error, padding: spacing.scale['16'] }}>
  Error message
</div>
```

### App-Level Components (VideoKing Example)

✅ **Maintained per-app; NOT shared.**

**VideoKing Component Architecture:**

```
apps/videoking/src/components/
├── layout/
│   ├── Header.tsx (VideoKing brand header)
│   ├── Footer.tsx
│   ├── SidebarNav.tsx
│   └── MainLayout.tsx
├── player/
│   ├── VideoPlayer.tsx (VideoKing-specific player UI)
│   ├── PlaybackControls.tsx
│   ├── ProgressBar.tsx
│   └── ...
├── creator/
│   ├── CreatorCard.tsx (VideoKing creator profile card)
│   ├── CreatorOnboarding.tsx
│   ├── ChannelHeader.tsx
│   └── ...
├── checkout/
│   ├── SubscribeFlow.tsx (VideoKing pricing UX)
│   ├── PaymentInfo.tsx
│   └── ConfirmationScreen.tsx
└── shared/
    ├── VideoThumbnail.tsx
    ├── ChannelLink.tsx
    └── ...
```

**Extends Shared UI:**

```typescript
// ❌ Don't: reimplement Button
function SubmitButton() {
  return <button className="custom-button">Submit</button>;
}

// ✅ Do: use shared Button, extend with VideoKing styling
import { Button } from '@adrper79-dot/ui';

function VideoKingSubscribeButton() {
  return (
    <Button 
      variant="primary" 
      className="videoking-subscribe-action"
    >
      Subscribe Now
    </Button>
  );
}

// In tailwind.config.js:
// .videoking-subscribe-action { 
//   font-size: 18px; /* VideoKing-specific size */
//   box-shadow: special-videoking-shadow;
// }
```

### Operator / Admin Components (`@adrper79-dot/admin-ui`)

✅ **Shared across all admin apps.**  
📌 **Separate from consumer-facing UI** (different UX goals)

**Location:** `packages/admin-ui/`

**Example:**

```typescript
// admin-ui package exports operator patterns
import { OperatorTable, StatusChip, ConfirmationModal } from '@adrper79-dot/admin-ui';
```

---

## Part 3: Component Ownership & Maintenance

### When a Component Starts in One App

**Example:** VideoKing creates a unique "Subscribe Now" button (special animation, brand color)

**Option A: Keep It App-Specific (Best Choice for VideoKing)**
- Lives in `apps/videoking/src/components/`
- Extract reusable sub-components (animation helpers, color utilities) to `@adrper79-dot/design-tokens` if useful elsewhere

**Option B: Promote to Shared (When Multiple Apps Need It)**
- After 2+ apps have reimplemented something similar, consider promotion
- Move to `@adrper79-dot/ui` with full test coverage + documentation
- Apps update import paths and deprecate local versions
- Major version bump in tokens package

### When a Component Spans Apps

**Example:** Future app B needs video playback; VideoKing has `VideoPlayer`

**Not Shared (Best Choice):**
- VideoKing's `VideoPlayer` stays app-specific (heavily optimized for VideoKing's content model)
- App B builds its own `VideoPlayer` (different features, controls, layout)
- Both import `@adrper79-dot/video` for common video utilities (sizing, aspect ratios, encoding specs)

**Shared (If Both Apps Have Identical Requirements):**
- Extract common behavior to `@adrper79-dot/ui` or new package
- Unlikely for complex components; reserved for basic UI abstractions

---

## Part 4: Token Usage Examples

### Colors (Semantic Mapping)

**Define semantic tokens in `@adrper79-dot/design-tokens`:**

```json
{
  "colors": {
    "semantic": {
      "error": "#D32F2F",      // WCAG AA compliant red
      "error-bg": "#FFEBEE",   // Light red background
      "success": "#388E3C",    // WCAG AA green
      "success-bg": "#E8F5E9",
      "info": "#1976D2",       // Blue
      "info-bg": "#E3F2FD",
      "warning": "#F57C00",    // Orange
      "warning-bg": "#FFF3E0"
    }
  }
}
```

**Use in App:**

```typescript
// tailwind.config.js
import { colors } from '@adrper79-dot/design-tokens';

export default {
  theme: {
    extend: {
      colors: {
        error: colors.semantic.error,
        success: colors.semantic.success,
        // ...
      }
    }
  }
};

// Component usage:
<div className="text-error bg-error-bg">Error message</div>
```

### Typography (Scale)

**Define in tokens:**

```json
{
  "typography": {
    "h1": { "fontSize": "32px", "lineHeight": "40px", "fontWeight": 600 },
    "h2": { "fontSize": "28px", "lineHeight": "36px", "fontWeight": 600 },
    "h3": { "fontSize": "24px", "lineHeight": "32px", "fontWeight": 600 },
    "h4": { "fontSize": "20px", "lineHeight": "28px", "fontWeight": 600 },
    "body": { "fontSize": "16px", "lineHeight": "24px", "fontWeight": 400 },
    "caption": { "fontSize": "12px", "lineHeight": "16px", "fontWeight": 400 }
  }
}
```

**Use:**

```typescript
// tailwind.config.js
export default {
  theme: {
    fontSize: {
      h1: ['32px', { lineHeight: '40px', fontWeight: 600 }],
      // ...
    }
  }
};

// Component:
<h1 className="text-h1">Main Title</h1>
<p className="text-body">Normal paragraph</p>
```

### Spacing (8px Grid)

**Define:**

```json
{
  "spacing": {
    "0": "0px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px"
  }
}
```

**Use (Tailwind):**

```typescript
<div className="p-6 mb-4">
  {/* padding: 24px, margin-bottom: 16px */}
</div>
```

---

## Part 5: New App Onboarding

### When Starting a New Factory App (App X)

**Week 1: Setup**

1. Install shared packages:
   ```bash
   npm install @adrper79-dot/ui @adrper79-dot/design-tokens
   ```

2. Configure Tailwind:
   ```javascript
   // tailwind.config.js
   import { tailwindConfig } from '@adrper79-dot/design-tokens';
   
   export default {
     ...tailwindConfig,
     theme: {
       extend: {
         // App X overrides go here (app-specific colors, spacing, etc.)
       }
     }
   };
   ```

3. Create app-specific components folder:
   ```
   src/components/
   ├── shared/        (use @adrper79-dot/ui here)
   └── app-x/         (App X brand components)
   ```

**Week 2: Component Inventory**

1. List all components App X needs
2. Check if they exist in `@adrper79-dot/ui`
3. If not, create in `src/components/app-x/`
4. If multiple apps might reuse, flag for promotion (don't promote immediately)

**Ongoing: Dependency Upgrades**

When `@adrper79-dot/ui` ships new version:
- Minor version: backward compatible; upgrade freely
- Major version: breaking changes; review before upgrading

---

## Part 6: VideoKing Reuse Strategy

### Current VideoKing Components (Audit)

| Component | Location | Candidate for Shared? | Reason |
|-----------|----------|---|---|
| Button (custom) | src/components/Button | No | VideoKing-specific animation |
| Modal | src/components/Modal | Yes → Migrate to `@adrper79-dot/ui` | Generic pattern |
| Toast | src/components/Toast | Yes → Migrate | Generic pattern |
| VideoPlayer | src/components/VideoPlayer | No | Complex, VideoKing-specific |
| CreatorCard | src/components/CreatorCard | No | Domain app-specific |
| SubscribeFlow | src/components/SubscribeFlow | No | Monetization UX is app-specific |
| Spinner | src/components/Spinner | Yes → Migrate | Generic pattern |
| Input, Checkbox, Select | src/components/Form/ | Yes → Migrate | Standard form controls |

### Phased Migration Plan (Phase C/D)

**Phase C (May 15–June 15):**
- [ ] Extract Modal, Toast, Spinner, Input, Checkbox, Select to `@adrper79-dot/ui`
- [ ] Bump `@adrper79-dot/ui` to v0.2.0
- [ ] Update VideoKing imports (use shared components)
- [ ] VideoKing retains Button (custom), VideoPlayer, CreatorCard, SubscribeFlow

**Phase D (June 15+):**
- [ ] Promote Button → If another app needs exact same animation, move to shared; otherwise keep VideoKing-specific
- [ ] Create App X; measure reuse of `@adrper79-dot/ui` components
- [ ] Identify patterns that recur; promote top 3 to v1.0 of shared UI

---

## Part 7: Exit Criteria (by May 15, 2026)

- [x] Design system matrix created (Tier 0/1/2/3 assets)
- [x] Shared vs app-specific boundaries defined
- [x] Architecture documented (Factory UI package, app-level components, operator UI package)
- [x] Component ownership model documented (who maintains what)
- [x] Token design system created (`@adrper79-dot/design-tokens` spec)
- [x] VideoKing reuse strategy documented (audit + migration plan)
- [x] Tailwind configuration strategy documented
- [ ] `@adrper79-dot/ui` v0.1 released with 5 core components (May 5–8)
- [ ] `@adrper79-dot/design-tokens` v1.0 released (May 5)
- [ ] VideoKing migrated to use shared tokens + components (May 8–12)
- [ ] New app scaffolding template includes design system setup (May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Design Lead | Design system scope matrix; shared vs app-specific boundaries; token architecture; VideoKing reuse plan |

---

**Status:** ✅ T1.4 READY FOR IMPLEMENTATION  
**Next Action:** Release `@adrper79-dot/design-tokens` v1.0 (May 5); extract VideoKing shared components (May 5–8)


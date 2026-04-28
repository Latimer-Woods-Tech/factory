# Factory Design System Scope

**Version:** 1.0  
**Effective Date:** April 28, 2026  
**Maintained By:** Design System Working Group  

---

## Overview

This document clarifies ownership of UI components between the **Factory Core Design System** (shared) and **app-specific component libraries** (videoking, admin-studio, etc.).

**Core Principle:** If a component is used by *multiple journeys* or *multiple apps*, it belongs in Factory. If it's unique to one journey or app, it stays in the app.

---

## Factory Core Design System (Reusable Infrastructure)

### Scope: Factory-Owned Components

Components in Factory Core must meet these criteria:
- ✅ Used by **≥2 different journeys** across one or more apps
- ✅ Have no app-specific business logic
- ✅ Are documented and tested
- ✅ Follow Factory quality gates (90%+ coverage, strict TS, ESLint clean)

### Tier 1: Design Tokens (Foundation)

**Location:** `packages/design-system/src/tokens.ts` (exported as JSON or TS module)

**Categories:**

#### Color Palette
```typescript
export const colors = {
  // Brand
  primary: '#0052CC',      // Core blue
  secondary: '#FF6600',    // Accent orange (if in brand)
  
  // Semantic
  success: '#10B981',      // Green (validation, approvals)
  danger: '#EF4444',       // Red (errors, destructive)
  warning: '#F59E0B',      // Amber (warnings, cautions)
  info: '#3B82F6',         // Blue (FYI, notices)
  
  // Neutrals
  surface: {
    bg: '#FFFFFF',         // Light backgrounds
    border: '#E5E7EB',     // Light borders
    hover: '#F9FAFB',      // Light hover states
  },
  text: {
    primary: '#1F2937',    // Dark text
    secondary: '#6B7280',  // Muted text
    disabled: '#D1D5DB',   // Disabled text
    inverse: '#FFFFFF',    // Text on dark
  },
};
```

**Usage:**
```tsx
// In app components
import { colors } from '@adrper79-dot/design-system';

<button style={{ backgroundColor: colors.primary }}>Click me</button>
```

#### Spacing Scale (4px grid)
```typescript
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};
```

#### Typography
```typescript
export const typography = {
  fontFamily: {
    base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

#### Shadows, Border Radius, Z-Index
```typescript
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
};

export const zIndex = {
  hide: -1,
  base: 0,
  backdrop: 40,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
};
```

### Tier 2: Atoms (Primitive Components)

**Location:** `packages/design-system/src/components/`

**Included in Factory:**

#### Typography
- `<Heading>` — h1–h6 semantic headings
- `<Body>` — p, spans, text fragments
- `<Label>` — form labels, semantic
- `<Hint>` — small help text, secondary styling

#### Form Controls
- `<Button>` — primary, secondary, tertiary, icon variants
- `<Input>` — text, email, password, tel, URL (no file upload)
- `<Checkbox>` — single checkbox with label
- `<Radio>` — single radio button with label
- `<Select>` — native select (not custom dropdown; see app-specific)
- `<Textarea>` — multiline text input
- `<Label>` — associated with inputs

#### Feedback
- `<Alert>` — success, error, warning, info (4 semantic types)
- `<Badge>` — tags, status pills (not contextual)
- `<ProgressBar>` — linear progress indicator
- `<Skeleton>` — placeholder loading state

### Tier 3: Patterns (Component Compositions)

**Location:** `packages/design-system/src/patterns/`

These are combinations of atoms used repeatedly:

#### Common Patterns
- **Error Message Layout** — Label + icon + text + aria-live
- **Loading State** — Skeleton + spinner + disabled overlay
- **Empty State** — Icon + heading + CTA button
- **Success Feedback** — Icon + message + auto-dismiss
- **Form Field Container** — Label + input + hint + error message
- **Focus Styles** — Outline + offset (shared CSS)

### Tier 4: Accessibility (Shared Foundation)

**Guaranteed in Factory components:**

- ✅ WCAG 2.2 AA compliant
- ✅ Keyboard navigation (Tab, Enter, Escape, arrow keys as appropriate)
- ✅ Screen reader tested (NVDA, JAWS)
- ✅ Semantic HTML (`<button>`, `<label>`, `<fieldset>`, etc.)
- ✅ ARIA attributes (role, aria-label, aria-describedby, aria-live, etc.)
- ✅ Color contrast ≥7:1 text, ≥3:1 non-text
- ✅ Focus indicator visible (3px outline)

---

## App-Owned Components (Videoking-Specific)

### Scope: Videoking Retains These

Components should stay in videoking if they are:
- ✅ Used by **only 1 journey** (e.g., video player only in "watch" flow)
- ✅ Have **domain-specific logic** (video-specific, creator-specific, payment-specific)
- ✅ Are unlikely to be reused in other Factory apps

### List of Videoking-Owned Components

#### Videoking Journeys

**Journey 1 & 4: Video Viewing (Feed + Player)**
- `<VideoCard>` — Thumbnail + title + creator + play button
- `<VideoPlayer>` — Cloudflare Stream wrapper with custom controls
- `<PlayerControls>` — Play, pause, seek, volume, quality selector, fullscreen
- `<VideoFeed>` — Paginated video grid with infinite scroll
- `<VideoFilters>` — Category, duration, upload date filters
- `<SubscribePrompt>` — Modal to subscribe before watching locked videos

**Journey 2: Creator Signup**
- `<CreatorSignupForm>` — Multi-step form (email → name → profile → account)
- `<ProfilePhotoUpload>` — Avatar upload with preview + crop
- `<StripeConnectButton>` — Stripe Connect auth + status

**Journey 3 & 5: Upload & Metadata**
- `<VideoUploadZone>` — Drag-drop file upload zone
- `<MetadataForm>` — Title, description, category, tags, thumbnail
- `<TranscodeStatus>` — Progress bar + estimated time
- `<PublishButton>` — Pre-publish checklist + go-live action
- `<ThumbnailSelector>` — Choose frame from video

**Journey 3 & 6: Subscription Tiers**
- `<TierCard>` — Plan name + price + features + CTA
- `<SubscriptionCheckout>` — Tier selector + payment form
- `<BillingPeriodToggle>` — Annual/monthly toggle with discount badge

**Journey 4: PPV Paywall**
- `<PaywallOverlay>` — "Unlock for $X" banner + CTA
- `<UnlockButton>` — Purchase button with loading state
- `<PaymentForm>` — Card input + CVV + billing address
- `<ConfirmationModal>` — Order confirmation + receipt

**Journey 6: Dashboard**
- `<DashboardLayout>` — Sidebar + main area layout (creator-specific)
- `<EarningsCard>` — Monthly earnings summary + trend
- `<EarningsChart>` — Line/bar chart of earnings over time (see table alternative)
- `<SubscribersList>` — Table of subscribers with tier + join date
- `<AnalyticsPanel>` — Views, watch time, engagement metrics
- `<TimeRangeSelector>` — Date picker for filtering data
- `<ExportButton>` — CSV/JSON export actions

**Journey 7: Stripe Connect**
- `<StripeConnectForm>` — Bank account + tax ID fields
- `<StripeConnectFrame>` — Embedded Stripe iframe manager
- `<VerificationStatus>` — Status badge (pending/verified/rejected)

**Journey 8: Payout Operations (Admin-Only)**
- `<PayoutBatchTable>` — Table of batches with status + actions
- `<ExecutePayoutButton>` — Confirmation dialog + execute action
- `<DLQItemsPanel>` — Failed payout details + retry button
- `<RecoveryWorkflow>` — Multi-step DLQ recovery (admin only)

#### Custom Styling

- **Video Player Theming** — Dark theme + accent color customization
- **Creator Dashboard Personalization** — Tier-based color schemes
- **Paywall Branding** — Creator's colors/logo in unlock prompt

---

## Decision Tree: Factory vs. App

```
Is this component used by 2+ journeys in the same app?
  └─ YES → Is it generic (no app-specific logic)?
           └─ YES → Consider Factory (if also reusable across other apps)
           └─ NO → App-owned (journey-specific)
  
  └─ NO → Is it likely to be used in another Factory app?
         └─ YES → Propose to Factory (future)
         └─ NO → App-owned (videoking-specific)

Is it a button, input, label, or other primitive?
  └─ YES → Factory (every app needs these)
  
Is it handling videoking-specific domain logic?
  └─ YES → App-owned (video transcoding, payout batches, etc.)

Is it a 1:1 mapping to a Factory component?
  └─ YES → Use Factory directly; skip app version
  
Unsure?
  └─ Ask accessibility champion or design system working group
```

---

## Migration: Moving Components to Factory

### Process

1. **Audit** — Identify component candidates (≥2 journeys, no app logic)
2. **Generalize** — Remove app-specific logic; add configuration
3. **Document** — Add JSDoc, stories, accessibility checklist
4. **Test** — Ensure 90%+ coverage, strict TS, accessibility pass
5. **Publish** — Tag version, publish to GitHub Packages
6. **Adopt** — App imports from Factory instead of local copy

### Example: Extracting `<VideoCard>` to Factory (Hypothetical)

**Current (Videoking-owned):**
```tsx
// apps/admin-studio/src/components/VideoCard.tsx
export function VideoCard({ video, creator, onClick, isSubscribed }) {
  return (
    <div onClick={onClick} className="video-card">
      <img src={video.thumbnailUrl} alt="" />
      <h3>{video.title}</h3>
      <p>by {creator.name}</p>
      {!isSubscribed && <div className="lock">🔒</div>}
    </div>
  );
}
```

**After Generalization (Factory-owned):**
```tsx
// packages/design-system/src/components/MediaCard.tsx
/**
 * A reusable card component for displaying media (video, image, article).
 * - Displays thumbnail/preview image
 * - Shows title + metadata
 * - Optional overlay badge (lock, new, featured, etc.)
 * - Keyboard accessible, screen reader friendly
 */
export interface MediaCardProps {
  imageUrl: string;
  imageAlt: string;
  title: string;
  metadata?: string;        // "by Jane Smith" or "5 views"
  badge?: {
    label: string;
    icon?: React.ReactNode;
    variant: 'locked' | 'new' | 'featured';
  };
  onClick?: () => void;
  isClickable?: boolean;
}

export function MediaCard({
  imageUrl,
  imageAlt,
  title,
  metadata,
  badge,
  onClick,
  isClickable = true,
}: MediaCardProps) {
  const Component = isClickable ? 'button' : 'div';
  
  return (
    <Component 
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      className="media-card"
      aria-label={`${title}${metadata ? `, ${metadata}` : ''}`}
    >
      <div className="media-card__image">
        <img src={imageUrl} alt={imageAlt} />
        {badge && (
          <Badge variant={badge.variant} aria-hidden={!badge.label}>
            {badge.icon} {badge.label}
          </Badge>
        )}
      </div>
      <h3 className="media-card__title">{title}</h3>
      {metadata && <p className="media-card__metadata">{metadata}</p>}
    </Component>
  );
}
```

**App Adoption (Videoking):**
```tsx
// apps/admin-studio/src/components/VideoCard.tsx (now thin wrapper)
import { MediaCard } from '@adrper79-dot/design-system';

export function VideoCard({ video, creator, onClick, isSubscribed }) {
  return (
    <MediaCard
      imageUrl={video.thumbnailUrl}
      imageAlt={`Thumbnail for ${video.title}`}
      title={video.title}
      metadata={`by ${creator.name}`}
      badge={isSubscribed ? undefined : {
        label: 'Unlock needed',
        icon: '🔒',
        variant: 'locked',
      }}
      onClick={onClick}
      isClickable
    />
  );
}
```

---

## Maintenance & Versioning

### Factory Design System Versioning

- **Major (`v2.0.0`)** — Breaking API changes (prop renaming, removed components)
- **Minor (`v1.1.0`)** — New features (new props, new components)
- **Patch (`v1.0.1`)** — Bug fixes, accessibility improvements

### SemVer Examples

```
v0.1.0 → v0.2.0  // First reusable component added (minor)
v0.2.0 → v0.2.1  // Color contrast fix (patch)
v0.2.1 → v1.0.0  // Stable release; core tokens + 8 components (major)
```

### Deprecation Policy

When retiring a Factory component:
1. **Announce** — Document in changelog, email team
2. **Support** — Keep old version available for 2 releases (6–12 weeks)
3. **Migrate** — Provide migration guide + examples
4. **Remove** — Delete from next major version

---

## Governance

### Design System Working Group

**Members:**
- Design lead (design decisions)
- 1–2 backend engineers (implementation, accessibility)
- Product lead (prioritization)

**Meeting:** 2nd Friday of month, 1 hour  
**Decisions:** Consensus required for new Factory components

### Proposal Process

**To add component to Factory:**

1. **Open Issue** — Title: "[PROPOSAL] Add `<ComponentName>` to Factory"
   - Problem: Why is this needed?
   - Solution: Show component API + usage examples
   - Coverage: Which apps/journeys will use it?
   - Effort: Estimate to generalize + test + document

2. **Review** — Working group votes (simple majority)

3. **Implement** — Champion adds to Factory, runs through quality gates

4. **Publish** — Tag release, update changelog

5. **Adopt** — Apps switch to Factory component

---

## Current Status (April 28, 2026)

### Factory Core (v0.1.0)

**Tier 1: Tokens** — Design tokens (color, spacing, typography)  
**Tier 2: Atoms** — Button, Input, Heading, Alert, Badge  
**Tier 3: Patterns** — Error layout, loading state, empty state  
**Tier 4: Accessibility** — WCAG 2.2 AA baseline  

**Status:** Stable; ready for apps to adopt

### Factory Roadmap (Next 3 Months)

- **May** — Adopt tokens + atoms in videoking; measure component count
- **June** — Extract 3–5 journey-agnostic components (MediaCard, FormField, etc.)
- **July** — Admin-studio adopts Factory components; reduce duplication by 40%

### Videoking Component Audit (Baseline)

- **Total components:** ~60 implemented
- **Factory-adopted:** 8 (Button, Input, Label, Alert, Badge, Heading, Body, Hint)
- **Candidates for Factory:** 8 (MediaCard, FormField, Card, Modal, Tabs, Skeleton, Toast, Dropdown)
- **Videoking-specific:** 32 (journey domain components)
- **Target:** Reduce to ~50 components (eliminate duplicates, move generics to Factory)

---

## Success Criteria

✅ **T1.4 Complete When:**
- [ ] Design system scope document published
- [ ] Tokens codified in `packages/design-system/tokens.ts`
- [ ] Videoking component audit shows ~50 components (down from 60)
- [ ] No duplicate components between Factory + app
- [ ] All Factory components WCAG 2.2 AA compliant
- [ ] Component decision tree adopted by team

---

**Document Version:** 1.0  
**Effective Date:** April 28, 2026  
**Next Review:** July 1, 2026

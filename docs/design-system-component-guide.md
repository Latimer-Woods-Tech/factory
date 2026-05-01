# Factory Component Usage Guide

**Purpose:** Help developers decide whether to use Factory primitives vs. app-specific components  
**Audience:** Frontend engineers building videoking, admin-studio, and future Factory apps  

---

## Decision Trees

### When to Use Factory Components

```
Do I need a button, input, heading, or other UI primitive?
  ↓ YES
  → Use Factory (every app needs these)
  
Does my component need styling from design tokens?
  ↓ YES
  → Import tokens; compose with Factory primitives
  
Is this component used by 2+ journeys in the same app?
  ↓ YES
  → Check if it's generic (no app-specific logic)
    ↓ Generic?
    → Use Factory (or propose to Factory if not there yet)
    ↓ App-specific?
    → Build in app
    
Is this component used by multiple Factory apps?
  ↓ YES
  → Add to Factory (standardize across all apps)
  
Unsure?
  → Ask in #design-system Slack channel
```

### When to Build App-Specific Components

```
Does my component handle app-specific business logic?
  ↓ YES
  → Build in app (don't put in Factory)
  
Examples:
  - VideoPlayer (Cloudflare Stream wrapper) → app-specific
  - PaymentForm (Stripe, currency, tax) → app-specific
  - DashboardLayout (creator dashboard) → app-specific
  - Button (generic, reusable) → Factory
  - FormField pattern → Factory
  - VideoCard (uses Factory primitives) → app-specific
```

---

## Component Maturity Matrix

### Tier 1: Primitives (Use Without Hesitation ✅)

These are guaranteed to be stable, accessible, and documented.

| Component | Use Case | App Adoption | Notes |
|-----------|----------|------|-------|
| `<Button>` | Primary, secondary, tertiary actions | ✅ Videoking, admin-studio | All variants supported |
| `<Input>` | Text, email, password, URL, tel | ✅ All apps | With optional icon prop |
| `<Heading>` | h1–h6 semantic headings | ✅ All apps | Auto sizing based on level |
| `<Body>` | Paragraph, span, text fragments | ✅ All apps | Use for all prose |
| `<Label>` | Form input labels | ✅ All apps | Always associated (aria-labelledby) |
| `<Alert>` | Success, error, warning, info feedback | ✅ Videoking, admin-studio | With aria-live regions |
| `<Badge>` | Status tags, labels, pills | ✅ Videoking | 4 semantic variants |
| `<Hint>` | Secondary text, form hints | ✅ Videoking | Always associated (aria-describedby) |

**Rule:** These are always the right choice. No reason to build custom versions.

---

### Tier 2: Patterns (Use for Common Structures ✅)

These are composed of Tier 1 primitives; stable and opinionated layouts.

| Component | Use Case | Example |
|-----------|----------|---------|
| `<FormField>` | Label + Input + Error + Hint layout | Any form input |
| `<ErrorLayout>` | Error message with icon (not color-only) | Form validation errors |
| `<LoadingState>` | Skeleton + spinner overlay | Data loading state |
| `<EmptyState>` | Icon + heading + CTA for empty views | 0 results, no data |
| `<Card>` | Container with shadow/border | Feed items, dashboard cards |
| `<PageLayout>` | Top nav + main + footer | Every page |

**Rule:** Use these for consistency. Don't copy/modify; use as-is. If you need customization, create an app-specific wrapper.

---

### Tier 3: Utilities (Use When Available)

These are helper components for common UI patterns.

| Component | Category | Status | When to Use |
|-----------|----------|--------|-----------|
| `<Spinner>` | Loading | ✅ Factory | Any loading state |
| `<Toast>` | Notifications | ✅ Factory | Temporary feedback |
| `<Tooltip>` | Popovers | ✅ Factory | Hover hints (keyboard accessible) |
| `<Pagination>` | Navigation | ✅ Factory | Multi-page lists |
| `<Breadcrumb>` | Navigation | ✅ Factory | Current page hierarchy |
| `<Tabs>` | Layout | ✅ Factory | Tab-based navigation |
| `<Dialog>` | Modals | ✅ Factory | Alerts, forms, confirmations |

**Rule:** Check Factory first. If not available, ask before building custom.

---

### Tier 4: App-Specific (Build in App 🎬)

These are domain-specific to videoking; don't belong in Factory.

| Component | Journey | Status | Example |
|-----------|---------|--------|---------|
| `<VideoCard>` | 1 (Discover) | 🎬 App | Thumbnail + title + metadata |
| `<VideoPlayer>` | 1, 4 (Watch/PPV) | 🎬 App | Cloudflare Stream wrapper |
| `<PlayerControls>` | 1, 4 (Watch/PPV) | 🎬 App | Play, pause, seek, quality |
| `<TierCard>` | 3 (Subscribe) | 🎬 App | Plan display + select |
| `<PaymentForm>` | 3, 4 (Checkout) | 🎬 App | Stripe card, CVV, billing|
| `<MetadataForm>` | 5 (Upload) | 🎬 App | Title, description, tags |
| `<EarningsChart>` | 6 (Dashboard) | 🎬 App | Creator analytics |
| `<DashboardLayout>` | 6 (Dashboard) | 🎬 App | Sidebar + main area |

**Rule:** These are complex domain logic + UI. Build in app; don't extract to Factory unless proven reusable across multiple apps.

---

## Usage Examples

### Example 1: A Simple Form (Use Tier 1 + tier 2)

**Goal:** Build a "Subscribe" form (email + name + submit)

**❌ DON'T:** Build custom components for each input
```tsx
// Bad: Custom input, label, and error components
<div className="form-field">
  <div className="label-wrapper">
    <CustomLabel htmlFor="email">Email</CustomLabel>
  </div>
  <CustomEmailInput id="email" />
  <CustomErrorMessage>Email is required</CustomErrorMessage>
</div>
```

**✅ DO:** Use Factory `<FormField>` pattern
```tsx
import { FormField, Button } from '@latimer-woods-tech/design-system';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    // ... submit
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField
        label="Email Address"
        input={{
          type: 'email',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: 'name@example.com',
        }}
        error={error}
        hint="We'll send you updates about new videos"
      />
      <Button type="submit" variant="primary">
        Subscribe
      </Button>
    </form>
  );
}
```

---

### Example 2: A Custom Dashboard View (Mix Factory + App-Specific)

**Goal:** Creator earnings dashboard

**✅ DO:** Compose Dashboard with Factory containers + app-specific charts
```tsx
import { 
  PageLayout, 
  Card, 
  Heading, 
  Body,
  spacing 
} from '@latimer-woods-tech/design-system';
import { 
  EarningsChart,      // App-specific (chartinglogic)
  TimeRangeSelector,  // App-specific (date picker)
  AnalyticsPanel,     // App-specific (KPIs)
} from '../dashboard';

export function CreatorEarningsDashboard() {
  const [dateRange, setDateRange] = useState('30d');

  return (
    <PageLayout>
      <div style={{ padding: spacing.lg }}>
        <Heading level={1}>Earnings Overview</Heading>
        
        {/* Factory Card for layout + shadow */}
        <Card style={{ marginTop: spacing.md }}>
          <TimeRangeSelector value={dateRange} onChange={setDateRange} />
          
          {/* App-specific chart (built in videoking) */}
          <EarningsChart dateRange={dateRange} style={{ marginTop: spacing.lg }} />
        </Card>

        {/* Another Factory Card for metrics */}
        <Card style={{ marginTop: spacing.md }}>
          <AnalyticsPanel dateRange={dateRange} />
        </Card>
      </div>
    </PageLayout>
  );
}
```

---

### Example 3: A Video Player (Entirely App-Specific)

**Goal:** Build a video player for watching videoking content

**✅ DO:** Build in app; wrap Cloudflare Stream API
```tsx
// apps/admin-studio/src/components/video/VideoPlayer.tsx
import React, { useRef } from 'react';
import { Button } from '@latimer-woods-tech/design-system'; // Factory button for controls

export function VideoPlayer({ 
  streamUid, 
  onPlay, 
  onPause, 
  onError 
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="video-player">
      {/* Cloudflare Stream iframe (app-specific) */}
      <iframe
        ref={iframeRef}
        src={`https://iframe.cloudflarestream.com/${streamUid}`}
        allow="accelerometer; gyroscope; picture-in-picture"
        allowFullScreen
      />
      
      {/* Factory buttons for custom controls */}
      <div className="video-player__controls">
        <Button onClick={handlePlay} variant="secondary">
          ▶ Play
        </Button>
        <Button onClick={handlePause} variant="secondary">
          ⏸ Pause
        </Button>
      </div>
    </div>
  );
}
```

**Why not Factory?**
- Depends on Cloudflare Stream API (app-specific)
- Custom controls (play, pause, quality) unique to video
- Unlikely to be reused in admin-studio or other apps

---

## Anti-Patterns (Common Mistakes)

### ❌ Anti-Pattern 1: Custom Button Component

```tsx
// DON'T: Build your own button
function MyButton({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

// ✅ DO: Use Factory
import { Button } from '@latimer-woods-tech/design-system';
<Button onClick={onClick}>{label}</Button>
```

**Why:** Factory `<Button>` is accessible, themed, and tested. Custom buttons duplicate effort and risk missing accessibility.

---

### ❌ Anti-Pattern 2: Copying Factory Component & Modifying

```tsx
// DON'T: Copy Factory Input and modify locally
function MyInput({ value, onChange, ...props }) {
  // You've created a local fork; won't benefit from Factory updates
  return <input value={value} onChange={onChange} {...props} />;
}

// ✅ DO: Use Factory, extend if needed
import { Input } from '@latimer-woods-tech/design-system';

function MyInput({ icon, ...props }) {
  return (
    <div className="input-wrapper">
      {icon && <span className="input-icon">{icon}</span>}
      <Input {...props} />
    </div>
  );
}
```

**Why:** Copies drift over time. Use composition instead; extend Factory components with app-specific features.

---

### ❌ Anti-Pattern 3: Rebuilding Patterns

```tsx
// DON'T: Build your own error handling layout
function MyFormField({ label, value, error }) {
  return (
    <div>
      <label>{label}</label>
      <input value={value} />
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}

// ✅ DO: Use Factory FormField pattern
import { FormField } from '@latimer-woods-tech/design-system';

function MyFormField({ label, value, error }) {
  return (
    <FormField
      label={label}
      input={{ value }}
      error={error}
    />
  );
}
```

**Why:** Factory patterns are tested for accessibility, contrast, and keyboard navigation. Don't duplicate.

---

### ❌ Anti-Pattern 4: Adding App Logic to Factory Components

```tsx
// DON'T: Put videoking-specific logic in Factory Button
import { Button } from '@latimer-woods-tech/design-system';

function PaymentButton({ amount, onComplete }) {
  return (
    <Button 
      onClick={() => {
        // Stripe payment logic (app-specific)
        stripe.confirmCardPayment(amount)
          .then(() => onComplete());
      }}
    >
      Pay ${amount}
    </Button>
  );
}

// ✅ DO: Create app-specific wrapper
import { Button } from '@latimer-woods-tech/design-system';

function PaymentButton({ amount, onComplete }) {
  const handlePay = async () => {
    const result = await stripe.confirmCardPayment(amount);
    if (result.success) onComplete();
  };

  return (
    <Button onClick={handlePay} variant="primary">
      Pay ${amount}
    </Button>
  );
}
```

**Why:** Keeps Factory components pure and reusable. App logic belongs in app-specific wrappers.

---

## Troubleshooting

### Q: I need a button but Factory doesn't have my variant

**A:** Check all Factory Button props first:
```tsx
<Button 
  variant="primary" | "secondary" | "tertiary" | "ghost"
  size="sm" | "md" | "lg"
  icon="left" | "right"
  disabled
  loading
/>
```

If still missing, create app-specific wrapper:
```tsx
export function PaymentButton(props) {
  return <Button variant="primary" {...props} />;
}
```

### Q: Do I need to use all Factory components?

**A:** No. Use where it makes sense:
- ✅ Use for primitives (Button, Input, Heading)
- ✅ Use for common patterns (FormField, Card, Alert)
- ⚠️ Optional for utilities (Spinner, Toast — depends on app needs)
- ❌ Don't force fit app-specific components into Factory

### Q: What if I disagree with a Factory design decision?

**A:** Open an issue in `packages/design-system/` with:
1. What you disagree with (e.g., default color, spacing)
2. Your reasoning (e.g., accessibility, brand fit)
3. Proposed alternative

The design system working group reviews quarterly.

---

## Component Checklist

Before building a custom component, ask:

- [ ] Does Factory already have this?
- [ ] Is it reusable across 2+ journeys?
- [ ] Does it have app-specific business logic? (If yes, skip Factory)
- [ ] Is it accessibility-compliant? (WCAG 2.2 AA)
- [ ] Have I checked the decision tree above?

If all Factory checks pass and app-specific checks fail → **Build in app.**  
If all checks pass and app-specific is no → **Use Factory or propose to Factory.**

---

## Resources

- **Factory Component Storybook:** [link to deployed storybook]
- **Component Inventory:** [docs/videoking/component-inventory.md](../videoking/component-inventory.md)
- **Design System Scope:** [docs/packages/design-system-scope.md](./design-system-scope.md)
- **Accessibility Guide:** [docs/accessibility-testing-guide.md](../accessibility-testing-guide.md)
- **Slack Channel:** #design-system (ask questions here)

---

**Guide Created:** April 28, 2026  
**Last Updated:** April 28, 2026  
**Review Cycle:** Quarterly

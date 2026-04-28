# Factory Front-End Quality Standards

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T4.2 — Add Front-End Quality Standards to Factory Support  
**Reference:** VideoKing UI + design rubric (T1.1)

---

## Mission

Establish one set of non-negotiable quality standards that **every app must meet** for:
- Accessibility (WCAG 2.2 AA essentials)
- Performance (responsive, <= 2s load time on 4G)
- Consistency (design system alignment)
- Code quality (TypeScript strict, ESLint)

These are Factory-wide guardrails, not optional polish.

---

## Part 1: Accessibility Standards (WCAG 2.2 AA)

### Critical Requirements

All user-facing surfaces must meet **WCAG 2.2 Level AA** for critical paths:

| Area | Standard | Automation | Owner |
|------|----------|-----------|-------|
| **Keyboard Navigation** | All interactive elements operable via keyboard; no keyboard traps | Axe scan (browser) | Dev |
| **Contrast** | Text/background >= 4.5:1 (normal text), >= 3:1 (large text) | Axe scan | Dev |
| **Color Not Sole Indicator** | Never use color alone to convey meaning (must have pattern, icon, text) | Manual review + Axe | Designer |
| **Focus Indicator** | Visible focus indicator on all focusable elements | Axe (native) | Dev |
| **Image Alt Text** | All meaningful images have descriptive alt text; decorative images marked `alt=""` | Manual review | Designer |
| **Heading Hierarchy** | Valid H1→H2→H3 nesting; no skips (h1 → h4 is invalid) | Axe scanner | Dev |
| **Form Labels** | Every form input has `<label>` or `aria-label` | Axe scanner | Dev |
| **Error Identification** | Form errors identified in text + color (not color alone) | Manual test | Dev |
| **Motion/Animation** | No persistent flashing; `prefers-reduced-motion` respected | Manual test | Dev |

### Automation: Axe in CI

**Setup:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});

// vitest.setup.ts
import { expect, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

afterEach(async () => {
  // Optional: run Axe on rendered components after each test
});
```

**Example Test:**

```typescript
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SubscribeButton } from './SubscribeButton';

it('should pass accessibility scan', async () => {
  const { container } = render(<SubscribeButton tierId="tier-1" />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**GitHub Actions Integration:**

```yaml
# workflows/accessibility.yml
name: Accessibility Tests

on: [pull_request]

jobs:
  axe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:a11y  # Must return exit code 0
        # Any Axe violations fail the CI
```

---

## Part 2: Performance Standards

### Performance Budgets

**Lighthouse Targets (mobile, 4G throttling):**

| Metric | Target | Consequence |
|--------|--------|-------------|
| **Lighthouse Score** | >= 85 (all pages) | Blocks PR merge |
| **First Contentful Paint (FCP)** | <= 1.8s | Axe + automat violation |
| **Largest Contentful Paint (LCP)** | <= 2.5s | Blocks merge |
| **Cumulative Layout Shift (CLS)** | <= 0.1 | Blocks merge |
| **Time to Interactive (TTI)** | <= 3.8s | Monitor; alert on regression |

**Measure with Lighthouse CI:**

```bash
# Install
npm install --save-dev @lhci/cli@0.11.x @lhci/server

# Config: lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/"],
      "numberOfRuns": 3,
      "settings": {
        "configPath": "./lighthouse-config.js"
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**GitHub Actions:**

```yaml
# workflows/performance.yml
name: Lighthouse Performance

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npm run start &
      - run: sleep 3  # Wait for server to start
      - run: npm run lighthouse:ci
        # Fails if any metric below target
```

### Code-Level Performance

**Requirements:**

| Rule | Example | Violation |
|------|---------|-----------|
| **React** | No inline objects in JSX props (causes re-renders) | `onClick={() => doThing()}` should be `useCallback` |
| **React** | No array.map() keys as index (breaks with reordering) | `key={index}` should be `key={item.id}` |
| **Network** | No waterfall requests; prefetch critical assets | Loading CSS after JS is delayed rendering |
| **Images** | Use `<picture>` or `srcset` for responsive images | Full-resolution images on mobile |
| **Bundle** | Single JS < 100KB (gzipped); lazy-load routes | Monolithic JS bundle slower first on 4G |

**ESLint Rules:**

```javascript
// eslintrc.cjs
module.exports = {
  overrides: [
    {
      files: ['**/*.jsx', '**/*.tsx'],
      rules: {
        'react/no-arrow-function-lifecycle': 'error',
        'react/destructuring-assignment': 'warn',
        'react/jsx-key': 'error', // Require key prop
        'react/no-multi-comp': 'warn', // Limit multi-component files
      },
    },
  ],
};
```

---

## Part 3: Responsive Design Standards

### Breakpoints (Tailwind Convention)

| Breakpoint | Screen Size | Usage |
|---|---|---|
| Mobile | Default (320px+) | `<styles>` default |
| sm | 640px+ | Tablets in portrait |
| md | 768px+ | Tablets landscape + small desktops |
| lg | 1024px+ | Desktop |
| xl | 1280px+ | Large desktop |

### Test Matrix

**Every interactive component must render correctly on:**

- [ ] iPhone SE (375px width)
- [ ] iPad (768px width)
- [ ] Desktop (1280px+ width)

**Automated Testing:**

```typescript
// Components should use Tailwind breakpoints, not CSS media queries
export const SubscribeButton = () => (
  <button className="
    w-full px-4 py-2  // Mobile first
    sm:w-auto          // Tablet and up
    md:px-6 md:py-3    // Larger screens
    text-sm md:text-base
    bg-primary hover:bg-primary-dark
  ">
    Subscribe
  </button>
);

// Test
it('renders correctly on mobile', () => {
  window.innerWidth = 375;
  render(<SubscribeButton />);
  expect(screen.getByRole('button')).toHaveClass('w-full');
});

it('renders correctly on desktop', () => {
  window.innerWidth = 1280;
  render(<SubscribeButton />);
  expect(screen.getByRole('button')).toHaveClass('w-auto');
});
```

### No Horizontal Scroll

**Requirement:** No horizontal scrollbar on any viewport (320px+)

**Test:**

```typescript
it('should not have horizontal scroll on 375px', () => {
  window.innerWidth = 375;
  render(<App />);
  const body = document.body;
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
});
```

---

## Part 4: Component Standards

### Base Component Anatomy

All components must follow this pattern:

```typescript
import { forwardRef, ReactNode } from 'react';

interface ComponentProps {
  /** Unique ID for accessibility and testing */
  id?: string;
  
  /** Visual intent: primary (call-to-action), secondary, or ghost */
  variant?: 'primary' | 'secondary' | 'ghost';
  
  /** Visual size: small, base, or large */
  size?: 'sm' | 'base' | 'lg';
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Loading state (for async operations) */
  isLoading?: boolean;
  
  /** Focus trap (for modals) */
  autoFocus?: boolean;
  
  /** Accessible name (if no visible text) */
  'aria-label'?: string;
  
  /** Accessible description */
  'aria-describedby'?: string;
  
  /** Children */
  children?: ReactNode;
  
  /** CSS class name */
  className?: string;
}

/**
 * Component name with clear purpose
 * 
 * @example
 * <Button variant="primary" onClick={handleSubmit}>
 *   Subscribe
 * </Button>
 */
export const Component = forwardRef<HTMLButtonElement, ComponentProps>(
  (
    {
      id,
      variant = 'primary',
      size = 'base',
      disabled = false,
      isLoading = false,
      autoFocus = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        id={id}
        disabled={disabled || isLoading}
        autoFocus={autoFocus}
        className={`
          component-base
          component--${variant}
          component--${size}
          ${disabled ? 'component--disabled' : ''}
          ${isLoading ? 'component--loading' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);

Component.displayName = 'Component';
```

### Required Component States

Every interactive component must support:

| State | Example | Styling |
|-------|---------|---------|
| Default | Button at rest | Tailwind default |
| Hover | Mouse over button | Add `:hover:` class |
| Focus | Tab to button | Visible outline (`.focus-visible:`) |
| Active | Button being clicked | Add shadow/press effect |
| Disabled | `disabled={true}` | Gray out; cursor: not-allowed |
| Loading | `isLoading={true}` | Spinner + hover disabled |
| Error | Input with validation error | Red border + error text |

**Tailwind Example:**

```typescript
<button className="
  // Default
  px-4 py-2
  bg-primary text-white
  
  // Hover
  hover:bg-primary-dark
  
  // Focus
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-primary
  
  // Active
  active:scale-95 active:shadow-inner
  
  // Disabled
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary
  
  // Loading
  aria-busy:pointer-events-none
  
  // Transitions
  transition-all duration-200 ease-in-out
">
  {isLoading ? 'Loading...' : 'Click me'}
</button>
```

---

## Part 5: Form Standards

### Input + Validation Pattern

```typescript
import { useId } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export const FormField = ({
  label,
  error,
  required,
  hint,
  ...inputProps
}: FormFieldProps & React.InputHTMLAttributes<HTMLInputElement>) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
        {required && <span aria-label="required" className="text-red-500">*</span>}
      </label>

      <input
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`
          w-full px-3 py-2 border rounded
          ${error ? 'border-red-500' : 'border-gray-300'}
          focus-visible:outline-2 focus-visible:outline-primary
        `}
        {...inputProps}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500 mt-1">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### Required Validations

| Rule | Example |
|------|---------|
| **Required field** | Show `*` in label + error on blur if empty |
| **Email format** | Validate regex; show error; suggest correction |
| **Password strength** | Min 8 chars, >= 1 uppercase, >= 1 number, >= 1 symbol |
| **Confirmation match** | Password + confirm must match |
| **Async validation** | Username uniqueness checked at blur (show loading state) |
| **Progressive** | Show errors on blur/change, not on focus |

---

## Part 6: Error Handling + UX

### HTTP Error to UI Mapping

```typescript
import { useEffect, useState } from 'react';

interface ApiError {
  code: string;
  message: string;
  field?: string; // For form validation
  retryable?: boolean;
}

// Standard error responses from Factory packages
const API_ERROR_MAP: Record<number, string> = {
  400: 'Please check your input and try again.',
  401: 'Your session expired. Please log in again.',
  403: 'You don\'t have permission to do that.',
  404: 'This resource doesn\'t exist.',
  409: 'This action conflicts with an existing item. Refresh and try again.',
  422: 'This data is invalid. Check the highlighted fields.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong. Please try again or contact support.',
  503: 'Service temporarily unavailable. Please try again soon.',
};

export const useApiCall = async (url: string, options = {}) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'content-type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          API_ERROR_MAP[response.status] || 'An error occurred'
        );
      }

      const result = await response.json();
      setData(result);
      return result;
    } catch (err: any) {
      const userError: ApiError = {
        code: err.code || 'unknown_error',
        message: err.message || 'Something went wrong.',
        retryable: [408, 429, 500, 503].includes(err.status),
      };
      setError(userError);
      throw userError;
    } finally {
      setIsLoading(false);
    }
  };

  return { data, error, isLoading, execute };
};
```

### Toast + Error Display

```typescript
export const ErrorMessage = ({ error }: { error: ApiError }) => (
  <div
    role="alert"
    className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded"
  >
    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
    <div>
      <p className="font-medium text-red-900">{error.message}</p>
      {error.retryable && (
        <p className="text-sm text-red-700 mt-1">
          You can try again in a moment.
        </p>
      )}
    </div>
  </div>
);
```

---

## Part 7: Design System Alignment

### Color Usage

**Never use color alone to communicate meaning:**

```typescript
// ❌ Bad: Only red identifies error
<div className="bg-red-500">Error occurred</div>

// ✅ Good: Icon + color + text
<div className="flex items-center gap-2 bg-red-50 border border-red-200 p-4">
  <AlertCircle className="text-red-500" />
  <span className="text-red-900">Error occurred</span>
</div>

// ✅ Good: Pattern (stripe) + color
<input className="
  border-2
  border-dashed
  border-red-500
  bg-red-50
" />
```

### Typography

**Hierarchy:**

| Class | Size | Weight | Line-height | Usage |
|-------|------|--------|-------------|-------|
| h1 | 2.25rem | 700 | 1.2 | Page title |
| h2 | 1.875rem | 700 | 1.2 | Section heading |
| h3 | 1.5rem | 600 | 1.3 | Subsection |
| h4 | 1.25rem | 600 | 1.4 | Minor heading |
| body-lg | 1.125rem | 400 | 1.6 | Lead paragraph |
| body | 1rem | 400 | 1.6 | Body text |
| body-sm | 0.875rem | 400 | 1.5 | Supporting text |
| caption | 0.75rem | 500 | 1.4 | Labels, hints |

**Tailwind:**

```typescript
// Use semantic tags
<h1 className="text-2xl font-bold leading-tight">Page Title</h1>
<h2 className="text-xl font-semibold leading-snug">Section Heading</h2>
<p className="text-base font-normal leading-relaxed">Body text</p>
<p className="text-sm font-medium leading-snug">Label text</p>
```

### Spacing Scale

Use the 8px grid system exclusively:

```typescript
// ✅ Use multiples of 8px
className="p-2 p-4 p-6 p-8"  // 16px, 32px, 48px, 64px
gap-2 gap-4 gap-6            // 16px, 32px, 48px

// ❌ Avoid arbitrary spacing
className="p-3 p-7 p-11"
```

---

## Part 8: Testing Requirements

### Minimum Test Coverage

| Type | Target | Example |
|------|--------|---------|
| Unit tests | 90% line coverage | Component logic, utility functions |
| Integration tests | >= 1 per critical flow | Checkout flow: render → fill → submit → success |
| E2E tests | Happy path + sad path | Signup → verify email → complete profile |
| Accessibility tests | All interactive components | Axe scan on every component test |
| Performance tests | Annual review | Lighthouse baseline + regression detection |

### Test File Organization

```typescript
// components/SubscribeButton.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SubscribeButton } from './SubscribeButton';

describe('SubscribeButton', () => {
  // 1. Accessibility
  it('should pass accessibility scan', async () => {
    const { container } = render(<SubscribeButton tierId="tier-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // 2. Rendering
  it('should render button with tier label', () => {
    render(<SubscribeButton tierId="tier-1" label="Premium" />);
    expect(screen.getByRole('button')).toHaveTextContent('Premium');
  });

  // 3. Interaction (happy path)
  it('should call onSuccess when subscription succeeds', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<SubscribeButton tierId="tier-1" onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // 4. Error handling
  it('should display error message on failure', async () => {
    const user = userEvent.setup();
    // Mock API failure
    global.fetch = vi.fn().mockRejectedValueOnce(
      new Error('Payment declined')
    );

    render(<SubscribeButton tierId="tier-1" />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Payment declined');
    });
  });

  // 5. Responsive
  it('renders correctly on mobile', () => {
    window.innerWidth = 375;
    const { container } = render(<SubscribeButton tierId="tier-1" />);
    expect(container.firstChild).toHaveClass('w-full');
  });
});
```

---

## Part 9: CI/CD Gates (GitHub Actions)

**All PRs must pass:**

```yaml
# workflows/quality-gates-frontend.yml
name: Front-End Quality Gates

on: [pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:a11y
        # Axe violations fail the build

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run start &
      - run: sleep 3
      - run: npm run lighthouse:ci
        # Lighthouse scores below targets fail the build

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test -- --coverage
        # Coverage below 90% lines / 85% branches fails

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
        # ESLint warnings > 0 fail the build
```

---

## Part 10: Component Library (Starter)

New apps should implement these first:

| Component | Purpose | Required |
|-----------|---------|----------|
| `Button` | CTA, submit, cancel | ✅ Yes |
| `Input` | Text field with validation | ✅ Yes |
| `Checkbox` | Multiple selection | ✅ Yes |
| `Radio` | Single selection | ✅ Yes |
| `Select` / `Dropdown` | Category selection | ✅ Yes |
| `Modal` | Confirmation, forms | ✅ Yes |
| `Toast` | Success / error notifications | ✅ Yes |
| `Spinner` | Loading state | ✅ Yes |
| `ErrorMessage` | Validation feedback | ✅ Yes |
| `Card` | Content container | ⚠️ Common |
| `Badge` | Status indicator | ⚠️ Common |
| `Tooltip` | Contextual help | ⚠️ Nice to have |
| `Tabs` | Multi-section views | ⚠️ Nice to have |
| `Accordion` | Collapsible content | ⚠️ Nice to have |

---

## Part 11: New App Front-End Checklist

**Use this when scaffolding new app UI:**

**Setup (Before writing components):**
- [ ] Install React + TypeScript strict
- [ ] Install Tailwind CSS + plugins (a11y, forms)
- [ ] Install Vitest + React Testing Library
- [ ] Install Axe testing (jest-axe)
- [ ] Install Lighthouse CI
- [ ] Configure ESLint with React rules
- [ ] Add `.eslintrc.cjs` with performance rules (no inline functions, etc.)
- [ ] Create `lighthouserc.json` with performance budgets

**Component Library (Required):**
- [ ] Button (primary, secondary, ghost; sm/base/lg sizes; all 5 states)
- [ ] Input + label (validation, error message, optional hint)
- [ ] Checkbox / Radio (both controlled)
- [ ] Select dropdown (keyboard accessible)
- [ ] Modal (focus trap, esc to close, accessible)
- [ ] Toast (success, error, info; auto-dismiss)
- [ ] Spinner (accessible, no infinite flashing)
- [ ] ErrorMessage (icon + text + color)

**Automation (CI/CD):**
- [ ] Lighthouse CI workflow (runs on PR, blocks if score < 85)
- [ ] Axe accessibility tests (runs on PR, blocks if violations)
- [ ] Coverage tests (blocks if < 90% lines / 85% branches)
- [ ] ESLint performance rules (blocks if warnings)

**Testing:**
- [ ] ≥ 1 test per component (happy path + error)
- [ ] Axe scan on responsive components (375px, 1280px)
- [ ] Form validation tested (required, format, async)
- [ ] Error handling tested (network failure, server error, invalid input)

**Documentation:**
- [ ] Create `docs/COMPONENT_LIBRARY.md` listing all components + examples
- [ ] Document accessibility choices (why this pattern for inputs?)
- [ ] Document performance budgets (why 85 Lighthouse?)
- [ ] Link to this document (`docs/FACTORY_FRONTEND_STANDARDS.md`)

---

## T4.2 Exit Criteria (by May 22, 2026)

- [x] Accessibility standards published (WCAG 2.2 AA + Axe automation)
- [x] Performance standards published (Lighthouse targets + CI gates)
- [x] Responsive design requirements documented (breakpoints, no horizontal scroll)
- [x] Component anatomy and states pattern defined
- [x] Form validation patterns documented
- [x] Error handling patterns documented
- [x] Design system alignment guidelines (color, typography, spacing)
- [x] Testing requirements documented (min 90% coverage, a11y tests, performance tests)
- [x] CI/CD gates template provided (accessibility, performance, coverage workflows)
- [x] New app checklist created
- [ ] VideoKing front-end audit completed using this standard (May 5–12)
- [ ] New app scaffolded and passes all gates (validated live)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Design Lead | Initial front-end standards; accessibility, performance, component patterns, CI gates |

---

**Status:** ✅ T4.2 READY FOR IMPLEMENTATION  
**Next:** T1.2 (Journey Maps) + T2.2 (Test Coverage) — starts May 5–8


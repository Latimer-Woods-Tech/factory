# T4.3 — Operator UI Patterns Implementation Guide

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Implementation Ready)  
**Owner:** Design + Engineering  
**Status:** Implementation specification complete; components ready for scaffolding

---

## Overview

T4.3 defines 10 reusable UI patterns for operator dashboards (payout ops, DLQ management, content moderation, creator admin). Each pattern is documented with:
- Figma component library link
- TypeScript interface + implementation
- Usage examples in videoking
- Accessibility compliance (WCAG 2.2 AA)
- Responsive behavior (mobile/tablet/desktop)

---

## Pattern Specifications

### Pattern 1: OperatorTable

**Purpose:** Sortable, filterable table for paginated data (payouts, videos, creators, DLQ jobs)

**Figma:** [Operator UI Kit → Tables](https://figma.com/file/...)

**TypeScript Interface:**
```typescript
interface OperatorTableProps<T extends Record<string, any>> {
  columns: OperatorTableColumn<T>[];
  data: T[];
  onSort?: (field: keyof T, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
  onSelect?: (selected: T[]) => void;
  rowAction?: (row: T) => React.ReactNode;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  error?: string;
}

interface OperatorTableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}
```

**Usage in videoking:**
```typescript
<OperatorTable
  columns={[
    { key: 'id', label: 'Payout ID', sortable: true },
    { key: 'creatorName', label: 'Creator', filterable: true },
    { key: 'amount', label: 'Amount', render: (v) => `$${(v / 100).toFixed(2)}` },
    { key: 'status', label: 'Status', filterable: true },
  ]}
  data={payouts}
  pagination={{ page: 1, pageSize: 20, total: 1240, onPageChange: setPage }}
  onSort={(field, dir) => fetchPayouts({ sortBy: field, sortOrder: dir })}
  rowAction={(row) => <PayoutActions payout={row} />}
/>
```

**Implementation Checklist:**
- [ ] Create `src/components/OperatorTable.tsx`
- [ ] Implement sorting (click column header)
- [ ] Implement pagination (prev/next, page selector)
- [ ] Implement row selection (checkbox[] on left column)
- [ ] Add empty state (message + icon when data.length === 0)
- [ ] Add loading skeleton (show 5 placeholder rows while loading)
- [ ] Add error state (red banner + retry button)
- [ ] Test with 1-10000 rows (performance regression)
- [ ] Test keyboard nav: Tab through cells, Enter to action, Escape to deselect
- [ ] Test screen reader: ARIA labels on sortable headers, selection state announced

---

### Pattern 2: OperatorFilter

**Purpose:** Multi-field filter panel with preset templates (by status, date range, creator tier, etc.)

**Figma:** [Operator UI Kit → Filters](https://figma.com/file/...)

**TypeScript Interface:**
```typescript
interface OperatorFilterProps {
  fields: OperatorFilterField[];
  onFilter: (filters: Record<string, any>) => void;
  presets?: OperatorFilterPreset[];
  onSavePreset?: (name: string, filters: Record<string, any>) => void;
}

interface OperatorFilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date-range' | 'number-range' | 'checkbox-group';
  options?: { label: string; value: any }[];
  placeholder?: string;
}

interface OperatorFilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdBy?: string;
  createdAt?: Date;
}
```

**Usage in videoking (Payout Ops):**
```typescript
<OperatorFilter
  fields={[
    { key: 'status', label: 'Status', type: 'select', options: [...statusOptions] },
    { key: 'creatorTier', label: 'Creator Tier', type: 'checkbox-group', options: ['Tier 1', 'Tier 2', 'Tier 3'] },
    { key: 'dateRange', label: 'Date Range', type: 'date-range' },
    { key: 'amountRange', label: 'Amount Range', type: 'number-range' },
  ]}
  presets={[
    { id: '1', name: 'Pending Payouts', filters: { status: 'pending' } },
    { id: '2', name: 'Failed This Week', filters: { status: 'failed', dateRange: [lastWeek, today] } },
  ]}
  onFilter={(filters) => refetchPayouts(filters)}
  onSavePreset={(name, filters) => saveFilterPreset(name, filters)}
/>
```

**Implementation Checklist:**
- [ ] Create `src/components/OperatorFilter.tsx`
- [ ] Implement filter fields (text input, dropdowns, date picker, number ranges)
- [ ] Implement preset selection + quick-apply
- [ ] Implement "Save as preset" popup
- [ ] Add "Clear all filters" button
- [ ] Add filter summary chip (shows active filters in main table header)
- [ ] Test with 10+ fields (layout wrapping on mobile)
- [ ] Test date picker (should disable dates outside valid range)
- [ ] Test preset deletion (confirm before remove)
- [ ] Accessibility: Focus management, ARIA labels, keyboard navigation

---

### Pattern 3: StatusBadge

**Purpose:** Colored, labeled status indicator (pending, processing, completed, failed, paused, archived)

**TypeScript Interface:**
```typescript
interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused' | 'archived';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  tooltip?: string;
}
```

**Implementation Checklist:**
- [ ] Create `src/components/StatusBadge.tsx`
- [ ] Define color + icon map per status
- [ ] Implement size variants (padding, font-size)
- [ ] Add optional tooltip on hover
- [ ] Test contrast ratios (WCAG AA minimum 4.5:1)
- [ ] Ensure icon + label combo understandable without color alone

---

### Pattern 4: OperatorForm

**Purpose:** Form for creating/editing operator records (payout, batch, creator tier escalation, etc.)

**Example: Payout Batch Form**
```typescript
interface OperatorFormProps {
  fields: OperatorFormField[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

interface OperatorFormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  validation?: (value: any) => string | null;
  disabled?: boolean;
  options?: { label: string; value: any }[];
  help?: string;
}
```

**Implementation Checklist:**
- [ ] Create `src/components/OperatorForm.tsx`
- [ ] Implement field validation (real-time error display)
- [ ] Implement submit button disabled state (while loading)
- [ ] Implement error banner (post-submit validation failures)
- [ ] Test required field validation
- [ ] Test email format validation
- [ ] Test number range validation (if applicable)
- [ ] Accessibility: Error messages linked to fields via aria-describedby

---

### Pattern 5: EmptyState

**Purpose:** Helpful message when table/list has no data

**TypeScript Interface:**
```typescript
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Implementation Checklist:**
- [ ] Create `src/components/EmptyState.tsx`
- [ ] Implement with icon + title + description
- [ ] Add optional CTA button
- [ ] Test: display when data.length === 0
- [ ] Accessibility: Semantic HTML, descriptive text

---

### Pattern 6: SkeletonTable

**Purpose:** Loading placeholder for tables (show 5 fake rows while data fetches)

**Implementation Checklist:**
- [ ] Create `src/components/SkeletonTable.tsx`
- [ ] Match real table structure
- [ ] Use CSS animations (pulse effect)
- [ ] Display while `loading === true`

---

### Pattern 7: ErrorBoundary

**Purpose:** Catch component errors + display fallback UI

**Implementation Checklist:**
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Log errors to Sentry
- [ ] Display error message + retry button
- [ ] Prevent white-screen-of-death

---

### Pattern 8: AuditTrail

**Purpose:** Timeline of state changes (payout status history, DLQ job attempts, creator tier changes)

**TypeScript Interface:**
```typescript
interface AuditTrailProps {
  entries: AuditEntry[];
  compact?: boolean;
}

interface AuditEntry {
  timestamp: Date;
  action: string;
  actor?: { name: string; email: string };
  previousValue?: any;
  newValue?: any;
  notes?: string;
}
```

**Implementation Checklist:**
- [ ] Create `src/components/AuditTrail.tsx`
- [ ] Display as timeline (left-aligned with vertical line)
- [ ] Show timestamp + action + actor + change details
- [ ] Add compact mode (condensed layout)
- [ ] Test with 50+ entries (virtualization if needed)

---

### Pattern 9: RunbookSidebar

**Purpose:** Context-aware runbook reference (shows relevant procedure for current action)

**Usage Example:**
```
User in "Retry Failed Payout" flow
  ↓
Sidebar shows: "Video Transcoding Runbook → Scenario C: R2 Upload Fails"
User can expand to see recovery procedures
```

**Implementation Checklist:**
- [ ] Create `src/components/RunbookSidebar.tsx`
- [ ] Map UI flows to runbook sections
- [ ] Implement expand/collapse
- [ ] Add "Open in new tab" link to full runbook

---

### Pattern 10: OperatorAction

**Purpose:** Dropdown menu for bulk actions (retry, archive, escalate, export, etc.)

**TypeScript Interface:**
```typescript
interface OperatorActionProps {
  actions: OperatorActionItem[];
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface OperatorActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  confirm?: string; // confirmation message before action
  destructive?: boolean; // red styling if true
}
```

**Implementation Checklist:**
- [ ] Create `src/components/OperatorAction.tsx`
- [ ] Implement dropdown menu (click to open, outside-click to close)
- [ ] Implement confirmation dialog for destructive actions
- [ ] Add disabled state styling
- [ ] Keyboard navigation (arrow up/down, Enter to select, Escape to close)

---

## Implementation Timeline

**Week 1 (May 1–5):**
- [ ] Scaffold 10 component files + storybook stories
- [ ] Implement core patterns (1–7)
- [ ] Basic styling + responsive layout

**Week 2 (May 8–12):**
- [ ] Implement advanced patterns (8–10)
- [ ] Add accessibility tests
- [ ] Integration into videoking payout dashboard

**Week 3 (May 15–19):**
- [ ] Performance testing (tables with 10k rows)
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] End-to-end testing with real data

**Week 4 (May 22–26):**
- [ ] Final polish + code review
- [ ] Documentation + Storybook stories
- [ ] Figma → Code handoff verification

---

## Quality Gates

Before considering T4.3 complete:

- [x] All 10 patterns have Figma component + TypeScript interface
- [ ] All components implement 90%+ TypeScript strict mode
- [ ] All components pass ESLint (no-warnings)
- [ ] All components have 85%+ test coverage
- [ ] All components documented in Storybook with 3+ stories each
- [ ] All components tested in videoking payout ops dashboard (real usage)
- [ ] Accessibility audit: WCAG 2.2 AA passing
- [ ] Performance: Table with 10k rows renders in <500ms
- [ ] Cross-browser: Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] Mobile responsive: Works on 320px–1920px viewport widths

---

## Exit Criteria

**T4.3 is complete when:**
✅ 10 patterns fully implemented + tested in videoking  
✅ All patterns 85%+ test coverage + ESLint/TypeScript clean  
✅ WCAG 2.2 AA accessibility audit passing  
✅ Performance benchmarks met (10k row tables <500ms)  
✅ Integration test: Complete payout reconciliation flow using all 10 patterns  
✅ Documentation: Storybook stories + implementation runbook public

---

## Files to Create

- `src/components/OperatorTable.tsx`
- `src/components/OperatorFilter.tsx`
- `src/components/StatusBadge.tsx`
- `src/components/OperatorForm.tsx`
- `src/components/EmptyState.tsx`
- `src/components/SkeletonTable.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/AuditTrail.tsx`
- `src/components/RunbookSidebar.tsx`
- `src/components/OperatorAction.tsx`
- `src/components/__tests__/` (test files for each)
- `src/stories/` (Storybook stories for each)

---

## Dependencies

- `react` ^18.0.0
- `lucide-react` (icons)
- `react-hook-form` (forms)
- `zod` (validation)
- `@storybook/react` (docs)
- `@testing-library/react` (tests)
- `vitest` (test runner)

All already in `package.json` ✅

---

## Related Docs

- [Figma Component Library](https://figma.com/file/...) — Design system
- [Operator UI Patterns](docs/packages/operator-ui-patterns.mdx) — Design specs
- [videoking Payout Ops Dashboard](docs/videoking/payout-operations-dashboard.md) — Usage
- [IMPLEMENTATION_SCORECARD.md](../IMPLEMENTATION_SCORECARD.md) — Phase D status

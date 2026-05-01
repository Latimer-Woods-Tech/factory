# Reusable Operator Patterns

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T4.3 — Build Reusable Operator Patterns  
**Scope:** Admin/ops UI surfaces (payout dashboard, moderation queue, creator management)

---

## Mission

Define a shared component + pattern library for operator/admin surfaces so:
- **Every admin UI app** reuses proven, tested patterns ( not reinventing filters, status chips, confirmations)
- **Operator workflows** are consistent across VideoKing, future Factory apps, and internal tools
- **Quality gates** (accessibility, performance, testing) apply uniformly to all operator UIs
- **New operator feature** delivers quickly (pattern already exists; engineer just composes it)

---

## Part 1: Operator UI Surface Inventory

### Current VideoKing Operator Surfaces

**Creator Management Dashboard:**
- Creator list table (sortable columns: name, subscribers, earnings; filterable: status, join date, earnings range)
- Individual creator detail panel (profile, stats, earnings, linked accounts, content stats, flags, actions)
- Bulk action toolbar (select creators, actions: message, suspend, verify bonus, trigger payout)
- Email/SMS messaging interface (template + personalization)

**Moderation Queue:**
- Content queue table (video title, reporter count, flagged date, flag reason, status)
- Content detail viewer (video player, reporter comments, flag reason categories, trending in flagged set)
- Action panel (approve, soft reject with message, hard reject with ban, escalate to human review)
- Batch operations (filter by reason, assign to reviewer, set priority, auto-action on confidence threshold)

**Payout Operations:**
- Pending payout batch table (batch ID, creator count, amount, scheduled date, status)
- Batch detail panel (creator list with individual status, success/fail counts, retry options, manual adjustments)
- Transfer execution interface (review → execute → verify reconciliation)
- Failed transfer triage (retry reason, manual override, notify creator, hold payout)
- Weekly revenue reconciliation (stripe balance, payout total, discrepancies, signed-off status)

**Analytics & Reporting:**
- KPI dashboard (DAU, subscribers, paying %, churn rate, payout volume; with sparklines + WoW change)
- Funnel dashboard (signup → payment completion; where drop; time to convert)
- Creator cohort analysis (by join date; retention, earnings, content output over time)
- Custom report builder (select dimensions/metrics, date range, export CSV/JSON)

**System Admin:**
- User management (list, search, roles, permissions, session revoke)
- Configuration toggles (feature flags, rate limit overrides, email domain config)
- Audit log viewer (search by user/action/date, correlate to business events)
- Secrets & API key rotation (view key fingerprint + rotation date, trigger rotation, revoke)

---

## Part 2: Operator Pattern Library

### Pattern 1: Data Table with Sorting, Filtering, Pagination

**Use Case:** Creator list, content queue, payout batch details

**Component Anatomy:**

```typescript
interface OperatorTable<T> {
  columns: OperatorColumn<T>[];
  data: T[];
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selected: T[]) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
}

interface OperatorColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  type?: 'string' | 'number' | 'date' | 'currency' | 'status' | 'enum';
  
  filter?: {
    type: 'text' | 'date-range' | 'select' | 'multi-select' | 'number-range';
    options?: { label: string; value: any }[];
  };
  
  width?: string; // e.g. '20%', '80px'
  align?: 'left' | 'center' | 'right';
}
```

**Code Example:**

```typescript
import { OperatorTable } from '@latimer-woods-tech/admin-ui';

interface Creator {
  id: string;
  name: string;
  subscribers: number;
  earnings: number;
  status: 'verified' | 'pending' | 'suspended';
  joinedAt: Date;
}

export function CreatorsList() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selected, setSelected] = useState<Creator[]>([]);

  return (
    <OperatorTable
      columns={[
        { 
          key: 'name', 
          label: 'Creator', 
          sortable: true, 
          width: '30%' 
        },
        { 
          key: 'subscribers', 
          label: 'Subscribers', 
          type: 'number',
          sortable: true,
          align: 'right',
          render: (val) => val.toLocaleString()
        },
        { 
          key: 'earnings', 
          label: 'Lifetime Earnings', 
          type: 'currency',
          sortable: true,
          align: 'right',
          render: (val) => `$${(val / 100).toFixed(2)}`
        },
        { 
          key: 'status', 
          label: 'Status',
          type: 'enum',
          filter: {
            type: 'select',
            options: [
              { label: 'Verified', value: 'verified' },
              { label: 'Pending', value: 'pending' },
              { label: 'Suspended', value: 'suspended' },
            ]
          },
          render: (val) => (
            <StatusChip status={val} />
          )
        },
        { 
          key: 'joinedAt', 
          label: 'Joined',
          type: 'date',
          sortable: true,
          filter: { type: 'date-range' }
        },
      ]}
      data={creators}
      selectable
      sortable
      onSelectionChange={setSelected}
      pageSize={25}
    />
  );
}
```

**Accessibility:**
- Sortable columns marked with `aria-sort="ascending" | "descending" | "none"`
- Filter controls keyboard-accessible (Tab through filters + Enter to apply)
- Table header sticky; header row repeated every 10 visible rows (for screen readers)
- Selected rows have `aria-selected="true"`

**States Required:**
- Empty (no data; show empty state message)
- Loading (skeleton rows + loading spinner)
- Error (error message + retry button)
- Filtered (row count matches filter)
- Sorted (indicator showing sort direction)
- Selected (highlight + bulk action toolbar appears)

---

### Pattern 2: Status Chip with Icon + Color

**Use Case:** Creator status (verified, pending, suspended), content status (approved, rejected, escalated), payout status (pending, success, failed)

**Component Anatomy:**

```typescript
type StatusColor = 'default' | 'success' | 'warning' | 'error' | 'info';

interface StatusChip {
  status: string;
  label?: string;
  color?: StatusColor;
  icon?: React.ComponentType<{ size: number }>;
  onClick?: () => void;
  tooltipText?: string;
}

const statusConfig = {
  'verified': { label: 'Verified', color: 'success', icon: CheckCircle },
  'pending': { label: 'Pending', color: 'info', icon: Clock },
  'suspended': { label: 'Suspended', color: 'error', icon: AlertCircle },
};
```

**Code Example:**

```typescript
import { StatusChip } from '@latimer-woods-tech/admin-ui';

// In CreatorsList render
render: (status) => (
  <StatusChip 
    status={status}
    tooltipText={`Changed on ${creator.statusChangedAt.toLocaleDateString()}`}
  />
)
```

**Accessibility:**
- Color + icon (never color alone per WCAG)
- `aria-label="Status: verified"` for assistive tech
- Optional tooltip with `aria-describedby`

**Responsive:**
- Desktop: icon + label
- Mobile: icon only (label in drawer/detail)

---

### Pattern 3: Confirmation Modal

**Use Case:** Before risky operations (suspend creator, reject content, execute payout batch, rotate API keys)

**Component Anatomy:**

```typescript
interface ConfirmationModal {
  isOpen: boolean;
  title: string;
  description: string; // action being taken
  riskLevel: 'low' | 'medium' | 'high'; // colors + messaging
  primaryAction: {
    label: string;
    onClick: () => Promise<void> | void;
    isLoading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  destructive?: boolean; // red button color if true
  details?: Array<{ label: string; value: string }>; // what will be affected
  auditContext?: {
    actionType: string;
    targetId: string;
    reason?: string;
  };
}
```

**Code Example:**

```typescript
import { ConfirmationModal } from '@latimer-woods-tech/admin-ui';

const [confirmSuspend, setConfirmSuspend] = useState(false);
const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
const [suspendReason, setSuspendReason] = useState('');

<ConfirmationModal
  isOpen={confirmSuspend}
  title="Suspend Creator"
  description={`This will suspend ${selectedCreator?.name} immediately. Suspended creators cannot upload, and subscribers cannot watch their videos.`}
  riskLevel="high"
  details={[
    { label: 'Creator', value: selectedCreator?.name || '' },
    { label: 'Current Subscribers', value: selectedCreator?.subscribers.toString() || '' },
    { label: 'Reason', value: suspendReason }
  ]}
  primaryAction={{
    label: 'Confirm Suspension',
    onClick: async () => {
      await creatorApi.suspend(selectedCreator!.id, suspendReason);
      setConfirmSuspend(false);
      await refreshTable(); // reload data
    },
    isLoading: isSuspending,
  }}
  secondaryAction={{
    label: 'Cancel',
    onClick: () => setConfirmSuspend(false),
  }}
  destructive
  auditContext={{
    actionType: 'creator_suspension',
    targetId: selectedCreator?.id || '',
    reason: suspendReason,
  }}
/>
```

**Accessibility:**
- Focus trap inside modal (Tab cycles within modal)
- Close button + Escape key
- Confirmation button requires deliberate click (not drag-to-click or double-click)

**Safety Features:**
- High-risk actions require typing confirmation (e.g., "Type DELETE to confirm")
- Details panel shows what will be affected
- Reason field is optional but logged to audit trail
- `auditContext` sent to server for compliance logging

---

### Pattern 4: Bulk Action Toolbar

**Use Case:** Creator selection → message, verify, suspend, trigger payout

**Component Anatomy:**

```typescript
interface BulkActionToolbar<T> {
  selectedItems: T[];
  actions: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<{ size: number }>;
    onClick: (items: T[]) => Promise<void> | void;
    confirm?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
    requiresReason?: boolean;
  }>;
  onDismiss?: () => void;
}
```

**Code Example:**

```typescript
const [selected, setSelected] = useState<Creator[]>([]);

<BulkActionToolbar
  selectedItems={selected}
  actions={[
    {
      id: 'message',
      label: `Message ${selected.length} creators`,
      icon: Mail,
      onClick: (items) => openMessageDialog(items),
    },
    {
      id: 'verify',
      label: 'Fast-track Verification',
      onClick: async (items) => {
        await creatorApi.bulkVerify(items.map(c => c.id));
        refreshTable();
      },
      riskLevel: 'low',
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: Ban,
      onClick: (items) => openSuspendDialog(items),
      confirm: true,
      riskLevel: 'high',
      requiresReason: true,
    },
  ]}
  onDismiss={() => setSelected([])}
/>
```

**UX Details:**
- Toolbar appears above table when ≥1 item selected
- Item count shown: "5 items selected"
- Action buttons ordered by risk (low risk first, high risk last)
- Color-codes by risk (info → warning → error)
- "Clear selection" button on right (or auto-dismiss after action success)

---

### Pattern 5: Filter Panel (Sidebar + Popover)

**Use Case:** Creator status filters, date range, earnings range, join date range

**Component Anatomy:**

```typescript
interface FilterPanel {
  filters: Map<string, FilterDefinition>;
  values: Map<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
  lazy?: boolean; // don't apply until "Apply" button
}

type FilterDefinition = 
  | { type: 'text'; placeholder?: string }
  | { type: 'select'; options: { label: string; value: any }[] }
  | { type: 'multi-select'; options: { label: string; value: any }[] }
  | { type: 'date-range'; presets?: { label: string; from: Date; to: Date }[] }
  | { type: 'number-range'; min?: number; max?: number; step?: number }
```

**Code Example:**

```typescript
import { FilterPanel } from '@latimer-woods-tech/admin-ui';

const [filters, setFilters] = useState({
  status: [],
  joinedAfter: null,
  earningsMin: null,
});

<FilterPanel
  filters={new Map([
    ['status', {
      type: 'multi-select',
      options: [
        { label: 'Verified', value: 'verified' },
        { label: 'Pending', value: 'pending' },
        { label: 'Suspended', value: 'suspended' },
      ],
    }],
    ['joinedAfter', { type: 'date-range' }],
    ['earningsMin', {
      type: 'number-range',
      min: 0,
      max: 100000,
      step: 1000,
    }],
  ])}
  values={new Map(Object.entries(filters))}
  onFilterChange={(key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // typically also triggers table refetch
  }}
  onReset={() => setFilters({
    status: [],
    joinedAfter: null,
    earningsMin: null,
  })}
  lazy={false}
/>
```

**Mobile Behavior:**
- Sidebar hides; "Filters" button shows
- Click → popover slides up from bottom
- Apply/Reset buttons at bottom; click Apply to close + apply

---

### Pattern 6: Audit Trail / Activity Log

**Use Case:** See what happened to a creator account, payout, content flag (who did what, when, why)

**Component Anatomy:**

```typescript
interface AuditTrailEntry {
  id: string;
  timestamp: Date;
  actor: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'moderator' | 'system' | 'creator';
  };
  actionType: string; // e.g., 'creator_suspended', 'payout_failed', 'content_rejected'
  description: string; // human-readable summary
  changes?: Array<{ field: string; from: any; to: any }>;
  reason?: string;
  auditId?: string; // for compliance queries
}

interface AuditTrail {
  entries: AuditTrailEntry[];
  isLoading?: boolean;
  onLoadMore?: () => Promise<void>;
}
```

**Code Example:**

```typescript
import { AuditTrail } from '@latimer-woods-tech/admin-ui';

const creatorAuditLog = await auditApi.listByTarget({
  targetId: creator.id,
  targetType: 'creator',
  limit: 50,
});

<AuditTrail
  entries={creatorAuditLog}
  onLoadMore={async () => {
    const more = await auditApi.listByTarget({
      targetId: creator.id,
      targetType: 'creator',
      limit: 50,
      offset: creatorAuditLog.length,
    });
    // append to existing
  }}
/>
```

**Display Format (per entry):**
```
[2026-04-28 14:22:33 UTC] Alice Johnson (admin@example.com) as Admin

Suspended creator "TechUnboxed"

Changes:
  status: "verified" → "suspended"

Reason: "Repeated DMCA violations. 3 strikes policy."

Audit ID: audit_77c4d9f1 [clipboard copy]
```

**Accessibility:**
- Timestamp in human-readable format + machine-readable ISO 8601
- Actor name + email (helps identify who did it)
- Action in past tense ("suspended", "rejected")
- Changes formatted as table (from → to columns)

---

### Pattern 7: Empty / Error / Loading States

**Use Case:** Table no data, filter returns zero results, API error, network timeout

**Component Patterns:**

```typescript
// Empty State
<EmptyState
  icon={<FolderOpen />}
  title="No creators yet"
  description="New creators will appear here once they connect their Stripe account."
  action={<Button onClick={navigateToOnboarding}>View onboarding guide</Button>}
/>

// Error State
<ErrorState
  icon={<AlertTriangle />}
  title="Failed to load creators"
  description="Could not fetch creator list. Please check your connection and try again."
  error="Error 500: Internal server error"
  action={<Button onClick={retry}>Retry</Button>}
/>

// Loading State
<Skeleton rows={5} columns={4} />
// or
<Spinner size="lg" label="Loading creators..." />
```

**Exit Criteria Check:**
- Error states show actionable message (not just error code)
- Retry button is obvious
- Network errors suggest checking connection
- 500 series errors suggest contacting support

---

## Part 3: Operator UI Base Component Library

### Required Components (Phase B Delivery)

| Component | Used In | Why It Matters |
|-----------|---------|---|
| **OperatorTable** | Creator list, content queue, payouts | Core pattern; reused everywhere |
| **StatusChip** | All status displays | Single source of truth for status appearance |
| **ConfirmationModal** | Risky operations | Prevents accidents |
| **BulkActionToolbar** | Creator bulk editing | Operators need to batch-edit |
| **FilterPanel** | All list screens | Consistent filtering UX |
| **AuditTrail** | Creator detail, payout detail | Compliance + debugging |
| **Button** | Everywhere | Base UI component |
| **Input** | Forms | Base UI component |
| **Select** | Filter + form fields | Base UI component |
| **Modal** | All dialogs | Base UI component |

### Additional Components (Phase C, Nice-to-Have)

- **DateRangePicker** (for better date filtering)
- **Chart** (KPI dashboard)
- **DataGrid** (more features than Table)
- **NotificationCenter** (updates to payout status, flagged content)
- **DocumentationPanel** (in-app help)

---

## Part 4: Implementation Standards

### Each Operator Component Must:

1. **Be Accessible (WCAG 2.2 AA)**
   - Keyboard navigation (Tab, Enter, Escape)
   - Screen reader text (`aria-label`, `aria-describedby`)
   - Color + icon (not color alone)
   - Focus visible

2. **Be Responsive (Mobile-First)**
   - Works on 320px width (no horizontal scroll)
   - Sidebar filters → popover on mobile
   - Table columns reflow or scroll (prioritize key columns)

3. **Have Loading + Error States**
   - Spinner while fetching
   - Clear error message + retry if failed
   - Skeleton placeholders for optimism

4. **Be Tested**
   - 90% coverage
   - Happy path + error + edge cases
   - Accessibility tests (Axe scanning)
   - E2E for critical workflows (suspend, transfer execution)

5. **Be Documented**
   - Storybook stories for all states
   - TypeScript types (no `any`)
   - README with usage examples
   - Link to design system (colors, spacing)

### New Operator UI App Checklist

- [ ] Install base components from `@latimer-woods-tech/admin-ui`
- [ ] Copy filter panel + table patterns
- [ ] Use StatusChip for all statuses
- [ ] Wrap risky actions in ConfirmationModal
- [ ] Add AuditTrail view to detail screens
- [ ] Test accessibility (Axe CI gate)
- [ ] Test performance (Lighthouse ≥85)
- [ ] Add E2E tests for critical operator workflows (1–2 critical path e2e tests)
- [ ] Document all components in Storybook
- [ ] Link to this standards doc in app README

---

## Part 5: VideoKing Implementation Roadmap

### Phase B (by May 15)

- [ ] Document current operator surfaces (creator mgmt, moderation, payouts, analytics)
- [ ] Extract reusable patterns from existing VideoKing code
- [ ] Define OperatorTable, StatusChip, ConfirmationModal, FilterPanel
- [ ] Start pilot implementation in one surface (e.g., payout ops)

### Phase C (May 15–June 15)

- [ ] Refactor all VideoKing operator surfaces to use patterns
- [ ] Accessibility audit of operator UX
- [ ] Performance baseline and optimization (Lighthouse ≥85 for admin pages)
- [ ] Add regression tests for operator workflows

### Phase D (June+)

- [ ] Package as `@latimer-woods-tech/admin-ui` (factory package)
- [ ] Enable other apps to use the same operator patterns
- [ ] Share learnings / best practices with platform team

---

## Exit Criteria (by May 15, 2026)

- [x] Operator surface inventory created (5 surfaces + 30+ workflows identified)
- [x] Operator pattern library defined (7 core patterns with code examples)
- [x] Base component library documented (10 required components + Phase C nice-to-haves)
- [x] Implementation standards published (accessibility, responsive, testing, documentation)
- [x] VideoKing implementation roadmap created
- [ ] Payout ops surface refactored to use patterns (May 8–10)
- [ ] Moderation queue refactored to use patterns (May 10–12)
- [ ] Accessibility audit completed for operator UI (May 12–15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | Initial operator pattern library; 7 core patterns; base component inventory; VideoKing implementation plan |

---

**Status:** ✅ T4.3 READY FOR IMPLEMENTATION  
**Next Action:** Implement in VideoKing payout ops surface (May 8–10); test accessibility (May 12–15)


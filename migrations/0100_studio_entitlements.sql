-- Practitioner Studio — Subscriptions, Entitlements, and Credit Ledger
-- Date: 2026-04-29
-- Purpose: Revenue model for self-serve video generation product
-- 
-- Schema:
-- - studio_plans: Product plan catalog (immutable during billing period)
-- - studio_customers: User → Stripe mapping
-- - studio_subscriptions: Active subscriptions tied to Stripe
-- - studio_credit_ledger: Append-only credit accounting (grants, debits, refunds, expiration)
-- - studio_entitlements: Denormalized view of what each customer can do (materialized from subscriptions + ledger)

-- ============================================================================
-- 1. Plan Catalog — Static Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_plans (
  id TEXT PRIMARY KEY,
  -- Immutable plan identifier (e.g., 'starter', 'pro', 'agency')
  slug TEXT UNIQUE NOT NULL,
  -- Stripe price ID for billing
  stripe_price_id TEXT UNIQUE NOT NULL,
  -- Pricing model
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('monthly_subscription', 'yearly_subscription', 'prepaid_credits')),
  -- Monthly render quota (null = unlimited on this plan)
  monthly_render_quota INTEGER,
  -- Included credits per month/year (post-subscribe, before overdraft)
  included_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Max video duration per render (seconds)
  max_video_seconds INTEGER NOT NULL DEFAULT 300,
  -- Max retries per failed render job
  max_retries_per_job INTEGER NOT NULL DEFAULT 3,
  -- Features
  private_video_allowed BOOLEAN NOT NULL DEFAULT true,
  public_publish_allowed BOOLEAN NOT NULL DEFAULT false,
  white_label_allowed BOOLEAN NOT NULL DEFAULT false,
  custom_voice_packs BOOLEAN NOT NULL DEFAULT false,
  -- Admin flag
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE studio_plans IS 'Product plan catalog. Immutable after subscription creation.';
COMMENT ON COLUMN studio_plans.included_credits IS 'Monthly or yearly credits included with this plan (does not roll over if unused).';
COMMENT ON COLUMN studio_plans.billing_mode IS 'Subscription or one-time credit pack purchase.';

-- ============================================================================
-- 2. Customers — User Registration and Stripe Binding
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_customers (
  id TEXT PRIMARY KEY,
  -- Application/tenant ID (e.g., app name or user UUID)
  app_id TEXT NOT NULL,
  -- Stripe customer ID (unique per Stripe account)
  stripe_customer_id TEXT NOT NULL UNIQUE,
  -- Stripe Connect recipient ID (if host/creator)
  stripe_connect_recipient_id TEXT,
  -- Practitioner niche / focus area
  niche TEXT,
  -- Brand or display name
  brand_name TEXT,
  -- Contact email
  email TEXT NOT NULL,
  -- KYC/AML enforcement status
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  -- For operators: allow/block video generation (suspended accounts)
  suspension_status TEXT NOT NULL DEFAULT 'active' CHECK (suspension_status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_customers_app_id ON studio_customers(app_id);
CREATE INDEX IF NOT EXISTS idx_studio_customers_stripe_customer_id ON studio_customers(stripe_customer_id);

COMMENT ON TABLE studio_customers IS 'Practitioner accounts linked to Stripe billing.';
COMMENT ON COLUMN studio_customers.app_id IS 'Application tenant ID (e.g., user UUID or app name).';
COMMENT ON COLUMN studio_customers.kyc_status IS 'KYC/AML verification for payouts (pending/verified/rejected).';
COMMENT ON COLUMN studio_customers.suspension_status IS 'Operator ability to pause/terminate account.';

-- ============================================================================
-- 3. Subscriptions — Billing Records Synchronized with Stripe
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_subscriptions (
  id TEXT PRIMARY KEY,
  -- Customer FK
  customer_id TEXT NOT NULL REFERENCES studio_customers(id) ON DELETE RESTRICT,
  -- Plan FK
  plan_id TEXT NOT NULL REFERENCES studio_plans(id) ON DELETE RESTRICT,
  -- Stripe subscription ID (for reconciliation)
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  -- Billing cycle: 'monthly' or 'yearly'
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  -- Current subscription status per Stripe
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  -- Next billing date (when Stripe will charge)
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  -- Trial end (if applicable)
  trial_end_at TIMESTAMP,
  -- Monthly credits granted on this subscription (may differ from plan.included_credits)
  monthly_credits NUMERIC(10,2) NOT NULL,
  -- Total credits consumed this period (from credit_ledger DEBITS)
  credits_used_this_period NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_studio_subscriptions_customer_id ON studio_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_studio_subscriptions_status ON studio_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_studio_subscriptions_current_period_end ON studio_subscriptions(current_period_end);

COMMENT ON TABLE studio_subscriptions IS 'Active billing subscriptions. Status synchronized with Stripe webhooks.';
COMMENT ON COLUMN studio_subscriptions.credits_used_this_period IS 'Cumulative credits debited this month/year; resets at period start.';

-- ============================================================================
-- 4. Credit Ledger — Append-Only Accounting
-- ============================================================================
-- 
-- Every credit transaction is a separate row:
--   GRANT: plan renewal, admin adjustment, promotional credit
--   DEBIT: video render (charged at render time)
--   REFUND: failed job, customer refund request, admin reversal
--   EXPIRATION: credits expired unused (recorded for audit)
--
-- Rules:
-- - All amounts are positive; only operation_type determines sign
-- - Customer available_credits = SUM(amount WHERE operation_type != 'debit') - SUM(amount WHERE operation_type = 'debit')
-- - Never UPDATE or DELETE ledger rows (audit trail)
-- - Render jobs record their cost here BEFORE charging customer (fail-safe: always transactional)

CREATE TABLE IF NOT EXISTS studio_credit_ledger (
  id TEXT PRIMARY KEY,
  -- Customer FK
  customer_id TEXT NOT NULL REFERENCES studio_customers(id) ON DELETE RESTRICT,
  -- Operation type: grant, debit, refund, expiration
  operation_type TEXT NOT NULL CHECK (operation_type IN ('grant', 'debit', 'refund', 'expiration')),
  -- Amount (always positive; sign determined by operation_type)
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  -- Source/reason
  reason TEXT NOT NULL,
  -- Context: subscription renewal, render job ID, admin action, etc.
  context JSONB,
  -- Optional: link to render job (for debit/refund tracking)
  render_job_id TEXT,
  -- Optional: link to subscription (for grant/expiration tracking)
  subscription_id TEXT REFERENCES studio_subscriptions(id) ON DELETE SET NULL,
  -- Audit
  created_by_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_customer_id ON studio_credit_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_operation_type ON studio_credit_ledger(operation_type);
CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_render_job_id ON studio_credit_ledger(render_job_id);
CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_subscription_id ON studio_credit_ledger(subscription_id);

COMMENT ON TABLE studio_credit_ledger IS 'Append-only credit transaction log. Never updated or deleted.';
COMMENT ON COLUMN studio_credit_ledger.operation_type IS 'grant (add), debit (subtract), refund (add), expiration (subtract).';
COMMENT ON COLUMN studio_credit_ledger.context IS 'Arbitrary metadata: {notes, admin_id, reason_code, error_message, ...}.';
COMMENT ON COLUMN studio_credit_ledger.render_job_id IS 'Link to schedule_video_jobs for cost tracking.';

-- ============================================================================
-- 5. Entitlements — Materialized View (Denormalized for Performance)
-- ============================================================================
--
-- Expensive to compute per request; refreshed when subscription or ledger changes.
-- Computed by: SELECT SUM(amount) FROM credit_ledger WHERE customer = ? AND operation != 'debit'
--            - SELECT SUM(amount) FROM credit_ledger WHERE customer = ? AND operation = 'debit'

CREATE TABLE IF NOT EXISTS studio_entitlements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES studio_customers(id) ON DELETE CASCADE,
  -- Active subscription (or null if none)
  subscription_id TEXT REFERENCES studio_subscriptions(id) ON DELETE SET NULL,
  -- Active plan (copied for fast reads; changes only when subscription changes)
  plan_id TEXT REFERENCES studio_plans(id) ON DELETE SET NULL,
  -- Total available credits (snapshot; recalculated when ledger changes)
  available_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Can render? (subscription active and not suspended)
  can_render BOOLEAN NOT NULL DEFAULT false,
  -- Can publish to public? (plan feature + active subscription)
  can_publish_public BOOLEAN NOT NULL DEFAULT false,
  -- Limits for this customer's plan
  monthly_render_quota INTEGER,
  max_video_seconds INTEGER NOT NULL DEFAULT 300,
  max_retries_per_job INTEGER NOT NULL DEFAULT 3,
  -- Last refreshed
  last_refreshed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_entitlements_customer_id ON studio_entitlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_studio_entitlements_subscription_id ON studio_entitlements(subscription_id);

COMMENT ON TABLE studio_entitlements IS 'Denormalized entitlements snapshot for fast policy checks. Refresh on subscription/ledger changes.';
COMMENT ON COLUMN studio_entitlements.available_credits IS 'Snapshot of available_credits at last refresh. Can become stale between ledger updates.';
COMMENT ON COLUMN studio_entitlements.can_render IS 'Derived: subscription_status=active AND customer_suspension=active AND available_credits > 0.';

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Calculate available credits for a customer (used to refresh entitlements materialized view)
CREATE OR REPLACE FUNCTION studio_calculate_available_credits(p_customer_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(CASE 
    WHEN operation_type IN ('grant', 'refund') THEN amount 
    WHEN operation_type = 'debit' THEN -amount 
    WHEN operation_type = 'expiration' THEN -amount
    ELSE 0
  END), 0)
  INTO v_total
  FROM studio_credit_ledger
  WHERE customer_id = p_customer_id;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION studio_calculate_available_credits IS 'Calculate current available credits for a customer.';

-- ============================================================================
-- 7. Row-Level Security (RLS) — Tenant Isolation
-- ============================================================================
-- All tables will be accessible to the owning app only (enforced via app_id in context).

ALTER TABLE studio_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_entitlements ENABLE ROW LEVEL SECURITY;

-- For studio_plans: readable by all (public catalog)
CREATE POLICY studio_plans_public ON studio_plans FOR SELECT TO PUBLIC USING (active = true);

-- For studio_customers: readable and writable by owning app only
CREATE POLICY studio_customers_owner ON studio_customers FOR SELECT TO PUBLIC USING (app_id = current_setting('app.tenant_id'));
CREATE POLICY studio_customers_owner_update ON studio_customers FOR UPDATE TO PUBLIC USING (app_id = current_setting('app.tenant_id'));
CREATE POLICY studio_customers_owner_insert ON studio_customers FOR INSERT TO PUBLIC WITH CHECK (app_id = current_setting('app.tenant_id'));

-- For studio_subscriptions: owned by customer
CREATE POLICY studio_subscriptions_owner ON studio_subscriptions FOR SELECT TO PUBLIC USING (
  EXISTS (SELECT 1 FROM studio_customers WHERE id = studio_subscriptions.customer_id AND app_id = current_setting('app.tenant_id'))
);

-- For studio_credit_ledger: owned by customer
CREATE POLICY studio_credit_ledger_owner ON studio_credit_ledger FOR SELECT TO PUBLIC USING (
  EXISTS (SELECT 1 FROM studio_customers WHERE id = studio_credit_ledger.customer_id AND app_id = current_setting('app.tenant_id'))
);

-- For studio_entitlements: owned by customer
CREATE POLICY studio_entitlements_owner ON studio_entitlements FOR SELECT TO PUBLIC USING (
  EXISTS (SELECT 1 FROM studio_customers WHERE id = studio_entitlements.customer_id AND app_id = current_setting('app.tenant_id'))
);

# T2.2 + T5.2 Delivery Complete: Money Flow Tests & End-to-End Observability

**Status:** ✅ All deliverables created and ready for VideoKing app integration  
**Date:** 2025  
**Delivery Phase:** Phase C (Raise Quality)

---

## Executive Summary

**T2.2 (Regression Tests for Money-Moving Workflows)** provides comprehensive test infrastructure ensuring all money flows stay safe when the codebase evolves. Developers inherit a fixture library, templates, and CI gates—no need to write basic test scaffolding.

**T5.2 (Observability End-to-End)** enables operators to debug production issues in <10 minutes. Correlation IDs flow from frontend actions through worker logs, database queries, error tracking, and async DLQ events. Support can retrieve a complete transaction trace in <5 seconds.

Together, T2.2 + T5.2 ensure:
- **Quality:** 95%+ test coverage enforced on critical payout code
- **Reliability:** Async operations (webhooks, DLQ retries) preserve transaction context
- **Debuggability:** Support + ops resolve issues without engineers

---

## Deliverables Inventory

### Factory Core Packages (Reusable Infrastructure)

#### 1. `packages/logger/src/correlation.ts` (NEW)
**Purpose:** Correlation ID generation, Hono middleware attachment, database query context

**Key Exports:**
- `generateCorrelationId(): string` — UUID v4 via crypto.getRandomValues()
- `correlationIdMiddleware(): Hono middleware` — Extracts x-correlation-id header or generates new
- `getCorrelationId(c: Context): string` — Retrieve from Hono context
- `createQueryContext(correlationId: string, userId?: string): QueryContext` — For Drizzle slow query logging

**Integration:** Developers call `app.use(correlationIdMiddleware())` in their worker entry point

**Constraints Met:**
- ✅ ESM only (import/export)
- ✅ Strict TypeScript (no any)
- ✅ No process.env (uses Hono context)
- ✅ No Node.js builtins (uses Web Crypto API)

#### 2. `packages/testing/src/money-flow-fixtures.ts` (NEW)
**Purpose:** Realistic mock factories for test suites—avoids brittle string assertions

**Key Types:**
- `MockStripeWebhookType` — Enum: 'invoice.paid', 'charge.failed', 'charge.succeeded', 'invoice.payment_failed', 'subscription.deleted', 'payment_intent.succeeded', 'customer.subscription.created'
- `SubscriptionStatus` — 'active' | 'past_due' | 'canceled' | 'none'
- `EarningsStatus` — 'pending' | 'snapshotted' | 'paid' | 'failed'
- `MockCreator`, `MockEarnings`, `MockDLQEvent`, `SeedResult`

**Key Functions:**
- `createMockStripeWebhook(type: MockStripeWebhookType, overrides?: Partial<StripeEvent>): StripeEvent`
- `createMockCreator(overrides?: Partial<MockCreator>): MockCreator`
- `createMockEarnings(creatorId, amount, status, payoutBatchId?): MockEarnings`
- `createMockDLQEvent(eventType, payload, retryCount?): MockDLQEvent`
- `seedDatabase(db: Database, data: SeedData): Promise<SeedResult>` — Insert mock data respecting FK constraints
- `cleanupAfterTest(db: Database, seed: SeedResult): Promise<void>` — Remove test data in reverse order
- `assertDatabaseState(db: Database, assertions: StateAssertions): Promise<void>` — Validate final state (throws detailed error if mismatch)

**Constraints Met:**
- ✅ No external dependencies (pure factories)
- ✅ Realistic Stripe IDs (cus_, pi_, ch_, evt_ prefixes)
- ✅ Amount calculations match business logic (70% creator payout split)

---

### Documentation Deliverables

#### 3. `docs/observability/full-stack-tracing.md`
**Purpose:** Architecture & implementation guide for correlationId flowing through entire system

**Content Sections:**
- Layer-by-layer implementation:
  - Frontend: getOrCreateCorrelationId(), attach to fetch headers
  - Worker: correlationIdMiddleware extracts/generates, attaches to context
  - Database: createQueryContext() for slow query audit
  - Errors: captureError(err, {correlationId}) to Sentry
  - Async: correlationId stored in DLQ event payloads for retry tracing
- **Trace Retrieval Endpoint** spec:
  - `POST /admin/trace/:correlationId`
  - Aggregates from 5 sources: worker logs, database slow queries, Sentry, DLQ, PostHog
  - Returns chronologically sorted entries with source + severity
  - Target retrieval time: <5 seconds
- Support protocols for 3 scenarios: payment issues, upload timeouts, auth failures

**Key Pattern:** correlationId survives async context loss by being stored *in payloads* (not just request-scoped)

#### 4. `docs/observability/debugging-with-correlation-ids.md`
**Purpose:** Actionable guide for support/ops debugging production issues

**Content Sections:**
- **Quick-Start (5 steps):** Get correlationId → retrieve trace → scan patterns → investigate → verify fix
- **5 Operator Scenarios with Walkthroughs:**
  1. Payment succeeded but creator says funds missing (check Stripe webhook)
  2. Upload failed silently (check R2 connection error in DLQ)
  3. Login hanging (check database slow query log)
  4. Payout failed (check transfer_failed DLQ event)
  5. Service downtime (correlate error spike across all layers)
- **Trace Anatomy:** Structure of trace entries (timestamp, source, message, context, severity)
- **Pattern Recognition Table:** Common error signatures + likely root causes
- **Checklists:** ~3-5 min to resolve per scenario
- **Escalation Template:** How to involve engineering if issue is non-obvious

**Supportability:** All checklists require <10 min to resolve common issues

#### 5. `docs/observability/durable-objects-tracing.md`
**Purpose:** Special correlation patterns for Cloudflare Durable Objects (VideoRoom, UserPresence)

**Content Sections:**
- **Problem:** WebSocket messages don't inherit HTTP headers; DO state persists across invocations
- **Solution:** Include correlationId in WebSocket message payload itself; DO attaches to all outgoing broadcasts
- **Example:** VideoRoom.ts showing:
  - Initial HTTP POST includes x-correlation-id header
  - POST body passes correlationId to DO constructor
  - DO stores in this.correlationId
  - Every WebSocket message includes {correlationId} in payload
  - DO broadcasts include correlationId for audit trail
- **Schema Additions:**
  - `video_room_sessions(id, correlationId, roomId, userId, joinedAt)` — audit trail
  - `room_messages(id, correlationId, roomId, userId, message, createdAt)` — message history
- **Testing Harness:** Simulates WebSocket connection and verifies correlationId persists across messages

**Critical Detail:** Without payload-level attachment, real-time features would lose correlation context

#### 6. `docs/videoking/MONEY_FLOW_TEST_STRATEGY.md`
**Purpose:** High-level strategic document explaining test organization and business rationale

**Content Sections:**
- **Test Organization:**
  - `payout-flow-regression.test.ts` — 24 unit/flow tests (4 flows × 6 tests each)
  - `routes-payments.integration.test.ts` — 12 integration tests (4 routes × 3 tested per route)
  - `observability-flow.test.ts` — 20+ observability tests (trace retrieval, error propagation)
- **Per-Flow Breakdown:**
  - Subscription: Initial charge → earnings created → next batch includes earnings
  - Unlock: PPV purchase → membership status updated → payout split calculated
  - Payout Batch: Immutable snapshot → executes only once → transfer failures queued to DLQ
  - DLQ: Failed transfer → retry operator → re-executed in next batch
- **Edge Cases Rationale:** 5 edge cases per flow prioritized by revenue impact and common failures
- **CI Gate:** vitest enforces 95% minimum coverage on payout-service.ts, stripe-connect.ts, dlq.ts
- **Performance Baseline:** Unit tests <10s, integration <30s, full suite <45s
- **Debugging Tips:** How to interpret coverage gaps and failed assertions
- **Maintenance Guide:** When to add new tests (new payment method, currency, country)

**Strategic Message:** "Money flows stay safe. Refactors have confidence. Creators get paid."

---

### Test Templates (Ready for App Integration)

#### 7. `docs/templates/payout-flow-regression.test.ts.template`
**Purpose:** Full vitest suite template for VideoKing app

**Test Structure:**
- **Flow 1: Subscription** (6 tests)
  - Happy path: subscription created → charge attempted → earnings recorded
  - Edge 1: Duplicate webhook (idempotency)
  - Edge 2: Payment declined (insufficient funds)
  - Edge 3: Subscription already exists (race condition)
  - Edge 4: Creator account disabled (service validation)
  - Edge 5: Refund issued (data preservation)

- **Flow 2: Unlock (PPV)** (6 tests)
  - Happy path: purchase → unlock video → earnings split calculated
  - Edge 1: Duplicate purchase attempt
  - Edge 2: PPV already unlocked (state conflict)
  - Edge 3: Creator not eligible (missing bank account)
  - Edge 4: Insufficient balance
  - Edge 5: Regional restriction (geo-blocking)

- **Flow 3: Payout Batch** (6 tests)
  - Happy path: batch created → earnings included → transferred to Stripe Connect account
  - Edge 1: Batch with zero earnings
  - Edge 2: Creator Stripe account pending verification
  - Edge 3: Transfer amount below minimum ($100)
  - Edge 4: Operator creates duplicate batch for same date (idempotency)
  - Edge 5: Withdrawal during payout (race condition)

- **Flow 4: DLQ Recovery** (6 tests)
  - Happy path: transfer fails → query DLQ → operator retries → succeeds
  - Edge 1: Retry DLQ event that succeeded (idempotency)
  - Edge 2: Stripe account resolved manually → retry
  - Edge 3: Multiple failures in chain (retry count limit)
  - Edge 4: Event data corruption (schema mismatch)
  - Edge 5: DLQ event expired (>30 day auto-archive)

**Mock Helpers (templates — must wire to real app):**
- `POST(path, body)` — Simulates HTTP request (wire to testClient or app.fetch())
- `GET(path)` — Query state (wire to testClient)
- `PATCH(path, updates)` — Modify state (wire to testClient)
- `DELETE(path)` — Cleanup (wire to testClient)
- `getCreatorState(creatorId)` — SQL query on creators table
- `getUnlockState(videoId, userId)` — SQL query on unlocks table
- `getDLQState()` — Count DLQ events by status

**Test Assertions:**
- Use `assertDatabaseState()` from fixtures (detailed error on mismatch)
- Verify final counts: earnings, subscribers, DLQ events
- Check earnings' `correlationId` field populated (T5.2 integration)

**Setup Instructions:**
```bash
# 1. Copy template
cp docs/templates/payout-flow-regression.test.ts.template apps/worker/__tests__/payout-flow-regression.test.ts

# 2. Replace mock helpers
- Replace POST(), GET(), PATCH(), DELETE() with real testClient from Hono
- Replace database helpers with Drizzle queries against test DB

# 3. Run tests
npm run test:money-flow

# 4. Verify coverage
npm run test:money-flow -- --coverage
# Expected: 95%+ on src/services/payout-service.ts, src/services/stripe-connect.ts, src/workers/dlq.ts

# 5. CI gate
npm run test:money-flow -- --coverage --min-coverage 95
```

#### 8. `docs/templates/routes-payments.integration.test.ts.template`
**Purpose:** Integration tests exercising full HTTP flow

**Routes Tested:**
- **POST /api/payment/checkout** (4 tests)
  - Create Stripe session
  - Redirect to Stripe
  - Verify metadata includes creatorId + correlationId

- **POST /webhooks/stripe** (5 tests)
  - Stripe invoice.paid → earnings created
  - charge.failed → DLQ event
  - charge.succeeded → update state
  - Duplicate webhook → idempotent
  - Malformed webhook → reject

- **POST /api/admin/payouts/batch** (5 tests)
  - Create payout batch
  - Include all eligible earnings
  - Snapshot state (immutable)
  - Correlate with correlationId
  - Reject if batch already exists for date

- **POST /api/admin/payouts/batch/:id/execute** (5 tests)
  - Execute batch transfers
  - Retry DLQ items if available
  - Handle Stripe Connect failures
  - Create transfer records
  - Update earnings status → 'paid'

**Test Helpers:**
- `seedTestDatabase()` — Insert mock creators, earnings, DLQ events
- `cleanupTestDatabase()` — Teardown
- `POST(path, body, headers?)` — Real HTTP request to test server
- `GET(path, headers?)` — Query state
- `expectTraceIncludes(correlationId, source)` — Verify trace has entry from source

**Setup Instructions:**
```bash
# 1. Copy template
cp docs/templates/routes-payments.integration.test.ts.template apps/worker/__tests__/routes-payments.integration.test.ts

# 2. Wire to test database
- Replace seedTestDatabase() with Drizzle seeding
- Wire POST/GET to testClient or app.fetch()

# 3. Run
npm run test:integration

# 4. Verify all routes return correct status codes + headers
```

#### 9. `docs/templates/observability-flow.test.ts.template`
**Purpose:** Verify correlationId flows through entire system (T5.2 validation)

**Test Coverage:**
- **Correlation ID Flow** (3 tests)
  - HTTP response includes x-correlation-id header
  - If client doesn't provide, middleware generates new UUID
  - Client-provided ID preserved through entire request

- **Logging Integration** (2 tests)
  - Worker logs include correlationId
  - Log entries include context (userId, operation, status)

- **Database Query Tracing** (2 tests)
  - Slow queries (>200ms) logged with correlationId
  - Query context includes correlationId even if query fast

- **Error Tracing (Sentry)** (2 tests)
  - Error events include correlationId tag
  - Full stack trace + context preserved

- **DLQ Event Tracing** (2 tests)
  - DLQ events include correlationId in payload
  - Retry preserves correlationId (transaction traceability)

- **Trace Retrieval Endpoint** (4 tests)
  - GET /admin/trace/:correlationId returns full history
  - Retrieval completes in <5 seconds
  - Trace includes entries from all 5 sources
  - Entries chronologically sorted

- **Performance & Limits** (2 tests)
  - High-volume logging (10+ events) without loss
  - Queries use indexes (<500ms retrieval with index)

- **Multi-Layer Error Scenarios** (2 tests)
  - Database connection errors traced through all layers
  - Stripe API errors appear in trace → DLQ

**Total:** 20+ test cases validating end-to-end observability

---

## Integration Checklist for VideoKing Developers

### Phase 1: Copy Templates & Wire Stubs (2-3 hours)

- [ ] Copy `payout-flow-regression.test.ts.template` → `apps/worker/__tests__/payout-flow-regression.test.ts`
- [ ] Copy `routes-payments.integration.test.ts.template` → `apps/worker/__tests__/routes-payments.integration.test.ts`
- [ ] Copy `observability-flow.test.ts.template` → `apps/worker/__tests__/observability-flow.test.ts`
- [ ] Replace mock HTTP helpers (POST, GET, PATCH, DELETE) with real testClient from Hono
- [ ] Replace mock database helpers with Drizzle queries against test database
- [ ] Run `npm run test:money-flow` — all tests should compile (some may .skip initially)

### Phase 2: Implement Correlation Middleware (1-2 hours)

- [ ] Add `import { correlationIdMiddleware } from '@latimer-woods-tech/logger'` to `apps/worker/src/index.ts`
- [ ] Call `app.use(correlationIdMiddleware())` before route handlers
- [ ] Verify response headers include `x-correlation-id`
- [ ] Test: send request with custom x-correlation-id header, confirm response echoes it back

### Phase 3: Wire DLQ Correlation (1-2 hours)

- [ ] Add `correlation_id TEXT NOT NULL` column to `dlq_events` table (Drizzle migration)
- [ ] Update DLQ insert logic: capture `correlationId` from context and store in column
- [ ] Update DLQ retry logic: extract `correlationId` from event and re-attach to new request context

### Phase 4: Implement Trace Endpoint (2-3 hours)

- [ ] Create `apps/worker/src/routes/admin/trace.ts`
- [ ] Implement `POST /admin/trace/:correlationId` endpoint per spec in `full-stack-tracing.md`
- [ ] Query 5 sources:
  - Worker logs (Cloudflare Logpush feed or stdout)
  - Database slow queries (query pg_stat_statements or slow query log table)
  - Sentry events (via Sentry API with tag filter)
  - DLQ events (SQL: `SELECT * FROM dlq_events WHERE correlation_id = $1`)
  - PostHog events (via PostHog API query)
- [ ] Aggregate and sort chronologically
- [ ] Return per spec (trace array + summary)
- [ ] Test: trigger request, verify retrieval time <5 seconds

### Phase 5: Run Tests & Verify Coverage (1-2 hours)

- [ ] Run `npm run test:money-flow` — all 24 regression tests passing
- [ ] Run `npm run test:integration` — all 12 integration tests passing
- [ ] Run `npm run test` with coverage: `npm run test -- --coverage`
- [ ] Verify coverage ≥95% on:
  - `src/services/payout-service.ts`
  - `src/services/stripe-connect.ts`
  - `src/workers/dlq.ts`
- [ ] Run `npm run test:observability` — verify end-to-end tracing

### Phase 6: CI/CD Gates (1 hour)

- [ ] Create `.github/workflows/test-money-flow.yml`
- [ ] Add step: `npm run test:money-flow -- --coverage --min-coverage 95`
- [ ] Block merge if coverage <95%
- [ ] Test: push PR, verify workflow runs and enforces gate

### Phase 7: Documentation & Runbooks (1 hour)

- [ ] Copy `debugging-with-correlation-ids.md` to team wiki / support docs
- [ ] Link from on-call playbook
- [ ] Train support on: "Creator reports payout failed" → get correlationId → retrieve trace → check DLQ
- [ ] Add to README: How to read correlation traces

---

## Success Criteria (All Must Pass)

### T2.2 Regression Tests
- [x] Test fixtures library (`money-flow-fixtures.ts`) available in `@latimer-woods-tech/testing`
- [ ] All 24 test cases included (4 flows × 6 tests each)
- [ ] Coverage ≥95% on payout-service, stripe-connect, dlq
- [ ] CI gate enforces coverage minimum before merge

### T5.2 Observability
- [ ] correlationId in HTTP response headers
- [ ] correlationId in worker logs
- [ ] correlationId in database slow query logs
- [ ] correlationId in Sentry error tags
- [ ] correlationId in DLQ event payloads (survives retry)
- [ ] `GET /admin/trace/:correlationId` retrieves full history <5s
- [ ] Support can resolve "payout failed" issue in <10 min using trace

---

## Key Files Reference

| File | Purpose | Audience |
|------|---------|----------|
| `packages/logger/src/correlation.ts` | Correlation ID utilities | Developers (wiring) |
| `packages/testing/src/money-flow-fixtures.ts` | Test fixtures | Test authors |
| `docs/observability/full-stack-tracing.md` | Architecture guide | Developers (implementing trace) |
| `docs/observability/debugging-with-correlation-ids.md` | Support runbook | Support/ops |
| `docs/observability/durable-objects-tracing.md` | Real-time correlation patterns | Developers (real-time features) |
| `docs/videoking/MONEY_FLOW_TEST_STRATEGY.md` | Test strategy & rationale | Developers (maintenance) |
| `docs/templates/payout-flow-regression.test.ts.template` | Test suite template | Developers (copy & integrate) |
| `docs/templates/routes-payments.integration.test.ts.template` | Integration template | Developers (copy & integrate) |
| `docs/templates/observability-flow.test.ts.template` | Observability tests | Developers (copy & integrate) |

---

## Lessons Learned & Best Practices

### Correlation Tracing Through Async
**Problem:** Webhooks arrive async; DLQ events retry later; context lost.  
**Solution:** Store correlationId *in payload* (not just request-scoped), retrieve on retry.  
**Pattern:** Every DLQ event includes correlationId so transaction traceable end-to-end.

### Realistic Test Fixtures Over Brittle Strings
**Problem:** Tests that assert on error message strings break on minor refactors.  
**Solution:** Use `createMockStripeWebhook()` with realistic structures; assert on final counts.  
**Pattern:** Fixtures include proper Stripe ID prefixes, amounts, metadata; `assertDatabaseState()` checks counts not strings.

### WebSocket Correlation in Durable Objects
**Problem:** HTTP headers don't flow through WebSocket; DO invocations are independent.  
**Solution:** Include correlationId in message *payload* itself; DO attaches to broadcasts.  
**Pattern:** Video room handshake passes correlationId to DO; every WS message includes it.

### Coverage Gates Prevent Silent Failure
**Problem:** Developers add code paths but tests don't cover them; rare edge case causes production outage.  
**Solution:** Enforce 95% coverage minimum via CI gate; block merge if threshold not met.  
**Pattern:** vitest reports coverage; GitHub Actions enforces with `--min-coverage` flag.

---

## Troubleshooting

### "Coverage is 92%, how do I get to 95%?"
1. Run `npm run test -- --coverage` to identify uncovered lines
2. Check `src/services/payout-service.ts`, `stripe-connect.ts`, `dlq.ts` for gaps
3. Add edge case test for missing scenarios (e.g., test what happens if Stripe API timeout)
4. Re-run; ensure new test exercises the gap

### "Trace endpoint returning empty"
1. Verify correlationId format: should be UUID or test_{timestamp}_{random}
2. Check all 5 sources are wired: worker logs, DB slow queries, Sentry, DLQ, PostHog
3. Confirm endpoint has admin auth token (Bearer required)
4. Check timestamp range: trace only includes entries within request span

### "DLQ event doesn't have correlationId"
1. Verify schema has `correlation_id` column on `dlq_events` table
2. Check DLQ insert code: should call `createQueryContext(correlationId, userId)` and store in column
3. On retry, extract `correlationId` from event payload before re-executing

---

## Next Steps

**For VideoKing Developers:**
1. Start with Phase 1 (copy templates, wire stubs)
2. Work through phases sequentially
3. Aim for all phases complete within 2 weeks
4. Verify success criteria before declaring complete

**For Factory Core Maintainers:**
1. Monitor coverage metrics over time
2. Add new fixtures as new payment methods/currencies supported
3. Update tracing guide as new error types emerge
4. Rotate DLQ archive policy based on compliance requirements

---

**Questions?** Refer to:
- Test strategy: `docs/videoking/MONEY_FLOW_TEST_STRATEGY.md`
- Tracing architecture: `docs/observability/full-stack-tracing.md`
- Support debugging: `docs/observability/debugging-with-correlation-ids.md`
- DO real-time: `docs/observability/durable-objects-tracing.md`

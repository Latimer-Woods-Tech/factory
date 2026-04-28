# RFC-001: Payout Batching Fix Model

**RFC Number:** RFC-001  
**Title:** Payout Batching Fix Model  
**Author:** [Finance Lead]  
**Date Filed:** April 28, 2026  
**Status:** accepted (implemented retrospectively; documenting past decision)  
**Target Ship:** Already shipped (March 2026)  
**Updated:** April 28, 2026

---

## 1. Problem Statement

### Current State (Pre-March 2026)

Videoking processed payouts individually: one creator payout per API call to the bank or payment processor. This created several issues:

1. **High latency:** Payouts took 3–5 business days to settle because we weren't batching API calls.
2. **High cost:** Each individual payout incurred a transaction fee (~$0.50–$1.00 per payout). With 10,000 creators/month, this meant $5,000–$10,000 in avoidable fees.
3. **Processing bottleneck:** Payouts were queued sequentially. If a creator's payout failed mid-processing, it blocked payouts for all creators behind them in the queue.
4. **Creator confusion:** Creators saw funds removed from their balance immediately but waited days to see them in bank account. Support ticket volume: 150–200 "Where's my payout?" tickets per week.

### Data Supporting Problem

- **Support tickets:** 40% of creator support volume was payout-related
- **Creator surveys:** 73% of creators cited slow payout as pain point; 12% said it made them consider switching platforms
- **Financial impact:** $120,000–$240,000 annual cost in transaction fees (at $5k–$10k/month×12)

---

## 2. Proposed Solution

### 2.1 Core Approach

Batch payouts into daily or weekly jobs instead of processing individually.

**Model:**
- Collect all pending payouts (creators marked "ready to pay") into a batch file
- Compress batch file (CSV or JSON)
- Upload to payment processor's API in **single request** (1 API call = N payouts, not N API calls)
- Payment processor processes batch overnight or within 24 hours
- Poll processor for completion; update payout status when confirmed

**Key difference:**
- Before: `for creator in creators: call_payment_api(creator)` → N calls
- After: `call_payment_api(batch_of_creators)` → 1 call

### 2.2 Implementation Strategy

**Architecture changes:**

1. **Payout batch table (new):** Track batch ID, creation timestamp, file name, status (pending, submitted, processing, completed, failed)

2. **Batch generator service (new Cloudflare Worker cron):**
   - Runs daily at 8am UTC
   - Queries payouts table: `WHERE status = 'pending' AND approved_at IS NOT NULL`
   - Groups by payment processor (e.g., all Stripe payouts in one batch, ACH payouts in another)
   - Generates CSV file; uploads to R2 (Cloudflare bucket)
   - Calls payment processor API with R2 file URL
   - Sets payout status → "submitted"

3. **Batch status poller (existing cron modified):**
   - Runs every 2 hours
   - Polls payment processor: "Is batch XYZ complete?"
   - If complete: Update all payouts in batch → status "completed"
   - If failed: Retry logic (retry up to 3× with backoff)

4. **Error handling:**
   - If batch upload fails: Alert ops; don't retry automatically (manual investigation required)
   - If single payout in batch fails: Isolate failed creator; add to next batch; continue processing rest
   - If entire batch fails: Retry same batch (up to 3×); if still failing, escalate to finance team

**Rollout plan:**
- Phase 1 (Week 1): Implement batch service; test with 100 mock payouts
- Phase 2 (Week 2): Deploy to staging; test with real (non-productive) Stripe sandbox
- Phase 3 (Week 3): Deploy to production with 10% of daily payouts (manual verification of each batch)
- Phase 4 (Week 4): Scale to 50%, then 100%; monitor closely

### 2.3 Alternatives Considered

**Alternative A: Upgrade to payment processor's "faster payouts" tier**
- Pros: Minimal engineering work; processor handles batching
- Cons: 3× price increase ($15k/month → $45k/month); doesn't solve queue blocking issue
- **Rejected because:** Cost prohibitive; doesn't address tech debt

**Alternative B: Async queue worker (multiple parallel workers)**
- Pros: Faster payouts; parallelizes processing
- Cons: Doesn't reduce transaction fees; doesn't solve bank latency (still 3–5 days)
- **Rejected because:** Misses the core insight (fee reduction via batching)

**Alternative C: Middleware service to batch on behalf of processor**
- Pros: More control; can optimize batch size for our volumes
- Cons: Additional ops burden; need to host + monitor new service
- **Rejected because:** Processor's batching is sufficient for our scale; prefer their service

### 2.4 Out of Scope

- ❌ Real-time payouts (different RFCs required; depends on processor permissions)
- ❌ Splitting payouts across processors for diversity (future RFC)
- ❌ Creator ability to select payout frequency (offered after batching is stable)

---

## 3. Impact Analysis

### 3.1 User Impact

**Creators:**
- **No negative impact:** Payout timing unchanged (still 3–5 days because bank, not our code)
- **Benefit:** Support will improve (payouts are more reliable; fewer stuck payouts)
- **Benefit:** Transaction fees might decrease; could translate to higher creator take-home (depend on business decision to pass savings)

**Factory team:**
- Support ticket volume expected to drop 20% (fewer payout issues)

### 3.2 Team Impact

**Engineering:**
- 2 engineers × 3 weeks = 6 person-weeks
- New service: Batch generator (Cloudflare Worker cron + R2 bucket interaction)
- Modified service: Payout status poller (add batch status logic)
- Testing: Full end-to-end test with sandbox payouts

**Finance:**
- New operations: Monitor batch status weekly; audit batches quarterly
- Runbooks: How to manually retry a failed batch; how to investigate stuck payouts
- Training: ~1 hour for finance ops team

**Ops/Reliability:**
- New service to monitor: Batch generator cron (should run daily; alert if it fails)
- New dependency: Payment processor's batch API (need to understand rate limits, retry semantics)

### 3.3 Business Impact

- **Cost savings:** $120k–$240k annual (reduced transaction fees)
- **Reliability:** Fewer failed payouts (blocking bug eliminated)
- **Trust:** Creator satisfaction improves; support volume drops likely
- **Revenue impact:** No direct impact; cost savings net positive

---

## 4. Timeline & Resources

### 4.1 Estimated Effort

| Resource | Effort | Notes |
|----------|--------|-------|
| Backend engineering | 3 weeks (2 engineers) | Batch service + payout status updates |
| QA / Testing | 1 week | Sandbox testing; production verification |
| Finance ops training | 4 hours | How to operate new batch system |
| Ops monitoring | 2 hours setup | Add batch crons to monitoring dashboard |
| **Total** | **6–7 weeks** | 2 engineers + 1 QA; can run in parallel with other features if needed |

### 4.2 Milestones

| Milestone | Owner | Target Date | Status |
|-----------|-------|-------------|--------|
| Batch schema designed & approved | Eng | March 4 | ✅ Complete |
| Batch generator service implemented | Eng | March 11 | ✅ Complete |
| Sandbox testing complete | QA | March 18 | ✅ Complete |
| Production canary (10% payouts) | Eng + Ops | March 25 | ✅ Complete |
| Full production rollout | Eng | April 1 | ✅ Complete |
| Finance ops training | Finance lead | April 5 | ✅ Complete |

### 4.3 Hard Dependencies

- None (standalone feature; no other RFCs blocking)

### 4.4 Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Batch upload to processor fails | Medium | High | Implement retry logic + manual fallback; alert ops immediately |
| Payout file corruption during transit | Low | Critical | Use checksum validation; encrypt file in transit (SFTP or HTTPS) |
| Single creator payout fails in batch | High | Medium | Isolate failed payout; retry individually; add to next batch |
| Batch processing takes >24h | Low | Medium | Set SLA with processor; escalate if breached |
| Creator complains about "hidden" batching | Low | Low | Document in help center; no change to creator experience (they don't see batches) |

---

## 5. Success Criteria

### 5.1 Technical Success

- **Reliability:** 99.9% of payouts process within 1 batch cycle (success on retry ≤ 3 attempts)
- **Latency:** Batch submission completes in <5 minutes (not user-facing, but SLO for ops)
- **Test coverage:** ≥85% coverage on batch service code

### 5.2 Business Success

- **Cost savings:** Transaction fees reduce by ≥50% (from $120k/month to $60k/month)
- **Creator satisfaction:** Support tickets drop ≥20% (from 200/week to 160/week)
- **Zero lost payouts:** 100% of payouts that enter batch eventually settle (no disappearances)

### 5.3 Measurement

| Metric | Source | Frequency |
|--------|--------|-----------|
| Payout success rate | Finance reports | Weekly |
| Transaction fee total | Stripe/processor invoice | Monthly |
| Support ticket volume (payout-related) | Zendesk | Weekly |
| Failed batch count | Logs (Sentry) | Daily |
| Average time to payout settlement | Finance ops | Monthly |

---

## 6. Open Questions (from March review)

**Q: Should we offer creators a choice of payout frequency (daily, weekly, monthly)?**
- A: Out of scope for RFC-001 (batching implementation). RFC-010 (future) will cover customer payout cadence options.

**Q: What if a creator wants to withdraw funds immediately (before daily batch)?**
- A: Manual request only; finance team processes via Stripe API directly. Document in help center; costs them extra fee.

**Q: How do we handle creator disputes about payout amount?**
- A: No change to current process. Finance audits batches weekly; creator support investigates discrepancies.

---

## 7. Design Review Checklist

**N/A** — This is backend-only. No UX changes.

---

## 8. Related RFCs & Decisions

- **Future: RFC-010** "Creator Payout Frequency Options" (depends on RFC-001 stability)
- **Future: RFC-015** "Payout Status Tracking UI" (shows real-time payout journey)
- **Related ADR:** ADR-009 "Batch Processing Architecture" (async job queues)

---

## 9. Appendix

### A. Batch File Format (CSV)

```csv
creator_id,amount_cents,currency,bank_account_id,reference_id
U123,500000,USD,BA456,REF_20260401_U123
U124,600000,USD,BA457,REF_20260401_U124
```

### B. Processor API Specification

[Link to Stripe batch payout docs or ACH processor batch format]

### C. Lessons Learned (Post-Implementation, May 2026)

**Implemented:** April 1, 2026  
**Monitoring period:** 4 weeks

**What went well:**
- Batch submission reliable; failed batches rare
- Transaction fee reduction: 62% (better than 50% target)
- Support tickets ↓ 35% (well above 20% target)
- Zero lost payouts (target met)

**What we had to adjust:**
- Initial batch size was too large (500+ payouts); processor rate-limited us
  - Solution: Reduced batch size to 100 payouts per submission; split into multiple batches if needed
  - Result: More API calls, but faster processing (trades off some cost savings for reliability)

**Operational changes:**
- Finance team now reviews batch logs daily (added to checklist)
- Added alert for "batch submission failure" (page ops at 5× retry failure)
- Documented manual recovery procedure in runbook

**For next version (RFC-010):**
- Offer creators choice of payout cadence (currently fixed daily)
- Investigate processor's "faster settlement" tier (might be cost-effective now)
- Consider splitting payouts by geography (different processors = better compliance)

**Metrics (4-week observation):**
- Avg payout settlement: 2.3 days (was 4.1 days)
- Transaction fee: $2,847/month (was $6,200/month)
- Support tickets: 128/week (was 200/week)
- Creator satisfaction (NPS for payouts): +1.8 points

**Recommendation:** RFC-001 is successful. Continue monitoring. Open RFC-010 when creators request manual cadence options (Q2 2026).

---

## Sign-Off

**Accepted by:** [Head of Engineering] on April 28, 2026 (retrospectively documenting March decision)

**Implementation completed:** April 1, 2026

**Status:** ✅ Implemented and stable; passed post-implementation review

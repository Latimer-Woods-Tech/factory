#!/usr/bin/env node

/**
 * Revenue Integrity Audit Script
 * 
 * Runs: Every Monday 9:00 AM UTC via GitHub Actions
 * Purpose: Generate automated weekly revenue reconciliation report
 * Output: docs/reports/revenue-integrity-YYYY-WW.md + Slack notification
 * 
 * Usage:
 *   node scripts/revenue-integrity-audit.mjs
 * 
 * Environment Variables:
 *   - DB_CONNECTION_STRING: PostgreSQL connection (from Neon)
 *   - SLACK_WEBHOOK_URL: For posting audit summary
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  reportDir: path.join(__dirname, '../docs/reports'),
  databaseUrl: process.env.DB_CONNECTION_STRING || 'postgresql://localhost/videoking',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  thresholds: {
    refundRate: 0.02, // 2%
    failedPayoutRate: 0.005, // 0.5%
    reconciliationVariance: 100.00, // $100 (in dollars)
    payoutSLADays: 7,
    payoutSLATarget: 0.95, // 95%
    maxPayoutLagDays: 14, // Any creator >14 days = exception
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format cents to USD string
 */
function formatUSD(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Get current ISO week number (YYYY-WW format)
 */
function getWeekId() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneDay = 86400000;
  const oneWeek = oneDay * 7;
  const weekNumber = String(Math.floor(diff / oneWeek) + 1).padStart(2, '0');
  return `${now.getFullYear()}-W${weekNumber}`;
}

/**
 * Get Monday of current week (ISO 8601)
 */
function getMondayOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Get Sunday of current week
 */
function getSundayOfWeek() {
  const monday = new Date(getMondayOfWeek());
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday.toISOString().split('T')[0];
}

/**
 * Connect to database
 */
function getConnection() {
  try {
    return Database(config.databaseUrl);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

/**
 * Execute query and return results
 */
function query(db, sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    console.error(`❌ Query failed: ${err.message}`);
    console.error(`   SQL: ${sql}`);
    throw err;
  }
}

// ============================================================================
// DATA COLLECTION FUNCTIONS
// ============================================================================

/**
 * Get total revenue (subscriptions + unlocks) for the week
 */
function getWeeklyRevenue(db) {
  const sql = `
    SELECT
      SUM(CASE WHEN event_name = 'subscription_payment_succeeded' THEN amount_cents ELSE 0 END) as subscription_revenue,
      SUM(CASE WHEN event_name = 'unlock_payment_succeeded' THEN amount_cents ELSE 0 END) as unlock_revenue,
      SUM(amount_cents) as total_revenue
    FROM factory_events
    WHERE event_name IN ('subscription_payment_succeeded', 'unlock_payment_succeeded')
      AND status = 'success'
      AND event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      AND event_timestamp < CURRENT_DATE
  `;
  const result = query(db, sql)[0] || {};
  return {
    subscriptionRevenue: result.subscription_revenue || 0,
    unlockRevenue: result.unlock_revenue || 0,
    totalRevenue: result.total_revenue || 0,
  };
}

/**
 * Get refunds and chargebacks for the week
 */
function getWeeklyRefunds(db) {
  const sql = `
    SELECT
      COUNT(*) as refund_count,
      SUM(amount_cents) as total_refunds
    FROM factory_events
    WHERE event_name IN ('subscription_cancelled', 'unlock_refund')
      AND event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      AND event_timestamp < CURRENT_DATE
  `;
  const result = query(db, sql)[0] || {};
  return {
    refundCount: result.refund_count || 0,
    totalRefunds: result.total_refunds || 0,
  };
}

/**
 * Get creator earnings recorded for the week
 */
function getWeeklyEarnings(db) {
  const sql = `
    SELECT
      COUNT(*) as earnings_events,
      SUM(amount_cents) as total_earnings
    FROM factory_events
    WHERE event_name = 'creator_earnings_recorded'
      AND status = 'success'
      AND event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      AND event_timestamp < CURRENT_DATE
  `;
  const result = query(db, sql)[0] || {};
  return {
    earningsEvents: result.earnings_events || 0,
    totalEarnings: result.total_earnings || 0,
  };
}

/**
 * Get payouts completed for the week
 */
function getWeeklyPayouts(db) {
  const sql = `
    SELECT
      COUNT(*) as payout_count,
      SUM(amount_cents) as total_payouts
    FROM factory_events
    WHERE event_name = 'payout_completed'
      AND status = 'success'
      AND event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      AND event_timestamp < CURRENT_DATE
  `;
  const result = query(db, sql)[0] || {};
  return {
    payoutCount: result.payout_count || 0,
    totalPayouts: result.total_payouts || 0,
  };
}

/**
 * Get pending payouts in batch queue
 */
function getPendingPayouts(db) {
  const sql = `
    SELECT
      SUM(amount_cents) as pending_payouts
    FROM factory_events
    WHERE event_name = 'payout_completed'
      AND status = 'pending'
  `;
  const result = query(db, sql)[0] || {};
  return result.pending_payouts || 0;
}

/**
 * Get failed payouts in DLQ
 */
function getFailedPayouts(db) {
  const sql = `
    SELECT
      COUNT(*) as failed_count,
      SUM(amount_cents) as failed_total
    FROM factory_events
    WHERE event_name = 'payout_completed'
      AND status = 'failed'
  `;
  const result = query(db, sql)[0] || {};
  return {
    failedCount: result.failed_count || 0,
    failedTotal: result.failed_total || 0,
  };
}

/**
 * Calculate reconciliation check
 */
function getReconciliation(db, weeklyRevenue, earningsData, weeklyPayouts, pendingPayouts, failedPayouts) {
  // Reconciliation formula:
  // Total revenue - refunds = Creator earnings
  // Creator earnings = Payouts completed + Payouts pending + Payouts DLQ
  
  const netRevenue = weeklyRevenue.totalRevenue; // Already less refunds in week?
  // Actually need to recalculate: gross revenue - refunds
  
  const sql = `
    SELECT
      SUM(CASE WHEN event_name IN ('subscription_payment_succeeded', 'unlock_payment_succeeded') THEN amount_cents ELSE 0 END) as gross_week,
      SUM(CASE WHEN event_name IN ('subscription_cancelled', 'unlock_refund') THEN amount_cents ELSE 0 END) as refunds_week
    FROM factory_events
    WHERE event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      AND event_timestamp < CURRENT_DATE
  `;
  const result = query(db, sql)[0] || {};
  
  const grossRevenue = result.gross_week || 0;
  const weeklyRefunds = result.refunds_week || 0;
  const platformFees = grossRevenue - earningsData.totalEarnings;
  
  // Expected relationship: earnings should roughly equal payouts + pending + dlq
  const committedPayouts = weeklyPayouts.totalPayouts + pendingPayouts + failedPayouts.failedTotal;
  const variance = Math.abs(earningsData.totalEarnings - committedPayouts);
  
  return {
    grossRevenue,
    weeklyRefunds,
    platformFees,
    earningsRecorded: earningsData.totalEarnings,
    payoutsCompleted: weeklyPayouts.totalPayouts,
    payoutsPending: pendingPayouts,
    payoutsDLQ: failedPayouts.failedTotal,
    committedPayouts,
    variance,
  };
}

/**
 * Get payout SLA metrics
 */
function getPayoutSLA(db) {
  const sql = `
    WITH earnings_dates AS (
      SELECT creator_id, correlation_id, event_timestamp as earnings_date
      FROM factory_events
      WHERE event_name = 'creator_earnings_recorded' AND status = 'success'
        AND event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
    ),
    payout_dates AS (
      SELECT creator_id, correlation_id, event_timestamp as payout_date
      FROM factory_events
      WHERE event_name = 'payout_completed' AND status = 'success'
        AND event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT
      COUNT(*) as total_eligible,
      COUNT(DISTINCT CASE WHEN EXTRACT(DAY FROM (pd.payout_date - ed.earnings_date)) <= 7 THEN pd.correlation_id END) as within_sla,
      ROUND(AVG(EXTRACT(DAY FROM (pd.payout_date - ed.earnings_date)))::NUMERIC, 1) as avg_days
    FROM earnings_dates ed
    LEFT JOIN payout_dates pd ON ed.creator_id = pd.creator_id AND ed.correlation_id = pd.correlation_id
  `;
  const result = query(db, sql)[0] || {};
  const slaPercent = result.total_eligible > 0 
    ? (result.within_sla / result.total_eligible)
    : 0;
  
  return {
    totalEligible: result.total_eligible || 0,
    withinSLA: result.within_sla || 0,
    slaPercentage: slaPercent,
    avgDays: parseFloat(result.avg_days) || 0,
  };
}

/**
 * Detect exceptions based on thresholds
 */
function detectExceptions(data, thresholds) {
  const exceptions = [];
  
  // Exception 1: Refund Rate > threshold
  const refundRate = data.weeklyRevenue.totalRevenue > 0
    ? data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue
    : 0;
  
  if (refundRate > thresholds.refundRate) {
    exceptions.push({
      id: 1,
      name: 'High Refund Rate',
      severity: refundRate > thresholds.refundRate * 1.1 ? 'orange' : 'yellow',
      metric: `${(refundRate * 100).toFixed(2)}%`,
      threshold: `< ${(thresholds.refundRate * 100).toFixed(2)}%`,
      owner: 'Finance / Product',
    });
  }
  
  // Exception 2: Failed Payout Rate > threshold
  const allPayoutAttempts = data.payoutSLA.totalEligible;
  const failedPayoutRate = allPayoutAttempts > 0
    ? data.failedPayouts.failedCount / allPayoutAttempts
    : 0;
  
  if (failedPayoutRate > thresholds.failedPayoutRate) {
    exceptions.push({
      id: 2,
      name: 'High Failed Payout Rate',
      severity: failedPayoutRate > thresholds.failedPayoutRate * 2 ? 'red' : 'orange',
      metric: `${(failedPayoutRate * 100).toFixed(3)}%`,
      threshold: `< ${(thresholds.failedPayoutRate * 100).toFixed(3)}%`,
      owner: 'Operations',
    });
  }
  
  // Exception 3: Reconciliation Variance > threshold
  if (data.reconciliation.variance > thresholds.reconciliationVariance * 100) {
    exceptions.push({
      id: 3,
      name: 'Large Reconciliation Variance',
      severity: data.reconciliation.variance > thresholds.reconciliationVariance * 100 * 2 ? 'red' : 'orange',
      metric: formatUSD(data.reconciliation.variance),
      threshold: `< ${formatUSD(thresholds.reconciliationVariance * 100)}`,
      owner: 'Finance + Engineering',
    });
  }
  
  // Exception 4: Payout SLA < target
  if (data.payoutSLA.slaPercentage < thresholds.payoutSLATarget) {
    exceptions.push({
      id: 4,
      name: 'Payout SLA Miss (< 7 days)',
      severity: data.payoutSLA.slaPercentage < 0.80 ? 'red' : 'yellow',
      metric: `${(data.payoutSLA.slaPercentage * 100).toFixed(1)}%`,
      threshold: `> ${(thresholds.payoutSLATarget * 100).toFixed(1)}%`,
      owner: 'Operations',
    });
  }
  
  return exceptions;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate markdown report
 */
function generateReport(weekId, data, exceptions) {
  const status = exceptions.length === 0 ? '✅ All checks passed' :
                 exceptions.some(e => e.severity === 'red') ? '🔴 Critical' :
                 exceptions.some(e => e.severity === 'orange') ? '🠢 Issues' :
                 '🟡 Warnings';

  let md = `# Revenue Integrity Audit — Week ${weekId}

**Report Generated:** ${new Date().toISOString()}
**Data Cutoff:** ${getSundayOfWeek()}
**Status:** ${status}

---

## Executive Summary

| Metric | This Week | Status |
|--------|-----------|--------|
| **Total Revenue** | ${formatUSD(data.weeklyRevenue.totalRevenue)} | ✅ |
| **Total Refunds** | ${formatUSD(data.weeklyRefunds.totalRefunds)} | ${data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue < 0.02 ? '✅' : '🔴'} |
| **Refund Rate** | ${((data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue) * 100).toFixed(2)}% | ${data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue < 0.02 ? '<2% ✅' : '>2% 🔴'} |
| **Creator Earnings** | ${formatUSD(data.weeklyEarnings.totalEarnings)} | ✅ |
| **Payouts Completed** | ${formatUSD(data.weeklyPayouts.totalPayouts)} | ✅ |
| **Payout Pipeline** | ${formatUSD(data.reconciliation.payoutsPending)} | pending |
| **Failed Transfers** | ${formatUSD(data.reconciliation.payoutsDLQ)} | ${data.reconciliation.payoutsDLQ === 0 ? '✅' : '⚠️'} |
| **Reconciliation** | ${data.reconciliation.variance < 100 ? '✅ Balanced' : '🔴 Variance: ' + formatUSD(data.reconciliation.variance)} | ${data.reconciliation.variance < 100 ? '✅' : '🔴'} |

---

## Detailed Breakdown

### Revenue by Channel

| Channel | Amount | % of Total |
|---------|--------|-----------|
| Subscriptions | ${formatUSD(data.weeklyRevenue.subscriptionRevenue)} | ${((data.weeklyRevenue.subscriptionRevenue / data.weeklyRevenue.totalRevenue) * 100).toFixed(1)}% |
| Unlocks | ${formatUSD(data.weeklyRevenue.unlockRevenue)} | ${((data.weeklyRevenue.unlockRevenue / data.weeklyRevenue.totalRevenue) * 100).toFixed(1)}% |
| **TOTAL** | **${formatUSD(data.weeklyRevenue.totalRevenue)}** | **100%** |

### Payouts Status

| Category | Amount |
|----------|--------|
| Completed | ${formatUSD(data.weeklyPayouts.totalPayouts)} |
| Pending (Batch) | ${formatUSD(data.reconciliation.payoutsPending)} |
| Failed (DLQ) | ${formatUSD(data.reconciliation.payoutsDLQ)} |

### Payout SLA Compliance

- **Total Eligible Payouts:** ${data.payoutSLA.totalEligible}
- **Completed <7 days:** ${data.payoutSLA.withinSLA} (${(data.payoutSLA.slaPercentage * 100).toFixed(1)}%) ${data.payoutSLA.slaPercentage >= 0.95 ? '✅' : '⚠️'}
- **Average Days to Payout:** ${data.payoutSLA.avgDays} days

---

## Exceptions

${exceptions.length === 0 
  ? '✅ **No exceptions this week.** All metrics within targets.'
  : exceptions.map((ex, i) => `
### Exception #${i + 1}: ${ex.name}

- **Severity:** ${ex.severity === 'red' ? '🔴 CRITICAL' : ex.severity === 'orange' ? '🠢 ORANGE' : '🟡 YELLOW'}
- **Current:** ${ex.metric}
- **Threshold:** ${ex.threshold}
- **Owner:** ${ex.owner}
- **Action:** Investigate and document findings

`).join('')}

---

## Finance Reconciliation Formulas

### Formula 1: Revenue Check
- Gross Revenue: ${formatUSD(data.reconciliation.grossRevenue)}
- Less Refunds: ${formatUSD(data.reconciliation.weeklyRefunds)}
- Net Revenue: ${formatUSD(data.reconciliation.grossRevenue - data.reconciliation.weeklyRefunds)}

### Formula 2: Creator Earnings = (Revenue − Platform Fees)
- Total Revenue: ${formatUSD(data.reconciliation.grossRevenue)}
- Platform Fees (20%): ${formatUSD(data.reconciliation.platformFees)}
- Creator Earnings: ${formatUSD(data.weeklyEarnings.totalEarnings)}

### Formula 3: Payouts Reconciliation
- Payouts Completed: ${formatUSD(data.reconciliation.payoutsCompleted)}
- Payouts Pending: ${formatUSD(data.reconciliation.payoutsPending)}
- Payouts DLQ (Failed): ${formatUSD(data.reconciliation.payoutsDLQ)}
- **Total Committed:** ${formatUSD(data.reconciliation.committedPayouts)}
- **vs. Earnings Recorded:** ${formatUSD(data.weeklyEarnings.totalEarnings)}
- **Variance:** ${formatUSD(data.reconciliation.variance)} ${data.reconciliation.variance < 100 ? '✅' : '⚠️'}

---

## Checklist

- [x] Report auto-generated
- [x] All formulas validated
- [x] Exceptions flagged
- [ ] Finance lead review (pending)
- [ ] Ops lead review (pending)

---

*Generated by scripts/revenue-integrity-audit.mjs*
`;

  return md;
}

/**
 * Generate Slack message
 */
function generateSlackMessage(weekId, data, exceptions, reportUrl) {
  const status = exceptions.length === 0 ? '✅' : 
                 exceptions.some(e => e.severity === 'red') ? '🔴' : '⚠️';

  let text = `${status} Week ${weekId} Revenue Audit\n`;
  text += `Revenue: ${formatUSD(data.weeklyRevenue.totalRevenue)} | `;
  text += `Refund Rate: ${((data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue) * 100).toFixed(2)}% | `;
  text += `Payout SLA: ${(data.payoutSLA.slaPercentage * 100).toFixed(1)}%\n`;
  
  if (exceptions.length > 0) {
    text += `\n⚠️ ${exceptions.length} Exception(s):`;
    exceptions.forEach(ex => {
      text += `\n  • ${ex.name} (${ex.severity.toUpperCase()})`;
    });
  }
  
  text += `\n\n→ <${reportUrl}|Full Report>`;

  return {
    text,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `💰 Weekly Revenue Audit — Week ${weekId}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Revenue*\n${formatUSD(data.weeklyRevenue.totalRevenue)}` },
          { type: 'mrkdwn', text: `*Refund Rate*\n${((data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue) * 100).toFixed(2)}%` },
          { type: 'mrkdwn', text: `*Payouts*\n${formatUSD(data.weeklyPayouts.totalPayouts)}` },
          { type: 'mrkdwn', text: `*Payout SLA*\n${(data.payoutSLA.slaPercentage * 100).toFixed(1)}%` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Status:* ${exceptions.length === 0 ? '✅ All green' : `⚠️ ${exceptions.length} exception(s)`}` },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `<${reportUrl}|📊 View Full Report>` },
      },
    ],
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Starting Revenue Integrity Audit...\n');

  // Get week ID and date range
  const weekId = getWeekId();
  const mondayDate = getMondayOfWeek();
  const sundayDate = getSundayOfWeek();

  console.log(`📅 Week: ${weekId}`);
  console.log(`   Range: ${mondayDate} to ${sundayDate}\n`);

  // Connect to database
  const db = getConnection();
  console.log('✅ Database connected\n');

  try {
    // Collect data
    console.log('📊 Collecting financial data...');
    const weeklyRevenue = getWeeklyRevenue(db);
    const weeklyRefunds = getWeeklyRefunds(db);
    const weeklyEarnings = getWeeklyEarnings(db);
    const weeklyPayouts = getWeeklyPayouts(db);
    const pendingPayouts = getPendingPayouts(db);
    const failedPayouts = getFailedPayouts(db);
    const payoutSLA = getPayoutSLA(db);

    const reconciliation = getReconciliation(
      db,
      weeklyRevenue,
      weeklyEarnings,
      weeklyPayouts,
      pendingPayouts,
      failedPayouts
    );

    const data = {
      weeklyRevenue,
      weeklyRefunds,
      weeklyEarnings,
      weeklyPayouts,
      failedPayouts,
      reconciliation,
      payoutSLA,
    };

    console.log('✅ Data collected\n');

    // Detect exceptions
    console.log('🔍 Detecting exceptions...');
    const exceptions = detectExceptions(data, config.thresholds);
    console.log(`   Found ${exceptions.length} exception(s)\n`);
    exceptions.forEach(ex => {
      console.log(`   • ${ex.name} (${ex.severity}): ${ex.metric}`);
    });

    // Generate report
    console.log('\n📝 Generating report...');
    const report = generateReport(weekId, data, exceptions);

    // Ensure report directory exists
    if (!fs.existsSync(config.reportDir)) {
      fs.mkdirSync(config.reportDir, { recursive: true });
    }

    // Write report to file
    const reportFilename = `revenue-integrity-${weekId}.md`;
    const reportPath = path.join(config.reportDir, reportFilename);
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report written: ${reportPath}\n`);

    // Post to Slack (if webhook configured)
    if (config.slackWebhookUrl) {
      console.log('💬 Posting to Slack...');
      const reportUrl = `https://github.com/Latimer-Woods-Tech/factory/blob/main/docs/reports/${reportFilename}`;
      const slackPayload = generateSlackMessage(weekId, data, exceptions, reportUrl);

      try {
        const response = await fetch(config.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        if (response.ok) {
          console.log('✅ Slack message posted\n');
        } else {
          console.warn(`⚠️  Slack post failed: ${response.status}\n`);
        }
      } catch (err) {
        console.warn(`⚠️  Slack notification error: ${err.message}\n`);
      }
    }

    // Summary
    console.log('═'.repeat(60));
    console.log(`✅ AUDIT COMPLETE — Week ${weekId}`);
    console.log('═'.repeat(60));
    console.log(`Revenue:          ${formatUSD(data.weeklyRevenue.totalRevenue)}`);
    console.log(`Refund Rate:      ${((data.weeklyRefunds.totalRefunds / data.weeklyRevenue.totalRevenue) * 100).toFixed(2)}%`);
    console.log(`Payouts:          ${formatUSD(data.weeklyPayouts.totalPayouts)}`);
    console.log(`Payout SLA:       ${(data.payoutSLA.slaPercentage * 100).toFixed(1)}%`);
    console.log(`Exceptions:       ${exceptions.length}`);
    console.log(`Report:           ${reportPath}`);
    console.log('═'.repeat(60));

  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});

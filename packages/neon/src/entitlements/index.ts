/**
 * Entitlements Module Barrel Export
 *
 * W360-005: Practitioner Studio Entitlements
 * Revenue model for self-serve video generation
 *
 * Exports:
 *   - Schema definitions (tables, types, interfaces)
 *   - Service layer (credit management, entitlements)
 *   - Webhook handler (Stripe event processing)
 */

export {
  studioPlanTable,
  studioCustomerTable,
  studioSubscriptionTable,
  studioCreditLedgerTable,
  studioEntitlementTable,
  studioPlanTables,
  type StudioPlan,
  type StudioPlanInsert,
  type StudioCustomer,
  type StudioCustomerInsert,
  type StudioSubscription,
  type StudioSubscriptionInsert,
  type StudioCreditLedgerEntry,
  type StudioCreditLedgerInsert,
  type CreditLedgerOperationType,
  type StudioEntitlement,
  type StudioEntitlementInsert,
  type EntitlementPolicy,
  evaluateEntitlementPolicy,
  getEntitlementPolicy,
  debitCreditsForRender,
  grantCredits,
  refundCredits,
  getTotalAvailableCredits,
  entitlementService,
} from './schema.js';

export {
  handleStripeWebhook,
  verifyStripeSignature,
  isEventProcessed,
  recordProcessedEvent,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  refreshEntitlements,
  type StripeEvent,
  type StripeSubscription,
  type StripeCustomer,
  type StripeInvoice,
} from './webhook.js';

export {
  estimateRenderCost,
  checkRenderGuardrails,
  isKillSwitchActive,
  getRenderCountThisPeriod,
  emitBudgetAlert,
  DEFAULT_CREDIT_RATE_PER_SECOND,
  BUDGET_ALERT_THRESHOLD_FRACTION,
  PLATFORM_MAX_VIDEO_SECONDS,
  DEFAULT_MAX_VIDEO_SECONDS,
  type RenderGuardrailResult,
  type RenderRequest,
  type KillSwitchState,
} from './guardrails.js';

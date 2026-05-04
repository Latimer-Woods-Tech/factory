## [Unreleased]

### Added

- `generateRequestId()` — generates a short 12-character hex request-correlation ID; suitable for vanilla Cloudflare Workers and cron handlers where the Hono `withRequestId` middleware is not used (e.g. HumanDesign migration from custom `lib/logger.js`).
- `sanitizeId()` — truncates opaque IDs (UUID, Stripe ID, etc.) to 8 characters for PII-safe log fields per policy CTO-012 / CISO-008.

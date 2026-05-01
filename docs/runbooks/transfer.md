# Transfer Runbook

Use this runbook when transferring a Factory app to a buyer. Fill in `{app}` with the app slug (e.g., `factory-crm`).

## Pre-Transfer Checklist

- [ ] Buyer has a GitHub account and Cloudflare account
- [ ] Buyer has a Stripe account (for Stripe account transfer or fresh keys)
- [ ] Export `factory_events` for this app's users to a CSV/S3 archive (stays with Factory)
- [ ] Set an export date — all events for this app are archived before transfer
- [ ] Confirm no cross-app code coupling (no other app imports `{app}` code)
- [ ] Revoke buyer's temporary access to Factory infrastructure after transfer

---

## Transfer Steps

### 1. Archive factory_events data

```bash
# Export events for this app before transfer
psql $FACTORY_ADMIN_DATABASE_URL \
  -c "\COPY (SELECT * FROM factory_events WHERE app_id = '{app}') TO '/tmp/{app}_events.csv' CSV HEADER"

# Upload to R2 or S3
wrangler r2 object put factory-archives/{app}/events_$(date +%Y%m%d).csv \
  --file /tmp/{app}_events.csv
```

### 2. Transfer GitHub repository

```bash
# Transfer repo to buyer's GitHub org
gh repo transfer Latimer-Woods-Tech/{app} {buyer-github-org}
# Buyer receives and accepts the transfer invitation
```

> After transfer, the buyer's org becomes the owner. Buyer should immediately update CI secrets.

### 3. Transfer the Neon database

**Option A — Neon project transfer** (buyer has a Neon account):

1. In Neon Dashboard → project → Settings → Transfer Ownership
2. Enter buyer's Neon email
3. Buyer accepts the transfer

**Option B — pg\_dump/restore** (buyer uses any Postgres host):

```bash
# Dump production schema + data
pg_dump $APP_CONN_STR > {app}_dump.sql

# Send dump to buyer (secure channel)
# Buyer restores:
psql $BUYER_DATABASE_URL < {app}_dump.sql
```

### 4. Transfer Cloudflare Worker

**Option A — Cloudflare dashboard transfer:**

1. Workers & Pages → {app} → Settings → Transfer

**Option B — Buyer deploys fresh Worker:**

```bash
# Buyer forks or clones the repo, then deploys with their CF account
wrangler deploy --env production
# Buyer sets their own secrets (step 6)
```

### 5. Hand off secrets

Generate a one-time secure note (e.g., 1Password Share, Bitwarden Send) containing:

- `JWT_SECRET` (buyer must rotate immediately post-transfer)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- Neon connection string (if not transferring the project)
- Any third-party API keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, etc.)

Buyer sets secrets on their Worker:

```bash
wrangler secret put JWT_SECRET --name {app}
wrangler secret put STRIPE_SECRET_KEY --name {app}
wrangler secret put STRIPE_WEBHOOK_SECRET --name {app}
wrangler secret put DATABASE_URL --name {app}
# — all remaining secrets
```

### 6. Update CI/CD secrets in buyer's GitHub repo

Buyer must set:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo {buyer-github-org}/{app}
gh secret set CLOUDFLARE_ACCOUNT_ID --repo {buyer-github-org}/{app}
```

If buyer wants to continue using `@latimer-woods-tech/*` packages, they also need:

```bash
gh secret set GH_PAT --repo {buyer-github-org}/{app}
# GH_PAT must have read:packages scope for npm.pkg.github.com
```

Alternatively, buyer can fork the packages and publish them under their own scope.

### 7. Update DNS

Transfer DNS for the app's domain to the buyer's registrar or Cloudflare account:

```bash
# If domain is on Cloudflare: Dashboard → DNS → Transfer zone
# If domain is at a registrar: update nameservers / CNAME to buyer's Worker
```

### 8. Revoke Factory access

```bash
# Revoke Factory's Cloudflare Worker API token for this app
# (if a per-app token was created — check CF Dashboard → API Tokens)

# Remove app from Factory's monitoring (PostHog, Sentry)
# Remove HYPERDRIVE_* and *_CONNECTION_STRING secrets from Factory repo for this app

# Remove factory_events rows for this app (or archive them per step 1)
psql $FACTORY_ADMIN_DATABASE_URL \
  -c "DELETE FROM factory_events WHERE app_id = '{app}'"
```

---

## Post-Transfer Verification Checklist

- [ ] Buyer confirms Worker responds at their domain
- [ ] Buyer confirms `/health` returns 200
- [ ] Buyer confirms DB connection works
- [ ] Buyer has rotated `JWT_SECRET` to their own value
- [ ] Buyer has updated Stripe webhook URL to their Worker endpoint
- [ ] Seller confirms `factory_events` data for this app is scrubbed or archived
- [ ] Seller confirms no Factory CI workflows reference this app's secrets
- [ ] DNS propagation confirmed (TTL waited)
- [ ] Old Cloudflare Worker route (under Factory account) deleted or disabled

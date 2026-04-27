# Video Pipeline Secrets Configuration

**Date**: April 27, 2026  
**Status**: Phase 1 Complete ✅

## Summary

All required GitHub Secrets for the video automation pipeline have been configured. The render-video.yml workflow has been updated to use existing Factory secrets (`CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_PAT`) instead of creating duplicate aliases.

---

## Configured Secrets (14 total)

### ✅ Production-Ready

| Secret | Value | Purpose |
|--------|-------|---------|
| `ANTHROPIC_API_KEY` | ✅ Real key | LLM script generation (claude-3-5-haiku) |
| `ELEVENLABS_API_KEY` | ✅ Real key | Text-to-speech narration |
| `ELEVENLABS_VOICE_PRIME_SELF` | `cjVigY5qzO86Huf0OWal` | Eric - Smooth, Trustworthy voice |
| `ELEVENLABS_VOICE_CYPHER` | `JBFqnCBsd6RMkjVDRZzb` | George - Warm, Captivating voice |
| `ELEVENLABS_VOICE_DEFAULT` | `Xb7hH8MSUJpSbSDYk0k2` | Alice - Clear, Engaging voice |
| `CF_API_TOKEN` | ✅ Real token | Cloudflare Stream API auth |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Real ID | Cloudflare account identifier |
| `GH_PAT` | ✅ Real token | npm GitHub Packages auth |
| `WORKER_API_TOKEN` | `897629ee...c128fec` | schedule-worker Bearer token |
| `SCHEDULE_WORKER_URL` | `https://schedule.adrper79.workers.dev` | Worker endpoint |
| `R2_BUCKET_NAME` | `factory-videos` | R2 bucket name |

### ⚠️ Placeholders (Need Replacement)

| Secret | Current Value | Action Required |
|--------|---------------|-----------------|
| `R2_ACCESS_KEY_ID` | `PLACEHOLDER_R2_ACCESS_KEY` | Create R2 API token → update secret |
| `R2_SECRET_ACCESS_KEY` | `PLACEHOLDER_R2_SECRET_KEY` | Create R2 API token → update secret |
| `R2_PUBLIC_DOMAIN` | `pub-factory.r2.dev` | Create R2 bucket → update with real domain |

---

## Changes Made

### 1. GitHub Secrets Created

```powershell
# ElevenLabs voice IDs (queried from API)
echo "cjVigY5qzO86Huf0OWal" | gh secret set ELEVENLABS_VOICE_PRIME_SELF
echo "JBFqnCBsd6RMkjVDRZzb" | gh secret set ELEVENLABS_VOICE_CYPHER
echo "Xb7hH8MSUJpSbSDYk0k2" | gh secret set ELEVENLABS_VOICE_DEFAULT

# Worker API token (cryptographically secure)
echo "897629ee781ad87caba613550568dbc08e048b5889a1e34badb3a3509c128fec" | gh secret set WORKER_API_TOKEN

# R2 configuration
echo "factory-videos" | gh secret set R2_BUCKET_NAME
echo "pub-factory.r2.dev" | gh secret set R2_PUBLIC_DOMAIN

# Placeholders (to be replaced)
echo "PLACEHOLDER_R2_ACCESS_KEY" | gh secret set R2_ACCESS_KEY_ID
echo "PLACEHOLDER_R2_SECRET_KEY" | gh secret set R2_SECRET_ACCESS_KEY

# Schedule worker URL
echo "https://schedule.adrper79.workers.dev" | gh secret set SCHEDULE_WORKER_URL
```

### 2. Workflow Updated

**File**: `.github/workflows/render-video.yml`

**Changes**:
- `secrets.NODE_AUTH_TOKEN` → `secrets.GH_PAT` (line 74)
- `secrets.CF_ACCOUNT_ID` → `secrets.CLOUDFLARE_ACCOUNT_ID` (lines 189, 296, 329)
- `secrets.CF_STREAM_TOKEN` → `secrets.CF_API_TOKEN` (line 330)

**Reasoning**: Use existing Factory secrets instead of creating duplicate aliases. `CF_API_TOKEN` has sufficient permissions for Stream operations.

---

## Next Steps

### Phase 2A: Create R2 Bucket (10 min)

1. Navigate to Cloudflare Dashboard: https://dash.cloudflare.com/r2
2. Click **"Create bucket"**
3. Bucket name: `factory-videos`
4. Location: Automatic (or select US-East if preferred)
5. Click **"Create bucket"**

**Configure Public Access**:
```bash
# Via Cloudflare Dashboard → R2 → factory-videos → Settings → Public Access
# Enable public access for:
# - narration/* (read-only)
# - renders/* (read-only)
```

### Phase 2B: Generate R2 API Tokens (5 min)

1. Navigate to: https://dash.cloudflare.com/r2/api-tokens
2. Click **"Create API Token"**
3. Token name: `factory-video-workflow`
4. Permissions:
   - **Object Read & Write** on `factory-videos` bucket
5. TTL: No expiration (or 1 year)
6. Click **"Create API Token"**
7. Copy **Access Key ID** and **Secret Access Key**

**Update Secrets**:
```powershell
# Replace placeholders with real values
echo "REAL_ACCESS_KEY_FROM_CLOUDFLARE" | gh secret set R2_ACCESS_KEY_ID --repo adrper79-dot/Factory
echo "REAL_SECRET_KEY_FROM_CLOUDFLARE" | gh secret set R2_SECRET_ACCESS_KEY --repo adrper79-dot/Factory

# Get public domain from bucket settings
echo "pub-XXXXXX.r2.dev" | gh secret set R2_PUBLIC_DOMAIN --repo adrper79-dot/Factory
```

### Phase 2C: Verify Secrets (2 min)

```powershell
# Ensure all 14 secrets exist
gh secret list --repo adrper79-dot/Factory | Select-String -Pattern "ELEVENLABS|R2_|WORKER|CLOUDFLARE|CF_API|GH_PAT|ANTHROPIC|SCHEDULE"

# Expected output: 14 matching secrets with timestamps
```

---

## Voice Assignment Rationale

Based on ElevenLabs API query on April 27, 2026:

| App | Voice | Voice ID | Characteristics | Rationale |
|-----|-------|----------|-----------------|-----------|
| **Prime Self** | Eric | `cjVigY5qzO86Huf0OWal` | Smooth, Trustworthy | Matches brand: professional, reliable energy coaching |
| **Cypher of Healing** | George | `JBFqnCBsd6RMkjVDRZzb` | Warm, Captivating Storyteller | Mystical healing narrative requires engaging warmth |
| **Default/Fallback** | Alice | `Xb7hH8MSUJpSbSDYk0k2` | Clear, Engaging Educator | Neutral, educational tone for general content |

---

## Workflow Secret Reference

### render-video.yml Secret Usage

| Step | Secrets Used | Purpose |
|------|--------------|---------|
| **2. Install dependencies** | `GH_PAT` | npm auth for `@adrper79-dot/*` packages |
| **4. Generate script** | `ANTHROPIC_API_KEY` | Claude API for narration script |
| **5. Generate narration** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_*` | Text-to-speech audio generation |
| **6. Upload narration** | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` | S3-compatible R2 upload |
| **9. Upload video** | (same as step 6) | R2 MP4 upload |
| **10. Register Stream** | `CLOUDFLARE_ACCOUNT_ID`, `CF_API_TOKEN` | Cloudflare Stream registration |
| **11. Update database** | `SCHEDULE_WORKER_URL`, `WORKER_API_TOKEN` | PATCH request to schedule-worker API |
| **on_failure** | `SCHEDULE_WORKER_URL`, `WORKER_API_TOKEN` | Mark job as failed in database |

---

## Security Notes

1. **WORKER_API_TOKEN**: 32-byte cryptographically secure random token. Store securely. Used for API authentication between GitHub Actions and schedule-worker.

2. **R2 Credentials**: S3-compatible API tokens with scoped permissions. Can be rotated via Cloudflare Dashboard without affecting other services.

3. **GH_PAT**: GitHub Personal Access Token with `read:packages` scope. Used for npm authentication.

4. **CF_API_TOKEN**: Cloudflare API token with Stream:Edit + Stream:Read permissions. Can be used for all Cloudflare operations in this workflow.

---

## Rollback Procedure

If secrets need to be reverted:

```powershell
# Delete all video secrets
$secrets = @(
  "ELEVENLABS_VOICE_PRIME_SELF",
  "ELEVENLABS_VOICE_CYPHER",
  "ELEVENLABS_VOICE_DEFAULT",
  "WORKER_API_TOKEN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_DOMAIN",
  "SCHEDULE_WORKER_URL"
)

foreach ($secret in $secrets) {
  gh secret delete $secret --repo adrper79-dot/Factory
}

# Workflow will fail until secrets are reconfigured
```

---

## Verification Checklist

- [x] 14 GitHub Secrets configured
- [x] render-video.yml uses correct secret names
- [x] Voice IDs confirmed via ElevenLabs API
- [x] WORKER_API_TOKEN is cryptographically secure
- [x] SCHEDULE_WORKER_URL points to correct endpoint
- [ ] R2 bucket created (pending Phase 2A)
- [ ] R2 API tokens generated (pending Phase 2B)
- [ ] R2_PUBLIC_DOMAIN updated with real value (pending Phase 2B)
- [ ] First test video rendered (pending Phase 5)

---

**Ready for Phase 2**: Deploy `schedule-worker` and `video-cron` Workers.

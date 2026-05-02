# Factory Naming Conventions

Factory publishes shared workflows, packages, and operational templates for other repositories. These names are part of the contract. If they drift, app repos break in ways that are hard to debug.

## Canonical names

### Reusable GitHub workflows

- Reusable workflow files live in `.github/workflows/` and use the `_*.yml` prefix.
- The workflow `name:` must exactly match the filename without `.yml`.
  - Example: `.github/workflows/_app-ci.yml` → `name: _app-ci`
- Reusable workflows must keep the standard header banner documenting purpose, inputs, secrets, conventions, and related workflows.

### GitHub environments

- Use `staging` and `production` only.
- Do not invent environment aliases like `prod`, `stage`, or `preview-prod`.

### Cloudflare GitHub secrets

- Canonical secret names are `CF_API_TOKEN` and `CF_ACCOUNT_ID`.
- When a third-party tool still expects `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` as environment variables, map those environment variables from the canonical secrets instead of reading legacy secret names directly.

### Workers URLs

- Factory Workers use the full account-scoped hostname:
  - `https://{worker}.adrper79.workers.dev`
- Never use the short form `https://{worker}.workers.dev`.

### Package names

- Shared packages publish under `@latimer-woods-tech/<package>`.
- New package names should stay short, infrastructure-oriented, and reusable across apps.

### Smoke-test secrets

- Authenticated smoke credentials use:
  - `SMOKE_USER_EMAIL`
  - `SMOKE_USER_PASSWORD`
  - `SMOKE_PRACTITIONER_EMAIL`
  - `SMOKE_PRACTITIONER_PASSWORD`
- Do not add new aliases unless migration tooling explicitly requires them.

## Automation

These conventions are enforced in automation:

- `scripts/check-naming-conventions.mjs` — reusable workflow naming + canonical Cloudflare secret references
- `scripts/check-workers-url-policy.mjs` — canonical `workers.dev` URL format in active docs/templates
- `.github/workflows/ci.yml` — pre-merge enforcement
- `.github/workflows/policy-drift-guard.yml` — scheduled drift detection

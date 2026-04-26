# ~~BLOCKED~~: Stage 1 Publish to GitHub Packages — RESOLVED

> **Resolution**: Scope renamed from `@factory/*` to `@adrper79-dot/*` on $(date +%Y-%m-%d). See commit `chore!: rename scope @factory/* -> @adrper79-dot/*`.

## Status (Historical)

- All 6 Stage 1 packages (`errors`, `monitoring`, `logger`, `auth`, `neon`, `stripe`) are implemented and merged to `main`.
- Quality gates pass for every package: lint=0, typecheck=0, tests passing with coverage thresholds met, ESM build artifacts produced.
- Tags pushed: `errors/v0.1.0`, `monitoring/v0.1.0`, `logger/v0.1.0`, `auth/v0.1.0`, `neon/v0.1.0`, `stripe/v0.1.0`.
- `.github/workflows/publish.yml` triggered on tag push and ran `npm ci` + `npm run prepublish` successfully.
- `npm publish` failed for every package with:

  ```
  npm error code E403
  npm error 403 Forbidden - PUT https://npm.pkg.github.com/@factory%2ferrors
  npm error 403 In most cases, you or one of your dependencies are requesting
  npm error 403 a package version that is forbidden by your security policy, or
  npm error 403 on a server you do not have access to.
  Permission permission_denied: The requested installation does not exist.
  ```

## Root Cause

GitHub Packages requires the npm scope to match the GitHub user or organization
that owns the repository. The repository is owned by `adrper79-dot`, but every
package is named `@adrper79-dot/*`. There is no GitHub user or organization named
`factory`, so `npm.pkg.github.com` rejects the upload with
`The requested installation does not exist`.

This is independent of the workflow's `GITHUB_TOKEN`: the token has
`packages: write` and is correctly set in `.npmrc` via `actions/setup-node`.

## Resolution Options (require user decision)

1. **Create a GitHub organization named `factory`** and transfer this repository
   into it. The `@adrper79-dot/*` scope then maps cleanly to the org. No code changes
   required. Most aligned with the spec.

2. **Rename the scope to `@adrper79-dot/*`** across every `package.json`,
   `CLAUDE.md`, the spec docs, and every cross-package `file:../` consumer.
   Spec-deviating; not recommended.

3. **Publish to npmjs.org instead.** Requires an `@factory` org on the public
   registry plus an automation token in the repo secrets. Changes
   `publishConfig.registry` in every package.

4. **Defer publishing.** Code is on `main`, tags are in place. Resume
   publishing after resolving the org question.

## Action Taken

Stopped per the Error Recovery Protocol after the workflow failed identically
for all six packages. No further publish attempts will be made until a path is
chosen.

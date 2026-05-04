## Summary
`node scripts/validate-docs-quality.mjs` is currently not providing actionable broken-link output in reasonable time in this workspace context, which blocks reliable docs-quality gating.

## Observed behavior
- Running `node scripts/validate-docs-quality.mjs` repeatedly in this repo did not complete within 120s in CI-like shell usage.
- Command produced no failure list before timeout, so link remediation cannot proceed from script output alone.

## Expected behavior
- Validator should complete quickly and deterministically.
- On failure, it should print a bounded list of broken targets with file paths.

## Requested fixes
1. Add traversal safeguards (skip symlink/junction loops and optionally bound traversal depth/paths).
2. Add timeout-safe progress logging (e.g., files scanned count every N files).
3. Add a `--max-errors` option so output remains actionable.
4. Add a dedicated script mode to emit JSON report for CI artifacts.

## Acceptance criteria
- Validator completes under agreed CI budget.
- Broken links are emitted with file + target.
- CI failure points to actionable list, not silent timeout.
# Supervisor Template Specification

**Canonical reference:** `docs/architecture/FACTORY_V1.md` §12 + `docs/supervisor/ARCHITECTURE.md` §5.5

Templates at `docs/supervisor/plans/<slug>.yml` drive the supervisor's autonomous execution. Each template declares triggers (how the supervisor decides the template applies), slots (parameters extracted from the matched issue), steps (the ordered tool-call sequence), and an acceptance gate (how verification decides success).

## Schema

```yaml
id: <slug>                            # required; filename basename
version: 1                            # required; bumped on breaking change
tier: green | yellow | red            # required; max trust tier for execution

triggers:
  labels_any_of: [<label1>, ...]      # ANY match triggers
  title_pattern: "<regex>"            # case-insensitive, ECMA regex
  body_patterns: ["<regex>", ...]     # optional; ALL must match

preconditions:
  - capability_exists: <app>.<tool>   # refuses plan if tool missing from capabilities.yml

slots:
  - name: <name>                      # required
    type: string | integer | enum | daterange
    validator: "<regex>"              # required when type=string, unless referential_check
    values: [a, b, c]                 # required when type=enum
    referential_check: <app>.<tool>   # optional; resolved before steps execute; failure -> plan rejected
    source: issue_body | issue_title | issue_labels
    default: <value>                  # optional

steps:
  - id: s1                            # required; referenced in depends_on + params
    tool: <app>.<tool>                # must match capabilities.yml OR the allowed set
    depends_on: null | sN             # sequencing
    params: { key: "<literal>" | "$slots.<name>" | "$sN.<field>" }
    intent: "one-sentence rationale"  # human-readable; posted on the issue
    requires_human_review: true|false # true forces CODEOWNER ✅ before the step executes; default false

acceptance_gate:
  description: "plain-text success criterion"
  verifier_query:                     # PREFERRED (deterministic) — supervisor runs this and asserts on the result
    tool: <app>.<tool>
    query: "<tool-specific query template>"
    assert: "<predicate>"

rollback:
  - on_step: sN
    action: <app>.<tool>
    params: {...}
```

## Strict rules

1. **No bare `string` slots.** Every string slot must declare a `validator` regex, be an `enum`, or have a `referential_check` that resolves the value.
2. **Enum preferred over string** whenever the domain is finite.
3. **Tool allowlist.** Only tools declared in any app's `capabilities.yml` (or the base supervisor tools: github.*, cloudflare.*, sentry.*, stripe.* READ-ONLY, neon.read READ-ONLY) are permitted.
4. **`requires_human_review: true` on any step that opens a PR, deletes a resource, or mutates external state.**
5. **Acceptance gate is deterministic-preferred.** A `verifier_query` against a tool is strongly preferred over an LLM-scored `description` check.
6. **Rollback for every mutating step.** If step sN opens a PR, rollback[on_step=sN] must close it.

## Lifecycle

- **Unblessed**: new template or `runs_merged < 3`. Every run requires plan-approval.
- **Blessed**: `runs_merged >= 3 AND runs_reverted == 0 AND runs_human_overridden == 0`. Green-tier runs skip plan-approval.
- **Demoted**: `runs_reverted / runs_merged > 0.2` over last 20 runs. Returns to unblessed until CODEOWNER review.

See `docs/supervisor/ARCHITECTURE.md` §5.9 for the `template_stats` data model.

## Authoring

Follow the playbook at `docs/architecture/FACTORY_V1.md` §12. Start from a real closed issue; never author from imagination.

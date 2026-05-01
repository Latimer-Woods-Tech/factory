## [Unreleased]

## [0.2.0] - 2026-04-29

### Added
- Multi-provider LLM completion chain with Anthropic primary, Grok fallback, and Groq tertiary fallback.
- Streaming support through the Anthropic-compatible provider path.
- `withSystem()` helper for consistently applying system prompts at call sites.
- Quality-gated package build with lint, typecheck, coverage, and ESM output.

### Fixed
- Restored `@latimer-woods-tech/errors` and `@latimer-woods-tech/logger` as runtime dependencies so published consumers resolve package imports correctly.

### Verification
- `npm install` regenerated the package lock and ran the package prepublish gate on Apr 29, 2026.
- `npm run lint`, `npm run typecheck`, `npm test -- --coverage`, and `npm run build` passed during the prepublish gate.

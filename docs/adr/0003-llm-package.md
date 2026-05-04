# 0003: LLM calls via @latimer-woods-tech/llm only

**Date:** 2026-04-30  **Status:** Accepted

## Context
Multiple workers need LLM access.

## Decision
All LLM calls go through `@latimer-woods-tech/llm`. Direct provider API calls are prohibited.

## Consequences
- All traffic flows through Cloudflare AI Gateway (`AI_GATEWAY_BASE_URL`)
- Workload-split routing: Haiku → fast, Sonnet → balanced, Gemini → long-context
- `llm-meter` records every call for cost tracking
- Breaking changes in the package affect all consumers simultaneously

## Alternatives considered
- **Direct provider calls:** no unified cost tracking, no failover, no caching

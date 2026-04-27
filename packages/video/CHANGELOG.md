# Changelog — `@adrper79-dot/video`

All notable changes to this package will be documented in this file.

## [0.2.0] — 2025-01-01

### Added
- Initial implementation: Cloudflare Stream REST API wrappers (`uploadFromUrl`, `getStreamVideo`, `listStreamVideos`, `deleteStreamVideo`, `getStreamEmbedUrl`, `getStreamThumbnailUrl`)
- R2 bucket helpers (`putR2Object`, `getR2Object`, `deleteR2Object`)
- `VideoEnv`, `R2BucketLike`, `StreamVideo`, `RenderJob`, `FetchFn` types
- 100% injected `fetch` dependency for deterministic unit tests

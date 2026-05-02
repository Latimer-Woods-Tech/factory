## [Unreleased]

### Added

- `BadRequestError` — HTTP 400 error class for generic bad-request conditions (e.g. malformed request syntax, missing parameters). Complements `ValidationError` (422) for constraint violations.
- `ErrorCodes.BAD_REQUEST` — error code constant used by `BadRequestError`.

# Changelog — @latimer-woods-tech/realtime

All notable changes to this package are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.0] — 2026-05-02

### Added

- `RealtimeDurableObject` abstract base class implementing the Cloudflare
  WebSocket Hibernation API (`webSocketMessage`, `webSocketClose`,
  `webSocketError`).
- `acceptConnection(request, meta?)` protected helper — upgrades an HTTP
  request to a WebSocket, registers with the Hibernation API, and serialises
  `ConnectionMeta` via `serializeAttachment`.
- `broadcast(message, excludeId?)` — sends to all active connections,
  optionally skipping the sender.
- `broadcastTagged(tag, message)` — sends to connections registered with a
  specific Cloudflare tag via `ctx.getWebSockets(tag)`.
- `getConnectionMetas()` — returns a snapshot of all `ConnectionMeta` objects.
- Optional lifecycle hooks: `onConnect`, `onDisconnect`, `onError`.
- `parseRealtimeMessage(raw)` standalone helper.
- `broadcastAll(connections, message)` and `broadcastToTag(connections, tag, message)`
  standalone helpers for callers that manage their own connection lists.
- `HibernatingWebSocket` and `DurableObjectStateLike` platform-agnostic
  interface types for easy mocking in tests.
- `RealtimeErrorCodes` constants: `UPGRADE_REQUIRED`, `MESSAGE_PARSE_FAILED`,
  `CONNECTION_NOT_FOUND`.
- `ConnectionMeta` and `RealtimeMessage` domain types.
- Re-export of `InternalError` from `@latimer-woods-tech/errors`.

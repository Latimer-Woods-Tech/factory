# @latimer-woods-tech/realtime

Cloudflare Durable Object base class and helpers for WebSocket real-time features using the Hibernation API.

Extracted from the videoking `subscription-notifier.ts` Durable Object pattern.

---

## Installation

```bash
npm install @latimer-woods-tech/realtime
```

---

## Overview

This package provides:

| Export | Purpose |
|--------|---------|
| `RealtimeDurableObject` | Abstract base class for WebSocket DOs (Hibernation API) |
| `parseRealtimeMessage` | Parse a raw WebSocket frame into a typed `RealtimeMessage` |
| `broadcastAll` | Send a message to every connection in a list |
| `broadcastToTag` | Send a message to connections with a specific metadata tag |
| `ConnectionMeta` | Per-connection metadata persisted across hibernation |
| `RealtimeMessage` | Typed message envelope (`{ type, payload, correlationId? }`) |
| `HibernatingWebSocket` | Interface compatible with Cloudflare WebSocket (Hibernation) |
| `DurableObjectStateLike` | Interface compatible with Cloudflare `DurableObjectState` |
| `RealtimeErrorCodes` | Error code constants (`UPGRADE_REQUIRED`, `MESSAGE_PARSE_FAILED`, …) |

---

## Usage

### Minimal Durable Object

```ts
import {
  RealtimeDurableObject,
  ConnectionMeta,
  HibernatingWebSocket,
  RealtimeMessage,
} from '@latimer-woods-tech/realtime';

export class SubscriptionNotifier extends RealtimeDurableObject {
  constructor(state: DurableObjectState, _env: Env) {
    super(state); // DurableObjectState implements DurableObjectStateLike
  }

  async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get('x-user-id') ?? undefined;
    const correlationId = request.headers.get('x-correlation-id') ?? undefined;

    return this.acceptConnection(request, {
      userId,
      correlationId,
      tags: ['subscription'],
    });
  }

  async onMessage(
    _ws: HibernatingWebSocket,
    _meta: ConnectionMeta,
    message: RealtimeMessage,
  ): Promise<void> {
    // Echo the event to every subscriber
    this.broadcast(message);
  }

  override async onConnect(ws: HibernatingWebSocket, meta: ConnectionMeta): Promise<void> {
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { connectionId: meta.connectionId },
    }));
  }

  override async onDisconnect(
    _ws: HibernatingWebSocket,
    meta: ConnectionMeta,
    code: number,
  ): Promise<void> {
    // Notify remaining clients
    this.broadcast({
      type: 'presence',
      payload: { userId: meta.userId, status: 'offline', code },
    });
  }
}
```

### Wrangler binding

```toml
[[durable_objects.bindings]]
name   = "SUBSCRIPTION_NOTIFIER"
class_name = "SubscriptionNotifier"

[[migrations]]
tag         = "v1"
new_classes = ["SubscriptionNotifier"]
```

### Worker route

```ts
app.get('/api/subscribe', authMiddleware, async (c) => {
  const id = c.env.SUBSCRIPTION_NOTIFIER.idFromName('global');
  const stub = c.env.SUBSCRIPTION_NOTIFIER.get(id);
  return stub.fetch(
    new Request(c.req.url, {
      headers: {
        Upgrade: 'websocket',
        'x-user-id': c.get('user').sub,
        'x-correlation-id': c.get('correlationId') ?? '',
      },
    }),
  );
});
```

---

## API Reference

### `RealtimeDurableObject`

Abstract base class. Extend it and implement `onMessage`.

#### Constructor

```ts
constructor(ctx: DurableObjectStateLike)
```

Pass your DO's `state` (first constructor arg).

#### Protected methods

| Method | Description |
|--------|-------------|
| `acceptConnection(request, meta?)` | Upgrade HTTP → WebSocket; returns `101` or `426` |
| `broadcast(message, excludeId?)` | Send to all connections; optionally skip one |
| `broadcastTagged(tag, message)` | Send to connections registered with a Cloudflare tag |
| `getConnectionMetas()` | Snapshot of all active `ConnectionMeta` objects |

#### Abstract method

```ts
abstract onMessage(ws, meta, message): Promise<void>
```

#### Optional lifecycle hooks (override as needed)

```ts
async onConnect(ws, meta): Promise<void>           // after connection accepted
async onDisconnect(ws, meta, code, reason): Promise<void> // after close
async onError(ws, meta | null): Promise<void>      // on error
```

#### Cloudflare Hibernation API handlers (do not call directly)

```ts
async webSocketMessage(ws, message): Promise<void>
async webSocketClose(ws, code, reason): Promise<void>
async webSocketError(ws): Promise<void>
```

---

### `parseRealtimeMessage(raw)`

Parses a raw WebSocket frame. Returns a `RealtimeMessage` or `null`.

```ts
const msg = parseRealtimeMessage(event.data);
if (!msg) return; // malformed — caller should send error frame
```

---

### `broadcastAll(connections, message)`

Sends `message` to every socket in `connections`. Silently skips closed ones.

---

### `broadcastToTag(connections, tag, message)`

Filters `connections` by `ConnectionMeta.tags` and sends only to matching ones.
For edge-side filtering, prefer `ctx.getWebSockets(tag)` and then `broadcastAll`.

---

## Types

```ts
interface RealtimeMessage {
  type: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

interface ConnectionMeta {
  connectionId: string;  // UUIDv4
  userId?: string;
  correlationId?: string;
  tags: string[];
  connectedAt: string;   // ISO 8601
}
```

---

## Testing

Inject a mock `DurableObjectStateLike` and stub `WebSocketPair`:

```ts
import { vi } from 'vitest';
import { RealtimeDurableObject, HibernatingWebSocket, DurableObjectStateLike } from '@latimer-woods-tech/realtime';

// Stub the Cloudflare global before calling acceptConnection
vi.stubGlobal('WebSocketPair', function (this: { 0: WS; 1: WS }) {
  this[0] = mockClientSocket;
  this[1] = mockServerSocket;
});
```

---

## Dependencies

| Package | Reason |
|---------|--------|
| `@latimer-woods-tech/errors` | `InternalError` re-export |

---

## License

MIT — see repository root for details.

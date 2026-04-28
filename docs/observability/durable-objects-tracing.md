# Durable Objects & Correlation ID Tracing

**Special considerations for VideoKing's real-time features**

VideoKing uses Cloudflare Durable Objects (DO) for:
- **VideoRoom** — Live video session + chat
- **UserPresence** — Online status tracking
- **ConferenceRoom** — Multi-participant calls

Durable Objects handle concurrent WebSocket connections, making correlation tracing more complex than regular HTTP requests.

---

## Challenge: Distributed Tracing with Durable Objects

```
HTTP Client                 Durable Object (VideoRoom)
    │ x-correlation-id              │
    ├──────────────────────────────>│
    │                               ├─ WebSocket connected
    │                               ├─ Process incoming messages
    │                               ├─ Forward to other clients
    │                               └─ Durable state persisted
    │<──────────────────────────────┤
    │ response + correlationId       │
```

**Problem:** Multiple WebSocket messages from same client → different handler invocations → lost correlation context

**Solution:** Attach correlationId to WebSocket message payload itself (not just HTTP headers)

---

## Implementation

### 1. Frontend: Send Correlation ID in WebSocket Payload

**video-studio/src/websocket.ts:**

```typescript
import { getOrCreateCorrelationId } from '@/lib/tracing';

export class VideoRoomConnection {
  private socket: WebSocket | null = null;
  private correlationId: string;

  constructor() {
    this.correlationId = getOrCreateCorrelationId();
  }

  connect(roomId: string) {
    // Get connection URL from Worker
    const response = await fetch('/api/video/room/join', {
      method: 'POST',
      headers: {
        'x-correlation-id': this.correlationId,
      },
      body: JSON.stringify({ roomId }),
    });

    const { wsUrl } = await response.json();

    // Connect to WebSocket
    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message with correlationId:', {
        correlationId: this.correlationId,
        messageType: message.type,
        timestamp: new Date().toISOString(),
      });
    };

    this.socket.onopen = () => {
      // Send first message with correlationId
      this.send({ type: 'handshake', correlationId: this.correlationId });
    };
  }

  private send(message: Record<string, any>) {
    if (!this.socket) return;

    // Attach correlationId to EVERY message
    const payload = {
      ...message,
      correlationId: this.correlationId,
      timestamp: Date.now(),
    };

    this.socket.send(JSON.stringify(payload));
  }

  sendChatMessage(text: string) {
    this.send({
      type: 'chat',
      text,
      // correlationId attached automatically
    });
  }

  sendStreamSample(data: Uint8Array) {
    this.send({
      type: 'stream_sample',
      data: Array.from(data),
      // correlationId attached automatically
    });
  }
}
```

---

### 2. Worker: Accept Correlation ID from WebSocket Initial Handshake

**apps/worker/src/routes/video/room.ts:**

```typescript
import {
  correlationIdMiddleware,
  getCorrelationId,
} from '@adrper79-dot/logger';

app.post('/api/video/room/join', async (c) => {
  const correlationId = c.get('correlationId');
  const { roomId } = await c.req.json();

  // Store correlation ID in Durable Object state
  // so it can be used for all subsequent messages
  const roomDO = env.DURABLE_OBJECT_ROOMS.get(
    new URL(`https://room/${roomId}`),
  );

  const wsUrl = await roomDO.fetch(
    new Request('https://do/setup', {
      method: 'POST',
      body: JSON.stringify({
        correlationId, // ← Pass to DO
        userId: c.get('user').id,
      }),
    }),
  ).then((res) => res.text());

  return c.json({
    wsUrl,
    correlationId, // ← Echo back to client
  });
});
```

---

### 3. Durable Object: Track Correlation ID for Each Connection

**apps/worker/src/durable-objects/VideoRoom.ts:**

```typescript
import { createLogger } from '@adrper79-dot/logger';

export class VideoRoom {
  private state: DurableObjectState;
  private env: Env;
  private connections: Map<string, { ws: WebSocket; correlationId: string }> =
    new Map();
  private logger: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.logger = createLogger({
      workerId: 'video-room-do',
      requestId: crypto.randomUUID(),
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/setup') {
      // Initial setup: client wants WebSocket
      const { correlationId, userId } = await request.json();

      // Create WebSocket pair
      const [clientWS, serverWS] = Object.values(
        new WebSocketPair(),
      ) as [WebSocket, WebSocket];

      // Map connection to correlationId
      const connectionId = crypto.randomUUID();
      this.connections.set(connectionId, {
        ws: serverWS,
        correlationId,
      });

      this.logger.info('WebSocket connected', {
        correlationId, // Now Available in logs!
        connectionId,
        userId,
      });

      // Handle incoming messages
      serverWS.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleMessage(
          message,
          connectionId,
          correlationId,
        );
      };

      return new Response(null, {
        status: 101,
        webSocket: clientWS,
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleMessage(
    message: Record<string, any>,
    connectionId: string,
    correlationId: string,
  ) {
    // ← correlationId now available for EVERY message

    this.logger.info('Message received', {
      correlationId, // ← Use for logging
      messageType: message.type,
      connectionId,
    });

    switch (message.type) {
      case 'chat':
        await this.broadcastChatMessage(
          message,
          correlationId,
        );
        break;

      case 'stream_sample':
        await this.procesStreamSample(message, correlationId);
        break;

      default:
        this.logger.warn('Unknown message type', {
          correlationId,
          type: message.type,
        });
    }
  }

  private async broadcastChatMessage(
    message: Record<string, any>,
    correlationId: string,
  ) {
    this.logger.info('Broadcasting chat', {
      correlationId,
      messageText: message.text,
      connectionCount: this.connections.size,
    });

    // Broadcast to all connected clients, preserving correlationId
    const payload = JSON.stringify({
      ...message,
      correlationId, // ← Attach to outgoing messages too
    });

    for (const { ws } of this.connections.values()) {
      ws.send(payload);
    }
  }

  private async procesStreamSample(
    message: Record<string, any>,
    correlationId: string,
  ) {
    this.logger.info('Processing stream sample', {
      correlationId,
      dataSize: message.data?.length,
    });

    // Save to R2 for recording, include correlationId for tracing
    const recordingKey = `rooms/${this.state.id}/recording-${correlationId}`;

    // ... R2 upload ...
  }
}

// Export for Worker binding
export { VideoRoom };
```

---

### 4. Monitoring Integration

**Extend correlation context in monitoring:**

```typescript
import { captureError } from '@adrper79-dot/monitoring';

export class VideoRoom {
  private async handleMessage(message: Record<string, any>) {
    try {
      // ... message handling ...
    } catch (err) {
      const correlationId = message.correlationId;

      captureError(err, {
        correlationId, // ← Sentry event includes DO context
        userId: message.userId,
        messageType: message.type,
        extra: {
          connectionCount: this.connections.size,
          roomId: this.state.id,
        },
      });

      throw err;
    }
  }
}
```

---

## Trace Path for Real-Time Features

**Trace for "Chat message fails to deliver to other users":**

```
┌─ Client 1 sends message via WebSocket
│  { type: 'chat', text: 'Hello', correlationId: 'corr_xyz' }
│
├─ VideoRoom DO receives message
│  Logger: "Message received { correlationId: 'corr_xyz', type: 'chat' }"
│
├─ Broadcast to clients
│  Logger: "Broadcasting chat { correlationId: 'corr_xyz', connectionCount: 3 }"
│
├─ Client 2 receives message with same correlationId
│  And can log: "Chat received { correlationId: 'corr_xyz' }"
│
└─ Trace retrieval shows all layers linked by single ID
```

---

## Schema Addition for VideoRoom

Add `correlation_id` column to any persistent storage:

```sql
-- Track video room sessions with correlation ID
CREATE TABLE video_room_sessions (
  id UUID PRIMARY KEY,
  correlation_id TEXT NOT NULL, -- ← From initial WebSocket handshake
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  INDEX (correlation_id, started_at), -- For trace lookup
};

-- Persist chat messages for audit + playback
CREATE TABLE room_messages (
  id UUID PRIMARY KEY,
  correlation_id TEXT NOT NULL, -- ← Same as parent session
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_type TEXT,
  content JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX (correlation_id), -- Search by trace ID
};
```

---

## Example: Debugging "Video froze during stream"

**User reports:** "Stream froze for 5 seconds, recovered after"

**In DevTools, capture correlationId:** `corr_stream_freeze_123`

**Query traces:**

```bash
curl "https://api.videoing.io/admin/trace/corr_stream_freeze_123" \
  -H "Authorization: Bearer $TOKEN" | jq '.trace | map(select(.source=="durable_object"))'
```

**Result shows:**

```json
[
  {
    "timestamp": "2026-04-28T15:10:00.500Z",
    "source": "durable_object",
    "message": "Message received",
    "context": { "messageType": "stream_sample", "dataSize": 16384 }
  },
  {
    "timestamp": "2026-04-28T15:10:01.200Z",
    "source": "durable_object",
    "message": "Processing stream sample",
    "context": { "dataSize": 16384 }
  },
  {
    "timestamp": "2026-04-28T15:10:05.100Z", // ← 4 second gap
    "source": "durable_object",
    "message": "Message received",
    "context": { "messageType": "stream_sample", "dataSize": 16384 }
  }
]
```

**Analysis:** 4-second gap between stream samples. Check:
1. Cloud infrastructure (Durable Object evicted due to inactivity?)
2. Client network (dropped frames?)
3. Browser tab was inactive (throttled by browser?)

**All traceable by correlationId.**

---

## Testing Durable Objects with Correlation ID

**File:** `apps/worker/__tests__/do-correlation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { VideoRoom } from '../src/durable-objects/VideoRoom';

describe('Durable Objects with Correlation ID', () => {
  it('attaches correlationId to all WebSocket messages', async () => {
    const correlationId = 'test_do_corr_123';

    // Simulate WebSocket connection
    const roomSetupRequest = new Request('https://do/setup', {
      method: 'POST',
      body: JSON.stringify({
        correlationId,
        userId: 'user_123',
      }),
    });

    // DO accepts correlationId
    // ... simulate WebSocket messages ...

    // Verify correlationId appears in logs
    // (Mock logger to capture)

    const logSpy = vi.spyOn(logger, 'info');

    // ... send message through DO ...

    expect(logSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        correlationId, // ← Verified
      }),
    );
  });

  it('preserves correlationId across broadcast to multiple clients', async () => {
    // ... connect 3 clients with same correlationId ...
    // ... one sends message ...
    // Verify all recipients receive message with same correlationId
  });

  it('captures DO errors with correlationId in Sentry', async () => {
    const correlationId = 'error_test_corr_456';

    // Trigger error in DO
    // Verify Sentry event includes correlationId
  });
});
```

---

## Best Practices

1. **Always attach correlationId to outgoing WebSocket messages**
   ```typescript
   ws.send(JSON.stringify({ ...message, correlationId }));
   ```

2. **Extract correlationId from incoming WebSocket payload**
   ```typescript
   const { correlationId } = JSON.parse(event.data);
   ```

3. **Pass correlationId to all async operations**
   ```typescript
   const recordingKey = `recording-${correlationId}`;
   ```

4. **Log with correlationId in every handler**
   ```typescript
   logger.info('Message received', { correlationId });
   ```

5. **Store correlationId in persistent state for audit**
   ```typescript
   await db.insert(roomMessages).values({ correlationId, ... });
   ```

---

## Limits & Considerations

- **DO state persistence:** correlationId stored in DO state (in-memory) survives evictions if you persist to Neon
- **Multi-DO communication:** If VideoRoom calls UserPresence DO, pass correlationId between them
- **Message size:** correlationId adds ~36 bytes per message (UUID string)
- **Privacy:** correlationId is user-facing in browser; don't expose in client-side UI

---

## FAQ

**Q: Won't adding correlationId to every WebSocket message increase latency?**  
A: No. Adds ~36 bytes, negligible for typical stream (~1MB/s video)

**Q: What if DO crashes mid-session?**  
A: Durable Object is evicted. On reconnect, client supplies correlationId again from session storage.

**Q: How do I search traces for all messages in a room?**  
A: Query room_messages table:
```sql
SELECT * FROM room_messages WHERE correlation_id LIKE 'corr_stream_%' ORDER BY created_at;
```

---

## See Also

- [Full-Stack Tracing Architecture](./full-stack-tracing.md)
- [Debugging with Correlation IDs](./debugging-with-correlation-ids.md)
- [VideoKing Durable Objects](../videoking/durable-objects.md)

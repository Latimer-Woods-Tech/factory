import { InternalError } from '@latimer-woods-tech/errors';

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Error codes emitted by the realtime package.
 */
export const RealtimeErrorCodes = {
  /** HTTP request to the WebSocket endpoint was not an upgrade request. */
  UPGRADE_REQUIRED: 'REALTIME_UPGRADE_REQUIRED',
  /** Incoming WebSocket message could not be parsed as JSON. */
  MESSAGE_PARSE_FAILED: 'REALTIME_MESSAGE_PARSE_FAILED',
  /** A requested connection ID was not found among active connections. */
  CONNECTION_NOT_FOUND: 'REALTIME_CONNECTION_NOT_FOUND',
} as const;

/**
 * Valid realtime error code values.
 */
export type RealtimeErrorCode = (typeof RealtimeErrorCodes)[keyof typeof RealtimeErrorCodes];

// ---------------------------------------------------------------------------
// Platform-agnostic interface types
// ---------------------------------------------------------------------------

/**
 * Minimal WebSocket interface used by this package.
 *
 * Compatible with the Cloudflare Worker WebSocket (with Hibernation API
 * extensions) and with test mocks. Consumers receive an instance of this type
 * via the DO lifecycle callbacks and should not implement it themselves.
 */
export interface HibernatingWebSocket {
  /** Send a text or binary message to the connected client. */
  send(message: string | ArrayBuffer): void;
  /** Close the connection with an optional code and reason. */
  close(code?: number, reason?: string): void;
  /**
   * Attach metadata to this WebSocket that survives DO hibernation.
   * Serialised to V8 snapshot; must be JSON-serialisable.
   */
  serializeAttachment(value: unknown): void;
  /**
   * Retrieve metadata previously stored via {@link serializeAttachment}.
   * Returns `null` if no attachment has been set.
   */
  deserializeAttachment<T>(): T | null;
}

/**
 * Minimal DurableObjectState subset required by this package.
 *
 * Compatible with the Cloudflare Worker `DurableObjectState` binding.
 * Pass your DO's `ctx` (or `state`) directly.
 */
export interface DurableObjectStateLike {
  /**
   * Register a server-side WebSocket with the Hibernation API.
   * @param ws   The server half of a `WebSocketPair`.
   * @param tags Optional string tags for grouped retrieval via `getWebSockets`.
   */
  acceptWebSocket(ws: HibernatingWebSocket, tags?: string[]): void;
  /**
   * Returns all WebSockets currently managed by this DO.
   * If `tag` is supplied, only WebSockets with that tag are returned.
   */
  getWebSockets(tag?: string): HibernatingWebSocket[];
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * Typed real-time message exchanged between a connected client and a
 * Durable Object via WebSocket.
 *
 * @example
 * ```ts
 * const msg: RealtimeMessage = {
 *   type: 'chat',
 *   payload: { text: 'Hello!' },
 *   correlationId: 'corr_abc123',
 * };
 * ```
 */
export interface RealtimeMessage {
  /** Discriminator string for routing (e.g. `'chat'`, `'reaction'`, `'poll'`). */
  type: string;
  /** Arbitrary event payload. */
  payload: Record<string, unknown>;
  /** Optional correlation ID for distributed tracing. */
  correlationId?: string;
}

/**
 * Per-connection metadata stored via the WebSocket Hibernation API
 * (`ws.serializeAttachment`). Survives DO hibernation and is available
 * on every subsequent message.
 */
export interface ConnectionMeta {
  /** Unique identifier for this connection (UUIDv4). */
  connectionId: string;
  /** Authenticated user ID, if known at connection time. */
  userId?: string;
  /** Distributed tracing correlation ID supplied by the client. */
  correlationId?: string;
  /**
   * Cloudflare WebSocket tags that were passed at `acceptWebSocket` time.
   * Useful for grouping connections by room, channel, or feature.
   */
  tags: string[];
  /** ISO 8601 timestamp when the connection was established. */
  connectedAt: string;
}

// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------

const _decoder = new TextDecoder();

/**
 * Parses a raw WebSocket message frame into a typed {@link RealtimeMessage}.
 * Returns `null` when the frame is not valid JSON or lacks the required
 * `type` and `payload` fields — callers must handle the null case.
 *
 * @param raw - Raw message frame received from a WebSocket event.
 *
 * @example
 * ```ts
 * const msg = parseRealtimeMessage(event.data);
 * if (!msg) { ws.send(JSON.stringify({ type: 'error', payload: {} })); return; }
 * ```
 */
export function parseRealtimeMessage(raw: string | ArrayBuffer): RealtimeMessage | null {
  try {
    const text = raw instanceof ArrayBuffer ? _decoder.decode(raw) : raw;
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      typeof (parsed as Record<string, unknown>)['type'] === 'string' &&
      'payload' in parsed &&
      typeof (parsed as Record<string, unknown>)['payload'] === 'object'
    ) {
      return parsed as RealtimeMessage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Broadcasts a message to every WebSocket in the provided array.
 * Connections that have been closed or dropped are silently skipped.
 *
 * Use this when you already hold a list of connections (e.g. from
 * `DurableObjectStateLike.getWebSockets()`).
 *
 * @param connections - WebSocket connections to broadcast to.
 * @param message     - Message to send.
 *
 * @example
 * ```ts
 * broadcastAll(ctx.getWebSockets(), { type: 'tick', payload: { ts: Date.now() } });
 * ```
 */
export function broadcastAll(
  connections: HibernatingWebSocket[],
  message: RealtimeMessage,
): void {
  const payload = JSON.stringify(message);
  for (const ws of connections) {
    try {
      ws.send(payload);
    } catch {
      // ignore — the connection was closed or errored
    }
  }
}

/**
 * Broadcasts a message only to connections whose {@link ConnectionMeta}
 * `tags` array contains the given tag string.
 *
 * > **Note:** This performs a client-side filter on the attachment metadata.
 * > For server-side filtering at the Cloudflare edge, prefer passing the tag
 * > directly to `DurableObjectStateLike.getWebSockets(tag)` and then using
 * > {@link broadcastAll}.
 *
 * @param connections - Full connection list to filter.
 * @param tag         - Tag string to match.
 * @param message     - Message to send.
 *
 * @example
 * ```ts
 * broadcastToTag(ctx.getWebSockets(), 'room:abc', { type: 'join', payload: { userId } });
 * ```
 */
export function broadcastToTag(
  connections: HibernatingWebSocket[],
  tag: string,
  message: RealtimeMessage,
): void {
  const payload = JSON.stringify(message);
  for (const ws of connections) {
    const meta = ws.deserializeAttachment<ConnectionMeta>();
    if (meta?.tags.includes(tag)) {
      try {
        ws.send(payload);
      } catch {
        // ignore closed connections
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Base Durable Object class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for Cloudflare Durable Objects that manage WebSocket
 * connections using the **Hibernation API**.
 *
 * Subclasses must implement {@link onMessage} and may optionally override
 * {@link onConnect}, {@link onDisconnect}, and {@link onError} lifecycle hooks.
 *
 * The Hibernation API lets the Workers runtime evict idle DOs from memory
 * between messages, dramatically reducing costs for low-traffic connections.
 * The base class transparently restores {@link ConnectionMeta} from the V8
 * attachment on every message wake-up.
 *
 * ---
 *
 * ### Minimal subclass example
 *
 * ```ts
 * import { RealtimeDurableObject, ConnectionMeta, HibernatingWebSocket, RealtimeMessage } from '@latimer-woods-tech/realtime';
 *
 * export class SubscriptionNotifier extends RealtimeDurableObject {
 *   constructor(state: DurableObjectState, _env: Env) {
 *     super(state);
 *   }
 *
 *   async fetch(request: Request): Promise<Response> {
 *     const userId = request.headers.get('x-user-id') ?? undefined;
 *     const correlationId = request.headers.get('x-correlation-id') ?? undefined;
 *     return this.acceptConnection(request, { userId, correlationId, tags: ['subscription'] });
 *   }
 *
 *   async onMessage(
 *     _ws: HibernatingWebSocket,
 *     _meta: ConnectionMeta,
 *     message: RealtimeMessage,
 *   ): Promise<void> {
 *     // echo to every subscriber
 *     this.broadcast(message);
 *   }
 * }
 * ```
 *
 * ### Wrangler binding
 *
 * ```toml
 * [[durable_objects.bindings]]
 * name = "SUBSCRIPTION_NOTIFIER"
 * class_name = "SubscriptionNotifier"
 *
 * [[migrations]]
 * tag = "v1"
 * new_classes = ["SubscriptionNotifier"]
 * ```
 */
export abstract class RealtimeDurableObject {
  protected readonly ctx: DurableObjectStateLike;

  /**
   * @param ctx - Durable Object state (pass the DO constructor's first arg).
   */
  public constructor(ctx: DurableObjectStateLike) {
    this.ctx = ctx;
  }

  // ---------------------------------------------------------------------------
  // Protected API — use from subclass `fetch()` handlers
  // ---------------------------------------------------------------------------

  /**
   * Upgrades an incoming HTTP request to a WebSocket connection and registers
   * it with the Cloudflare Hibernation API.
   *
   * Call this from your subclass `fetch()` method whenever the client requests
   * a WebSocket upgrade. Returns a `101 Switching Protocols` response on
   * success, or a `426 Upgrade Required` response if the `Upgrade: websocket`
   * header is missing.
   *
   * @param request - Incoming HTTP request.
   * @param meta    - Optional metadata to attach to this connection.
   *
   * @example
   * ```ts
   * async fetch(request: Request): Promise<Response> {
   *   return this.acceptConnection(request, {
   *     userId: request.headers.get('x-user-id') ?? undefined,
   *     tags: ['room:abc'],
   *   });
   * }
   * ```
   */
  protected acceptConnection(
    request: Request,
    meta?: {
      userId?: string;
      correlationId?: string;
      tags?: string[];
    },
  ): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', {
        status: 426,
        headers: { Upgrade: 'websocket' },
      });
    }

    // WebSocketPair is a Cloudflare Workers global (not in the standard DOM).
    // In tests, stub it with vi.stubGlobal / globalThis.WebSocketPair.
    const pair = new WebSocketPair();
    const client = pair[0] as unknown as HibernatingWebSocket;
    const server = pair[1] as unknown as HibernatingWebSocket;

    const connectionMeta: ConnectionMeta = {
      connectionId: crypto.randomUUID(),
      userId: meta?.userId,
      correlationId: meta?.correlationId,
      tags: meta?.tags ?? [],
      connectedAt: new Date().toISOString(),
    };

    this.ctx.acceptWebSocket(server, connectionMeta.tags);
    server.serializeAttachment(connectionMeta);

    // Fire the onConnect hook — errors are surfaced to the DO runtime
    void this.onConnect(server, connectionMeta);

    return new Response(null, {
      status: 101,
      webSocket: client as unknown as WebSocket,
    });
  }

  /**
   * Broadcasts a message to **all** active WebSocket connections managed by
   * this Durable Object instance.
   *
   * Optionally excludes the sender's connection so they don't receive their
   * own message echoed back.
   *
   * @param message             - Message to broadcast.
   * @param excludeConnectionId - Connection ID to skip (e.g. the message sender).
   *
   * @example
   * ```ts
   * this.broadcast({ type: 'reaction', payload: { emoji: '❤️' } }, meta.connectionId);
   * ```
   */
  protected broadcast(message: RealtimeMessage, excludeConnectionId?: string): void {
    const connections = this.ctx.getWebSockets();
    const payload = JSON.stringify(message);

    for (const ws of connections) {
      const connMeta = ws.deserializeAttachment<ConnectionMeta>();
      if (!connMeta) continue;
      if (excludeConnectionId !== undefined && connMeta.connectionId === excludeConnectionId) {
        continue;
      }
      try {
        ws.send(payload);
      } catch {
        // ignore — connection closed or DO was hibernating when client dropped
      }
    }
  }

  /**
   * Broadcasts a message to connections that carry a specific Cloudflare
   * WebSocket tag (set via {@link acceptConnection}'s `tags` option).
   *
   * This calls `ctx.getWebSockets(tag)` which is a server-side filter at the
   * Cloudflare edge — more efficient than iterating all connections.
   *
   * @param tag     - Tag string to target (e.g. `'room:abc'`).
   * @param message - Message to send.
   *
   * @example
   * ```ts
   * this.broadcastTagged('room:abc', { type: 'chat', payload: { text } });
   * ```
   */
  protected broadcastTagged(tag: string, message: RealtimeMessage): void {
    const connections = this.ctx.getWebSockets(tag);
    const payload = JSON.stringify(message);

    for (const ws of connections) {
      try {
        ws.send(payload);
      } catch {
        // ignore closed connections
      }
    }
  }

  /**
   * Returns a snapshot of {@link ConnectionMeta} for all currently active
   * connections in this DO instance. Useful for presence tracking and
   * connection count displays.
   *
   * @example
   * ```ts
   * const count = this.getConnectionMetas().length;
   * ```
   */
  protected getConnectionMetas(): ConnectionMeta[] {
    return this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment<ConnectionMeta>())
      .filter((meta): meta is ConnectionMeta => meta !== null);
  }

  // ---------------------------------------------------------------------------
  // Abstract — must be implemented by subclasses
  // ---------------------------------------------------------------------------

  /**
   * Called for every valid {@link RealtimeMessage} received from a connected
   * client. This is the main application event handler.
   *
   * @param ws      - The sender's WebSocket (use for unicast replies).
   * @param meta    - Metadata for the sender's connection.
   * @param message - Parsed and validated incoming message.
   */
  public abstract onMessage(
    ws: HibernatingWebSocket,
    meta: ConnectionMeta,
    message: RealtimeMessage,
  ): Promise<void>;

  // ---------------------------------------------------------------------------
  // Optional lifecycle hooks — override in subclasses as needed
  // ---------------------------------------------------------------------------

  /**
   * Called immediately after a new WebSocket connection is accepted.
   * Override to send a welcome message or initialise per-connection state.
   *
   * @param _ws   - Newly connected WebSocket.
   * @param _meta - Metadata for the new connection.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async onConnect(_ws: HibernatingWebSocket, _meta: ConnectionMeta): Promise<void> {
    // no-op — override in subclasses
  }

  /**
   * Called when a WebSocket connection is closed by the client or the runtime.
   * Override to clean up per-connection state or notify remaining clients.
   *
   * @param _ws     - The closing WebSocket.
   * @param _meta   - Metadata for the closing connection.
   * @param _code   - WebSocket close code.
   * @param _reason - Human-readable close reason (may be empty).
   */
  public async onDisconnect(
    _ws: HibernatingWebSocket,
    _meta: ConnectionMeta,
    _code: number,
    _reason: string,
  ): Promise<void> {
    // no-op — override in subclasses
  }

  /**
   * Called when a WebSocket error occurs.
   * Override to log the error or alert on connection failures.
   *
   * @param _ws   - The errored WebSocket.
   * @param _meta - Metadata for the connection (`null` if the attachment was lost).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async onError(_ws: HibernatingWebSocket, _meta: ConnectionMeta | null): Promise<void> {
    // no-op — override in subclasses
  }

  // ---------------------------------------------------------------------------
  // Cloudflare DO WebSocket Hibernation lifecycle — called by the runtime
  // ---------------------------------------------------------------------------

  /**
   * **Cloudflare Hibernation API lifecycle method.**
   *
   * Called by the Workers runtime for every incoming message on a WebSocket
   * managed by this DO. Deserialises the raw frame, validates the JSON shape,
   * and dispatches to {@link onMessage}. Returns an error frame to the sender
   * if the message cannot be parsed.
   *
   * > Do **not** call this method directly.
   *
   * @param ws      - The WebSocket that received the message.
   * @param message - Raw message frame (string or binary).
   */
  public async webSocketMessage(
    ws: HibernatingWebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const meta = ws.deserializeAttachment<ConnectionMeta>();
    if (!meta) return;

    const parsed = parseRealtimeMessage(message);

    if (parsed === null) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: RealtimeErrorCodes.MESSAGE_PARSE_FAILED,
            message: 'Invalid message — expected JSON { type: string, payload: object }',
          },
        }),
      );
      return;
    }

    await this.onMessage(ws, meta, parsed);
  }

  /**
   * **Cloudflare Hibernation API lifecycle method.**
   *
   * Called when a client closes their WebSocket connection.
   * Closes the server side and fires {@link onDisconnect}.
   *
   * > Do **not** call this method directly.
   *
   * @param ws     - The closing WebSocket.
   * @param code   - WebSocket close code.
   * @param reason - Human-readable close reason.
   */
  public async webSocketClose(
    ws: HibernatingWebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    const meta = ws.deserializeAttachment<ConnectionMeta>();
    ws.close(code, reason);
    if (meta) {
      await this.onDisconnect(ws, meta, code, reason);
    }
  }

  /**
   * **Cloudflare Hibernation API lifecycle method.**
   *
   * Called when the Workers runtime detects a WebSocket error.
   * Fires {@link onError} with the connection metadata (or `null` if the
   * attachment was unavailable).
   *
   * > Do **not** call this method directly.
   *
   * @param ws - The errored WebSocket.
   */
  public async webSocketError(ws: HibernatingWebSocket): Promise<void> {
    const meta = ws.deserializeAttachment<ConnectionMeta>();
    await this.onError(ws, meta);
  }
}

// Re-export InternalError so callers can throw a typed error without importing
// @latimer-woods-tech/errors directly.
export { InternalError };

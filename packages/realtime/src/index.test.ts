import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RealtimeErrorCodes,
  parseRealtimeMessage,
  broadcastAll,
  broadcastToTag,
  RealtimeDurableObject,
  type HibernatingWebSocket,
  type DurableObjectStateLike,
  type ConnectionMeta,
  type RealtimeMessage,
} from './index.js';

// ---------------------------------------------------------------------------
// Helpers / mocks
// ---------------------------------------------------------------------------

/** Build a minimal HibernatingWebSocket mock. */
function makeWS(attachment: ConnectionMeta | null = null): HibernatingWebSocket & {
  _attachment: ConnectionMeta | null;
  _sent: string[];
  _closed: boolean;
} {
  let _attachment: ConnectionMeta | null = attachment;
  const _sent: string[] = [];
  let _closed = false;
  const ws = {
    get _attachment() {
      return _attachment;
    },
    _sent,
    get _closed() {
      return _closed;
    },
    send(msg: string | ArrayBuffer) {
      _sent.push(typeof msg === 'string' ? msg : new TextDecoder().decode(msg));
    },
    close() { _closed = true; },
    serializeAttachment(value: unknown) {
      _attachment = value as ConnectionMeta;
    },
    deserializeAttachment<T>() {
      return _attachment as T | null;
    },
  };
  return ws;
}

/** Build a minimal DurableObjectStateLike mock. */
function makeDOState(sockets: HibernatingWebSocket[] = []): DurableObjectStateLike & {
  _accepted: Array<{ ws: HibernatingWebSocket; tags: string[] }>;
  _sockets: HibernatingWebSocket[];
} {
  const _accepted: Array<{ ws: HibernatingWebSocket; tags: string[] }> = [];
  const _sockets = [...sockets];
  return {
    _accepted,
    _sockets,
    acceptWebSocket(ws: HibernatingWebSocket, tags: string[] = []) {
      _accepted.push({ ws, tags });
      _sockets.push(ws);
    },
    getWebSockets(tag?: string) {
      if (tag === undefined) return _sockets;
      return _sockets.filter((ws) => {
        const meta = ws.deserializeAttachment<ConnectionMeta>();
        return meta?.tags.includes(tag) ?? false;
      });
    },
  };
}

/** Build a valid ConnectionMeta fixture. */
function makeMeta(overrides: Partial<ConnectionMeta> = {}): ConnectionMeta {
  return {
    connectionId: 'conn-test-1',
    userId: 'user-1',
    correlationId: 'corr-abc',
    tags: [],
    connectedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Concrete DO subclass for testing. */
class TestDO extends RealtimeDurableObject {
  public receivedMessages: Array<{ ws: HibernatingWebSocket; meta: ConnectionMeta; message: RealtimeMessage }> = [];
  public connectedEvents: Array<{ ws: HibernatingWebSocket; meta: ConnectionMeta }> = [];
  public disconnectedEvents: Array<{ ws: HibernatingWebSocket; meta: ConnectionMeta; code: number; reason: string }> = [];
  public errorEvents: Array<{ ws: HibernatingWebSocket; meta: ConnectionMeta | null }> = [];

  public onMessage(
    ws: HibernatingWebSocket,
    meta: ConnectionMeta,
    message: RealtimeMessage,
  ): Promise<void> {
    this.receivedMessages.push({ ws, meta, message });
    return Promise.resolve();
  }

  public override onConnect(ws: HibernatingWebSocket, meta: ConnectionMeta): Promise<void> {
    this.connectedEvents.push({ ws, meta });
    return Promise.resolve();
  }

  public override onDisconnect(
    ws: HibernatingWebSocket,
    meta: ConnectionMeta,
    code: number,
    reason: string,
  ): Promise<void> {
    this.disconnectedEvents.push({ ws, meta, code, reason });
    return Promise.resolve();
  }

  public override onError(
    ws: HibernatingWebSocket,
    meta: ConnectionMeta | null,
  ): Promise<void> {
    this.errorEvents.push({ ws, meta });
    return Promise.resolve();
  }

  // Expose protected methods for testing
  public testAcceptConnection(request: Request, meta?: Parameters<typeof RealtimeDurableObject.prototype['acceptConnection']>[1]): Response {
    return this.acceptConnection(request, meta);
  }
  public testBroadcast(message: RealtimeMessage, excludeId?: string): void {
    return this.broadcast(message, excludeId);
  }
  public testBroadcastTagged(tag: string, message: RealtimeMessage): void {
    return this.broadcastTagged(tag, message);
  }
  public testGetConnectionMetas(): ConnectionMeta[] {
    return this.getConnectionMetas();
  }
}

// ---------------------------------------------------------------------------
// Setup global WebSocketPair mock for acceptConnection tests
// ---------------------------------------------------------------------------

type MockWebSocketPairResult = {
  0: HibernatingWebSocket;
  1: HibernatingWebSocket;
};

function makeMockWebSocketPair(): { client: ReturnType<typeof makeWS>; server: ReturnType<typeof makeWS>; Ctor: new () => MockWebSocketPairResult } {
  const client = makeWS();
  const server = makeWS();
  const Ctor = function (this: MockWebSocketPairResult) {
    this[0] = client;
    this[1] = server;
  } as unknown as new () => MockWebSocketPairResult;
  return { client, server, Ctor };
}

// ---------------------------------------------------------------------------
// parseRealtimeMessage
// ---------------------------------------------------------------------------

describe('parseRealtimeMessage', () => {
  it('parses a valid JSON string message', () => {
    const raw = JSON.stringify({ type: 'chat', payload: { text: 'hi' } });
    const result = parseRealtimeMessage(raw);
    expect(result).toEqual({ type: 'chat', payload: { text: 'hi' } });
  });

  it('parses a valid ArrayBuffer message', () => {
    const json = JSON.stringify({ type: 'ping', payload: {} });
    const buf = new TextEncoder().encode(json).buffer;
    const result = parseRealtimeMessage(buf);
    expect(result).toEqual({ type: 'ping', payload: {} });
  });

  it('includes optional correlationId when present', () => {
    const raw = JSON.stringify({ type: 'event', payload: { x: 1 }, correlationId: 'corr-1' });
    const result = parseRealtimeMessage(raw);
    expect(result?.correlationId).toBe('corr-1');
  });

  it('returns null for invalid JSON', () => {
    expect(parseRealtimeMessage('not json')).toBeNull();
  });

  it('returns null when type field is missing', () => {
    expect(parseRealtimeMessage(JSON.stringify({ payload: {} }))).toBeNull();
  });

  it('returns null when payload field is missing', () => {
    expect(parseRealtimeMessage(JSON.stringify({ type: 'x' }))).toBeNull();
  });

  it('returns null when type is not a string', () => {
    expect(parseRealtimeMessage(JSON.stringify({ type: 42, payload: {} }))).toBeNull();
  });

  it('returns null when payload is not an object', () => {
    expect(parseRealtimeMessage(JSON.stringify({ type: 'x', payload: 'bad' }))).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseRealtimeMessage('')).toBeNull();
  });

  it('returns null for a JSON null value', () => {
    expect(parseRealtimeMessage('null')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// broadcastAll
// ---------------------------------------------------------------------------

describe('broadcastAll', () => {
  it('sends serialised message to every connection', () => {
    const ws1 = makeWS();
    const ws2 = makeWS();
    const msg: RealtimeMessage = { type: 'tick', payload: { ts: 1 } };

    broadcastAll([ws1, ws2], msg);

    expect(ws1._sent).toEqual([JSON.stringify(msg)]);
    expect(ws2._sent).toEqual([JSON.stringify(msg)]);
  });

  it('sends to a single connection', () => {
    const ws = makeWS();
    const msg: RealtimeMessage = { type: 't', payload: {} };
    broadcastAll([ws], msg);
    expect(ws._sent).toHaveLength(1);
  });

  it('sends nothing when connection list is empty', () => {
    // should not throw
    broadcastAll([], { type: 't', payload: {} });
  });

  it('silently skips a connection whose send throws', () => {
    const good = makeWS();
    const bad: HibernatingWebSocket = {
      send() { throw new Error('closed'); },
      close() { /* noop */ },
      serializeAttachment() { /* noop */ },
      deserializeAttachment() { return null; },
    };
    const msg: RealtimeMessage = { type: 'x', payload: {} };

    expect(() => broadcastAll([bad, good], msg)).not.toThrow();
    expect(good._sent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// broadcastToTag
// ---------------------------------------------------------------------------

describe('broadcastToTag', () => {
  it('only sends to connections whose metadata includes the tag', () => {
    const tagged = makeWS(makeMeta({ tags: ['room:abc'] }));
    const untagged = makeWS(makeMeta({ tags: ['room:xyz'] }));
    const msg: RealtimeMessage = { type: 'chat', payload: {} };

    broadcastToTag([tagged, untagged], 'room:abc', msg);

    expect(tagged._sent).toHaveLength(1);
    expect(untagged._sent).toHaveLength(0);
  });

  it('skips connections with null attachment', () => {
    const noMeta = makeWS(null);
    broadcastToTag([noMeta], 'any', { type: 'x', payload: {} });
    expect(noMeta._sent).toHaveLength(0);
  });

  it('silently skips a connection whose send throws', () => {
    const bad: HibernatingWebSocket = {
      send() { throw new Error('closed'); },
      close() { /* noop */ },
      serializeAttachment() { /* noop */ },
      deserializeAttachment<T>() { return { tags: ['t'] } as unknown as T; },
    };
    expect(() => broadcastToTag([bad], 't', { type: 'x', payload: {} })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — acceptConnection
// ---------------------------------------------------------------------------

/** Permissive Response mock that allows status 101 (used by Cloudflare WS upgrade). */
class WorkerResponse {
  public readonly status: number;
  public readonly headers: Headers;
  constructor(_body: BodyInit | null, init?: ResponseInit & { webSocket?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers);
  }
}

describe('RealtimeDurableObject.acceptConnection', () => {
  let ctx: ReturnType<typeof makeDOState>;
  let do_: TestDO;
  let mockPair: ReturnType<typeof makeMockWebSocketPair>;

  beforeEach(() => {
    ctx = makeDOState();
    do_ = new TestDO(ctx);
    mockPair = makeMockWebSocketPair();
    vi.stubGlobal('WebSocketPair', mockPair.Ctor);
    vi.stubGlobal('Response', WorkerResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 426 when Upgrade header is missing', () => {
    const req = new Request('https://example.com/ws');
    const res = do_.testAcceptConnection(req);
    expect(res.status).toBe(426);
  });

  it('returns 426 when Upgrade header is not "websocket"', () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'h2c' },
    });
    const res = do_.testAcceptConnection(req);
    expect(res.status).toBe(426);
    expect(res.headers.get('Upgrade')).toBe('websocket');
  });

  it('returns 101 on valid WebSocket upgrade', () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'websocket' },
    });
    const res = do_.testAcceptConnection(req);
    expect(res.status).toBe(101);
  });

  it('calls ctx.acceptWebSocket with the server socket and tags', () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'websocket' },
    });
    do_.testAcceptConnection(req, { tags: ['room:abc'] });
    expect(ctx._accepted).toHaveLength(1);
    expect(ctx._accepted[0]?.tags).toEqual(['room:abc']);
  });

  it('serializes ConnectionMeta onto the server socket', () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'websocket' },
    });
    do_.testAcceptConnection(req, { userId: 'u1', correlationId: 'c1', tags: ['sub'] });
    const meta = mockPair.server.deserializeAttachment<ConnectionMeta>();
    expect(meta?.userId).toBe('u1');
    expect(meta?.correlationId).toBe('c1');
    expect(meta?.tags).toEqual(['sub']);
    expect(meta?.connectionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(meta?.connectedAt).toBeTruthy();
  });

  it('uses default empty tags when none supplied', () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'websocket' },
    });
    do_.testAcceptConnection(req);
    const meta = mockPair.server.deserializeAttachment<ConnectionMeta>();
    expect(meta?.tags).toEqual([]);
  });

  it('fires the onConnect hook asynchronously', async () => {
    const req = new Request('https://example.com/ws', {
      headers: { Upgrade: 'websocket' },
    });
    do_.testAcceptConnection(req, { userId: 'u2' });
    // onConnect is fired as a void promise — flush micro-tasks
    await Promise.resolve();
    expect(do_.connectedEvents).toHaveLength(1);
    expect(do_.connectedEvents[0]?.meta.userId).toBe('u2');
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — broadcast
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.broadcast', () => {
  it('sends to all connections', () => {
    const ws1 = makeWS(makeMeta({ connectionId: 'c1' }));
    const ws2 = makeWS(makeMeta({ connectionId: 'c2' }));
    const ctx = makeDOState([ws1, ws2]);
    const do_ = new TestDO(ctx);
    const msg: RealtimeMessage = { type: 'ping', payload: {} };

    do_.testBroadcast(msg);

    expect(ws1._sent).toHaveLength(1);
    expect(ws2._sent).toHaveLength(1);
  });

  it('excludes the specified connection ID', () => {
    const ws1 = makeWS(makeMeta({ connectionId: 'sender' }));
    const ws2 = makeWS(makeMeta({ connectionId: 'receiver' }));
    const ctx = makeDOState([ws1, ws2]);
    const do_ = new TestDO(ctx);

    do_.testBroadcast({ type: 'msg', payload: {} }, 'sender');

    expect(ws1._sent).toHaveLength(0);
    expect(ws2._sent).toHaveLength(1);
  });

  it('skips connections with no attachment', () => {
    const noMeta = makeWS(null);
    const ctx = makeDOState([noMeta]);
    const do_ = new TestDO(ctx);

    do_.testBroadcast({ type: 't', payload: {} });
    expect(noMeta._sent).toHaveLength(0);
  });

  it('silently ignores connections whose send throws', () => {
    const bad: HibernatingWebSocket = {
      send() { throw new Error('gone'); },
      close() { /* noop */ },
      serializeAttachment() { /* noop */ },
      deserializeAttachment<T>() { return makeMeta({ connectionId: 'bad' }) as unknown as T; },
    };
    const good = makeWS(makeMeta({ connectionId: 'good' }));
    const ctx = makeDOState([bad, good]);
    const do_ = new TestDO(ctx);

    expect(() => do_.testBroadcast({ type: 't', payload: {} })).not.toThrow();
    expect(good._sent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — broadcastTagged
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.broadcastTagged', () => {
  it('sends only to connections matching the tag via ctx.getWebSockets(tag)', () => {
    const ws1 = makeWS(makeMeta({ tags: ['room:a'] }));
    const ws2 = makeWS(makeMeta({ tags: ['room:b'] }));
    const ctx = makeDOState([ws1, ws2]);
    const do_ = new TestDO(ctx);

    do_.testBroadcastTagged('room:a', { type: 'x', payload: {} });

    expect(ws1._sent).toHaveLength(1);
    expect(ws2._sent).toHaveLength(0);
  });

  it('silently ignores connections whose send throws', () => {
    const bad: HibernatingWebSocket = {
      send() { throw new Error('gone'); },
      close() { /* noop */ },
      serializeAttachment() { /* noop */ },
      deserializeAttachment<T>() { return makeMeta({ tags: ['t'] }) as unknown as T; },
    };
    const ctx = makeDOState([bad]);
    const do_ = new TestDO(ctx);
    expect(() => do_.testBroadcastTagged('t', { type: 'x', payload: {} })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — getConnectionMetas
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.getConnectionMetas', () => {
  it('returns metas for all connections', () => {
    const meta1 = makeMeta({ connectionId: 'c1' });
    const meta2 = makeMeta({ connectionId: 'c2' });
    const ws1 = makeWS(meta1);
    const ws2 = makeWS(meta2);
    const ctx = makeDOState([ws1, ws2]);
    const do_ = new TestDO(ctx);

    const metas = do_.testGetConnectionMetas();
    expect(metas).toHaveLength(2);
    expect(metas.map((m) => m.connectionId)).toContain('c1');
    expect(metas.map((m) => m.connectionId)).toContain('c2');
  });

  it('filters out connections with null attachment', () => {
    const ws1 = makeWS(null);
    const ws2 = makeWS(makeMeta({ connectionId: 'c2' }));
    const ctx = makeDOState([ws1, ws2]);
    const do_ = new TestDO(ctx);

    const metas = do_.testGetConnectionMetas();
    expect(metas).toHaveLength(1);
    expect(metas[0]?.connectionId).toBe('c2');
  });

  it('returns an empty array when there are no connections', () => {
    const ctx = makeDOState([]);
    const do_ = new TestDO(ctx);
    expect(do_.testGetConnectionMetas()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — webSocketMessage
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.webSocketMessage', () => {
  let do_: TestDO;
  let ws: ReturnType<typeof makeWS>;

  beforeEach(() => {
    const ctx = makeDOState();
    do_ = new TestDO(ctx);
    ws = makeWS(makeMeta());
  });

  it('dispatches a valid string message to onMessage', async () => {
    const msg = JSON.stringify({ type: 'chat', payload: { text: 'hi' } });
    await do_.webSocketMessage(ws, msg);

    expect(do_.receivedMessages).toHaveLength(1);
    expect(do_.receivedMessages[0]?.message.type).toBe('chat');
  });

  it('dispatches a valid ArrayBuffer message to onMessage', async () => {
    const buf = new TextEncoder().encode(JSON.stringify({ type: 'binary', payload: {} })).buffer;
    await do_.webSocketMessage(ws, buf);

    expect(do_.receivedMessages).toHaveLength(1);
    expect(do_.receivedMessages[0]?.message.type).toBe('binary');
  });

  it('sends an error frame for unparseable messages', async () => {
    await do_.webSocketMessage(ws, 'not-json');

    expect(do_.receivedMessages).toHaveLength(0);
    expect(ws._sent).toHaveLength(1);
    const frame = JSON.parse(ws._sent[0]!) as { type: string; payload: { code: string } };
    expect(frame.type).toBe('error');
    expect(frame.payload.code).toBe(RealtimeErrorCodes.MESSAGE_PARSE_FAILED);
  });

  it('sends an error frame when message structure is invalid', async () => {
    await do_.webSocketMessage(ws, JSON.stringify({ noType: true }));
    expect(ws._sent).toHaveLength(1);
  });

  it('returns without dispatching if attachment is null', async () => {
    const noMetaWS = makeWS(null);
    await do_.webSocketMessage(noMetaWS, JSON.stringify({ type: 'x', payload: {} }));
    expect(do_.receivedMessages).toHaveLength(0);
    expect(noMetaWS._sent).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — webSocketClose
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.webSocketClose', () => {
  it('closes the socket and fires onDisconnect', async () => {
    const ctx = makeDOState();
    const do_ = new TestDO(ctx);
    const ws = makeWS(makeMeta());

    await do_.webSocketClose(ws, 1000, 'Normal');

    expect(ws._closed).toBe(true);
    expect(do_.disconnectedEvents).toHaveLength(1);
    expect(do_.disconnectedEvents[0]?.code).toBe(1000);
    expect(do_.disconnectedEvents[0]?.reason).toBe('Normal');
  });

  it('closes the socket even if attachment is null (no onDisconnect)', async () => {
    const ctx = makeDOState();
    const do_ = new TestDO(ctx);
    const ws = makeWS(null);

    await do_.webSocketClose(ws, 1001, '');

    expect(ws._closed).toBe(true);
    expect(do_.disconnectedEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — webSocketError
// ---------------------------------------------------------------------------

describe('RealtimeDurableObject.webSocketError', () => {
  it('fires onError with the attachment meta', async () => {
    const ctx = makeDOState();
    const do_ = new TestDO(ctx);
    const meta = makeMeta();
    const ws = makeWS(meta);

    await do_.webSocketError(ws);

    expect(do_.errorEvents).toHaveLength(1);
    expect(do_.errorEvents[0]?.meta).toEqual(meta);
  });

  it('fires onError with null when attachment is missing', async () => {
    const ctx = makeDOState();
    const do_ = new TestDO(ctx);
    const ws = makeWS(null);

    await do_.webSocketError(ws);

    expect(do_.errorEvents).toHaveLength(1);
    expect(do_.errorEvents[0]?.meta).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RealtimeErrorCodes
// ---------------------------------------------------------------------------

describe('RealtimeErrorCodes', () => {
  it('exposes the expected constants', () => {
    expect(RealtimeErrorCodes.UPGRADE_REQUIRED).toBe('REALTIME_UPGRADE_REQUIRED');
    expect(RealtimeErrorCodes.MESSAGE_PARSE_FAILED).toBe('REALTIME_MESSAGE_PARSE_FAILED');
    expect(RealtimeErrorCodes.CONNECTION_NOT_FOUND).toBe('REALTIME_CONNECTION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// RealtimeDurableObject — default lifecycle hooks (no-op base implementations)
// ---------------------------------------------------------------------------

/** Minimal DO that only implements the required onMessage — uses default hooks. */
class MinimalDO extends RealtimeDurableObject {
  public onMessage(
    _ws: HibernatingWebSocket,
    _meta: ConnectionMeta,
    _message: RealtimeMessage,
  ): Promise<void> {
    return Promise.resolve();
  }
}

describe('RealtimeDurableObject default lifecycle hooks', () => {
  const ctx = makeDOState();
  const do_ = new MinimalDO(ctx);
  const ws = makeWS(makeMeta());

  it('onConnect default is a no-op that resolves', async () => {
    await expect(do_.onConnect(ws, makeMeta())).resolves.toBeUndefined();
  });

  it('onDisconnect default is a no-op that resolves', async () => {
    await expect(do_.onDisconnect(ws, makeMeta(), 1000, 'Normal')).resolves.toBeUndefined();
  });

  it('onError default is a no-op that resolves with meta', async () => {
    await expect(do_.onError(ws, makeMeta())).resolves.toBeUndefined();
  });

  it('onError default is a no-op that resolves with null meta', async () => {
    await expect(do_.onError(ws, null)).resolves.toBeUndefined();
  });
});

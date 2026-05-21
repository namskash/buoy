# 06 — WebSockets and live sync

## The problem we're solving

The whole point of Buoy storing data in a plain `.md` file is that you can edit it in any editor:

```bash
$ vim data/todos.md
# add a line:
- [ ] new idea I just had
:wq
```

…and the bubble for "new idea I just had" should **appear in the UI** without you refreshing the browser. That's not possible with plain REST — the browser doesn't know anything has changed unless it asks.

WebSockets let the **server push messages to the browser** the moment something happens.

## Three options we considered

| Option              | Mechanism                                   | Latency | Complexity |
| ------------------- | ------------------------------------------- | ------- | ---------- |
| Refresh page        | User hits ⌘R                                | ∞       | None       |
| Polling             | Browser asks every 3-5s                     | 1-5s    | Low        |
| **WebSocket push**  | Server tells browser the instant it changes | <50ms   | Medium     |

We picked WebSockets — it feels magical, and the implementation is not actually that bad.

**Rails analogy:** WebSockets ≈ ActionCable. ActionCable is itself a thin wrapper around WS with channels and authentication baked in. We're doing the raw version because we have one global "channel" (all todos) and no auth.

## The library: `ws`

We use the [`ws`](https://www.npmjs.com/package/ws) package. It's the de-facto Node WebSocket implementation, used by basically everything (Socket.IO, Apollo, etc., all build on it).

```js
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
```

Key idea: **the WebSocket server shares the same HTTP server as Express**. WS connections start life as a regular HTTP request with an `Upgrade: websocket` header. The HTTP server hands those requests off to `wss`. Net result: REST and WS share one port (3004 in dev), which is what you want.

## Our hub: `backend/src/ws.js`

```js
export function createWsHub({ httpServer, path = '/ws' }) {
  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on('connection', (socket) => {
    socket.on('error', (err) => console.error('[ws] socket error:', err));
  });

  function broadcast(payload) {
    const json = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(json);
    }
  }

  return { broadcast, close: ..., clients: wss.clients };
}
```

That's it. We don't process incoming messages at all — this is a **one-way push** channel. (The client could send messages back, but we have no use for that yet.)

The message envelope is just:

```json
{ "type": "todos:changed", "todos": [ /* whole list */ ] }
```

We push the **entire todos array** on every change rather than diffs. With realistic todo counts (tens, not thousands) it's trivially fast and means the client code is dumb: "got message → replace state". No reconciliation logic.

## Two sources of change → one broadcast

There are exactly two ways `todos.md` can be modified:

1. **API call from the UI** (POST / PATCH / DELETE) — handled by Express routes, which call into the store.
2. **External edit** (you vim the file) — picked up by `chokidar`.

Both need to result in a broadcast. We wired them in `server.js` like this:

```js
// (1) API mutations: the store fires a 'changed' event after every write
store.subscribe(async () => {
  const todos = await store.list();
  wsHub.broadcast({ type: 'todos:changed', todos });
});

// (2) External edits: the watcher fires when the file changes on disk
watchTodosFile({
  filePath: TODOS_FILE,
  store,
  onChange: (todos) => wsHub.broadcast({ type: 'todos:changed', todos }),
});
```

### Wait, won't an API mutation trigger both?

It would! Our own `writeFile` causes chokidar to see "the file changed", which would fire the watcher's callback as well — and we'd broadcast twice. That's where the **just-wrote flag** from milestone 1 earns its keep:

```js
// in watcher.js
watcher.on('change', async () => {
  if (store.wasJustWritten()) return; // ignore our own echo
  onChange(await store.list());
});
```

API writes set `lastWriteAt = Date.now()`. The watcher sees `wasJustWritten()` is true and bails. External edits (which happen at human speed, not microseconds after an API write) sail through.

You can see this in the end-to-end smoke test from this milestone — exactly 4 messages arrive for 4 distinct changes:

```
[client] received: todos:changed (5 todos)   ← POST
[client] received: todos:changed (6 todos)   ← external edit
[client] received: todos:changed (5 todos)   ← DELETE
[client] received: todos:changed (4 todos)   ← DELETE
```

No duplicates. Good.

## The store's `subscribe` API

Storing state and pushing notifications are two different concerns. Rather than mention WebSockets from inside `store.js`, the store just emits a generic event:

```js
// store.js
const emitter = new EventEmitter();
// inside writeItems:
setImmediate(() => emitter.emit('changed'));

return {
  ...,
  subscribe(fn) { emitter.on('changed', fn); return () => emitter.off('changed', fn); }
};
```

Anyone (in our case, `server.js`) can subscribe and react. This keeps the store testable in isolation without dragging in WS.

**Rails analogy:** Like `ActiveSupport::Notifications` — emit events, anyone interested subscribes. Decouples "thing happened" from "things to do about it".

## Reconnection (for the client, coming up)

WebSocket connections drop — laptop sleeps, wifi blips, server restarts. The client side (next milestone) needs a small reconnect loop: on `close`, wait a bit, reopen. We'll add backoff to avoid hammering the server.

The server doesn't care: each new connection joins the broadcast set, and on the next change it gets the latest state. There's no per-client state to recover.

## What we built this milestone

```
backend/src/
├── ws.js              ← createWsHub({ httpServer, path }) → { broadcast, close }
├── server.js          ← now uses http.createServer + attaches WS + watcher
└── store/store.js     ← added subscribe(fn)

backend/test/
└── ws.test.js         ← 2 tests: real WebSocket clients + broadcast + drop on disconnect

backend/test/store.test.js
└── + 1 test for subscribe()
```

**Test count: 27 (parser 8 + store 8 + routes 9 + ws 2).**

## Try it

In one terminal:

```bash
cd backend && npm run dev
```

In another, open `data/todos.md` in your editor, add a line like `- [ ] hand-typed`, save. Then:

```bash
# Watch the WS broadcasts by hand:
npx -y wscat -c ws://localhost:3004/ws
```

(or use the smoke script pattern from the test in `ws.test.js`). Each save of the file produces a `todos:changed` message.

Once the frontend lands in milestone 4, this will translate into bubbles appearing on screen without a refresh.

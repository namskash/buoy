import { describe, it, expect } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import { createWsHub } from '../src/ws.js';

function once(emitter, event) {
  return new Promise((res) => emitter.once(event, res));
}

async function listenOnRandomPort(server) {
  await new Promise((res) => server.listen(0, res));
  return server.address().port;
}

describe('ws hub', () => {
  it('broadcasts to all connected clients', async () => {
    const httpServer = http.createServer();
    const hub = createWsHub({ httpServer, path: '/ws' });
    const port = await listenOnRandomPort(httpServer);

    const a = new WebSocket(`ws://localhost:${port}/ws`);
    const b = new WebSocket(`ws://localhost:${port}/ws`);
    await Promise.all([once(a, 'open'), once(b, 'open')]);

    const aMsg = once(a, 'message');
    const bMsg = once(b, 'message');

    hub.broadcast({ type: 'todos:changed', todos: [{ id: '1' }] });

    const [ra, rb] = await Promise.all([aMsg, bMsg]);
    expect(JSON.parse(ra.toString())).toEqual({
      type: 'todos:changed',
      todos: [{ id: '1' }],
    });
    expect(JSON.parse(rb.toString())).toEqual({
      type: 'todos:changed',
      todos: [{ id: '1' }],
    });

    a.close();
    b.close();
    await hub.close();
    await new Promise((res) => httpServer.close(res));
  });

  it('drops disconnected clients silently', async () => {
    const httpServer = http.createServer();
    const hub = createWsHub({ httpServer, path: '/ws' });
    const port = await listenOnRandomPort(httpServer);

    const c = new WebSocket(`ws://localhost:${port}/ws`);
    await once(c, 'open');
    c.close();
    await once(c, 'close');

    // Should not throw.
    expect(() => hub.broadcast({ type: 'todos:changed', todos: [] })).not.toThrow();

    await hub.close();
    await new Promise((res) => httpServer.close(res));
  });
});

// WebSocket hub. Attaches a WebSocketServer to an existing http.Server
// (so REST and WS share the same port) and exposes broadcast().
//
// Message envelope sent to clients:
//   { type: 'todos:changed', todos: [...] }
//
// We don't process anything clients send back — this is one-way push.

import { WebSocketServer } from 'ws';

export function createWsHub({ httpServer, path = '/ws' }) {
  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on('connection', (socket) => {
    socket.on('error', (err) => {
      console.error('[ws] socket error:', err);
    });
  });

  function broadcast(payload) {
    const json = JSON.stringify(payload);
    for (const client of wss.clients) {
      // 1 === OPEN. Don't queue messages for clients that are mid-close.
      if (client.readyState === 1) client.send(json);
    }
  }

  function close() {
    return new Promise((resolve) => wss.close(() => resolve()));
  }

  return { broadcast, close, clients: wss.clients };
}

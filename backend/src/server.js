// Entrypoint. Boots the Express app + WebSocket hub on one HTTP server,
// and wires the file watcher so external edits to todos.md broadcast too.

import http from 'node:http';
import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { createStore } from './store/store.js';
import { createWsHub } from './ws.js';
import { watchTodosFile } from './store/watcher.js';

const PORT = Number(process.env.PORT) || 3004;
const TODOS_FILE = resolve(
  process.env.TODOS_FILE || '../data/todos.md',
);

async function ensureTodosFile(path) {
  try {
    await access(path);
  } catch {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '# Buoy Todos\n\n', 'utf8');
    console.log(`[buoy] created empty todos file at ${path}`);
  }
}

async function main() {
  await ensureTodosFile(TODOS_FILE);

  const store = createStore({ filePath: TODOS_FILE });
  const staticDir = process.env.STATIC_DIR || null;
  const app = createApp({ store, staticDir });
  const httpServer = http.createServer(app);
  const wsHub = createWsHub({ httpServer, path: '/ws' });

  async function broadcastAll() {
    const [todos, sections] = await Promise.all([store.list(), store.sections()]);
    wsHub.broadcast({ type: 'todos:changed', todos, sections });
  }

  // Broadcast on every API-driven mutation.
  store.subscribe(async () => {
    try {
      await broadcastAll();
    } catch (err) {
      console.error('[buoy] broadcast (mutation) failed:', err);
    }
  });

  // Broadcast on every external file edit (e.g. you edit todos.md in Vim).
  // The watcher already filters out our own writes via store.wasJustWritten().
  watchTodosFile({
    filePath: TODOS_FILE,
    store,
    onChange: async () => {
      try {
        await broadcastAll();
      } catch (err) {
        console.error('[buoy] broadcast (watcher) failed:', err);
      }
    },
  });

  httpServer.listen(PORT, () => {
    console.log(`[buoy] api  listening on http://localhost:${PORT}`);
    console.log(`[buoy] ws   listening on ws://localhost:${PORT}/ws`);
    console.log(`[buoy] file ${TODOS_FILE}`);
  });
}

main().catch((err) => {
  console.error('[buoy] fatal:', err);
  process.exit(1);
});

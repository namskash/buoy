// Entrypoint. Boots the Express app on a real port.
// (WebSocket wiring will be added in the next milestone.)

import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.js';
import { createStore } from './store/store.js';

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
  const app = createApp({ store });

  app.listen(PORT, () => {
    console.log(`[buoy] api listening on http://localhost:${PORT}`);
    console.log(`[buoy] todos file: ${TODOS_FILE}`);
  });
}

main().catch((err) => {
  console.error('[buoy] fatal:', err);
  process.exit(1);
});

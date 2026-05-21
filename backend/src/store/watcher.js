// Watches todos.md for external edits (e.g. you opening it in Vim) and
// invokes a callback. Echoes from our own writes are filtered out via
// store.wasJustWritten().

import chokidar from 'chokidar';

export function watchTodosFile({ filePath, store, onChange }) {
  const watcher = chokidar.watch(filePath, {
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    ignoreInitial: true,
  });

  watcher.on('change', async () => {
    if (store.wasJustWritten()) return; // ignore our own echo
    try {
      const todos = await store.list();
      onChange(todos);
    } catch (err) {
      console.error('[watcher] failed to read after change:', err);
    }
  });

  return watcher;
}

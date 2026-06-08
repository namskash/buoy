// Watches todos.md for external edits (e.g. you opening it in Vim) and
// invokes a callback. Echoes from our own writes are filtered out via
// store.wasJustWritten().

import chokidar from 'chokidar';

export function watchTodosFile({ filePath, store, onChange }) {
  const watcher = chokidar.watch(filePath, {
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    ignoreInitial: true,
  });

  watcher.on('change', () => {
    if (store.wasJustWritten()) return; // ignore our own echo
    onChange();
  });

  return watcher;
}

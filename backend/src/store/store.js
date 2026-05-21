// The "database". Wraps todos.md with:
//   - read():       parse the file and return tasks (with defaults filled in)
//   - create/update/remove: mutate and write back
//   - a serial write queue so concurrent writes don't clobber each other
//   - a "just wrote" flag so the file watcher can ignore our own writes
//
// Why a queue? Reading then writing is a two-step dance; two simultaneous
// requests would otherwise both read the same starting state and overwrite
// each other's changes. The queue forces one read-modify-write at a time.

import { readFile, writeFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { parse, tasksOnly } from './parser.js';
import { serialize } from './serializer.js';

function withDefaults(task) {
  return {
    id: task.id || nanoid(8),
    title: task.title,
    done: !!task.done,
    priority: clampPriority(task.priority ?? 3),
    created: task.created || new Date().toISOString(),
    completed: task.completed,
    description: task.description,
  };
}

function clampPriority(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function createStore({ filePath }) {
  let writeChain = Promise.resolve();
  // Timestamp of our most recent write — watcher uses this to ignore echoes.
  let lastWriteAt = 0;
  const emitter = new EventEmitter();

  async function readItems() {
    const text = await readFile(filePath, 'utf8');
    return parse(text);
  }

  async function writeItems(items) {
    // Fill in defaults for every task before writing so the file becomes
    // self-describing (every task ends up with an id, priority, created).
    const filled = items.map((item) =>
      item.kind === 'task'
        ? { ...item, ...withDefaults(item) }
        : item,
    );
    await writeFile(filePath, serialize(filled), 'utf8');
    lastWriteAt = Date.now();
    // Fire & forget. Listeners deal with errors.
    setImmediate(() => emitter.emit('changed'));
    return filled;
  }

  // Serialize all mutating operations through one promise chain.
  function enqueue(fn) {
    const next = writeChain.then(fn, fn);
    // Keep the chain alive even if `fn` throws.
    writeChain = next.catch(() => {});
    return next;
  }

  return {
    // Read-only.
    async list() {
      const items = await readItems();
      return tasksOnly(items).map(withDefaults);
    },

    // Returns the created task.
    create({ title, priority, description }) {
      return enqueue(async () => {
        const items = await readItems();
        const newTask = withDefaults({
          title,
          priority,
          description,
          done: false,
        });
        items.push({ kind: 'task', ...newTask });
        await writeItems(items);
        return newTask;
      });
    },

    // Partial update. Pass { done: true } to complete; sets completed timestamp.
    update(id, patch) {
      return enqueue(async () => {
        const items = await readItems();
        let updated = null;
        for (const item of items) {
          if (item.kind !== 'task' || item.id !== id) continue;
          if (patch.title !== undefined) item.title = patch.title;
          if (patch.priority !== undefined) item.priority = clampPriority(patch.priority);
          if (patch.description !== undefined) item.description = patch.description;
          if (patch.done !== undefined) {
            item.done = !!patch.done;
            item.completed = item.done ? new Date().toISOString() : undefined;
          }
          updated = { ...withDefaults(item) };
          Object.assign(item, updated);
          break;
        }
        if (!updated) throw new Error(`Todo not found: ${id}`);
        await writeItems(items);
        return updated;
      });
    },

    remove(id) {
      return enqueue(async () => {
        const items = await readItems();
        const before = items.length;
        const next = items.filter(
          (item) => !(item.kind === 'task' && item.id === id),
        );
        if (next.length === before) throw new Error(`Todo not found: ${id}`);
        await writeItems(next);
        return { id };
      });
    },

    // For the watcher to detect "did we just write this?".
    wasJustWritten(withinMs = 250) {
      return Date.now() - lastWriteAt < withinMs;
    },

    // Listeners fire after every successful internal mutation.
    // Returns an unsubscribe function.
    subscribe(fn) {
      emitter.on('changed', fn);
      return () => emitter.off('changed', fn);
    },
  };
}

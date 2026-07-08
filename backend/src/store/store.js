// The "database". Wraps todos.md with:
//   - read():       parse the file and return tasks (with defaults filled in)
//   - create/update/remove: mutate and write back
//   - a serial write queue so concurrent writes don't clobber each other
//   - a "just wrote" flag so the file watcher can ignore our own writes
//
// Why a queue? Reading then writing is a two-step dance; two simultaneous
// requests would otherwise both read the same starting state and overwrite
// each other's changes. The queue forces one read-modify-write at a time.

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { parse, tasksOnly } from './parser.js';
import { serialize } from './serializer.js';

function withDefaults(task) {
  return {
    id: task.id || nanoid(8),
    title: task.title,
    done: !!task.done,
    priority: clampPriority(task.priority ?? 2),
    created: task.created || new Date().toISOString(),
    completed: task.completed,
    description: task.description,
  };
}

function sectionOf(items, taskIndex) {
  for (let i = taskIndex - 1; i >= 0; i--) {
    if (items[i].kind === 'heading') return items[i].text;
  }
  return null;
}

function clampPriority(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(4, Math.round(n)));
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
      return items
        .map((item, idx) => item.kind === 'task' ? { item, idx } : null)
        .filter(Boolean)
        .map(({ item, idx }) => ({ ...withDefaults(item), section: sectionOf(items, idx) }));
    },

    async sections() {
      const items = await readItems();
      return items.filter((i) => i.kind === 'heading').map((i) => i.text);
    },

    renameSection(oldName, newName) {
      return enqueue(async () => {
        const items = await readItems();
        const heading = items.find((i) => i.kind === 'heading' && i.text === oldName);
        if (!heading) throw new Error(`Section not found: ${oldName}`);
        if (items.some((i) => i.kind === 'heading' && i.text === newName)) {
          throw new Error(`Section already exists: ${newName}`);
        }
        heading.text = newName;
        await writeItems(items);
        return newName;
      });
    },

    archiveSection(name) {
      return enqueue(async () => {
        const items = await readItems();
        const headingIdx = items.findIndex((i) => i.kind === 'heading' && i.text === name);
        if (headingIdx === -1) throw new Error(`Section not found: ${name}`);

        const nextHeadingIdx = items.findIndex((i, idx) => idx > headingIdx && i.kind === 'heading');
        const end = nextHeadingIdx === -1 ? items.length : nextHeadingIdx;
        const sectionItems = items.slice(headingIdx, end);

        const archivePath = join(dirname(filePath), 'archive.md');
        await appendFile(archivePath, '\n' + serialize(sectionItems) + '\n', 'utf8');

        items.splice(headingIdx, end - headingIdx);
        await writeItems(items);
        return name;
      });
    },

    clearDoneInSection(name) {
      return enqueue(async () => {
        const items = await readItems();
        const headingIdx = items.findIndex((i) => i.kind === 'heading' && i.text === name);
        if (headingIdx === -1) throw new Error(`Section not found: ${name}`);

        const nextHeadingIdx = items.findIndex((i, idx) => idx > headingIdx && i.kind === 'heading');
        const end = nextHeadingIdx === -1 ? items.length : nextHeadingIdx;
        const sectionItems = items.slice(headingIdx, end);
        const doneItems = sectionItems.filter((item) => item.kind === 'task' && item.done);

        if (doneItems.length === 0) return { cleared: 0 };

        const archivePath = join(dirname(filePath), 'archive.md');
        await appendFile(
          archivePath,
          '\n' + serialize([{ kind: 'heading', text: name }, ...doneItems]) + '\n',
          'utf8',
        );

        items.splice(
          headingIdx,
          end - headingIdx,
          ...sectionItems.filter((item) => item.kind !== 'task' || !item.done),
        );
        await writeItems(items);
        return { cleared: doneItems.length };
      });
    },

    createSection(name) {
      return enqueue(async () => {
        const items = await readItems();
        if (items.some((i) => i.kind === 'heading' && i.text === name)) {
          throw new Error(`Section already exists: ${name}`);
        }
        items.push({ kind: 'heading', text: name });
        await writeItems(items);
        return name;
      });
    },

    // Returns the created task.
    create({ title, priority, description, section }) {
      return enqueue(async () => {
        const items = await readItems();
        const newTask = withDefaults({
          title,
          priority,
          description,
          done: false,
        });
        const taskItem = { kind: 'task', ...newTask };

        if (section != null) {
          const headingIdx = items.findIndex(
            (i) => i.kind === 'heading' && i.text === section,
          );
          if (headingIdx !== -1) {
            // Find the next heading after this one (or end of array).
            let insertAt = items.length;
            for (let i = headingIdx + 1; i < items.length; i++) {
              if (items[i].kind === 'heading') { insertAt = i; break; }
            }
            items.splice(insertAt, 0, taskItem);
            await writeItems(items);
            return newTask;
          }
        }

        items.push(taskItem);
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

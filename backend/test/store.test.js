import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store/store.js';

async function makeFixture(initialMd = '# Buoy\n') {
  const dir = await mkdtemp(join(tmpdir(), 'buoy-'));
  const filePath = join(dir, 'todos.md');
  await writeFile(filePath, initialMd, 'utf8');
  return { dir, filePath };
}

describe('store', () => {
  let fx;
  beforeEach(async () => {
    fx = await makeFixture('# Buoy\n');
  });

  it('create adds a task and fills defaults', async () => {
    const store = createStore({ filePath: fx.filePath });
    const created = await store.create({ title: 'Buy milk', priority: 1 });
    expect(created.title).toBe('Buy milk');
    expect(created.priority).toBe(1);
    expect(created.id).toBeTruthy();
    expect(created.done).toBe(false);
    expect(created.created).toBeTruthy();

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it('update toggles done and stamps completed', async () => {
    const store = createStore({ filePath: fx.filePath });
    const t = await store.create({ title: 'X', priority: 2 });
    const updated = await store.update(t.id, { done: true });
    expect(updated.done).toBe(true);
    expect(updated.completed).toBeTruthy();

    const reopened = await store.update(t.id, { done: false });
    expect(reopened.done).toBe(false);
    expect(reopened.completed).toBeUndefined();
  });

  it('remove deletes a task', async () => {
    const store = createStore({ filePath: fx.filePath });
    const t = await store.create({ title: 'X', priority: 2 });
    await store.remove(t.id);
    expect(await store.list()).toHaveLength(0);
  });

  it('clamps priority into 0..4', async () => {
    const store = createStore({ filePath: fx.filePath });
    const high = await store.create({ title: 'A', priority: 99 });
    const low = await store.create({ title: 'B', priority: -3 });
    expect(high.priority).toBe(4);
    expect(low.priority).toBe(0);
  });

  it('serializes concurrent writes (no lost updates)', async () => {
    const store = createStore({ filePath: fx.filePath });
    // Fire 20 creates in parallel.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.create({ title: `task-${i}`, priority: 2 }),
      ),
    );
    const list = await store.list();
    expect(list).toHaveLength(20);
    // All titles present (no overwrites).
    const titles = list.map((t) => t.title).sort();
    expect(titles[0]).toBe('task-0');
    expect(titles[titles.length - 1]).toBe('task-9'); // string sort
  });

  it('hand-typed bare task gets defaults filled in on next write', async () => {
    // Simulate a user typing `- [ ] hand` directly into the file.
    await writeFile(fx.filePath, '# Buoy\n- [ ] hand\n', 'utf8');
    const store = createStore({ filePath: fx.filePath });
    // Trigger a write by creating something else.
    await store.create({ title: 'other', priority: 2 });
    const onDisk = await readFile(fx.filePath, 'utf8');
    // The bare line should now have metadata baked in.
    expect(onDisk).toMatch(/- \[ \] hand <!-- id:\S+ priority:2 created:[^ ]+ -->/);
  });

  it('subscribe is called on every mutation', async () => {
    const store = createStore({ filePath: fx.filePath });
    let count = 0;
    store.subscribe(() => count++);
    const t = await store.create({ title: 'X', priority: 2 });
    await store.update(t.id, { done: true });
    await store.remove(t.id);
    // setImmediate makes the emit async — wait a tick.
    await new Promise((r) => setImmediate(r));
    expect(count).toBe(3);
  });

  it('wasJustWritten flips true right after a write', async () => {
    const store = createStore({ filePath: fx.filePath });
    expect(store.wasJustWritten()).toBe(false);
    await store.create({ title: 'X', priority: 2 });
    expect(store.wasJustWritten()).toBe(true);
  });
});


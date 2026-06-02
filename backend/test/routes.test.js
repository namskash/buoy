import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store/store.js';

async function makeApp(initialMd = '# Buoy\n') {
  const dir = await mkdtemp(join(tmpdir(), 'buoy-routes-'));
  const filePath = join(dir, 'todos.md');
  await writeFile(filePath, initialMd, 'utf8');
  const store = createStore({ filePath });
  const app = createApp({ store });
  return { app, store, filePath };
}

describe('REST: /api/todos', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await makeApp();
  });

  it('GET returns an empty list initially', async () => {
    const res = await request(ctx.app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST creates a todo', async () => {
    const res = await request(ctx.app)
      .post('/api/todos')
      .send({ title: 'Buy milk', priority: 1, description: 'corner store' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Buy milk',
      priority: 1,
      done: false,
      description: 'corner store',
    });
    expect(res.body.id).toBeTruthy();

    const list = await request(ctx.app).get('/api/todos');
    expect(list.body).toHaveLength(1);
  });

  it('POST response does not leak internal "kind" field', async () => {
    const res = await request(ctx.app)
      .post('/api/todos')
      .send({ title: 'X', priority: 2 });
    expect(res.body.kind).toBeUndefined();
  });

  it('POST rejects missing title', async () => {
    const res = await request(ctx.app).post('/api/todos').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title is required/);
  });

  it('PATCH toggles done and stamps completed', async () => {
    const { body: created } = await request(ctx.app)
      .post('/api/todos')
      .send({ title: 'X', priority: 2 });

    const res = await request(ctx.app)
      .patch(`/api/todos/${created.id}`)
      .send({ done: true });

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);
    expect(res.body.completed).toBeTruthy();
  });

  it('PATCH on unknown id returns 404', async () => {
    const res = await request(ctx.app)
      .patch('/api/todos/nope')
      .send({ done: true });
    expect(res.status).toBe(404);
  });

  it('DELETE removes the todo', async () => {
    const { body: created } = await request(ctx.app)
      .post('/api/todos')
      .send({ title: 'X', priority: 2 });

    const del = await request(ctx.app).delete(`/api/todos/${created.id}`);
    expect(del.status).toBe(204);

    const list = await request(ctx.app).get('/api/todos');
    expect(list.body).toHaveLength(0);
  });

  it('GET /api/health responds', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('unknown route returns 404 json', async () => {
    const res = await request(ctx.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Not found/);
  });
});

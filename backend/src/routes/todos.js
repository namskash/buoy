// REST endpoints for /api/todos. Thin wrappers over the store.
//
// Rails analogy: this file is your `app/controllers/todos_controller.rb`
// plus the routes from `config/routes.rb`, since Express keeps routing
// and handlers in the same place.

import { Router } from 'express';

export function createSectionsRouter({ store }) {
  const router = Router();

  // GET /api/sections  →  ["Section A", "Section B", ...]
  router.get('/', async (_req, res, next) => {
    try {
      const sections = await store.sections();
      res.json(sections);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createTodosRouter({ store }) {
  const router = Router();

  // GET /api/todos  →  [{ id, title, done, priority, created, ... }, ...]
  router.get('/', async (_req, res, next) => {
    try {
      const todos = await store.list();
      res.json(todos);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/todos  body: { title, priority?, description? }
  router.post('/', async (req, res, next) => {
    try {
      const { title, priority, description } = req.body || {};
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title is required' });
      }
      const created = await store.create({
        title: title.trim(),
        priority,
        description,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/todos/:id  body: any subset of { title, priority, description, done }
  router.patch('/:id', async (req, res, next) => {
    try {
      const updated = await store.update(req.params.id, req.body || {});
      res.json(updated);
    } catch (err) {
      if (err.message && err.message.startsWith('Todo not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  });

  // DELETE /api/todos/:id
  router.delete('/:id', async (req, res, next) => {
    try {
      await store.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err.message && err.message.startsWith('Todo not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  });

  return router;
}

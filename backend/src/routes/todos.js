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

  // PATCH /api/sections/:name  body: { name: newName }
  router.patch('/:name', async (req, res, next) => {
    try {
      const oldName = decodeURIComponent(req.params.name);
      const { name: newName } = req.body || {};
      if (typeof newName !== 'string' || newName.trim() === '') {
        return res.status(400).json({ error: 'name is required' });
      }
      await store.renameSection(oldName, newName.trim());
      res.json({ name: newName.trim() });
    } catch (err) {
      if (err.message && err.message.startsWith('Section not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && err.message.startsWith('Section already exists')) {
        return res.status(409).json({ error: err.message });
      }
      next(err);
    }
  });

  // DELETE /api/sections/:name  →  archives section to archive.md
  router.delete('/:name', async (req, res, next) => {
    try {
      const name = decodeURIComponent(req.params.name);
      await store.archiveSection(name);
      res.status(204).end();
    } catch (err) {
      if (err.message?.startsWith('Section not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  });

  // POST /api/sections  body: { name }
  router.post('/', async (req, res, next) => {
    try {
      const { name } = req.body || {};
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'name is required' });
      }
      await store.createSection(name.trim());
      res.status(201).json({ name: name.trim() });
    } catch (err) {
      if (err.message && err.message.startsWith('Section already exists')) {
        return res.status(409).json({ error: err.message });
      }
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
      const { title, priority, description, section } = req.body || {};
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title is required' });
      }
      const created = await store.create({
        title: title.trim(),
        priority,
        description,
        section,
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

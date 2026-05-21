// Express app factory. Kept separate from server.js so tests can mount
// the app without binding a real port. server.js wraps this and calls listen().

import express from 'express';
import cors from 'cors';
import { createTodosRouter } from './routes/todos.js';

export function createApp({ store }) {
  const app = express();

  // Middleware stack. Order matters (just like Rails Rack middleware).
  app.use(cors()); // dev mode: Vite is on a different port, so we allow all
  app.use(express.json());

  // Tiny health endpoint so we can curl-test the server is alive.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/todos', createTodosRouter({ store }));

  // Express's default 404 (no route matched).
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // Error handler — Express recognises this signature (4 args) as the
  // last-resort handler. Anything that calls `next(err)` lands here.
  app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(500).json({ error: err.message || 'internal error' });
  });

  return app;
}

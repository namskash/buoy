// Express app factory. Kept separate from server.js so tests can mount
// the app without binding a real port. server.js wraps this and calls listen().

import express from 'express';
import cors from 'cors';
import { resolve, join } from 'node:path';
import { createTodosRouter, createSectionsRouter } from './routes/todos.js';

export function createApp({ store, staticDir } = { store: undefined }) {
  const app = express();

  // Middleware stack. Order matters (just like Rails Rack middleware).
  app.use(cors()); // dev mode: Vite is on a different port, so we allow all
  app.use(express.json());

  // Tiny health endpoint so we can curl-test the server is alive.
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/todos', createTodosRouter({ store }));
  app.use('/api/sections', createSectionsRouter({ store }));

  // In production the same Express process serves the built React bundle.
  // staticDir is set by server.js when STATIC_DIR env var points at a dir.
  // Registered AFTER /api routes so they take precedence.
  if (staticDir) {
    const absStatic = resolve(staticDir);
    app.use(express.static(absStatic));
    // SPA fallback: any non-/api GET serves index.html so client-side
    // routing (if we ever add it) keeps working on deep links.
    app.get(/^\/(?!api\/|ws$).*/, (_req, res) => {
      res.sendFile(join(absStatic, 'index.html'));
    });
  }

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

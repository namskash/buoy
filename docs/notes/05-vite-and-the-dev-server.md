# 05 — Vite and the dev server

## What's a "build tool" and why do we need one?

The browser only understands plain JS. But the code we wrote in `frontend/src/` uses:

- **JSX** (`<App />`) — not real JS, needs to be compiled.
- **ES modules across files** — `import App from './App.jsx'`. The browser supports these natively, but only with `.js` (not `.jsx`), and only with explicit file extensions.
- **CSS imports from JS** (`import './styles.css'`) — not a thing in raw browser JS.
- **`import.meta.env.VITE_API_URL`** — Vite injects env vars at build time.

Something has to bridge "what we wrote" → "what the browser runs". That's the build tool.

## Vite, briefly

Vite is two things:

1. **A dev server.** Runs `vite dev`. It serves your source files, transforming them on demand (JSX → JS, CSS → injectable string, etc.). It uses **native ES modules in the browser** + **esbuild** (Go-based, very fast) to do this, so startup is near-instant. No bundling in dev.
2. **A production bundler.** Runs `vite build`. Outputs a `dist/` folder of optimised, bundled, minified static files ready to serve.

That's it. No config needed for the basics — `vite.config.js` is one file:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
```

The `@vitejs/plugin-react` plugin teaches Vite about JSX and **HMR** (more below).

**Rails analogy:** Vite is what `sprockets`/`webpacker`/`esbuild-rails`/`importmap-rails` are trying to be — your asset pipeline. Vite is significantly faster than any of them because it skips bundling in dev entirely.

## Hot Module Replacement (HMR)

Save `App.jsx`. The browser updates **without a full page reload** — and without losing component state (your text in the input field is preserved). That's HMR.

How it works at a high level:

1. Vite watches your files.
2. On save, it figures out which module changed.
3. It pushes a tiny update to the browser over its own WebSocket (yes, Vite has its own WS, separate from ours).
4. The React plugin re-mounts only the affected components.

You'll see messages like `[vite] hot updated: /src/App.jsx` in the terminal. This feedback loop is why frontend devs are picky about their tooling.

## Why two ports in dev?

- Backend: `http://localhost:3004` (Express + our WebSocket)
- Frontend: `http://localhost:5173` (Vite)

You browse to 5173. The HTML it serves has JS that calls `fetch('http://localhost:3004/api/todos')`. That's a **cross-origin** request, which browsers block by default. We allow it via `cors()` middleware on the Express side.

In production we'll merge: a single Node server serves both the built React static files *and* the API. Same origin, no CORS needed. That's what milestone 8 is for.

## Env vars: `import.meta.env`

Vite exposes env vars at build time. **Only vars prefixed with `VITE_`** are exposed to client code — this is a safety feature (so you don't accidentally leak `DATABASE_URL` into your bundle).

Files Vite reads, in order of precedence:
- `.env.development.local`
- `.env.development`
- `.env.local`
- `.env`

We use `frontend/.env.development`:

```
VITE_API_URL=http://localhost:3004
VITE_WS_URL=ws://localhost:3004/ws
```

In the code:

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';
```

The `||` fallback is for tests and for production where these would be set differently.

**Rails analogy:** `.env.development` ≈ Rails' `.env.development` (via `dotenv-rails`) or `Rails.application.credentials`. Same idea: per-environment config, kept out of source.

## The `index.html` entry point

```html
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
```

This is the entire HTML the browser receives. React mounts everything else into `<div id="root">` at runtime. The `<script type="module">` is what triggers Vite's module loading machinery.

Note: the `src="/src/main.jsx"` works in dev because Vite handles `.jsx`. In production, `vite build` rewrites this to point at the bundled `dist/assets/index-XYZ.js`.

## The build output

```bash
npm run build
# →
dist/index.html                   0.39 kB
dist/assets/index-CXTHF_ZK.css    1.91 kB
dist/assets/index-CAvHXQkG.js   145.75 kB
```

That's the entire production deployable. ~150kB of JS for a React app + our code + the CSS, fingerprinted (the `CXTHF_ZK` hash) for cache-busting. Anything that serves static files can serve this — Express, nginx, S3, GitHub Pages.

In milestone 8 we'll have our Express server serve this directory in production mode, so the whole thing runs on one port.

## Useful commands

```bash
cd frontend
npm run dev     # Vite dev server on 5173 (HMR, no build)
npm run build   # Builds to dist/
npm run preview # Serves the built dist/ locally (mimics prod)
```

The dev server is what you'll use 99% of the time. `preview` is occasionally useful to sanity-check the production build before shipping.

## Summary

- Vite turns `.jsx` + `import` + env vars into something a browser can run.
- Dev: serves files individually (native ESM + esbuild). Instant startup.
- Prod: bundles to `dist/`. Tiny, fast, fingerprinted.
- HMR keeps your component state across edits.
- Two ports in dev (Vite + Node) → one port in prod (Node serves both).

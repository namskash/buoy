# 08 — Docker and Compose (dev)

This milestone wraps the whole app in Docker so `docker compose up` is all you need to run it. A separate later milestone will add a production image; this one is dev-only.

## Image vs container vs Compose, in three sentences

- An **image** is an immutable file-system snapshot built from a `Dockerfile`. Like a class.
- A **container** is a running instance of an image. Like an object.
- **Docker Compose** is a YAML file that describes a set of containers (services), how they're networked, what volumes they share, and how to build them. `docker compose up` brings the whole thing up.

**Rails analogy:** `Dockerfile` ≈ a Gemfile + initialization recipe baked into a binary; `docker compose up` ≈ Foreman/Procfile launching several processes at once.

## Our stack

```
┌────────────────────────────────────────┐
│ docker compose (one file: 2 services)  │
│                                        │
│  ┌────────────────┐  ┌───────────────┐ │
│  │ buoy-backend   │  │ buoy-frontend │ │
│  │ Node + Express │  │ Vite + React  │ │
│  │ port 3004      │  │ port 5173     │ │
│  └────────────────┘  └───────────────┘ │
│         │                  │           │
│         ▼                  ▼           │
│    bind-mounts: ./data, ./*/src        │
└────────────────────────────────────────┘
                  ▲
                  │
            (you on the host)
```

The browser still runs on your host — both 3004 and 5173 are published to the host so `http://localhost:5173` works as before.

## The Dockerfiles (dev)

Both look almost identical:

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 3004        # or 5173
CMD ["npm", "run", "dev"]
```

Three layers of build cache here:

1. **Base image** — Node 20 on Alpine. Tiny, cached after first pull.
2. **Dependencies** — `package.json` + `package-lock.json` copied alone, then `npm ci`. This layer is reused whenever the lockfile doesn't change, which is most of the time. (If we'd `COPY . .` first, ANY source change would bust the deps cache and trigger a full reinstall.)
3. **Source** — everything else. Cheap to invalidate because it doesn't trigger reinstall.

`.dockerignore` keeps `node_modules`, `.git`, logs out of the build context — both for speed and to avoid shadowing the container's `node_modules` with host garbage.

## Compose, annotated

```yaml
services:
  backend:
    build: ./backend
    container_name: buoy-backend
    ports:
      - "3004:3004"
    volumes:
      - ./data:/app/data            # ① data sync
      - ./backend/src:/app/src      # ② source hot-reload
      - ./backend/test:/app/test
      - /app/node_modules           # ③ keep container's node_modules
    environment:
      TODOS_FILE: /app/data/todos.md

  frontend:
    build: ./frontend
    container_name: buoy-frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/index.html:/app/index.html
      - ./frontend/vite.config.js:/app/vite.config.js
      - /app/node_modules
    environment:
      VITE_API_URL: http://localhost:3004
      VITE_WS_URL: ws://localhost:3004/ws
    depends_on:
      - backend
```

### ① The data sync — the whole point of using a file as DB

```
./data:/app/data
```

The host's `./data` directory is mounted inside the backend container as `/app/data`. Anything either side writes is *the same file*. Open `data/todos.md` in your editor → backend container reads it. Add a todo via the UI → backend writes through the mount → the host file updates.

This is what makes "the markdown file is the source of truth" work in a containerized world. Without it, `todos.md` inside the container would be a private copy, disappearing on every rebuild.

### ② Source bind-mounts for hot reload

```
./backend/src:/app/src
```

The image built by the Dockerfile contains a snapshot of the source at build time. But in dev we want edits on the host to show up *immediately* inside the container. So we bind-mount the source directories on top of the image's source. The image's `npm run dev` script uses `node --watch` (a Node 20 feature) which restarts the server when files change.

The frontend gets the same treatment, with one wrinkle: we also mount `index.html` and `vite.config.js` individually because they live at the root, not under `src/`. Vite's HMR (hot module replacement) handles the actual live update.

### ③ The anonymous volume trick

```
- /app/node_modules
```

This line looks weird — there's no host path. It's an **anonymous volume**, which gives `/app/node_modules` a Docker-managed location that **shadows whatever might be sitting at that path on the host**.

Why we need it: when we bind-mount `./backend/src` onto `/app/src`, the bind would *also* let the host's `node_modules` (if any) bleed into the container. On a Mac host, those modules are macOS-built; the container is Linux. Symlinks, native extensions, file-permissions — instant breakage.

The anonymous volume preserves the `node_modules` directory that `npm ci` installed at image-build time, regardless of what's on the host. It's invisible from the host and exists for the container's lifetime.

You may see this pattern called "the node_modules volume trick" — it's standard for Node + Docker dev setups.

## Networking note

Both containers are on a default Compose network where they can address each other by service name (`backend` → `frontend`, `backend` → `backend`, etc.). **But our browser runs on the host**, not inside Docker — so the env vars the frontend uses to call the API still need `localhost`:

```yaml
VITE_API_URL: http://localhost:3004
VITE_WS_URL:  ws://localhost:3004/ws
```

If the frontend were calling the API *server-side* (it's not — it's React in a browser), we'd use `http://backend:3004`. For client-side calls baked into JS, the URLs must resolve from the browser's perspective.

## Running it

```bash
docker compose build    # one-time (or after Dockerfile changes)
docker compose up       # start both
docker compose logs -f  # tail logs
docker compose down     # stop and remove containers
```

`docker compose up -d` runs detached (background).

## What we verified end-to-end

- **Host → container**: `echo "- [ ] foo" >> data/todos.md` on host → seen in container's `curl http://localhost:3004/api/todos`.
- **Container → host**: `curl -X POST http://localhost:3004/api/todos -d '{"title":"bar"}'` → new row appears in `data/todos.md` on the host.
- **Browser**: `http://localhost:5173` renders the full Buoy app served by the container'd Vite, talking to the container'd API + WS.

## Common dev-loop commands cheat sheet

```bash
# Watch a single service's logs
docker compose logs -f backend

# Restart only one service (e.g. after changing its Dockerfile)
docker compose up -d --build backend

# Open a shell inside a running container
docker compose exec backend sh

# Rebuild from scratch when something feels broken
docker compose down -v       # also drops the anonymous node_modules volume
docker compose up --build
```

## Rails analogy

Compose's `services:` is `Procfile`. Bind-mounting source so saves auto-reload is the equivalent of `rails server` running directly against your working tree. The anonymous `node_modules` volume is the awkward bit Rails users don't have to think about because Rails apps don't have a per-platform binary `node_modules`-style directory — bundler's gems are platform-tagged, but they go in a system-wide location, not the project tree.

The win versus the previous "two terminals" setup: one command, reproducible environment, identical Node version on every machine, ready to grow into a production image (next section).

---

# Part 2 — The production image

Dev compose runs two containers on two ports with bind-mounted source. That's great for editing but terrible for shipping: two processes, two open ports, host directories baked into the topology. Production wants the opposite — **one immutable image**, **one port**, **no host filesystem assumptions**.

The trick: **Express serves the built React bundle itself**, so the API, the WebSocket, and the static HTML/CSS/JS all come out of the same Node process on the same port. The frontend isn't a server in prod — it's just a folder of files.

## Multi-stage build

A multi-stage `Dockerfile` runs through several `FROM` statements; only the **last** stage becomes the final image. Earlier stages are throwaway scratch space — perfect for compiling assets you don't want to ship.

```
┌──── Stage 1: frontend-build ──────────────┐
│ FROM node:20-alpine                       │
│  npm ci  (full deps, incl. vite, react)   │
│  npm run build  →  /build/dist/           │
└────────────────┬──────────────────────────┘
                 │ COPY --from=frontend-build
                 ▼
┌──── Stage 2: runtime (← final image) ─────┐
│ FROM node:20-alpine                       │
│  npm ci --omit=dev  (express, ws, etc.)   │
│  COPY backend/src  →  /app/src/           │
│  COPY ... /build/dist → /app/public/      │
│  CMD node src/server.js                   │
└───────────────────────────────────────────┘
```

The shipped image has **no Vite, no React source, no devDependencies, no test files** — just Node + the runtime deps + compiled assets. Smaller image, smaller attack surface, faster startup.

## Same-origin URLs

In dev the frontend's bundle is built with:

```
VITE_API_URL=http://localhost:3004
VITE_WS_URL=ws://localhost:3004/ws
```

— because the React app at `:5173` calls a separate API server at `:3004`. Different origins, CORS required.

In prod the bundle is built with **empty strings**:

```dockerfile
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
```

And the client code falls back to relative paths:

```js
// api.js
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3004';
// "" + "/api/todos"  →  "/api/todos"  (relative, same-origin)

// useTodos.js
function resolveWsUrl() {
  const fromEnv = import.meta.env.VITE_WS_URL;
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
```

Why this matters: the same bundle works behind any reverse proxy, on any port, over http or https. No rebuild needed per environment. The browser asks the *current page's origin* for `/api/todos` and `/ws`, and Express — running on that origin — answers both.

## Serving static files from Express

```js
// backend/src/app.js
if (staticDir) {
  app.use(express.static(staticDir));
  app.get(/^\/(?!api\/|ws$).*/, (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'));
  });
}
```

Two pieces:

1. **`express.static`** — for every GET, if a file with that path exists under `staticDir`, send it. Handles MIME types, ETags, 304s for free.
2. **SPA fallback** — for any non-`/api/` and non-`/ws` route that *isn't* a static file, return `index.html`. This is what makes client-side routes like `/settings` work on a deep-link refresh: the server gives back the React shell and the React router takes over in the browser.

Order matters: `express.static` and the SPA fallback are registered AFTER the API routes, so `/api/todos` still wins.

The `staticDir` is wired by `server.js`:

```js
const staticDir = process.env.STATIC_DIR || null;
const app = createApp({ store, staticDir });
```

In dev `STATIC_DIR` is unset → no static serving → Express stays a pure API. In prod the Dockerfile sets `STATIC_DIR=/app/public` → Express serves the bundle.

## The whole production Dockerfile

```dockerfile
# Stage 1 — build the frontend bundle
FROM node:20-alpine AS frontend-build
WORKDIR /build
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2 — runtime
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004
ENV STATIC_DIR=/app/public
ENV TODOS_FILE=/app/data/todos.md
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/src ./src
COPY --from=frontend-build /build/dist ./public
EXPOSE 3004
CMD ["node", "src/server.js"]
```

`.dockerignore` at the repo root keeps build contexts clean — `node_modules`, `dist`, `.git`, docs, the dev compose file all stay out.

## Building and running

```bash
# Build the image (a few seconds after the first cold pull)
docker build -t buoy:prod .

# Run it. Mount data/ so todos.md persists across container restarts.
docker run --rm -p 3004:3004 -v "$PWD/data:/app/data" buoy:prod

# Visit http://localhost:3004 — the React app loads from Express,
# /api/todos and /ws both answer on the same port.
```

## Dev vs prod, side by side

| Aspect            | Dev compose                              | Prod image                              |
|-------------------|------------------------------------------|-----------------------------------------|
| Containers        | 2 (backend + frontend)                   | 1                                       |
| Open ports        | 3004 (API) + 5173 (Vite)                 | 3004 (everything)                       |
| Frontend serving  | Vite dev server (HMR)                    | Express `static` from `/app/public/`    |
| API URL in bundle | `http://localhost:3004` (env-baked)      | empty → relative `/api/...`             |
| Source mount      | bind-mounted, hot reload                 | none — source is baked into the image   |
| `node_modules`    | container's, shadowed by anon volume     | only the runtime's prod deps            |
| Image size goal   | doesn't matter                           | small (no Vite, no devDeps, no tests)   |
| When you rebuild  | only when `package.json` changes         | on every release                        |

## Why one port matters

Many cloud platforms (Heroku, Fly, Cloud Run, App Service) give you exactly one HTTP port and route all traffic to it. Splitting your API and your bundle across two ports either requires a separate web server in front (nginx) or two deployed services. Folding the bundle into Express collapses the whole app into the simplest possible deploy unit: one image, one process, one port.

In Rails terms this is roughly the move from `rails server` + a separate `webpack-dev-server` (dev) to the precompiled-assets-served-by-Rails model (prod) — assets compiled at build time, served from `public/` by the same process that answers the API.

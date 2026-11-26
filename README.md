# 🫧 Buoy

A floating-bubble to-do app.

Each task is a bubble. Bigger bubbles (higher priority) rise to the top of the canvas and bob around. Click to complete (the bubble _pops_), right-click or long-press to see details, drag to throw it across the screen. The active tasks live in a human-editable `data/todos.md` file — edit it on your host in any text editor and the running app picks up the change over WebSocket after the file settles.

|                   Daydream (light)                   |                   Nightswim (dark)                   |
| :--------------------------------------------------: | :--------------------------------------------------: |
| ![Buoy in Daydream mode](media/buoy-empty_light.png) | ![Buoy in Nightswim mode](media/buoy-empty_dark.png) |

## Run Buoy Locally

### Dev (hot reload on both sides) - _QUICKEST_

Two containers. Nothing to see here.

```bash
docker compose up --build
```

Then visit **<http://localhost:5173>**. Edits to `frontend/src/*` hot-reload via Vite HMR; edits to `backend/src/*` restart Node (`--watch`); edits to `data/todos.md` push to the UI via WebSocket.

### Without Docker (two terminals) - _Why would you prefer this?_

```bash
# Terminal 1
cd backend && npm install && npm run dev      # → http://localhost:3004

# Terminal 2
cd frontend && npm install && npm run dev     # → http://localhost:5173
```

### Production (one container, one port) - _IDEAL_ :)

```bash
build-prod    # fresh Docker build (--no-cache) + run → http://localhost:3004
run-prod      # run last-built image (skip rebuild)
rebuild-prod  # stop matching containers, then build and run
```

**When to use each:**
- `build-prod`: after code changes, when no production container is running.
- `run-prod`: to start the existing image again without rebuilding.
- `rebuild-prod`: after code changes, when you want to replace a running production container. It stops containers publishing host port 3004 with this repo's `data/` mounted at `/app/data`, regardless of image.

Scripts live in `bin/`. Run them from the repo root: `build-prod` and `run-prod` use the current directory for the build context and data mount. An `.envrc` adds `bin/` to your `PATH` via [direnv](https://direnv.net/) — run `direnv allow` once after cloning. Without direnv, use `./bin/build-prod` etc. All three run the container in the foreground; stop it with Ctrl+C.

The bundle is built with empty `VITE_API_URL`/`VITE_WS_URL` so it uses same-origin relative paths — works behind any reverse proxy, on any host, http or https.

## Stack at a glance

Physics: Because your to-dos need some bubbly motivation!

| Layer    | Tech                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Frontend | React 18 · Vite · matter.js (physics) · framer-motion                                  |
| Backend  | Node 20 · Express · `ws` (WebSockets) · `chokidar` (file watcher)                      |
| Storage  | a plain `todos.md` file (no real DB)                                                   |
| Dev      | `docker-compose.yml` with two containers + bind mounts                                 |
| Prod     | single multi-stage `Dockerfile` — Express serves both API and built bundle on one port |

## The data file

`data/todos.md` is plain markdown. A database as basic as a text file. Because it is.

Archived tasks and sections are stored in `data/archive.md` — the peaceful farm where completed tasks go to play in the open fields. Metadata rides in an HTML comment so it's invisible when rendered:

```markdown
# Buoy Todos

- [ ] `nvim` - Install harpoon <!-- id:a1b2c3 priority:2 created:2026-05-21T10:00:00Z description:"From the corner store" -->
- [x] Ship the bubble app <!-- id:d4e5f6 priority:0 created:2026-05-20T09:00:00Z completed:2026-05-20T18:00:00Z -->
```

You can hand-type `- [ ] something new` with no metadata — the parser tolerates the absence, and the next write fills in defaults (new id, priority 2, timestamps). Priorities run 0–4, with **P0 being the most urgent** (biggest, hottest bubble). P0 is the loudest crybaby. P4 is the least attention-seeking older child.

## Interactions

The UI shows all keybindings and is self-explanatory. Read the README if you're bored.

|                     Daydream (light)                     |                     Nightswim (dark)                     |
| :------------------------------------------------------: | :------------------------------------------------------: |
| ![Buoy with todos, light](media/buoy-example_light.png)  | ![Buoy with todos, dark](media/buoy-example_dark.png)    |

| Gesture                      | Action                             |
| ---------------------------- | ---------------------------------- |
| **Click** a bubble           | Toggle done (pop animation)        |
| **Right-click / long-press** | Open the detail overlay            |
| **Detail overlay**           | Edit or delete a todo              |
| **Drag**                     | Throw — physics resumes on release |
| **+** floating button        | Open the add-todo modal            |

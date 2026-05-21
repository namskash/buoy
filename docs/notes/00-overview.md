# 00 — Overview

## What we're building

**Buoy** is a To-Do app where each task is a floating bubble. Big bubbles (high priority) rise to the top. Hover and click reveal more info. Add new tasks via a floating `+` button. Completing a task pops the bubble with a satisfying animation.

The point of this project is **two-fold**:

1. Have a fun To-Do app to actually use.
2. Learn React + Node.js as a Rails developer, by building something real.

## The stack at a glance

| Piece          | Tech                       | Rails analogy                                     |
| -------------- | -------------------------- | ------------------------------------------------- |
| Frontend       | React + Vite               | views + Sprockets/Webpacker (but client-rendered) |
| Backend        | Node + Express             | Rails controllers + routing (but tinier)          |
| Realtime       | WebSocket (`ws`)           | ActionCable                                       |
| "Database"     | a single `todos.md` file   | (nothing — we deliberately skipped a DB)          |
| File watching  | `chokidar`                 | (nothing direct; Listen gem is close)             |
| Physics        | `matter.js` in the browser | (n/a — UX-only)                                   |
| Containerising | Docker + docker-compose    | Docker + docker-compose                           |

## Where things live

```
buoy/
├── data/todos.md          ← THE database. Edit it in any editor.
├── backend/               ← Node + Express + WebSocket server
├── frontend/              ← React + Vite app
├── docker-compose.yml     ← Runs both services together
└── docs/notes/            ← These learning notes
```

## How to run it (will be true after later milestones)

- **Dev:** `docker compose up` → app at `http://localhost:5173`.
- **Tests (backend):** `cd backend && npm test`.
- **Edit `data/todos.md` directly** in your editor — the UI updates live over WebSocket.

## Reading order for the notes

1. `00-overview.md` (you are here)
2. `02-the-md-file-as-db.md` ← we did this first because the "DB" is the bottom of everything
3. `01-node-and-express.md`
4. `06-websockets-and-live-sync.md`
5. `03-react-basics.md` → `04-hooks-and-state.md` → `05-vite-and-the-dev-server.md`
6. `07-matter-js-physics.md`
7. `08-docker-and-compose.md`
8. `09-rails-analogies.md` ← cheat sheet, dip in any time

(The numbers aren't strictly the order they're written in — they're a tidy reading order.)

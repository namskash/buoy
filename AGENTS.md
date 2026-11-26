# Buoy — agent guide

Buoy is a floating-bubble todo app. The React/Vite frontend uses matter.js for
physics; the Node/Express backend stores tasks in Markdown and syncs changes
through WebSockets.

## Where to look

- `frontend/src/` — UI, physics, API client, and todo state.
- `backend/src/` — API routes, Markdown storage and file watching, and WebSockets.
  Backend tests are in `backend/test/`.
- `docs/notes/` — architecture and interaction notes; see
  [`11-keyboard-ux-patterns.md`](docs/notes/11-keyboard-ux-patterns.md) for
  keyboard behavior.
- `docs/design_handoff_buoy/` — design reference and prototype, not production code.
- `bin/` — production build and run scripts; `media/` contains README screenshots.

## User data

`data/todos.md` is the live task database, and `data/archive.md` stores archived
tasks and sections. They are user data, not project feature documentation. Do
not modify them without the user's permission.

## Setup

- For a non-technical user, follow [`docs/NON_TECHNICAL_SETUP.md`](docs/NON_TECHNICAL_SETUP.md).
- For development and production workflows, see [`README.md`](README.md).
- After implementing a significant change, update `README.md` to reflect it.

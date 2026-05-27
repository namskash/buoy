# Buoy — Setup Instructions (for an AI agent helping a non-technical user)

You are helping someone who **does not write code** get this project running on
their own machine. Be patient, narrate what you're doing, and never assume they
already have developer tools installed. Default to the **Docker path** — it is
one command and avoids Node version mismatches.

The end state you are aiming for: the user opens a browser, types
`http://localhost:5173`, and sees the Buoy app (a canvas with floating
bubbles, or an empty-state if `data/todos.md` has no todos).

---

## Step 1 — Confirm prerequisites

Run each check yourself with the Bash tool. Do **not** ask the user to run
commands in their terminal unless a step explicitly requires it (e.g. an
interactive login). Report results in plain language.

### 1a. Is this the right folder?

```bash
ls
```

You should see `docker-compose.yml`, `backend/`, `frontend/`, `data/`,
`README.md`. If you don't, you are in the wrong directory — stop and tell the
user. Do not try to fix it by `cd`-ing around without confirming with them.

### 1b. Is Docker installed?

```bash
docker --version
```

- **If this prints a version** (e.g. `Docker version 24.0.7`): good, continue.
- **If you get `command not found`:** Docker is not installed. Tell the user:
  > "Docker isn't installed on this machine. The easiest way to install it is
  > to download **Docker Desktop** from <https://www.docker.com/products/docker-desktop>.
  > Install it, open the Docker Desktop app at least once so it finishes setup,
  > then come back and tell me you're ready."
  >
  > Then stop and wait. Do not try to install Docker yourself with `brew`,
  > `apt`, or any package manager — installing system software is a decision
  > for the user.

### 1c. Is Docker Desktop actually running?

```bash
docker info
```

- **If this prints engine info:** Docker is running, continue.
- **If it errors with "Cannot connect to the Docker daemon" or similar:**
  Docker is installed but not started. Tell the user:
  > "Docker is installed but the Docker Desktop app isn't running. Please open
  > **Docker Desktop** from your Applications (Mac) or Start Menu (Windows),
  > wait until the whale icon in your menu bar / system tray stops animating,
  > then tell me you're ready."
  >
  > Then stop and wait.

### 1d. Is `docker compose` available?

```bash
docker compose version
```

- **If this prints a version** (e.g. `Docker Compose version v2.24.0`): good.
  Use the **`docker compose`** (two words) form throughout — that's the
  modern version bundled with Docker Desktop.
- **If `docker compose` errors but `docker-compose --version` (one word, with
  hyphen) works:** they have the legacy standalone version. It still works.
  Substitute `docker-compose` for `docker compose` in every command below and
  tell the user this is fine, just an older form.
- **If neither works:** their Docker install is incomplete. Tell them to
  reinstall Docker Desktop (it bundles compose).

### 1e. Is port 5173 free?

```bash
lsof -i :5173 -sTCP:LISTEN
```

- **No output:** port is free, continue.
- **Output showing a process:** something is already using port 5173. Tell the
  user what's holding it (the process name from the output) and ask whether
  they want to stop that process or skip running Buoy for now. Do **not**
  kill processes without explicit permission.

Do the same check for port `3004` (the backend port).

---

## Step 2 — Start the app

Once the checks above all pass:

```bash
docker compose up --build
```

Run this as a **background task** (so you can keep talking to the user while
it runs). Monitor the output for these signals:

- ✅ Lines like `frontend-1  | VITE v... ready in ... ms` and
  `backend-1   | Server listening on http://localhost:3004` mean it worked.
- ❌ `Error response from daemon: ... port is already allocated` → see Step 1e.
- ❌ `Cannot connect to the Docker daemon` → see Step 1c.
- ❌ `no such file or directory` for `docker-compose.yml` → wrong folder, Step 1a.

When you see the ready lines, tell the user:

> "Buoy is running. Open your browser and go to **http://localhost:5173**.
> You should see the bubble canvas. Try clicking the **+** button at the
> bottom-right to add a todo — each one becomes a floating bubble."

---

## Step 3 — Day-to-day use

Once it's running, the user mostly doesn't need you. Things they might ask
about:

- **"Where are my todos saved?"** → In the file `data/todos.md` inside this
  project folder. It's plain text — they can open it in any text editor
  (TextEdit on Mac, Notepad on Windows) and edits will appear in the app
  within a second.
- **"How do I stop it?"** → If the `docker compose up` task is still running,
  use `TaskStop` to end it. Or tell them to press `Ctrl+C` in the terminal
  window where it's running. To fully clean up containers afterward, run
  `docker compose down`.
- **"How do I start it again later?"** → Just `docker compose up` (no
  `--build` needed unless code changed). Or `docker compose up --build` to be
  safe.
- **"It says port 5173 is in use"** → see Step 1e.

---

## Things to NOT do

- ❌ Do not modify `data/todos.md` yourself unless the user explicitly asks.
  That file contains their real todos.
- ❌ Do not run `git` commands on their behalf — they own version control
  decisions.
- ❌ Do not install Docker / Homebrew / Node / anything system-level. Always
  hand that decision back to the user.
- ❌ Do not `docker system prune`, `docker rm`, or any cleanup command
  without explicit permission — these can delete other projects' data.
- ❌ Do not skip the prerequisite checks in Step 1 even if the user says
  "just run it" — Docker not being installed or running is the #1 reason
  this fails, and silently retrying is more confusing than checking once.

---

## If you get stuck

Tell the user the literal error message and which command produced it, then
stop and wait for their direction. Don't loop on failed commands.

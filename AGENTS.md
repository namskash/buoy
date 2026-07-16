# AGENTS.md

If you are an AI coding agent (Claude Code, Copilot CLI, Cursor agent, etc.)
helping a **non-technical user** set up or run this project, **read
[`docs/NON_TECHNICAL_SETUP.md`](docs/NON_TECHNICAL_SETUP.md) first** and
follow it step by step.

That file tells you how to:

- Verify the user has Docker and Docker Compose installed and running.
- Check that the required ports are free.
- Start the app, monitor for the "ready" signals, and report success in
  plain language.
- Avoid common destructive mistakes (modifying user data, installing system
  software without permission, etc.).

For technical contributors, the regular [`README.md`](README.md) at the repo
root is the right entry point — it covers the dev and prod workflows
directly.

## Scripts (`bin/`)

| Command      | What it does                                        |
| ------------ | --------------------------------------------------- |
| `prod-build` | `docker build --no-cache -t buoy:prod .` then runs  |
| `prod-run`   | Runs the last-built `buoy:prod` image               |

A `.envrc` at the repo root adds `bin/` to `PATH` via direnv (`direnv allow`
once after clone). Without direnv use `./bin/<script>`.

# 02 — The `.md` file as a database

## Why a Markdown file at all?

A real DB (Postgres, SQLite) would be more "correct", but it would hide what's happening behind ORM magic. The whole point of Buoy is that you can:

- Open `data/todos.md` in any text editor.
- Type `- [ ] something I just thought of`.
- Save the file.
- Watch the bubble appear in the UI within milliseconds.

That magic only works if **the file itself is the source of truth**. The Node server is a thin layer that reads/writes that file.

## The format

```
# Buoy Todos

- [ ] Buy milk <!-- id:a1b2c3 priority:2 created:2026-05-21T10:00:00Z -->
- [x] Ship PR  <!-- id:d4e5f6 priority:0 created:2026-05-20T09:00:00Z completed:2026-05-20T18:00:00Z -->
```

Two ideas to notice:

1. **The visible part is plain checkbox markdown.** It renders nicely on GitHub. A human reader gets `[ ]` for "todo" and `[x]` for "done", same as anywhere else.
2. **Metadata lives in an HTML comment** at the end of the line. Markdown renderers hide HTML comments, so the file still looks clean. But our parser can still read fields like `priority` and `created`.

## Why HTML-comment metadata vs. inline?

We considered things like `- [ ] (P2) Buy milk` to encode priority. Three problems with that:

- It's noisy for human readers.
- We'd reinvent a mini-syntax for every new field (timestamps, descriptions...).
- Editing the markdown in another tool would risk mangling our syntax.

HTML comments solve all three: invisible when rendered, structured (`key:value`), and any tool that doesn't understand them will just leave them alone.

## What "hand-typed tasks" means

If you type a bare line like `- [ ] new idea` into the file, the parser still recognises it as a task (just with no metadata). On the **next** time the app writes the file, it fills in `id`, `priority` (defaults to 2 — the middle of the 0–4 range, where 0 = highest urgency), and `created` for that task — so the file becomes self-healing.

## The two scariest words: race conditions

A file is not a database. Two requests writing at the same time can clobber each other:

```
Request A reads the file        ┐
Request B reads the file        │ both see the same starting state
Request A modifies + writes     │
Request B modifies + writes  ←──┘ overwrites A's change
```

We defend against this with a **serial write queue** in `store.js`:

```js
let writeChain = Promise.resolve();
function enqueue(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}
```

Every mutating op (`create`, `update`, `remove`) goes through `enqueue()`. The chain guarantees they run one after another — read-modify-write is now atomic *within this Node process*.

(Two Node processes could still fight, but we only run one. If we ever needed multi-process safety, we'd need OS-level file locks — out of scope.)

## The "echo loop" problem

We watch `todos.md` for external changes (in the next milestone). But every time the server writes to the file, chokidar also fires a "file changed" event. Without protection, that would trigger a re-broadcast of the new state to the UI, which already has it — annoying, but worse, it could loop.

Fix: the store records `lastWriteAt = Date.now()` after every write. The watcher calls `store.wasJustWritten()` and bails out if the write was recent (last 250ms). External edits (which won't be within that window of an API write) still go through.

## What's in this milestone

```
backend/src/store/
├── parser.js       ← text → in-memory list of {kind: 'task' | 'raw'}
├── serializer.js   ← reverse
├── store.js        ← read / create / update / remove, plus the write queue
└── watcher.js      ← chokidar wrapper (used by next milestone)
backend/test/
├── parser.test.js  ← round-trip, metadata, quoted descriptions, passthrough lines
└── store.test.js   ← create/update/remove, defaults, 20 concurrent writes
```

15 tests, all green. Crucially, one of them fires 20 `create()` calls in parallel and verifies all 20 land — that's the proof the write queue actually works.

## Rails analogy

This whole layer is what a Rails app gets "for free" from `ActiveRecord` + a database driver: parsing, defaults, atomic writes, persistence. We had to build it by hand because we picked a file as the DB. It's about 100 lines of code total — which is a fun reminder of how much you actually depend on Rails doing all this for you.

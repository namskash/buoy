# 01 — Node + Express

## Node.js, in one paragraph

Node is a JavaScript runtime. It takes the V8 engine (the same one Chrome uses) and bolts on access to the filesystem, network, processes, etc., so JS can run as a server-side language. There's no built-in web framework — `node server.js` just runs your file. If you want an HTTP server, you import `http` from the standard library and write request handlers by hand, like Sinatra without sugar.

**Rails analogy:** Node ≈ Ruby (the language + runtime). Express ≈ a slimmer-than-Sinatra micro-framework on top.

## What Express adds

Express gives you three things over raw `http`:

1. **Routing.** `app.get('/api/todos', handler)` instead of `if (req.url === '/api/todos' && req.method === 'GET') { ... }`.
2. **Middleware.** A pipeline of functions every request flows through (CORS, JSON parsing, auth, etc.). Rails Rack middleware is the exact analogy.
3. **A response API.** `res.json({...})`, `res.status(404).end()` — sugar over manually setting headers and writing to the socket.

That's roughly it. Express is intentionally tiny. Anything bigger (templating, sessions, ORM) is opt-in via separate packages.

## Anatomy of our backend

```
backend/src/
├── server.js          ← entrypoint: boot store, build app, call listen()
├── app.js             ← createApp({ store }) → an Express app (testable)
├── routes/todos.js    ← createTodosRouter({ store }) → an Express Router
└── store/             ← from milestone 1
```

### Why separate `server.js` and `app.js`?

If `server.js` *both* built the app *and* called `listen()`, our tests would have to bind a real port to test routes — flaky and slow. By splitting them, tests can mount the Express app directly via `supertest` and skip the network entirely.

```js
// app.js — pure factory, no side effects
export function createApp({ store }) {
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter({ store }));
  return app;
}

// server.js — the side-effecty entrypoint
const app = createApp({ store });
app.listen(PORT);
```

**Rails analogy:** `app.js` is your Rails app object; `server.js` is the equivalent of `bin/rails server` actually binding a port.

## Reading a route handler

```js
router.post('/', async (req, res, next) => {
  try {
    const { title, priority, description } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    const created = await store.create({ title: title.trim(), priority, description });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
```

A few things to notice:

- **`req.body` is only populated because `express.json()` middleware is registered.** Without it, Express doesn't parse request bodies for you.
- **`next(err)`** is how you forward an error to Express's error handler. Without it, an uncaught throw inside an async handler would just hang the request (unlike Rails, where the framework rescues for you).
- **`return res.status(400)...`** — you `return` to short-circuit, otherwise the function keeps running.

## Middleware: the pipeline

In `app.js`:

```js
app.use(cors());                              // 1. CORS headers
app.use(express.json());                      // 2. parse JSON bodies
app.use('/api/todos', createTodosRouter(...)); // 3. our routes
app.use((req, res) => res.status(404).json(...)); // 4. fallthrough 404
app.use((err, req, res, next) => ...);        // 5. error handler (4 args!)
```

Requests flow top-to-bottom. Each middleware either responds (ending the flow) or calls `next()` (passing control to the next one). The error handler is special: Express recognises the **4-argument signature** as "this is the error handler" and only routes errors to it.

**Rails analogy:** identical mental model to Rack middleware in `config/application.rb`.

## CORS in one minute

In dev, the React app runs at `http://localhost:5173` (Vite) and the API runs at `http://localhost:3004` (Express). Different origins. Browsers block cross-origin requests by default unless the server explicitly opts in via `Access-Control-Allow-Origin` headers.

`app.use(cors())` adds those headers — with default settings (`*`, allow all). In production we'll merge everything onto one port, so CORS will be moot.

## The endpoints we built

| Method | Path             | Body                                            | Response                |
| ------ | ---------------- | ----------------------------------------------- | ----------------------- |
| GET    | `/api/health`    | —                                               | `{ ok: true }`          |
| GET    | `/api/todos`     | —                                               | `[Todo, ...]`           |
| POST   | `/api/todos`     | `{ title, priority?, description? }`            | `201` + the new todo    |
| PATCH  | `/api/todos/:id` | any subset of `{ title, priority, description, done }` | the updated todo |
| DELETE | `/api/todos/:id` | —                                               | `204` (no content)      |

Validation is minimal on purpose: title required, everything else optional and clamped/defaulted by the store. Unknown id → `404`. Any other error → `500` with the message in JSON.

## Running it

```bash
cd backend
npm run dev    # node --watch src/server.js (auto-restart on save)
# or
npm start      # plain node
```

Smoke test:

```bash
curl http://localhost:3004/api/todos
curl -X POST http://localhost:3004/api/todos -H 'content-type: application/json' \
  -d '{"title":"hi","priority":3}'
```

## Tests

`backend/test/routes.test.js` uses [supertest](https://www.npmjs.com/package/supertest), which is the Node-world equivalent of `rspec-rails`'s request specs: it takes the Express app, fakes an HTTP request, and gives you a response object to assert on. No real port needed.

```js
const res = await request(app).post('/api/todos').send({ title: 'X' });
expect(res.status).toBe(201);
```

Total tests after this milestone: **24 (parser 8 + store 7 + routes 9)**.

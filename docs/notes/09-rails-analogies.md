# 09 — Rails ⇆ React/Node cheat-sheet

A flat lookup table for the Rails developer who built Buoy. Every row maps a Rails-world concept to its closest Node/React equivalent and points at where in this repo it lives. Some rows have **no equivalent on one side** — that's information too.

> Conventions: "≈" means "plays roughly the same role" (not "behaves identically"). Where Buoy doesn't use a thing, the cell still names the standard tool so you know what to reach for.

## The big table

| Rails / Ruby world                       | React / Node world                                  | In Buoy                                            |
|------------------------------------------|-----------------------------------------------------|----------------------------------------------------|
| **Language & runtime**                   |                                                     |                                                    |
| `ruby` (interpreter)                     | `node` (V8 runtime, single-threaded event loop)     | `node src/server.js`                               |
| `irb` / `rails console`                  | `node` REPL, `node --inspect` for debugger          | —                                                  |
| **Packages**                             |                                                     |                                                    |
| `Gemfile`                                | `package.json` (`dependencies` + `devDependencies`) | `backend/package.json`, `frontend/package.json`    |
| `Gemfile.lock`                           | `package-lock.json` (or `yarn.lock`, `pnpm-lock`)   | committed alongside each `package.json`            |
| `bundle install`                         | `npm install` (lockfile-friendly: `npm ci`)         | `npm ci` in Dockerfiles                            |
| `bundle exec foo`                        | `npx foo` or `npm run foo`                          | `npm run dev`, `npm test`                          |
| RubyGems registry                        | npm registry                                        | `chokidar`, `ws`, `react`, `vite`, etc.            |
| **App framework**                        |                                                     |                                                    |
| Rails (full-stack)                       | No single framework. Express + your own React app   | `backend/src/app.js` + `frontend/src/App.jsx`      |
| Sinatra (micro)                          | **Express** (closest analogue)                      | `backend/src/app.js`                               |
| `config/application.rb`, initializers    | `server.js` (the file you boot)                     | `backend/src/server.js`                            |
| Rack                                     | Express's `(req, res, next)` middleware             | `app.use(cors())`, `app.use(express.json())`       |
| `config/routes.rb`                       | `app.get/post/...` calls + `Router`                 | `backend/src/routes/todos.js`                      |
| `before_action`                          | middleware that calls `next()` (or `next(err)`)     | none beyond cors/json                              |
| `ActionController` action                | Express route handler `(req, res, next) => …`       | `routes/todos.js` (GET/POST/PATCH/DELETE)          |
| **Data layer**                           |                                                     |                                                    |
| ActiveRecord                             | No standard. Roll your own, or use Prisma/Knex/TypeORM | hand-rolled `store/` (file-as-DB)                  |
| ActiveRecord migrations                  | Prisma migrations / Knex migrations / —             | none — the schema is "lines of markdown"           |
| ActiveModel validations                  | Zod, Joi, Yup, or hand-coded                        | hand-coded in `routes/todos.js` (title required)   |
| Database adapter                         | `pg`, `mysql2`, `sqlite3`, or in our case `node:fs` | `backend/src/store/store.js` (fs.readFile/writeFile) |
| `ActionCable` (WebSockets)               | `ws` library + your own broadcast hub               | `backend/src/ws.js`                                |
| **Views**                                |                                                     |                                                    |
| ERB / Haml / Slim templates              | JSX (`.jsx` files)                                  | `frontend/src/**/*.jsx`                            |
| Helpers (`app/helpers/*.rb`)             | plain JS functions imported into components         | `frontend/src/api.js` etc.                         |
| Partials (`_card.html.erb`)              | React components                                    | `Bubble`, `AddTodoModal`, `DetailOverlay`           |
| `instance variables → view` flow         | props + state passed into JSX                       | `<BubbleCanvas todos={activeTodos} />`             |
| `content_for(:head)`                     | edit `index.html` directly, or `react-helmet`       | `frontend/index.html`                              |
| Layouts (`application.html.erb`)         | The single root in `App.jsx` + `index.html`         | `frontend/src/App.jsx`                             |
| **Frontend assets**                      |                                                     |                                                    |
| Asset pipeline / Sprockets / propshaft   | **Vite** (esbuild + Rollup under the hood)          | `frontend/vite.config.js`                          |
| `assets:precompile`                      | `vite build` → `dist/`                              | stage 1 of the prod `Dockerfile`                   |
| Importmaps / Webpacker                   | ES modules + Vite                                   | every `import` in `frontend/src/`                  |
| Tailwind / Sass                          | plain CSS, CSS-in-JS, Tailwind                      | plain CSS in `frontend/src/styles.css`             |
| **State, hooks, lifecycle**              |                                                     |                                                    |
| Stimulus controllers                     | React components + hooks                            | `Bubble` etc.                                      |
| `connect()` / `disconnect()` in Stimulus | `useEffect(() => …, [])` and its cleanup return     | `BubbleCanvas` (matter.js setup), `useTodos` (WS)  |
| Instance variables on a controller       | `useState` / `useRef`                               | `useTodos.js`                                      |
| Memoization (`@x ||= …`)                 | `useMemo` / `useCallback`                           | `activeTodos`, `detailTodo` in `App.jsx`           |
| Concerns (mix-in modules)                | Custom hooks (`use*`)                               | `useTodos`                                         |
| **Real-time**                            |                                                     |                                                    |
| Action Cable channel                     | `ws.WebSocketServer` + a broadcast helper           | `backend/src/ws.js`                                |
| Subscriber in JS via `@rails/actioncable`| native `new WebSocket(url)` in the browser          | `frontend/src/useTodos.js`                         |
| Turbo Streams                            | bespoke `{ type: "todos:changed", todos: [...] }`   | `wsHub.broadcast(...)`                             |
| **Background work**                      |                                                     |                                                    |
| Sidekiq / GoodJob / ActiveJob            | BullMQ / Bee-Queue, or a worker thread              | none — Buoy is single-process                       |
| File-system watcher (`Listen`)           | **chokidar**                                        | `backend/src/store/watcher.js`                     |
| **Tests**                                |                                                     |                                                    |
| RSpec                                    | **Vitest** (Jest-compatible API)                    | `backend/test/*.test.js`                           |
| `let`, `subject`, `describe`             | `describe`, `it`, `beforeEach`, `vi.fn()`           | all test files                                     |
| Request specs (`get '/path'`)            | **supertest** (`request(app).get('/path')`)         | `backend/test/routes.test.js`                      |
| Capybara / system specs                  | Playwright / Cypress                                | manual via the running app                         |
| Factories (`FactoryBot`)                 | plain JS object literals / `@faker-js/faker`        | inline literals                                    |
| **Config & env**                         |                                                     |                                                    |
| `Rails.env`                              | `process.env.NODE_ENV`                              | set to `production` in the prod Dockerfile         |
| `config/credentials.yml.enc`             | `.env` files (Vite: `.env`, `.env.development`)     | `frontend/.env.development`                        |
| `ENV['DATABASE_URL']`                    | `process.env.DATABASE_URL`                          | `process.env.TODOS_FILE`, `STATIC_DIR`, `PORT`     |
| **Errors & logs**                        |                                                     |                                                    |
| `rescue_from` in controllers             | Express error middleware `(err, req, res, next)`    | `backend/src/app.js` (last `app.use`)              |
| `Rails.logger.info`                      | `console.log` (or pino/winston for serious apps)    | `console.log` in `server.js`                       |
| **Dev server & deploy**                  |                                                     |                                                    |
| `rails server` (puma)                    | `node src/server.js` (the dev script wraps in `--watch`) | `npm run dev` in `backend/`                       |
| `bin/dev` + Foreman + Procfile           | `docker compose up`                                 | `docker-compose.yml`                               |
| Puma serving everything                  | Express serving both `/api/*` and the bundle        | `staticDir` branch in `backend/src/app.js`         |
| Capistrano / Kamal                       | `docker build && docker push` to a registry         | `Dockerfile` (multi-stage) at the repo root        |
| **Naming & style**                       |                                                     |                                                    |
| `snake_case_methods`                     | `camelCaseFunctions`, `PascalCaseComponents`        | `useTodos`, `BubbleCanvas`, `createStore`          |
| `lib/` directory                         | anywhere — no convention; we use `src/`             | `backend/src/`, `frontend/src/`                    |
| **Time & dates**                         |                                                     |                                                    |
| `Time.zone.now`                          | `new Date()`, `new Date().toISOString()`            | `created` / `completed` timestamps                  |
| `Time.iso8601(s)`                        | `new Date(s)`                                        | parsing on display                                 |

## A few things that don't translate cleanly

- **Convention over configuration.** Rails answers "where does code go?" for you. Node + React do not — every Buoy file lives where I decided to put it, not where a generator put it. The plus side: less magic. The minus side: more bikeshedding.
- **The model layer.** ActiveRecord folds schema, validations, persistence, and query DSL into one object. The JS world keeps these separate: `pg` for the connection, Prisma/Drizzle/Knex for the query builder, Zod for validation, your own classes for behavior. Buoy ducks the question entirely by using a file.
- **Strong parameters.** No equivalent. Either roll your own `pick` (`const { title, priority } = req.body`) or use a schema validator. Buoy just destructures.
- **CSRF tokens for forms.** React apps usually talk JSON over `fetch`, so the Rails default of an HTML form posting with a CSRF token doesn't apply. If we needed protection here we'd use SameSite cookies + a token header.
- **The single-threaded event loop.** Ruby with Puma forks workers; Node is one process. A long CPU-bound task blocks the whole server. For Buoy it doesn't matter (everything is I/O), but it changes how you'd structure heavier work — worker threads or a separate queue process instead of "another puma worker."
- **Hot reload model.** Rails reloads classes on file change inside the same process. Node's `--watch` flag instead **restarts** the process. Vite's HMR for the frontend is closer to Rails' reload — it swaps individual modules in a running browser without losing state.

## When to reach for what

| Rails reflex                          | Node/React reach                                  |
|---------------------------------------|---------------------------------------------------|
| "I need a model" → `rails g model`    | decide: store layer? validator? both? — then write small files |
| "I need a controller" → `rails g controller` | `router.get('/path', handler)` in a new or existing routes file |
| "I need a view" → `app/views/...`     | a new React component file; import where used     |
| "I need a partial"                    | extract a sub-component, pass props               |
| "I need a job"                        | spawn a worker (not needed in Buoy)               |
| "I need to broadcast"                 | `wsHub.broadcast({ type, ... })`                  |
| "I need a helper"                     | a plain function in `src/utils.js`                |
| "I need to validate"                  | check the field, return 422 from the route        |

The recurring shift: Rails gives you a **slot** and a **generator**. Node/React give you a **blank file** and the freedom (curse) to name it whatever you want. The trade-off Rails developers feel most is having to invent layout and naming conventions that Rails would have decided for them — but the payoff is that nothing is hidden behind ten generations of `method_missing` magic.

## Aside: Jetpack Compose, for the Android-curious

React and Jetpack Compose share an ancestry (both inspired by declarative UI ideas from Elm/SwiftUI/etc.), so the core mental model ports almost directly:

| React / Buoy                      | Jetpack Compose                                             |
| --------------------------------- | ----------------------------------------------------------- |
| Component (function returning JSX)| `@Composable fun Foo(...)` (returns Unit, emits UI)         |
| Re-render on state change         | **Recomposition** (Compose re-invokes the function)         |
| `useState`                        | `remember { mutableStateOf(...) }`                          |
| `useRef`                          | `remember { ... }` (un-observed box)                        |
| `useEffect(fn, [deps])`           | `LaunchedEffect(deps) { ... }` / `DisposableEffect`         |
| `useCallback` / `useMemo`         | `remember(key) { ... }`                                     |
| Props                             | Function parameters                                         |
| `<AnimatePresence>` + `exit`      | `AnimatedVisibility(visible) { ... }`                       |
| `framer-motion` spring transition | `spring(stiffness, dampingRatio)` in `animate*AsState`      |
| Custom hook (`useTodos`)          | Composable that returns state, or a `ViewModel` + `collectAsState` |

The biggest delta is **where long-lived state lives**: React leans on custom hooks; Compose tends to push that into a `ViewModel` (survives configuration changes) exposed as `StateFlow`/`State`. But within a single screen, `remember { mutableStateOf(...) }` and `useState` are the same idea.

---

That's the tour. Re-read [00-overview.md](00-overview.md) and you'll see the same map from the other direction: this time the Rails columns of the table should read like the right side of your brain saying "ahh, that one."

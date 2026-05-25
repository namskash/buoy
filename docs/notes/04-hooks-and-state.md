# 04 — Hooks and state

## The model in one sentence

**State is the truth. UI is derived.** When state changes, React re-runs your component, which produces new JSX, which React reconciles with the DOM.

You never poke the DOM directly. You change state. The UI follows.

## `useState`

```js
const [title, setTitle] = useState('');
```

- Returns a 2-tuple: the current value and a setter.
- The setter triggers a re-render. The next call to `useState('')` (in the next render) returns the *new* value, not the initial one.
- The initial value `''` is only used the first time.
- Calling `setTitle('new')` schedules a re-render — it doesn't change `title` immediately. Treat `title` as **read-only within the current render**.

```js
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Rails analogy:** there isn't really one — Rails view rendering is one-shot per request. The closest thing is Stimulus controllers, which keep state in instance variables. React's `useState` is similar, but the *re-render after change* is the magic.

## `useEffect`

```js
useEffect(() => {
  // runs AFTER render
  doSomething();
  return () => {
    // optional cleanup, runs BEFORE the next effect or on unmount
    undoSomething();
  };
}, [dep1, dep2]);
```

- Effect = anything that touches the world outside React's render output (network, timers, subscriptions, DOM APIs).
- The **dependency array** tells React when to re-run: pass `[]` for "only on mount", `[x, y]` for "when x or y changes", omit it for "every render" (almost never what you want).
- The optional **cleanup function** is React's hook for "undo what you set up". Crucial for websockets, intervals, event listeners.

Our `useTodos`:

```js
// One-time REST load.
useEffect(() => { refresh(); }, [refresh]);

// Long-lived WebSocket — cleans up on unmount.
useEffect(() => {
  let cancelled = false;
  function connect() {
    if (cancelled) return;
    const ws = new WebSocket(WS_URL);
    // ... set up handlers ...
  }
  connect();
  return () => { cancelled = true; wsRef.current?.close(); };
}, []);
```

The `cancelled` flag inside the closure prevents the backoff timer from reconnecting after the component has unmounted — a classic gotcha.

## React StrictMode and double-invoked effects

In dev, React's `<StrictMode>` (we use it in `main.jsx`) intentionally **mounts → unmounts → re-mounts** every component on first render. This means every `useEffect` runs *twice* in development. It's a stress test: if your effect doesn't clean up properly, you'll see the bug immediately (two WebSocket connections, two timers, etc.) instead of in production.

This is why our WS effect uses the `cancelled` flag and `wsRef.current?.close()` in cleanup. Without it, StrictMode would leave a leaked socket every time the component mounted.

## `useRef`

```js
const wsRef = useRef(null);
wsRef.current = someSocket;
```

`useRef` gives you a mutable container that **persists across renders without triggering re-renders**. Useful for:
- Holding non-rendering values (a WebSocket instance, a timer id, a matter.js engine reference).
- Pointing to a DOM node (`<canvas ref={canvasRef} />`).

If you change `state`, React re-renders. If you change `ref.current`, nothing happens — you just remember a value. That's exactly what we want for the WS instance, since the socket itself doesn't change what we render.

## `useCallback`

```js
const refresh = useCallback(async () => { ... }, []);
```

`useCallback` returns the **same function reference** across renders (as long as the dependency array doesn't change). Without it, a new function object is created every render, which can:
- Break `useEffect` dep arrays that include the function (causing infinite loops).
- Defeat memoization in child components.

In `useTodos` we use `useCallback` for `refresh`, `add`, `toggle`, `remove` so callers can include them in their dep arrays safely.

## Custom hooks: why bother

A **custom hook** is just a function whose name starts with `use` and which calls other hooks inside it. That's the only convention. The win is encapsulation: complex stateful logic lives in one place, with a clean public API.

Compare:

```jsx
// Without a custom hook — App.jsx would balloon to 100+ lines:
function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  useEffect(() => { /* fetch */ }, []);
  useEffect(() => { /* websocket */ }, []);
  // ... 50 more lines ...
  return ( <div>...</div> );
}
```

```jsx
// With a custom hook — App.jsx is now about logic ABOUT TO-DOS, not state plumbing:
function App() {
  const { todos, loading, error, connected, add, toggle, remove } = useTodos();
  // ... just the rendering and form logic ...
}
```

Same as Rails: extract a complicated controller into a service object so the controller can focus on coordination. Same instinct, different syntax.

## State recap

| Need                          | Hook         | Re-renders on change?         |
| ----------------------------- | ------------ | ----------------------------- |
| Value that drives UI          | `useState`   | Yes                           |
| Side effect / subscription    | `useEffect`  | (the effect re-runs, not the component) |
| Persistent non-UI value       | `useRef`     | No                            |
| Stable function reference     | `useCallback`| (it's about identity, not re-rendering) |

If you're tempted to reach for one of the rarer hooks (`useMemo`, `useReducer`, `useImperativeHandle`, `useLayoutEffect`), you almost certainly don't need it yet. Start with the four above.

> **Jetpack Compose parallel:** the same four primitives exist with different names.
>
> | React                  | Compose                                                 |
> | ---------------------- | ------------------------------------------------------- |
> | `useState`             | `remember { mutableStateOf(...) }` (or `by` delegate)   |
> | `useEffect`            | `LaunchedEffect(key)` / `DisposableEffect(key)` (cleanup via `onDispose`) |
> | `useRef`               | `remember { ... }` (a plain box, not observed)          |
> | `useCallback`          | `remember(key) { { ... } }` for a stable lambda         |
> | `useMemo`              | `remember(key) { compute() }`                           |
>
> The dependency-array idea shows up as the **keys** passed to `remember` / `LaunchedEffect`: change a key, the block re-runs (and the old effect's `onDispose` fires). Same mental model as `useEffect`'s `[dep1, dep2]`.

## What "controlled inputs" means

```jsx
<input value={title} onChange={(e) => setTitle(e.target.value)} />
```

The input's value is **derived from state**, not from what the user typed. Every keystroke fires `onChange`, which calls `setTitle`, which re-renders, which sets `value` to the new string. The input never holds its own value — it always reflects state.

This sounds laborious but it means: any time you want to clear the input, you call `setTitle('')`. Any time you want to validate, you read `title`. There's one source of truth.

Rails form helpers do something similar server-side (`@user.name`); the React version is just doing it on the client per-keystroke.

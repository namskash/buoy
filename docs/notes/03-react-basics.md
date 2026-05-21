# 03 — React basics

## The one-sentence version

A React component is a JavaScript function that returns markup (JSX). When the data it depends on changes, React re-runs the function and patches the DOM to match the new output.

That's the whole game. Everything else is implementation detail.

## JSX, briefly

```jsx
function Hello({ name }) {
  return <h1>Hello, {name}!</h1>;
}
```

- `<h1>...</h1>` is **JSX** — looks like HTML, is actually JavaScript. Vite (via Babel) compiles it to `React.createElement('h1', null, 'Hello, ', name, '!')`.
- `{name}` interpolates a JS expression. Anything between `{}` is JS.
- `{ name }` in the function signature is **destructuring props** — the parent calls `<Hello name="Naman" />` and React calls your function with `{ name: 'Naman' }`.

**Rails analogy:** A React component is partial + the helper that builds the data for that partial, mashed into one thing.

```erb
<%# Rails partial _todo.html.erb %>
<li class="<%= 'done' if todo.done? %>"><%= todo.title %></li>
```

```jsx
// Equivalent React
function TodoItem({ todo }) {
  return <li className={todo.done ? 'done' : ''}>{todo.title}</li>;
}
```

A few cosmetic differences:
- `className` instead of `class` (because `class` is a reserved word in JS).
- `htmlFor` instead of `for` on labels (same reason).
- Inline event handlers are camelCase (`onClick`, `onChange`), not lowercase.
- Style is an object: `style={{ color: 'red' }}` (two braces: outer JSX `{...}`, inner JS object).

## Composition

Components are functions, so you compose them like functions — by calling them with different props:

```jsx
function App() {
  return (
    <div>
      <Hello name="Naman" />
      <Hello name="World" />
    </div>
  );
}
```

A React app is just one root component (in our case, `App`) that renders other components, which render other components, all the way down.

## The render loop

This is the part that trips up people coming from Rails (or jQuery, or backbone):

1. React renders your component → produces JSX → React reconciles with the DOM.
2. Something changes (state, props).
3. React calls your component function **again** with the new data.
4. It diffs the new output against the old DOM and only patches what changed.

So **your component function will run many times**. Every variable inside it is recreated on each run. That's fine; React is smart about not throwing away DOM. But it means:

- Don't put `console.log` calls inside the render body and expect them once. (They fire on every render.)
- Don't mutate things across renders — store cross-render data in `useState` or `useRef`.

## Our `App.jsx`

```jsx
export default function App() {
  const { todos, loading, error, connected, add, toggle, remove } = useTodos();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(3);

  function onSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    add({ title: title.trim(), priority });
    setTitle('');
    setPriority(3);
  }

  // ... JSX with the form, the list, etc.
}
```

Two state pieces (`title`, `priority`) for the form. Everything else (the todos themselves, loading flag, connection status, mutating functions) comes from `useTodos()`, our custom hook. **All the messy stuff is hidden behind that one hook.** This is the React idiom.

When you type in the input, `setTitle(e.target.value)` updates state, which re-renders `App`, which re-reads `title` from state, which sets the input's value. Two-way binding via one-way data flow.

## What we're NOT using

The React ecosystem is huge. We're skipping all of it:

- No Redux/MobX/Zustand — `useState` is plenty.
- No React Router — single page.
- No `useReducer` — no need yet.
- No Suspense, no Server Components — overkill.
- No TypeScript — easier to learn one thing at a time.

This is a feature. Start with plain React + hooks, add tools when you actually need them.

## Mental model summary

| Coming from Rails              | React equivalent                              |
| ------------------------------ | --------------------------------------------- |
| View (`.erb`)                  | Component (`.jsx`)                            |
| Partial                        | Component                                     |
| Instance variables in controller | Props passed to a component                 |
| Form helpers (`form_for`)      | Controlled inputs (`value` + `onChange`)       |
| `data-` attributes + JS handlers | Just write `onClick={fn}`                   |
| ERB `<%= %>` interpolation     | JSX `{}` interpolation                        |
| Server-rendered → static page  | Client-rendered → page that re-renders on data change |

The biggest mental shift: in Rails you think about pages (request → render once → done). In React you think about UI as a function of state (data → render → data changes → re-render → repeat).

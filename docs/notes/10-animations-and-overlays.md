# 10 — Animations and overlays (framer-motion)

## What framer-motion gives us

[framer-motion](https://www.framer.com/motion/) is a React animation library. Instead of writing CSS keyframes or imperatively poking the DOM, you describe *what state the element should be in* and let the library handle the interpolation:

```jsx
<motion.div
  initial={{ scale: 0, opacity: 0 }}     // start state
  animate={{ scale: 1, opacity: 1 }}     // current state
  exit={{ scale: 0, opacity: 0 }}        // state on unmount
  transition={{ type: 'spring' }}
/>
```

When the component mounts, it animates from `initial` → `animate`. When you change `animate`, it animates to the new values. When the component unmounts (and is inside `<AnimatePresence>`), it animates `animate` → `exit` before being removed from the DOM.

That last bit — **animating an element on its way out** — is the magic. Without something like framer-motion, by the time React calls `removeChild`, the DOM node is already gone — there's no chance to fade.

## How we wired it into Buoy

### Two-layer bubble structure

The matter.js notes mention we render bubbles as nested elements:

```jsx
<div className="bubble-wrapper">       {/* matter.js writes transform here */}
  <motion.div className="bubble" ...>  {/* framer-motion animates scale/opacity */}
    <span>{title}</span>
  </motion.div>
</div>
```

This split is the *whole reason* the pop animation works. matter.js owns the wrapper's position via `transform: translate3d(...)`. framer-motion owns the inner bubble's scale and opacity. Neither steps on the other.

If we'd put everything on a single element, the moment framer-motion set `transform: scale(1.3)`, matter.js's `transform: translate3d(...)` would have overwritten it on the next frame.

### Pop on complete

```jsx
<motion.div
  exit={{
    scale: [1, 1.3, 0],
    opacity: [1, 1, 0],
    transition: { duration: 0.5, times: [0, 0.35, 1] },
  }}
>
```

When a bubble's id leaves the `todos` array, `AnimatePresence` plays this exit:
- **0%**: scale 1, opacity 1 (current state)
- **35%**: scale 1.3, opacity 1 (it gets BIGGER first — the "pop")
- **100%**: scale 0, opacity 0 (then vanishes)

`scale: [1, 1.3, 0]` is **keyframe syntax** — values at specific points along the duration. `times: [0, 0.35, 1]` says when each frame happens. Total duration 0.5s.

Why the bigger-then-smaller? Because that's how things naturally feel when they're "completing". The bubble triumphantly grows before disappearing. A pure shrink-to-zero would feel anticlimactic.

### Enter spring

```jsx
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ type: 'spring', stiffness: 240, damping: 18 }}
```

New bubbles spring into existence. `type: 'spring'` uses real spring physics (stiffness + damping) rather than time-based easing. `stiffness: 240` is moderately bouncy; `damping: 18` settles it quickly. Play with these in the framer-motion docs sandbox to get a feel — small changes matter a lot.

### Hover

```jsx
whileHover={{ scale: 1.08 }}
```

`whileHover` is a "transient" animation state — applied while the cursor is over the element, reverted when it leaves. It composes with `animate`, so the hover scale of 1.08 multiplies onto the base scale of 1.

### AnimatePresence — the gatekeeper

```jsx
<AnimatePresence>
  {todos.map((t) => <motion.div key={t.id} ... />)}
</AnimatePresence>
```

`AnimatePresence` watches its children. When a `motion.*` element with a stable `key` disappears from the children list, AnimatePresence **keeps it mounted long enough for the exit animation to play**. Once exit is complete, it actually unmounts.

The `key` is crucial — without a stable key, React can't tell "this element is leaving" from "this element changed". Always pass `key={t.id}` (a stable identifier, not the array index).

### Where the bubble pops from

When a todo is marked done, App.jsx filters it out of `activeTodos`. BubbleCanvas receives a smaller list. The matter.js body is removed from the world *immediately* — and so the rAF loop stops updating that wrapper's `transform`. But AnimatePresence keeps the `motion.div` mounted during exit. The wrapper sits at the position it had at the last frame, and the bubble pops *in place*.

Same trick works for delete (double-click → onRemove → todo gone from list → exit anim).

## The detail overlay (right-click / long-press)

We wanted the bubbles to still be **one click = mark done**, so opening the detail panel needed a different gesture. Two are supported:

- **Right-click** — `onContextMenu` handler, with `e.preventDefault()` to stop the browser's native menu.
- **Long-press** — on `pointerdown`, set a 500ms timer that fires `onShowDetails` if the pointer hasn't moved. On `pointerup` or movement > 6px, cancel.

```js
onPointerDown(e, todo) {
  const state = { startX: e.clientX, startY: e.clientY, moved: false };
  state.longPressTimer = setTimeout(() => {
    if (!state.moved) onShowDetails(todo);
  }, 500);
  pointerStateRef.current.set(todo.id, state);
},
onPointerMove(e, todo) {
  // if pointer moved >6px, this isn't a long-press, it's a drag
  ...
  if (moved) clearTimeout(state.longPressTimer);
},
onPointerUp(e, todo) {
  clearTimeout(state.longPressTimer);
  if (state.longPressFired || state.moved) return;
  onToggle(todo);  // it was a click
}
```

The three gestures share the same pointer-down/up handlers and a small state machine. Three things can fire:

| Outcome      | Condition                                                 |
| ------------ | --------------------------------------------------------- |
| Toggle done  | pointer up within ~6px and < 500ms                        |
| Show details | pointer held for 500ms with < 6px movement                |
| Drag         | pointer moved > 6px (matter.js takes over)                |

## The modal pattern

Both the Add modal and the Detail overlay use the same structure:

```jsx
<AnimatePresence>
  {open && (
    <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={close}>
      <motion.div className="modal" initial={...} animate={...} exit={...} onClick={(e) => e.stopPropagation()}>
        ...form / details...
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

A few patterns worth noting:

- **Click backdrop to close**: `onClick` on the backdrop. Inside the modal, `onClick={(e) => e.stopPropagation()}` so clicks on the form don't bubble up and close the modal.
- **Escape to close**: a `useEffect` adds a `keydown` listener while the modal is open, removes it on close.
- **Auto-focus**: `useEffect(() => titleRef.current?.focus(), [open])` puts the cursor in the title field the moment the Add modal opens.

These three things together make the modal feel native rather than something you have to manage.

## Floating action button (FAB)

```jsx
<button className={`fab ${open ? 'fab-open' : ''}`}>
  <span className="fab-plus">+</span>
</button>
```

Plain CSS-only animation here — no framer-motion needed. The `+` rotates 45° to become an `×` when the modal is open via a class toggle:

```css
.fab-open .fab-plus { transform: rotate(45deg); }
.fab-plus { transition: transform 0.2s; }
```

A small thing, but the rotation gives a clear "open ↔ closed" affordance.

## Rails analogy

There isn't really a server-side one. The closest thing in Rails is **Stimulus + Turbo Streams**: server emits a change, Stimulus controller animates the DOM in/out. Buoy does the same thing with React + framer-motion: WS broadcasts a change, framer animates the bubble entering or exiting.

## Jetpack Compose parallel

Compose ships an animation toolkit that maps almost 1:1 onto what we're doing:

| framer-motion                           | Compose equivalent                                          |
| --------------------------------------- | ----------------------------------------------------------- |
| `animate={{ scale: 1 }}`                | `animateFloatAsState(targetValue = 1f)`                     |
| `transition={{ type: 'spring', ... }}`  | `spring(stiffness = ..., dampingRatio = ...)`               |
| `<AnimatePresence>` + `exit={...}`      | `AnimatedVisibility(visible) { ... }` (handles enter/exit)  |
| Keyframes `[1, 1.3, 0]` with `times`    | `keyframes { 1f at 0; 1.3f at 175; 0f at 500 }`             |
| `whileHover={{ scale: 1.08 }}`          | `Modifier.hoverable` + `animateFloatAsState` on a flag      |

The "animate on the way out" trick is the same idea in both worlds: `AnimatedVisibility` keeps the composable alive until its exit animation finishes, exactly like `AnimatePresence` defers React's unmount.

## What changed in this milestone

```
frontend/src/
├── App.jsx                         ← filters active todos for canvas, hosts overlay state
├── components/
│   ├── BubbleCanvas.jsx            ← split into wrapper + motion.div; click-toggle; long-press/right-click for details
│   ├── AddTodoModal.jsx (new)      ← floating + button + modal form
│   └── DetailOverlay.jsx (new)     ← right-click/long-press detail
├── styles.css                      ← FAB, modal, overlay, two-layer bubble
```

Plus `framer-motion` in package.json.

## Reading order

`03-react-basics` → `04-hooks-and-state` → `07-matter-js-physics` → **`10-animations-and-overlays`** (here). The animation story builds directly on the matter.js story; without understanding why we wrap bubbles in two divs, the framer-motion piece is harder to follow.

# 07 — matter.js physics

## What matter.js is

[matter.js](https://brm.io/matter-js/) is a 2D rigid-body physics engine in pure JavaScript. You give it bodies (circles, rectangles, polygons) and a world, and it simulates them: gravity, collisions, friction, restitution, all of it. It's small (~90KB), works in the browser, and doesn't try to do anything 3D.

For Buoy we use it to make todos *feel* alive. Each todo is a circular body. Big bubbles (high priority) rise faster than small ones because the simulation uses real mass + gravity.

## Three layers

```
┌──────────────────────────────────────────────────┐
│ React: renders one <div> per todo                │
│         (absolute positioning, locks the DOM)    │
└──────────────────────────────────────────────────┘
           ▲
           │  rAF loop: read body.position, write transform
           │
┌──────────────────────────────────────────────────┐
│ matter.js: simulates physics in its own world    │
│         (bodies, gravity, collisions)            │
└──────────────────────────────────────────────────┘
           ▲
           │  add/remove/scale bodies in useEffect on `todos`
           │
┌──────────────────────────────────────────────────┐
│ Props: `todos` array from useTodos()             │
└──────────────────────────────────────────────────┘
```

The two layers are loosely coupled. React only ever **creates the divs**. matter.js only ever **moves them**. The rAF loop is the bridge.

This is the bit that's most worth understanding for any animation-heavy UI: **don't make React do the per-frame work**. It's optimised for diffing changes to state, not 60Hz updates. Let it create the DOM nodes; then bypass it for the hot path.

## The setup, in pieces

### Engine + Runner

```js
const engine = Engine.create();
engine.gravity.y = -0.4;   // inverted: bubbles rise

const runner = Runner.create();
Runner.run(runner, engine);
```

- `Engine` holds the world (bodies, forces, the current state).
- `Runner` is the "time loop" — it calls `Engine.update()` at ~60Hz with fixed time steps.
- `gravity.y = -0.4` makes things float up. The default is `1` (down).

### Walls

We add four static rectangles as walls so bubbles can't escape:

```js
const opts = { isStatic: true, label: 'wall', restitution: 0.6 };
World.add(engine.world, [
  Bodies.rectangle(width / 2, -half, width + WALL_THICKNESS * 2, WALL_THICKNESS, opts), // top
  Bodies.rectangle(width / 2, height + half, ..., opts),                                 // bottom
  Bodies.rectangle(-half, height / 2, ..., opts),                                        // left
  Bodies.rectangle(width + half, height / 2, ..., opts),                                 // right
]);
```

`isStatic: true` means infinite mass — bodies bounce off them but they never move. `restitution` is bounciness (0 = mushy clay, 1 = perfect rubber). The top wall has a slightly lower restitution so big bubbles cluster against it rather than ping-ponging.

A `ResizeObserver` rebuilds the walls if the container resizes, so the playground always covers the visible area.

### Bubbles

```js
body = Bodies.circle(x, y, radius, {
  restitution: 0.5,
  friction: 0.005,
  frictionAir: 0.02,
  density: t.done ? 0.005 : 0.001,
  inertia: Infinity,
  label: `todo:${t.id}`,
});
```

The key knobs:

- **`density`**: heavier bodies experience the same forces with less acceleration. Done bubbles are denser → they fight gravity less effectively → they slowly sink past the active ones.
- **`frictionAir`**: drag through "air". Without it, every collision keeps imparting motion forever and bubbles never settle.
- **`inertia: Infinity`**: locks rotation. Without this, every collision spins the bubble and the text ends up upside down. (We learned this the hard way mid-milestone.)
- **`label`**: arbitrary string. Useful for debugging in `engine.world.bodies`.

## The rAF loop (the bridge)

```js
function tick() {
  for (const [id, body] of bodiesRef.current) {
    const node = nodesRef.current.get(id);
    if (!node) continue;
    node.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0) translate(-50%, -50%)`;
  }
  rafId = requestAnimationFrame(tick);
}
```

Every frame (~16ms at 60fps), we read each body's `position` from matter.js and write a `transform` directly onto the corresponding DOM node. We never call `setState` — React never re-renders this on each tick. That's the whole point.

The `translate(-50%, -50%)` centers the div on the body's position (since `body.position` is the body center but `transform: translate3d` moves the div's top-left corner).

`translate3d` instead of `translate` forces the browser to put the element on its own GPU layer — cheap, smooth, doesn't trigger layout.

## Reconciliation: keeping bodies in sync with `todos`

```js
useEffect(() => {
  const incomingIds = new Set(todos.map((t) => t.id));

  // Remove bodies whose todo is gone.
  for (const [id, body] of [...bodiesRef.current]) {
    if (!incomingIds.has(id)) {
      World.remove(engine.world, body);
      bodiesRef.current.delete(id);
    }
  }

  // Add/update.
  for (const t of todos) {
    let body = bodiesRef.current.get(t.id);
    if (!body) {
      // new todo → spawn a body at bottom-center
      body = Bodies.circle(...);
      World.add(engine.world, body);
      bodiesRef.current.set(t.id, body);
    } else {
      // update density / size if priority or done changed
      ...
    }
  }
}, [todos]);
```

This effect re-runs whenever the `todos` prop changes (which happens on every WS broadcast or local mutation). The logic:

- Bodies for ids no longer in `todos` → remove from the world.
- New ids → create a new body, spawn near the bottom so it visibly rises.
- Existing ids → mutate density/size to reflect priority/done changes.

This is the same kind of reconciliation React does internally for DOM nodes, but we're doing it for physics bodies. We use a `Map<id, Body>` so lookups are O(1).

## Drag + click

Two interactions share the same mouse:

1. **Drag a bubble** — handled by matter.js's `MouseConstraint`. It listens for mousedown, hooks the closest body, drags it around, releases on mouseup, and physics takes over again.
2. **Click to toggle done** — we want this *in addition to* drag.

The trick: a click is "mousedown + mouseup at almost the same place". If you moved the mouse > a few pixels between down and up, it's a drag, not a click. We capture pointerdown coords and only fire `onToggle` if total movement is < 6px.

```js
function onPointerDown(e) {
  dragInfoRef.current = { startX: e.clientX, startY: e.clientY };
}
function onPointerUp(e, todo) {
  const dx = e.clientX - dragInfoRef.current.startX;
  const dy = e.clientY - dragInfoRef.current.startY;
  if (Math.hypot(dx, dy) < 6) onToggle?.(todo);
}
```

Double-click deletes. matter.js doesn't fight us on that — `dblclick` fires after a normal click, and we don't bind a delete handler to `click`.

## Pairwise attraction (bubbles cluster together)

If we only had gravity + walls, bubbles would spread out evenly along the top wall — eight bubbles would be eight equally-spaced dots. We want them to feel social: drift toward each other, pack into a single cluster, react when a new one joins.

The way to get that is a **pairwise attractive force** between every pair of bubbles, applied every physics tick:

```js
const G = 4e-7;
const MIN_DIST = 80;
Events.on(engine, 'beforeUpdate', () => {
  const bodies = [...bodiesRef.current.values()];
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const distSq = Math.max(MIN_DIST * MIN_DIST, dx*dx + dy*dy);
      const dist = Math.sqrt(distSq);
      const mag = (G * a.mass * b.mass) / distSq;        // Newton's law
      const fx = (dx / dist) * mag;
      const fy = (dy / dist) * mag;
      Body.applyForce(a, a.position, { x:  fx, y:  fy }); // pull A toward B
      Body.applyForce(b, b.position, { x: -fx, y: -fy }); // and B toward A
    }
  }
});
```

What's happening:

- This is **Newton's law of gravitation** scaled down: `F = G · m₁·m₂ / r²`. The constant `G` is tiny because it accumulates over many pairs and we don't want bubbles snapping together violently.
- We compute the force once per pair and apply it equally in both directions (Newton's third law — `applyForce(a, +F)` and `applyForce(b, -F)`).
- **`MIN_DIST`** clamps the minimum distance used in the divisor. Without it, when two bubbles overlap (`r` ≈ 0), the inverse-square term explodes and they catapult each other across the screen.
- It runs on `engine.on('beforeUpdate')` — matter.js's hook for "after I've decided what each body wants to do, but before I integrate motion". The right place to inject custom forces.

### Tuning

The relative balance of three forces decides the look:

| Force                     | What it does                                    |
| ------------------------- | ----------------------------------------------- |
| Upward gravity (`-0.4`)   | Pushes everything against the top wall          |
| Attraction (`G = 4e-7`)   | Squeezes the top-wall cluster horizontally       |
| Random nudges (every 1.5s) | Stops the cluster from going visually still     |

With these numbers, 7 bubbles that would have lined up across the full canvas width instead pack into ~half of it, touching neighbours. If you want them looser, halve `G`. If you want them welded together, double it.

**Why O(n²) is fine:** for tens of bubbles, the inner loop runs hundreds of times per tick — trivial. If we ever had thousands, we'd swap in a quadtree or use the `matter-attractors` plugin's bucketing. Not worth it here.

## Random nudges

Without forces, bubbles eventually settle against the top wall in a stable arrangement and become static. To keep them lively, every 1.5s we apply a tiny random force to every body:

```js
setInterval(() => {
  for (const body of bodiesRef.current.values()) {
    const fx = (Math.random() - 0.5) * 0.0009 * body.mass;
    const fy = (Math.random() - 0.5) * 0.0009 * body.mass;
    Body.applyForce(body, body.position, { x: fx, y: fy });
  }
}, 1500);
```

Multiplying by `body.mass` keeps the *acceleration* roughly equal regardless of size — bigger bubbles get bigger forces.

## Cleanup

React's `useEffect` returns a cleanup function. We use it to tear matter.js down on unmount:

```js
return () => {
  cancelAnimationFrame(rafId);
  clearInterval(bobInterval);
  ro.disconnect();
  Runner.stop(runner);
  World.clear(engine.world, false);
  Engine.clear(engine);
};
```

This matters because of React's `StrictMode`, which mounts → unmounts → re-mounts every effect in development. Without proper cleanup we'd leak engines, runners, and event listeners on every dev reload.

## Mental model summary

- **React** = scaffolding. Creates and removes DOM nodes when todos change.
- **matter.js** = motion. Owns the `position` of each body, simulates forces.
- **rAF loop** = projector. Reads matter.js, writes DOM `transform`. Never touches React state.

The same pattern works for any "many things moving smoothly" UI: drag-and-drop sorting, particle systems, charts that animate between data updates, game-like demos.

## File / line map

- `frontend/src/components/BubbleCanvas.jsx` — everything described above.
- `frontend/src/App.jsx` — composes `<BubbleCanvas todos={...} onToggle={...} onRemove={...} />`.
- `frontend/src/styles.css` — the visual styling of `.bubble` (gradient, shadow, border).

## Rails analogy?

There isn't really one — physics simulation isn't a server concern. The closest spirit-of-the-thing analogy is **ActionCable broadcasting events to a Stimulus controller that does DOM animations**: keep the server stateless, let the client own the animated UI.

// Bubble physics canvas.
//
// Architecture:
//   - matter.js owns physics state. Its body positions are read every frame
//     and written to the OUTER wrapper div's `transform`.
//   - The INNER element is a framer-motion <motion.div> so we can animate
//     scale/opacity (enter/exit/pop) independently of matter.js positioning.
//   - AnimatePresence keeps a bubble's DOM alive during its exit animation
//     even after the parent removed it — it just sits where matter.js last
//     placed it and pops in place.
//
// Interactions:
//   - Single click  → onToggle(todo)   (pop happens via exit anim when done bubble is filtered out)
//   - Right-click   → onShowDetails(todo)
//   - Long-press    → onShowDetails(todo)  (~500ms)
//   - Double-click  → onRemove(todo.id)
//   - Drag          → matter.js MouseConstraint takes over (movement >6px suppresses click/long-press)

import { useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Matter from 'matter-js';

const RADIUS_FOR = (priority) => 18 + priority * 12;
const WALL_THICKNESS = 80;
const LONG_PRESS_MS = 500;
const CLICK_TOLERANCE = 6;

// Per-priority buoyancy acceleration (negative = upward in matter's coords).
// P1/P2 barely lift (they linger mid-canvas), P5 rises hard to the top.
const BUOYANCY = { 1: 0.00012, 2: -0.00004, 3: -0.0003, 4: -0.0007, 5: -0.0012 };

export default function BubbleCanvas({ todos, onToggle, onRemove, onShowDetails }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const bodiesRef = useRef(new Map()); // id → matter Body
  const nodesRef = useRef(new Map());  // id → DOM wrapper (matter writes transform here)
  // Per-bubble pointer state.
  const pointerStateRef = useRef(new Map()); // id → { startX, startY, moved, longPressTimer }

  // ----------------------------------------------------------------
  // matter.js setup (once on mount).
  // ----------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { Engine, Runner, Bodies, World, Mouse, MouseConstraint, Events, Body } = Matter;

    const engine = Engine.create();
    // Disable global gravity; buoyancy is applied per-body by priority below.
    engine.gravity.y = 0;
    engine.gravity.x = 0;
    engineRef.current = engine;

    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    function rebuildWalls() {
      const { width, height } = container.getBoundingClientRect();
      const walls = engine.world.bodies.filter((b) => b.label === 'wall');
      World.remove(engine.world, walls);
      const opts = { isStatic: true, label: 'wall', restitution: 0.6 };
      const half = WALL_THICKNESS / 2;
      World.add(engine.world, [
        Bodies.rectangle(width / 2, -half, width + WALL_THICKNESS * 2, WALL_THICKNESS, { ...opts, restitution: 0.4 }),
        Bodies.rectangle(width / 2, height + half, width + WALL_THICKNESS * 2, WALL_THICKNESS, opts),
        Bodies.rectangle(-half, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, opts),
        Bodies.rectangle(width + half, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, opts),
      ]);
    }
    rebuildWalls();

    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(engine.world, mouseConstraint);

    // Per-frame forces: per-priority buoyancy + pairwise attraction.
    // Attraction scales with mass*mass, so big bubbles already pull harder;
    // G is sized so a P5 pair noticeably clusters without the canvas collapsing.
    const G = 1.2e-6;
    const MIN_DIST = 80;
    Events.on(engine, 'beforeUpdate', () => {
      const bodies = [...bodiesRef.current.values()];
      for (const body of bodies) {
        const accel = BUOYANCY[body.plugin?.priority] ?? 0;
        if (accel) Body.applyForce(body, body.position, { x: 0, y: accel * body.mass });
      }
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          const dx = b.position.x - a.position.x;
          const dy = b.position.y - a.position.y;
          const distSq = Math.max(MIN_DIST * MIN_DIST, dx * dx + dy * dy);
          const dist = Math.sqrt(distSq);
          const mag = (G * a.mass * b.mass) / distSq;
          const fx = (dx / dist) * mag;
          const fy = (dy / dist) * mag;
          Body.applyForce(a, a.position, { x: fx, y: fy });
          Body.applyForce(b, b.position, { x: -fx, y: -fy });
        }
      }
    });

    // Random nudges so the cluster never goes still.
    const bobInterval = setInterval(() => {
      for (const body of bodiesRef.current.values()) {
        const fx = (Math.random() - 0.5) * 0.0009 * body.mass;
        const fy = (Math.random() - 0.5) * 0.0009 * body.mass;
        Body.applyForce(body, body.position, { x: fx, y: fy });
      }
    }, 1500);

    const ro = new ResizeObserver(rebuildWalls);
    ro.observe(container);

    let rafId = 0;
    function tick() {
      for (const [id, body] of bodiesRef.current) {
        const node = nodesRef.current.get(id);
        if (!node) continue;
        node.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0) translate(-50%, -50%)`;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(bobInterval);
      ro.disconnect();
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      bodiesRef.current.clear();
      engineRef.current = null;
      runnerRef.current = null;
    };
  }, []);

  // ----------------------------------------------------------------
  // Reconcile bodies with the todos prop.
  // ----------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { Bodies, World, Body } = Matter;
    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();

    const incomingIds = new Set(todos.map((t) => t.id));
    for (const [id, body] of [...bodiesRef.current]) {
      if (!incomingIds.has(id)) {
        World.remove(engine.world, body);
        bodiesRef.current.delete(id);
      }
    }
    for (const t of todos) {
      const radius = RADIUS_FOR(t.priority);
      let body = bodiesRef.current.get(t.id);
      if (!body) {
        const x = width / 2 + (Math.random() - 0.5) * 200;
        const y = height - 40;
        body = Bodies.circle(x, y, radius, {
          restitution: 0.5,
          friction: 0.005,
          frictionAir: 0.02,
          density: 0.001,
          inertia: Infinity,
          label: `todo:${t.id}`,
          plugin: { priority: t.priority },
        });
        World.add(engine.world, body);
        bodiesRef.current.set(t.id, body);
      } else {
        const currentRadius = body.circleRadius;
        if (currentRadius !== radius) {
          const scale = radius / currentRadius;
          Body.scale(body, scale, scale);
          body.circleRadius = radius;
        }
        body.plugin.priority = t.priority;
      }
    }
  }, [todos]);

  // ----------------------------------------------------------------
  // Pointer handlers per bubble.
  // ----------------------------------------------------------------
  const handlers = useMemo(() => ({
    onPointerDown(e, todo) {
      const state = { startX: e.clientX, startY: e.clientY, moved: false, longPressFired: false };
      state.longPressTimer = setTimeout(() => {
        if (!state.moved) {
          state.longPressFired = true;
          onShowDetails?.(todo);
        }
      }, LONG_PRESS_MS);
      pointerStateRef.current.set(todo.id, state);
    },
    onPointerMove(e, todo) {
      const state = pointerStateRef.current.get(todo.id);
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (Math.hypot(dx, dy) > CLICK_TOLERANCE) {
        state.moved = true;
        clearTimeout(state.longPressTimer);
      }
    },
    onPointerUp(e, todo) {
      const state = pointerStateRef.current.get(todo.id);
      pointerStateRef.current.delete(todo.id);
      if (!state) return;
      clearTimeout(state.longPressTimer);
      if (state.longPressFired || state.moved) return;
      onToggle?.(todo);
    },
    onContextMenu(e, todo) {
      e.preventDefault();
      // Cancel any pending long-press so we don't double-fire.
      const state = pointerStateRef.current.get(todo.id);
      if (state) clearTimeout(state.longPressTimer);
      pointerStateRef.current.delete(todo.id);
      onShowDetails?.(todo);
    },
  }), [onToggle, onShowDetails]);

  return (
    <div ref={containerRef} className="bubble-canvas">
      <AnimatePresence>
        {todos.map((t) => {
          const size = RADIUS_FOR(t.priority) * 2;
          return (
            <div
              key={t.id}
              ref={(el) => {
                if (el) nodesRef.current.set(t.id, el);
                else nodesRef.current.delete(t.id);
              }}
              className="bubble-wrapper"
              style={{ width: `${size}px`, height: `${size}px` }}
            >
              <motion.div
                className="bubble"
                data-priority={t.priority}
                data-done={t.done ? '' : undefined}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: [1, 1.3, 0], opacity: [1, 1, 0], transition: { duration: 0.5, times: [0, 0.35, 1] } }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                whileHover={{ scale: 1.08 }}
                onPointerDown={(e) => handlers.onPointerDown(e, t)}
                onPointerMove={(e) => handlers.onPointerMove(e, t)}
                onPointerUp={(e) => handlers.onPointerUp(e, t)}
                onContextMenu={(e) => handlers.onContextMenu(e, t)}
                onDoubleClick={() => onRemove?.(t.id)}
                title={`${t.title}  ·  P${t.priority}  ·  (click: done · right-click/hold: details · dbl-click: delete · drag: throw)`}
              >
                <span className="bubble-title">{t.title}</span>
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

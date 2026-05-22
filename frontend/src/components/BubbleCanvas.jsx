// The bubble physics canvas.
//
// matter.js simulates the physics. React renders one absolutely-positioned
// <div> per todo. A requestAnimationFrame loop syncs DOM position/rotation
// from matter.js body positions every frame — bypassing React's render cycle
// for that hot path so we can hit 60fps with no re-render cost.
//
// Gravity points UP (inverted), so bigger bubbles rise to the top.
//
// What this component does NOT do (yet — milestone 6):
//   - hover/click overlay animations
//   - pop-on-complete particle burst
//   - framer-motion enter/exit
// Click to toggle done works, drag works.

import { useEffect, useRef, useMemo } from 'react';
import Matter from 'matter-js';

const RADIUS_FOR = (priority) => 18 + priority * 12; // 30, 42, 54, 66, 78
const WALL_THICKNESS = 80;

function colourFor(t) {
  if (t.done) return '#475569';
  const palette = {
    5: '#ef4444', // red
    4: '#f97316', // orange
    3: '#eab308', // yellow
    2: '#38bdf8', // sky
    1: '#64748b', // slate
  };
  return palette[t.priority] || palette[3];
}

export default function BubbleCanvas({ todos, onToggle, onRemove }) {
  // Container div the canvas + bubbles live inside.
  const containerRef = useRef(null);
  // matter.js engine refs (kept in refs so re-renders don't recreate them).
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  // id → matter.js Body. Updated as todos prop changes.
  const bodiesRef = useRef(new Map());
  // id → DOM node. Used by the rAF loop to write transforms.
  const nodesRef = useRef(new Map());
  // For click-vs-drag discrimination.
  const dragInfoRef = useRef({ startX: 0, startY: 0, moved: false });

  // ------------------------------------------------------------------
  // One-time engine setup. Runs on mount, cleans up on unmount.
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { Engine, Runner, Bodies, World, Mouse, MouseConstraint, Events, Body } = Matter;

    const engine = Engine.create();
    // Gravity points UP. y is negative because matter.js y grows downward.
    engine.gravity.y = -0.4;
    engine.gravity.x = 0;
    engineRef.current = engine;

    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    // Walls. Container dims are read live in case window resizes.
    function rebuildWalls() {
      const { width, height } = container.getBoundingClientRect();
      // Remove existing wall bodies.
      const walls = engine.world.bodies.filter((b) => b.label === 'wall');
      World.remove(engine.world, walls);

      const opts = { isStatic: true, label: 'wall', restitution: 0.6 };
      const half = WALL_THICKNESS / 2;
      World.add(engine.world, [
        // Top (the "surface" — bubbles bob against this)
        Bodies.rectangle(width / 2, -half, width + WALL_THICKNESS * 2, WALL_THICKNESS, { ...opts, restitution: 0.4 }),
        // Bottom
        Bodies.rectangle(width / 2, height + half, width + WALL_THICKNESS * 2, WALL_THICKNESS, opts),
        // Left
        Bodies.rectangle(-half, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, opts),
        // Right
        Bodies.rectangle(width + half, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, opts),
      ]);
    }
    rebuildWalls();

    // Drag via MouseConstraint.
    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(engine.world, mouseConstraint);

    // Track movement for click-vs-drag.
    Events.on(mouseConstraint, 'startdrag', () => {
      dragInfoRef.current.moved = false;
    });
    Events.on(mouseConstraint, 'mousemove', () => {
      // If a body is being dragged, mark moved.
      if (mouseConstraint.body) dragInfoRef.current.moved = true;
    });

    // Periodic random nudge so bubbles never look perfectly static.
    const bobInterval = setInterval(() => {
      for (const body of bodiesRef.current.values()) {
        const fx = (Math.random() - 0.5) * 0.0009 * body.mass;
        const fy = (Math.random() - 0.5) * 0.0009 * body.mass;
        Body.applyForce(body, body.position, { x: fx, y: fy });
      }
    }, 1500);

    // Resize observer to rebuild walls when the container resizes.
    const ro = new ResizeObserver(rebuildWalls);
    ro.observe(container);

    // rAF loop — read body positions and write to DOM nodes.
    let rafId = 0;
    function tick() {
      for (const [id, body] of bodiesRef.current) {
        const node = nodesRef.current.get(id);
        if (!node) continue;
        // Rotation is locked (inertia: Infinity), so just translate.
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

  // ------------------------------------------------------------------
  // Reconcile bodies with the todos prop on every render.
  // Add bodies for new ids, remove for gone ids, update existing.
  // ------------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { Bodies, World, Body } = Matter;
    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();

    const incomingIds = new Set(todos.map((t) => t.id));

    // Remove bodies whose todo no longer exists.
    for (const [id, body] of [...bodiesRef.current]) {
      if (!incomingIds.has(id)) {
        World.remove(engine.world, body);
        bodiesRef.current.delete(id);
      }
    }

    // Add or update.
    for (const t of todos) {
      const radius = RADIUS_FOR(t.done ? Math.max(1, t.priority - 1) : t.priority);
      let body = bodiesRef.current.get(t.id);
      if (!body) {
        // Spawn near the bottom-center, slight horizontal jitter.
        const x = width / 2 + (Math.random() - 0.5) * 200;
        const y = height - 40;
        body = Bodies.circle(x, y, radius, {
          restitution: 0.5,
          friction: 0.005,
          frictionAir: 0.02,
          density: t.done ? 0.005 : 0.001, // done bubbles are heavier → sink
          inertia: Infinity, // lock rotation so the title stays upright
          label: `todo:${t.id}`,
        });
        World.add(engine.world, body);
        bodiesRef.current.set(t.id, body);
      } else {
        // Update size or density if priority/done changed.
        const currentRadius = body.circleRadius;
        if (currentRadius !== radius) {
          const scale = radius / currentRadius;
          Body.scale(body, scale, scale);
          body.circleRadius = radius;
        }
        body.density = t.done ? 0.005 : 0.001;
      }
    }
  }, [todos]);

  // ------------------------------------------------------------------
  // Click vs drag — both ride the same mousedown on the bubble div.
  // Capture the start coords on pointerdown; on pointerup, if we moved
  // < 6px we treat it as a click and toggle the todo.
  // ------------------------------------------------------------------
  const handlers = useMemo(() => ({
    onPointerDown(e) {
      dragInfoRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    },
    onPointerUp(e, todo) {
      const { startX, startY } = dragInfoRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < 6) {
        onToggle?.(todo);
      }
    },
  }), [onToggle]);

  return (
    <div ref={containerRef} className="bubble-canvas">
      {todos.map((t) => (
        <div
          key={t.id}
          ref={(el) => {
            if (el) nodesRef.current.set(t.id, el);
            else nodesRef.current.delete(t.id);
          }}
          className={`bubble ${t.done ? 'done' : ''}`}
          style={{
            width: `${RADIUS_FOR(t.priority) * 2}px`,
            height: `${RADIUS_FOR(t.priority) * 2}px`,
            background: `radial-gradient(circle at 30% 30%, #fff5 0%, ${colourFor(t)} 60%)`,
            borderColor: colourFor(t),
          }}
          onPointerDown={handlers.onPointerDown}
          onPointerUp={(e) => handlers.onPointerUp(e, t)}
          onDoubleClick={() => onRemove?.(t.id)}
          title={`${t.title}  ·  P${t.priority}${t.done ? '  ·  done' : ''}  ·  (click: toggle, dbl-click: delete, drag: throw)`}
        >
          <span className="bubble-title">{t.title}</span>
        </div>
      ))}
    </div>
  );
}

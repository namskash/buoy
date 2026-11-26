// Bubble physics canvas.
//
// Architecture:
//   - matter.js owns physics state. Its body positions are read every frame
//     and written to the OUTER wrapper div's `transform`.
//   - Separate shape and pulse layers sit between positioning and the inner
//     framer-motion element, keeping squish, breathing, and pop independent.
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

import { useEffect, useRef, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Matter from 'matter-js';
import ConfirmModal from './ConfirmModal.jsx';

const DELETE_LABELS = 'abcdefghijklmnopqrstuvwxyz';

const RADIUS_FOR = (priority) => 18 + (4 - priority) * 12;
const WALL_THICKNESS = 80;
const LONG_PRESS_MS = 500;
const CLICK_TOLERANCE = 6;
// Leave a little room inside the drawn bubble for its surface to flatten at contact.
const PHYSICS_RADIUS_SCALE = 0.96;
const WOBBLE_FREQUENCY = 16; // radians per second
const WOBBLE_DAMPING = 2.7;
const WOBBLE_AXES = ['xx', 'xy', 'yy'];

// Exact damped-spring step, so the rebound looks the same at different frame rates.
function advanceWobble(position, velocity, dt) {
  const frequency = Math.sqrt(WOBBLE_FREQUENCY ** 2 - WOBBLE_DAMPING ** 2);
  const decay = Math.exp(-WOBBLE_DAMPING * dt);
  const cosine = Math.cos(frequency * dt);
  const sine = Math.sin(frequency * dt) / frequency;
  return [
    decay * (position * (cosine + WOBBLE_DAMPING * sine) + velocity * sine),
    decay * (velocity * (cosine - WOBBLE_DAMPING * sine) - position * WOBBLE_FREQUENCY ** 2 * sine),
  ];
}

function pulseDelay(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `-${(hash % 2500) / 1000}s`;
}

// Per-priority buoyancy acceleration (negative = upward in matter's coords).
// Higher priorities rise; lower priorities drift lower, even within a cluster.
const BUOYANCY = { 0: -0.00009, 1: -0.000055, 2: -0.000025, 3: -0.000005, 4: 0.000025 };

export default function BubbleCanvas({ todos, onToggle, onRemove, onShowDetails, selectedId, shellEnabled, onDeleteModeChange }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const bodiesRef = useRef(new Map()); // id → matter Body
  const nodesRef = useRef(new Map());  // id → DOM wrapper (matter writes transform here)
  // Per-bubble pointer state.
  const pointerStateRef = useRef(new Map()); // id → { startX, startY, moved, longPressTimer }

  // Keyboard-driven delete: 'd' labels the first 26 bubbles a-z, typing a
  // label picks that bubble, then Enter/y in ConfirmModal deletes it.
  const [deleteMode, setDeleteMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // todo or null

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const labelById = useMemo(() => {
    const map = new Map();
    todos.slice(0, DELETE_LABELS.length).forEach((t, i) => map.set(t.id, DELETE_LABELS[i]));
    return map;
  }, [todos]);

  useEffect(() => {
    onDeleteModeChange?.(deleteMode || !!pendingDelete);
  }, [deleteMode, pendingDelete, onDeleteModeChange]);

  useEffect(() => () => onDeleteModeChange?.(false), [onDeleteModeChange]);

  // Opening another interaction cancels delete selection and its confirmation.
  useEffect(() => {
    if (!shellEnabled) { setDeleteMode(false); setPendingDelete(null); }
  }, [shellEnabled]);

  useEffect(() => {
    function onKey(e) {
      if (!shellEnabled || pendingDelete || e.defaultPrevented || e.isComposing || e.repeat ||
          e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) return;
      if (!deleteMode) {
        if (e.key === 'd') { e.preventDefault(); setDeleteMode(true); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setDeleteMode(false); return; }
      const todo = todos.find((t) => labelById.get(t.id) === e.key.toLowerCase());
      if (todo) { e.preventDefault(); setPendingDelete(todo); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shellEnabled, pendingDelete, deleteMode, todos, labelById]);

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
      const opts = { isStatic: true, label: 'wall', restitution: 0.2 };
      const half = WALL_THICKNESS / 2;
      World.add(engine.world, [
        Bodies.rectangle(width / 2, -half, width + WALL_THICKNESS * 2, WALL_THICKNESS, opts),
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

    // Matter hit-tests its smaller polygon. Start the same constraint from the
    // visible bubble so its soft edge (including hover/pulse) is draggable too.
    function startBubbleDrag(event) {
      if ((event.type === 'mousedown' && event.button !== 0) || mouseConstraint.constraint.bodyB) return;
      const bubble = event.target.closest?.('.bubble');
      if (!bubble) return;
      for (const [id, node] of nodesRef.current) {
        if (!node.contains(bubble)) continue;
        const body = bodiesRef.current.get(id);
        if (!body) return;
        const constraint = mouseConstraint.constraint;
        constraint.pointA = mouse.position;
        constraint.bodyB = mouseConstraint.body = body;
        constraint.pointB = { x: mouse.position.x - body.position.x, y: mouse.position.y - body.position.y };
        constraint.angleB = body.angle;
        Matter.Sleeping.set(body, false);
        Events.trigger(mouseConstraint, 'startdrag', { mouse, body });
        return;
      }
    }
    // Matter's mouse listeners were registered first, so mouse.position is current.
    container.addEventListener('mousedown', startBubbleDrag);
    container.addEventListener('touchstart', startBubbleDrag, { passive: true });

    // Pull separated bubbles together, fading out near contact so clusters
    // aren't constantly squeezed. Cap each body's total acceleration as the
    // number of neighbours grows; buoyancy remains independent of attraction.
    const ATTRACTION = 0.00025;
    const MAX_ATTRACTION = 0.0002;
    Events.on(engine, 'beforeUpdate', () => {
      const bodies = [...bodiesRef.current.values()];
      const forces = bodies.map(() => ({ x: 0, y: 0 }));
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
          const distance = Math.hypot(dx, dy);
          if (!distance) continue;
          const gap = Math.max(0, distance - a.circleRadius - b.circleRadius);
          const falloff = Math.min(1, gap / 30) * Math.min(1, 300 / distance);
          // Accelerate each bubble toward the other regardless of their very
          // different masses, so small bubbles can also draw large ones in.
          const accel = ATTRACTION * falloff;
          const ax = dx / distance * accel;
          const ay = dy / distance * accel;
          forces[i].x += ax * a.mass;
          forces[i].y += ay * a.mass;
          forces[j].x -= ax * b.mass;
          forces[j].y -= ay * b.mass;
        }
      }
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const force = forces[i];
        const magnitude = Math.hypot(force.x, force.y);
        const scale = magnitude ? Math.min(1, MAX_ATTRACTION * body.mass / magnitude) : 0;
        Body.applyForce(body, body.position, { x: force.x * scale, y: force.y * scale });
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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const squishes = new Map();
    const wobbleImpulses = new Map();

    const stepPositions = new Map();
    const contactImpacts = new Map();
    Events.on(engine, 'beforeUpdate', () => {
      stepPositions.clear();
      for (const body of engine.world.bodies) {
        stepPositions.set(body, { x: body.position.x, y: body.position.y });
      }
    });

    // Start events run before collision resolution; active events run after it.
    // For active contacts, include the change in penetration depth so a push
    // absorbed by the solver still produces an impact. Position changes also
    // include movement from the mouse constraint, unlike body.velocity.
    function captureImpacts({ pairs, timestamp, delta }, active) {
      if (reducedMotion.matches) {
        contactImpacts.clear();
        return;
      }
      const idsByBody = new Map([...bodiesRef.current].map(([id, body]) => [body, id]));
      for (const pair of pairs) {
        const { parentA: a, parentB: b, normal, depth } = pair.collision;
        const previousA = stepPositions.get(a);
        const previousB = stepPositions.get(b);
        if (!previousA || !previousB) continue;
        const contact = contactImpacts.get(pair.id) || { depth: 0, armed: true, lastImpact: -Infinity };
        const direction = (b.position.x - a.position.x) * normal.x + (b.position.y - a.position.y) * normal.y >= 0 ? 1 : -1;
        const relativeX = (b.position.x - previousB.x) - (a.position.x - previousA.x);
        const relativeY = (b.position.y - previousB.y) - (a.position.y - previousA.y);
        const closing = -(relativeX * normal.x + relativeY * normal.y) * direction;
        const speed = Math.max(0, closing + (active ? depth - contact.depth : 0)) * (1000 / 60) / (delta || 1000 / 60);
        contact.depth = depth;
        if (speed < 0.2) contact.armed = true;
        if (speed >= 0.6 && contact.armed && timestamp - contact.lastImpact >= 250) {
          contact.armed = false;
          contact.lastImpact = timestamp;
          const strength = Math.min(0.12, 0.04 + speed * 0.012) * WOBBLE_FREQUENCY;
          for (const body of [a, b]) {
            const id = idsByBody.get(body);
            if (id === undefined) continue;
            const impulse = wobbleImpulses.get(id) || { xx: 0, xy: 0, yy: 0 };
            impulse.xx += strength * (0.5 - 1.5 * normal.x * normal.x);
            impulse.xy -= strength * 1.5 * normal.x * normal.y;
            impulse.yy += strength * (0.5 - 1.5 * normal.y * normal.y);
            wobbleImpulses.set(id, impulse);
          }
        }
        contactImpacts.set(pair.id, contact);
      }
    }
    Events.on(engine, 'collisionStart', (event) => captureImpacts(event, false));
    Events.on(engine, 'collisionActive', (event) => captureImpacts(event, true));
    Events.on(engine, 'collisionEnd', ({ pairs }) => {
      for (const pair of pairs) contactImpacts.delete(pair.id);
    });
    let previousFrame = 0;
    let rafId = 0;
    function tick(time) {
      const bodies = [...bodiesRef.current.entries()];
      const contacts = new Map();
      if (!reducedMotion.matches) {
        for (let i = 0; i < bodies.length; i++) {
          const [idA, a] = bodies[i];
          for (let j = i + 1; j < bodies.length; j++) {
            const [idB, b] = bodies[j];
            const dx = b.position.x - a.position.x;
            const dy = b.position.y - a.position.y;
            const distance = Math.hypot(dx, dy);
            if (!distance || distance > a.circleRadius + b.circleRadius + 3) continue;
            const closingSpeed = Math.max(0, -((b.velocity.x - a.velocity.x) * dx + (b.velocity.y - a.velocity.y) * dy) / distance);
            const amount = Math.min(0.11, 0.05 + closingSpeed * 0.012);
            const nx = dx / distance;
            const ny = dy / distance;
            // Add symmetric deformation tensors, so opposing contacts reinforce
            // each other and perpendicular contacts don't flip the squash axis.
            for (const id of [idA, idB]) {
              const contact = contacts.get(id) || { xx: 0, xy: 0, yy: 0, total: 0 };
              contact.xx += amount * (0.5 - 1.5 * nx * nx);
              contact.xy -= amount * 1.5 * nx * ny;
              contact.yy += amount * (0.5 - 1.5 * ny * ny);
              contact.total += amount;
              contacts.set(id, contact);
            }
          }
        }
      }
      const elapsed = Math.min(time - (previousFrame || time), 50);
      const blend = 1 - Math.exp(-elapsed / 90);
      const dt = elapsed / 1000;
      previousFrame = time;
      for (const [id, body] of bodies) {
        const node = nodesRef.current.get(id);
        if (!node) continue;
        node.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0) translate(-50%, -50%)`;
        const shape = node.querySelector('.bubble-shape');
        if (!shape) continue;
        const contact = contacts.get(id);
        const state = squishes.get(id) || {
          rest: { xx: 0, xy: 0, yy: 0 },
          wobble: { xx: 0, xy: 0, yy: 0 },
          velocity: { xx: 0, xy: 0, yy: 0 },
        };
        const impulse = wobbleImpulses.get(id);
        const limit = contact ? Math.min(1, 0.11 / contact.total) : 0;
        const deformation = {};
        for (const axis of WOBBLE_AXES) {
          if (reducedMotion.matches) {
            state.rest[axis] = state.wobble[axis] = state.velocity[axis] = 0;
          } else {
            state.rest[axis] += ((contact?.[axis] || 0) * limit - state.rest[axis]) * blend;
            state.velocity[axis] = Math.max(-2, Math.min(2, state.velocity[axis] + (impulse?.[axis] || 0)));
            [state.wobble[axis], state.velocity[axis]] = advanceWobble(state.wobble[axis], state.velocity[axis], dt);
          }
          deformation[axis] = state.rest[axis] + state.wobble[axis];
        }
        squishes.set(id, state);
        shape.style.transform = `matrix(${1 + deformation.xx}, ${deformation.xy}, ${deformation.xy}, ${1 + deformation.yy}, 0, 0)`;
      }
      wobbleImpulses.clear();
      for (const id of squishes.keys()) if (!bodiesRef.current.has(id)) squishes.delete(id);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('mousedown', startBubbleDrag);
      container.removeEventListener('touchstart', startBubbleDrag);
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
      const radius = RADIUS_FOR(t.priority) * PHYSICS_RADIUS_SCALE;
      let body = bodiesRef.current.get(t.id);
      if (!body) {
        const x = width / 2 + (Math.random() - 0.5) * 200;
        const y = height - 40;
        body = Bodies.circle(x, y, radius, {
          restitution: 0.2,
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
              {deleteMode && labelById.has(t.id) && (
                <span className="bubble-delete-label" aria-hidden="true">{labelById.get(t.id)}</span>
              )}
              <div className="bubble-shape">
                <div className="bubble-pulse" style={{ animationDelay: pulseDelay(t.id) }}>
                  <motion.div
                    className="bubble"
                    data-vim-selected={selectedId === t.id ? '' : undefined}
                    data-priority={t.priority}
                    data-done={t.done ? '' : undefined}
                    initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0, transition: { duration: 0 } } : { scale: [1, 1.3, 0], opacity: [1, 1, 0], transition: { duration: 0.5, times: [0, 0.35, 1] } }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 18 }}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                    onPointerDown={(e) => handlers.onPointerDown(e, t)}
                    onPointerMove={(e) => handlers.onPointerMove(e, t)}
                    onPointerUp={(e) => handlers.onPointerUp(e, t)}
                    onContextMenu={(e) => handlers.onContextMenu(e, t)}
                    title={`${t.title}  ·  P${t.priority}  ·  (click: done · right-click/hold: details · drag: throw)`}
                  >
                    <span className="bubble-title">{t.title}</span>
                  </motion.div>
                </div>
              </div>
            </div>
          );
        })}
      </AnimatePresence>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete todo?"
        message={pendingDelete ? pendingDelete.title : ''}
        confirmLabel="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onRemove?.(pendingDelete.id);
          setPendingDelete(null);
          setDeleteMode(false);
        }}
      />
    </div>
  );
}

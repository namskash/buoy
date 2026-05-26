// buoy-canvas.jsx
// The bubble canvas — owns physics + per-bubble rendering.
// Physics: simple in-house solver (Verlet-ish) instead of matter.js.
// ~30 bubbles, 60fps, no deps. Same external contract as the matter.js version:
// outer wrapper takes translate3d; inner .buoy-bubble takes scale/opacity.

const { useState, useEffect, useRef, useCallback } = React;

// ─── Physics constants (tweakable via motion intensity) ─────────────────────
const PHYS = {
  calm:   { gravity: -0.10, drag: 0.992, attract: 0.0010, jiggle: 0.05, springK: 0.18 },
  normal: { gravity: -0.16, drag: 0.990, attract: 0.0014, jiggle: 0.08, springK: 0.22 },
  lively: { gravity: -0.26, drag: 0.986, attract: 0.0022, jiggle: 0.18, springK: 0.28 },
};
const RADIUS = (priority) => 22 + priority * 10; // px — half the diameter

function nudge(b, mag) {
  b.vx += (Math.random() - 0.5) * mag;
  b.vy += (Math.random() - 0.5) * mag;
}

function BuoyCanvas({
  todos,
  density = 'normal',
  motion = 'normal',
  onToggle,
  onOpenDetail,
  onDelete,
  paused = false,
}) {
  const wrapRef = useRef(null);
  const bubblesRef = useRef(new Map()); // id → {x, y, vx, vy, r, priority, dragging, dragOff}
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 600 });
  const [popping, setPopping] = useState([]); // {id, x, y, color}

  // Click vs hold vs double-click disambiguation
  const interactionRef = useRef({});

  // ─── Initialize bubble state when todo list changes ───────────────────────
  useEffect(() => {
    const map = bubblesRef.current;
    // Make sure dims reflect current size (may run before first ResizeObserver tick)
    if (wrapRef.current) {
      dimsRef.current = {
        w: wrapRef.current.clientWidth || 800,
        h: wrapRef.current.clientHeight || 600,
      };
    }
    const dims = dimsRef.current;
    let added = false;
    todos.forEach((t) => {
      if (!map.has(t.id)) {
        added = true;
        const r = RADIUS(t.priority);
        // Spawn near bottom, slightly inset, with x jitter
        map.set(t.id, {
          x: Math.max(r + 10, Math.min(dims.w - r - 10, dims.w * (0.15 + Math.random() * 0.7))),
          y: dims.h - r - 20 - Math.random() * 60,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1.2 - Math.random() * 0.8,
          r,
          priority: t.priority,
          done: false,
          dragging: false,
          dragOff: { x: 0, y: 0 },
        });
      } else {
        const b = map.get(t.id);
        b.r = RADIUS(t.priority);
        b.priority = t.priority;
      }
    });
    [...map.keys()].forEach((id) => {
      if (!todos.find((t) => t.id === id)) map.delete(id);
    });

    // Warm up: simulate ~80 frames of physics so bubbles settle at top.
    // Ensures the first paint shows a believable layout even if rAF is
    // throttled (e.g. hidden iframe at screenshot time).
    if (added) {
      for (let i = 0; i < 80; i++) physicsStep(1);
      renderTransforms();
    }
  }, [todos]);

  // ─── Resize handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (wrapRef.current) {
        dimsRef.current = {
          w: wrapRef.current.clientWidth,
          h: wrapRef.current.clientHeight,
        };
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // ─── Per-bubble random nudges ─────────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    const tick = () => {
      const cfg = PHYS[motion] || PHYS.normal;
      bubblesRef.current.forEach((b) => {
        if (!b.dragging) nudge(b, cfg.jiggle);
      });
    };
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [motion, paused]);

  // ─── Physics & render loop ────────────────────────────────────────────────
  // Uses both rAF (smooth when visible) and a setInterval fallback (so
  // hidden iframes / background tabs still tick — at least at the throttled
  // 1s clamp). Whichever fires first wins, the other no-ops via `last`.
  useEffect(() => {
    let last = performance.now();
    const tick = (now) => {
      now = now || performance.now();
      const dt = Math.min(40, now - last) / 16.67;
      if (dt < 0.2) return; // skip duplicate same-frame calls
      last = now;
      if (!paused) physicsStep(dt);
      renderTransforms();
    };
    const rafLoop = (t) => {
      tick(t);
      rafRef.current = requestAnimationFrame(rafLoop);
    };
    rafRef.current = requestAnimationFrame(rafLoop);
    const intervalId = setInterval(() => tick(performance.now()), 16);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(intervalId);
    };
  }, [motion, paused]);

  function physicsStep(dt) {
    const cfg = PHYS[motion] || PHYS.normal;
    const { w, h } = dimsRef.current;
    const bubbles = [...bubblesRef.current.values()];

    // Pairwise attraction (weak inverse-distance, capped)
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      if (a.dragging) continue;
      for (let j = i + 1; j < bubbles.length; j++) {
        const b = bubbles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 100;
        const d = Math.sqrt(d2);
        const minDist = a.r + b.r;

        if (d < minDist) {
          // Soft collision response
          const overlap = (minDist - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          // Velocity exchange (light)
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const vAlong = rvx * nx + rvy * ny;
          if (vAlong < 0) {
            const imp = -vAlong * 0.5;
            a.vx -= imp * nx;
            a.vy -= imp * ny;
            b.vx += imp * nx;
            b.vy += imp * ny;
          }
        } else if (d < 280) {
          // Weak attraction
          const f = (cfg.attract * (a.r + b.r) * 0.5) / d;
          a.vx += (dx / d) * f * dt;
          a.vy += (dy / d) * f * dt;
          if (!b.dragging) {
            b.vx -= (dx / d) * f * dt;
            b.vy -= (dy / d) * f * dt;
          }
        }
      }
    }

    // Integrate
    bubbles.forEach((b) => {
      if (b.dragging) return;
      b.vy += cfg.gravity * dt;       // inverted gravity = upward
      b.vx *= Math.pow(cfg.drag, dt);
      b.vy *= Math.pow(cfg.drag, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Boundaries
      if (b.x < b.r)      { b.x = b.r;     b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > w - b.r)  { b.x = w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      if (b.y < b.r)      { b.y = b.r;     b.vy = Math.abs(b.vy) * 0.4; } // ceiling
      if (b.y > h - b.r)  { b.y = h - b.r; b.vy = -Math.abs(b.vy) * 0.5; }
    });
  }

  function renderTransforms() {
    bubblesRef.current.forEach((b, id) => {
      const el = wrapRef.current?.querySelector(`[data-bid="${id}"]`);
      if (el) {
        el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`;
        el.style.width = `${b.r * 2}px`;
        el.style.height = `${b.r * 2}px`;
      }
    });
  }

  // ─── Interaction: pointer down → press timer → click/drag/long-press ─────
  const onPointerDown = useCallback((e, id) => {
    if (e.button === 2) return; // right-click handled separately
    const b = bubblesRef.current.get(id);
    if (!b) return;
    const wrap = wrapRef.current.getBoundingClientRect();
    const pointerX = e.clientX - wrap.left;
    const pointerY = e.clientY - wrap.top;

    const state = {
      id,
      startX: pointerX,
      startY: pointerY,
      startTime: Date.now(),
      moved: false,
      dragging: false,
      holdTimer: null,
      lastX: pointerX,
      lastY: pointerY,
      lastT: Date.now(),
    };
    interactionRef.current = state;

    // Long-press → open detail
    state.holdTimer = setTimeout(() => {
      if (!state.moved && !state.dragging) {
        state.longPressed = true;
        if (onOpenDetail) onOpenDetail(id);
      }
    }, 480);

    // Capture
    e.target.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      const x = ev.clientX - wrap.left;
      const y = ev.clientY - wrap.top;
      const dx = x - state.startX;
      const dy = y - state.startY;
      if (!state.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        state.moved = true;
        state.dragging = true;
        b.dragging = true;
        b.dragOff = { x: state.startX - b.x, y: state.startY - b.y };
        clearTimeout(state.holdTimer);
      }
      if (state.dragging) {
        const now = Date.now();
        const elapsed = Math.max(8, now - state.lastT);
        b.vx = ((x - state.lastX) / elapsed) * 16;
        b.vy = ((y - state.lastY) / elapsed) * 16;
        b.x = x - b.dragOff.x;
        b.y = y - b.dragOff.y;
        state.lastX = x;
        state.lastY = y;
        state.lastT = now;
      }
    };

    const onUp = () => {
      clearTimeout(state.holdTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const heldFor = Date.now() - state.startTime;

      if (state.dragging) {
        b.dragging = false;
        // throw with last velocity (clamped)
        b.vx = Math.max(-22, Math.min(22, b.vx * 1.2));
        b.vy = Math.max(-22, Math.min(22, b.vy * 1.2));
      } else if (state.longPressed) {
        // already opened detail; do nothing
      } else if (heldFor < 380 && !state.moved) {
        // single click → wait briefly to disambiguate from double-click
        if (state.clickTimer) clearTimeout(state.clickTimer);
        const lastClick = interactionRef.current.lastClickFor;
        const lastClickT = interactionRef.current.lastClickTime || 0;
        if (lastClick === id && (Date.now() - lastClickT) < 320) {
          // double-click → delete
          interactionRef.current.lastClickFor = null;
          if (onDelete) onDelete(id);
        } else {
          interactionRef.current.lastClickFor = id;
          interactionRef.current.lastClickTime = Date.now();
          setTimeout(() => {
            if (interactionRef.current.lastClickFor === id) {
              interactionRef.current.lastClickFor = null;
              popBubble(id);
              if (onToggle) onToggle(id);
            }
          }, 240);
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onToggle, onOpenDetail, onDelete]);

  const onContextMenu = useCallback((e, id) => {
    e.preventDefault();
    if (onOpenDetail) onOpenDetail(id);
  }, [onOpenDetail]);

  function popBubble(id) {
    const b = bubblesRef.current.get(id);
    if (!b) return;
    const todo = todos.find((t) => t.id === id);
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue(`--prio-${todo?.priority || 3}`).trim() || '#f0c14a';
    const popId = `${id}-${Date.now()}`;
    setPopping((p) => [...p, { id: popId, x: b.x, y: b.y, color, size: b.r * 2 }]);
    setTimeout(() => {
      setPopping((p) => p.filter((x) => x.id !== popId));
    }, 700);
  }

  return (
    <div ref={wrapRef} className="buoy-canvas" style={{ position: 'absolute', inset: 0 }}>
      {todos.map((t) => (
        <div
          key={t.id}
          className="buoy-bubble-wrap"
          data-bid={t.id}
          style={{
            width: RADIUS(t.priority) * 2,
            height: RADIUS(t.priority) * 2,
          }}
        >
          <div
            className="buoy-bubble"
            data-priority={t.priority}
            onPointerDown={(e) => onPointerDown(e, t.id)}
            onContextMenu={(e) => onContextMenu(e, t.id)}
            title={t.title}
          >
            <span className="buoy-bubble-label">{t.title}</span>
          </div>
        </div>
      ))}
      {popping.map((p) => (
        <PopBurst key={p.id} x={p.x} y={p.y} color={p.color} size={p.size} />
      ))}
    </div>
  );
}

function PopBurst({ x, y, color, size }) {
  const sparks = Array.from({ length: 10 }).map((_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const dist = size * 0.6 + Math.random() * size * 0.3;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: Math.random() * 80,
    };
  });
  return (
    <div className="buoy-pop" style={{ left: x, top: y, '--bubble-color': color }}>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="buoy-pop-spark"
          style={{
            '--dx': `${s.dx}px`,
            '--dy': `${s.dy}px`,
            animationDelay: `${s.delay}ms`,
            background: color,
          }}
        />
      ))}
    </div>
  );
}

window.BuoyCanvas = BuoyCanvas;

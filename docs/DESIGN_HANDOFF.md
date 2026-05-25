# Buoy — Design Handoff

> Paste this whole doc into Claude (design mode) as the starting brief.

## What I want back

1. **Layout / UX rework** for: header, the floating-bubble canvas, the add-todo modal, the detail overlay, the floating "+" button (FAB), the empty state, the loading state, and the reconnecting banner.
2. **Component spec + design tokens** ready to drop into CSS: a palette (semantic — primary/surface/border/danger/etc.), type scale, spacing scale, radius scale, shadow/elevation scale, motion durations + easings. Per-component specs noting padding, border, hover/active/focus states.
3. Mood/direction is **open** — surprise me. The current look is dark + playful but I'm not attached to it. The one non-negotiable is that the **bubbles must look and feel like bubbles** (round, with depth/sheen, soft shadows, hover/squish responsiveness).

Output format I'd love: a Markdown spec doc I can implement against, plus an ASCII or annotated-text layout of each screen. No need for image mockups unless they help.

## What Buoy is

A floating-bubble to-do app, built as a learning project (React + Node, for a Rails dev). Each task is a **bubble**:

- **Size** encodes **priority** (1–5). `radius = 12 + priority * 10` px → priority-1 ≈ 44px, priority-5 ≈ 124px diameter.
- Real 2D physics (matter.js): **inverted gravity** so bubbles rise. Bigger ones cluster at the top. They **attract each other** weakly (pairwise inverse-square), so they tend to clump rather than scatter.
- Idle bubbles get small random "nudges" every ~1.5s so the scene never sits perfectly still.
- Click = mark done (the bubble **pops** — scale-up + fade + small particle burst).
- Right-click / long-press = open the **detail overlay**.
- Double-click = delete.
- Drag = throw the bubble; physics resumes on release.

The "database" is a single human-editable `data/todos.md` file — every change syncs both ways over WebSocket within ~100ms. The point of the app is that it feels **alive and satisfying** to interact with, even though there are only ~10 todos on screen.

## Tech that constrains design

- **Plain CSS** (`frontend/src/styles.css`). No Tailwind, no CSS-in-JS, no design system library. Design tokens should be CSS custom properties on `:root`.
- **React 18 + framer-motion** for enter/exit + hover animations.
- **matter.js** owns each bubble's `transform: translate3d(...)` every animation frame — so any per-bubble CSS animation must NOT touch `transform`. (Current solution: two-layer DOM — an outer "wrapper" that matter.js writes to, and an inner `.bubble` that framer-motion animates `scale`/`opacity` on. Keep this pattern.)
- **Responsive**: phone and desktop both. Touch is a first-class input (long-press is a primary interaction).
- **Accessibility**: should be at least keyboard-usable for add + delete + toggle. The bubble canvas can stay mouse/touch-only, but modals and the FAB must be keyboard-navigable; focus rings must be visible.

## Current screens (text mockups)

### 1. Main canvas (the home screen)

```
┌──────────────────────────────────────────────────────────────────┐
│  Buoy  •  7 active · 2 done                                       │ ← header
│  ───────────────────────────────────────────────────────────────  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │                          ⬤ Ship the PR                       │ │
│ │              ⬤ Read           ⬤ Set up                       │ │ ← bubble canvas
│ │      ⬤ Buy milk                                              │ │   (bubbles rise to top,
│ │                       ⬤ Second                               │ │    bob, attract, drag)
│ │                                                              │ │
│ │                                                       ⬤ Third│ │
│ │  ⬤ First                                                     │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                          ┌────┐  │
│ live sync on · click: done · hold: details · dbl: delete │  + │  │ ← footer + FAB
└──────────────────────────────────────────────────────────┴────┘
```

### 2. Add-todo modal (opens when FAB is tapped)

```
            ┌─────────────────────────────────┐
            │  New todo                       │
            │  ─────────────────────────────  │
            │  Title                          │
            │  [ buy a thing            ]     │
            │                                 │
            │  Priority                       │
            │  [────●────────]   [ P3 ]       │ ← slider 1..5 + colored chip
            │                                 │
            │  Description (optional)         │
            │  [                         ]    │
            │  [                         ]    │
            │                                 │
            │                 [Cancel] [Add]  │
            └─────────────────────────────────┘
```

- FAB rotates `+` → `✕` while modal is open.
- Backdrop dims + blurs the canvas.
- Escape closes; backdrop click closes.

### 3. Detail overlay (right-click / long-press a bubble)

```
            ┌─────────────────────────────────┐
            │  [P3]  Buy milk                 │
            │  ─────────────────────────────  │
            │  From the corner store          │
            │                                 │
            │  status     active              │
            │  created    2026-05-21 10:00    │
            │  id         a1b2c3              │
            │                                 │
            │  [Delete]      [Mark done]      │
            └─────────────────────────────────┘
```

### 4. Empty state

```
┌──────────────────────────────────────────────────────────────────┐
│  No floating todos.                                              │
│  Tap the (+) button to send one up.            ↘                 │
│                                                                  │
│                                                          [ + ]   │
└──────────────────────────────────────────────────────────────────┘
```

### 5. Loading state

Three faintly-pulsing skeleton circles where bubbles would appear.

### 6. Reconnecting banner

Strip at the top under the header: "Can't reach the server. Retrying… (attempt 4)". Shows only after 3 consecutive failed WS reconnect attempts.

## Priority color encoding (current)

| Priority | Current color | Meaning             |
|----------|---------------|---------------------|
| 5        | red `#ef4444` | urgent / largest    |
| 4        | orange `#f97316` |                  |
| 3        | yellow `#eab308` | default          |
| 2        | sky `#38bdf8` |                     |
| 1        | slate `#64748b` | smallest          |

These are the only **semantic** colors in the app. I'd love a palette where priority is still distinguishable at-a-glance but feels less "tailwind defaults" and more "intentional."

## Things I want the redesign to address

1. **The header is anemic.** It's just a wordmark + a green dot + a count. There's room for personality — maybe the wordmark itself reacts to live-sync state, or the counts feel less like a footnote.
2. **The FAB is generic.** A purple gradient circle with a "+" — feels like a default. Should feel like it belongs to *this* app (bubble-themed?).
3. **Modals are square in a round world.** Add + Detail modals are flat 1rem-radius cards. Could lean into the bubble aesthetic — circular framing, blurred bubble backdrops, etc.
4. **Empty state should be charming.** Currently text + an arrow. Could be a single drifting empty bubble, a "first bubble" animation, etc.
5. **Bubble polish.** The current bubble is a circle with an inset shadow + drop shadow + flat color. Could push toward genuine soap-bubble feel: subtle iridescence, rim light, internal reflection. Must stay performant with up to ~30 bubbles on screen.
6. **Priority readability.** A P5 bubble next to a P3 should feel like a meaningful difference beyond just "bigger and redder."
7. **Motion vocabulary.** Spring stiffness/damping for hover, the pop on completion, the FAB rotation, the modal entrance — these should feel like they came from the same family.

## Token shape I want

Please give me CSS custom properties grouped like this (names are suggestions, not requirements):

```css
:root {
  /* Color — semantic, not raw */
  --bg-base:   ...;   /* page background */
  --bg-canvas: ...;   /* the bubble canvas */
  --surface:   ...;   /* modals, banners */
  --border:    ...;
  --text:      ...;
  --text-dim:  ...;
  --primary:   ...;   /* FAB, CTAs */
  --danger:    ...;
  --success:   ...;

  /* Priority */
  --prio-1: ...;
  --prio-2: ...;
  --prio-3: ...;
  --prio-4: ...;
  --prio-5: ...;

  /* Type */
  --font-display: ...;
  --font-body:    ...;
  --fs-xs: ...; --fs-sm: ...; --fs-md: ...; --fs-lg: ...; --fs-xl: ...;

  /* Spacing — 4-step scale */
  --space-1: ...; --space-2: ...; --space-3: ...; --space-4: ...; --space-5: ...;

  /* Radius */
  --radius-sm: ...; --radius-md: ...; --radius-lg: ...; --radius-pill: 9999px;

  /* Elevation */
  --shadow-1: ...; --shadow-2: ...; --shadow-3: ...; --shadow-bubble: ...;

  /* Motion */
  --ease-spring: ...;   /* or document spring config: stiffness/damping */
  --duration-fast: 150ms; --duration-mid: 250ms; --duration-slow: 400ms;
}
```

## Per-component specs I'd love

For each component, give me: dimensions, padding, border, background, hover state, active/pressed state, focus state, and any motion.

- **Bubble** (the resting circle) — must be a self-contained CSS visual using a single `<div>` (or one wrapper + one inner). Size driven by inline `width`/`height` set by React.
- **FAB** — 56×56 by default; how does it differ from the current purple disc?
- **Modal shell** — backdrop + card; entrance motion
- **Modal form fields** — text input, textarea, range slider, priority chip
- **Modal buttons** — primary, secondary/ghost, danger
- **Header** — wordmark, live-sync indicator, counts row
- **Banner** (reconnecting) — warning style only, for now
- **Empty-state composition**
- **Loading skeleton bubble**

## What stays the same

- The interaction model (click toggle, long-press details, double-click delete, drag throw, FAB → modal).
- The two-layer bubble DOM trick (matter.js owns the outer `transform`, framer-motion animates the inner).
- The file: `frontend/src/styles.css` stays as the single stylesheet. I'll translate the spec into it myself.

## Repo for reference

If you want to look at the actual code, the relevant files are:

- `frontend/src/styles.css` — the entire current stylesheet
- `frontend/src/App.jsx` — top-level composition
- `frontend/src/components/BubbleCanvas.jsx` — bubble rendering and physics
- `frontend/src/components/AddTodoModal.jsx` — the add modal
- `frontend/src/components/DetailOverlay.jsx` — the detail overlay
- `frontend/index.html` — title + favicon
- `frontend/public/favicon.svg` — the current 3-bubble favicon (open to redesign too)

Thanks — go wild within the constraints above.

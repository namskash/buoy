# Handoff: Buoy Redesign

> Frontend-only tweaks. The Buoy backend, React+matter.js wiring, file-sync layer, and component tree already exist in your repo. Your job is to **bring the existing UI up to the design spec below** — not to scaffold a new app.

## What you have

```
design_handoff_buoy/
├── README.md            ← this file (start here)
├── Buoy Spec.md         ← the authoritative design spec (tokens + per-component anatomy + ASCII layouts)
└── prototype/           ← the HTML/JSX prototype the spec was authored against
    ├── Buoy Prototype.html
    ├── buoy-styles.css     ← every token + every component. The single stylesheet.
    ├── buoy-app.jsx        ← top-level composition + scene/tweak state (for review only)
    ├── buoy-canvas.jsx     ← bubble rendering + a from-scratch physics solver (REPLACE with your existing matter.js)
    ├── buoy-overlays.jsx   ← header, footer, FAB, add modal, detail overlay, banner, empty, loading
    └── tweaks-panel.jsx    ← prototype-only UI for switching directions/themes/motion/density. NOT to be shipped.
```

## What these files are (and aren't)

These are **design references**. They render in the browser, they're interactive, and they're a faithful representation of the target visual + interaction language — but they are **not production code to drop into the Buoy repo as-is**.

Your task is to **port the visual + behavior into the existing Buoy frontend** (`frontend/src/styles.css`, `frontend/src/App.jsx`, `frontend/src/components/BubbleCanvas.jsx`, `frontend/src/components/AddTodoModal.jsx`, `frontend/src/components/DetailOverlay.jsx`, `frontend/index.html`, `frontend/public/favicon.svg`) — keeping the existing physics layer (matter.js), WebSocket sync, and todos.md file-as-database intact.

## Fidelity

**High-fidelity.** Every color, font size, radius, shadow, and motion value below is final and matches the prototype. The ASCII layouts in `Buoy Spec.md` are pixel-accurate to the prototype. Use them as the source of truth; the prototype JSX is one valid way of expressing them but not the only one — if your existing component tree wants to organize differently, that's fine, as long as the visual contract holds.

## What stays exactly the same

Per the original brief — these are non-negotiable, do not change:

1. The interaction model: click = toggle done (with pop), long-press / right-click = open detail overlay, double-click = delete, drag = throw bubble, FAB → add modal.
2. The two-layer bubble DOM trick: matter.js writes `transform: translate3d(…)` on the **outer wrapper**; framer-motion animates `scale` / `opacity` on the **inner `.buoy-bubble`**. Never let any per-bubble CSS animation touch `transform` on the outer wrapper.
3. The file: `frontend/src/styles.css` stays as the single stylesheet. Translate the prototype's `buoy-styles.css` into it.
4. WebSocket sync semantics. The `data/todos.md` file remains the database.

## The implementation work, broken down

### 1. Tokens — drop into `:root` in `frontend/src/styles.css`

Open `buoy-styles.css` from the prototype and copy the contents of sections **1, 2, 3** (the `:root, [data-direction="daydream"]` block, the `[data-direction="daydream"][data-theme="dark"]` block, and the `[data-direction="nightswim"]` block) verbatim into the top of `frontend/src/styles.css`.

Then add a `<html data-direction="…" data-theme="…">` attribute pair so directions can swap. The prototype sets these from `App.jsx`; in Buoy you'd persist the choice in localStorage and read it back on mount.

**Required tokens** (full values in `Buoy Spec.md` §2):
- Surfaces: `--bg-base`, `--bg-canvas` (gradient), `--surface`, `--surface-sunken`, `--surface-tint`
- Lines: `--border`, `--border-strong`, `--border-focus`
- Text: `--text`, `--text-dim`, `--text-faint`, `--text-on-primary`
- Semantic: `--primary` / `-hover` / `-press`, `--danger`, `--success`, `--warning`, `--info`, plus `*-soft` variants
- Priority: `--prio-0` … `--prio-4` (P0 = highest urgency)
- Iridescence (for empty-state bubble): `--iri-a / -b / -c`
- Bubble shading: `--bubble-highlight`, `--bubble-rim-mix`, `--bubble-contact`
- Type: `--font-display`, `--font-body`, `--font-mono`, plus `--fs-xs … --fs-display`, `--lh-tight/-snug/-body`
- Spacing: `--space-1 … --space-8`
- Radius: `--radius-sm/-md/-lg/-xl/-pill`
- Elevation: `--shadow-1/-2/-3/-focus/-bubble`
- Motion: `--ease-standard/-spring/-out`, `--duration-fast/-mid/-slow`

### 2. The bubble — `BubbleCanvas.jsx` (the biggest visual win)

The bubble is a single `<div class="buoy-bubble">` inside an outer `<div class="buoy-bubble-wrap">`. The visual is a stack of:
- Background: bottom-right tinted shadow gradient + top-left highlight gradient + base fill (the priority color)
- Two inset shadows for depth
- One outer drop-shadow for float
- A `::after` blob for the (subtle) specular catch-light
- An iridescent `::before` rim — **already removed**. Bubble is subtle-only.

Drop the relevant CSS from `buoy-styles.css` §8 (the `.buoy-bubble*` rules) into `frontend/src/styles.css`. Apply `data-priority="0..4"` on the inner element — the priority filter (saturate + brightness) is driven by a `--p` custom property the spec details (`--p` is the inverse urgency level 1..5; the rules set it from the priority).

**Inline width/height** on the wrapper, set by React from `radius = 22 + (4 - priority) × 10` (the formula, inverted for P0=highest). The inner is `width:100%; height:100%`. No other JS-set styles on either layer.

### 3. Header — wordmark with the bouncing "o"

The "o" in "Buoy" is replaced with a live bubble — see `BuoyHeader` in `buoy-overlays.jsx`. The `.buoy-wm-dot` element bobs on a 4.8s ease-in-out loop. When sync state is reconnecting, the dot is replaced (by changing `data-state` on `.buoy-sync`) with a yellow blinker. See `Buoy Spec.md` §8.1.

### 4. FAB — the pill at bottom-center (replaces the purple disc)

`buoy-overlays.jsx → BuoyFab`. Restrained pill, `--primary` background, "+ New todo" label. Rotates to ✕ + flips to a ghost-button look when `data-open="true"`. Full spec in `Buoy Spec.md` §8.3.

### 5. Modals — softened rectangles, big radii (32px)

Add and Detail overlays share `.buoy-modal` shell. Backdrop is full-viewport `rgba(20,14,32,0.42)` + `backdrop-filter: blur(10px) saturate(140%)`. Entrance is a 320ms spring from `{opacity:0, translateY:14, scale:0.96}` → identity.

Form fields use `--radius-md` (16px), `--surface-sunken` fill, focus shows `--border-focus` + `--shadow-focus`. Priority chooser is a `<input type="range" min=0 max=4>` (with the rendered value inverted so the right end is P0/highest) over a colored gradient strip + a live "P2"-style chip on the right that uses the bubble visual recipe in miniature. See spec §8.4 and §8.5.

### 6. Empty / Loading / Reconnecting

- **Empty**: one drifting 96px iridescent bubble + "All clear up here." + "Send your first thought up with the New todo button below." Use `--iri-a/-b/-c` for the gradient stack. Bobs ±10px on a 5s loop. Spec §8.7.
- **Loading**: three pulsing skeleton circles at fixed positions (92/64/44px at canvas %s — see spec §8.8). No shimmer.
- **Reconnecting banner**: yellow pill, pinned top-center inside the canvas wrap, shows after 3 consecutive WS reconnect failures. Spec §8.6.

### 7. Two directions

`<html data-direction>` toggles between **Daydream** (light, default — has a dark companion via `data-theme="dark"`) and **Nightswim** (deep teal, dark-only). All other tokens swap with this single attribute change. Add a settings toggle somewhere unobtrusive — or wire it to `prefers-color-scheme` for an automatic default.

## What's NOT in scope

- Bubble physics. Your existing matter.js setup is fine. The prototype's `buoy-canvas.jsx` ships its own minimal solver only so the prototype is self-contained — **do not port it**.
- WebSocket sync, the `data/todos.md` file format, server-side anything.
- New features (search, filters, sort, multiple lists). The brief is a visual + interaction rework.
- The Tweaks panel (`tweaks-panel.jsx`) — prototype tooling only.
- The "scene picker" pills at the top of the prototype — prototype tooling only.

## How to verify you're done

1. Open the prototype side-by-side with your running Buoy. Bubbles should look identical at every priority level. The pink should feel restrained-coral, not Tailwind-default-purple.
2. Tab through the modals — focus rings (`--shadow-focus`) visible on every interactive element.
3. Flip `<html data-direction="nightswim">` in devtools. The whole app should swap to the teal palette in one frame, with no awkward mid-state colors.
4. Hit Escape on either modal — closes. Click backdrop — closes.
5. With reduced-motion preferred (devtools → Rendering → Emulate CSS prefers-reduced-motion: reduce), the wordmark dot stops bobbing, the skeleton stops pulsing, the iridescent empty-state bubble stops shimmering. Bubbles still move (physics is gameplay, not decoration).

## Per-component reference

**The full per-component spec is in `Buoy Spec.md`.** Every component has: dimensions, padding, border, background, hover/active/focus states, and motion. ASCII layouts show the resting state of each screen. Open it next to your editor and read it section by section.

## Quick-reference: color hexes you'll hard-code into the spec

For convenience — these all live as tokens, but if you need to quote them in PR descriptions or design reviews:

| Token              | Daydream    | Nightswim   |
|--------------------|-------------|-------------|
| `--bg-base`        | `#f3f5f8`   | `#001824`   |
| `--surface`        | `#ffffff`   | `#052f44`   |
| `--text`           | `#221a2e`   | `#f0ecff`   |
| `--primary`        | `#ff5c8a`   | `#6be4c1`   |
| `--prio-0` (vermilion) | `#f05a3a` | `#ff6a4d` |
| `--prio-1` (clay)  | `#ff8a55`   | `#ff9670`   |
| `--prio-2` (sun)   | `#ffcc1f`   | `#ffd54a`   |
| `--prio-3` (sky)   | `#2eb6ff`   | `#3fc1ff`   |
| `--prio-4` (slate) | `#93a4c8`   | `#8b95d6`   |

## Open questions left for you / Eli

(Reproduced from spec §12.)

1. **"Done" semantics.** Prototype pops + removes. If you want a "done bin" / history view, header count row already reserves the slot.
2. **Long-press timing.** 480ms threshold. On touch this competes with the OS long-press menu — may need `touch-action: manipulation` + a CSS `contextmenu` preventDefault on the bubble wrapper.
3. **Wordmark on sync.** Currently bobs on a fixed loop. Alternative: one-shot ripple every time a WS event lands. Sharper, but requires surfacing that event from the sync layer.

---

If anything in the spec is ambiguous, the **prototype is the tiebreaker** — open `Buoy Prototype.html` in a browser and compare directly.

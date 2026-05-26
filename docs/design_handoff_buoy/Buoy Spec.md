# Buoy — Design Handoff Spec

A floating-bubble to-do app. This doc is the implementation contract: every value below maps 1:1 to a CSS custom property in `buoy-styles.css` and every component to a `.buoy-*` class. The interactive prototype next to it is the live spec.

Two directions ship: **Daydream** (light, airy, soap-bubble-in-sunshine — has a dark companion) and **Nightswim** (deep, luminous, dark-only). Switch via `data-direction` on `<html>`, plus `data-theme="dark"` inside Daydream.

---

## 1. The bubble — the one non-negotiable

The bubble is a single `<div class="buoy-bubble">` inside an outer `<div class="buoy-bubble-wrap">`. Matter.js writes `transform: translate3d(…)` on the **wrapper**. Framer-motion animates `scale` / `opacity` on the **inner**. The CSS visual is fully self-contained on the inner — no images, no SVG, no canvas.

### Anatomy (rendered from a single `<div>`)

```
        ╭──────────────╮
       ╱  · spec dot   ╲    ← ::after (white blur, 26%×16% at 18/12)
      │      ____       │   ← top-left highlight gradient (white → transparent)
      │ ╳ Ship the PR  │   ← .buoy-bubble-label (1–2 line clamp)
      │      ____       │
       ╲     (dark)    ╱    ← bottom-right tinted-dark gradient
        ╰──────────────╯
           [iridescent rim ::before — masked annulus 60–92%]
```

### Sizing
`diameter = (22 + priority × 10) × 2` px → **P1 = 64px, P2 = 84px, P3 = 104px, P4 = 124px, P5 = 144px**.
Set as inline `width` / `height` on the wrapper by React. The inner is `width: 100%; height: 100%`.

### Visual recipe (in order, top→bottom in `background:`)
1. **Bottom-right shadow lobe** — `radial-gradient(circle at 72% 80%, color-mix(in oklab, var(--bubble-color) 92%, #000 20%) 0%, … transparent 78%)`. Tinted with the bubble's own color, **never pure black**.
2. **Top-left highlight lobe** — `radial-gradient(circle at 26% 26%, var(--bubble-highlight) 0%, transparent 38%)`. White at `rgba(255,255,255,0.55)` in Daydream / `0.48` in Daydream-dark / `0.45` in Nightswim — deliberately soft, no harsh shine.
3. **Base fill** — `var(--bubble-color)` (the priority color).

### Inset shadows (the depth)
```
inset -6px -10px 22px color-mix(in oklab, var(--bubble-color) 70%, #000 30%),
inset  6px   8px 18px var(--bubble-rim-mix);
```

### Outer shadow (the float)
```css
--shadow-bubble:
  0 6px 14px rgba(34, 26, 46, 0.10),
  0 2px  4px rgba(34, 26, 46, 0.06);   /* Daydream */
```
Nightswim adds a barely-there mint glow: `0 0 32px rgba(107,228,193,0.05)`.

### Iridescent rim — removed
An opt-in iridescent conic-gradient rim once lived behind a `data-bubble-style="rich"` flag. After review it felt too busy at scale; the bubble is now subtle-only. The `--iri-a / --iri-b / --iri-c` tokens are kept and still drive the **empty-state bubble** (which is large, singular, and benefits from the extra shimmer).

### Specular catch-light (`::after`)
White blob, 20%×12%, at `top:14% left:20%`, `background: rgba(255,255,255,0.55)`, `filter: blur(5px)`, `opacity: 0.55`, rotated -18°. Always on. Subtle on purpose — the bubble should read soft, not glossy.

### Priority readability — beyond size and hue
Two more channels stack on top of size + color:

```css
.buoy-bubble {
  --p: 3;
  filter: saturate(calc(0.7 + (var(--p) - 1) * 0.14))
          brightness(calc(0.96 + (var(--p) - 1) * 0.04));
}
```

| Priority | Diameter | Saturation × | Brightness × | Feel              |
|---------:|---------:|-------------:|-------------:|-------------------|
| **P1**   | 64px     | 0.70         | 0.96         | Dusty, recessive  |
| **P2**   | 84px     | 0.84         | 1.00         | Cool, present     |
| **P3**   | 104px    | 0.98         | 1.04         | Default, warm     |
| **P4**   | 124px    | 1.12         | 1.08         | Vivid             |
| **P5**   | 144px    | 1.26         | 1.12         | Luminous, urgent  |

So a P5 next to a P3 is **larger + hotter hue + more saturated + slightly more luminous**. Four channels working together.

### States
- **Hover** (framer-motion on inner) — `scale: 1.06`, spring `{ stiffness: 320, damping: 22, mass: 1 }`.
- **Press / long-press** — `data-pressing="true"` on the wrapper paints a 2px dashed `--primary` ring 8px outside the bubble (0.55s ease-out), and bumps filter to `brightness(1.0 + p×0.06)`.
- **Pop** (on click → done) — framer-motion: `scale 1 → 1.25 → 0`, `opacity 1 → 0` over 350ms cubic-bezier(.16,1,.3,1) + 10 `.buoy-pop-spark` divs flying outward (600ms, individual `--dx` / `--dy` set inline).
- **Enter** — spawn from `y = canvas.height - r - 20`, initial `vy = -1.2 ± 0.4`. Framer enters from `scale: 0 → 1, opacity: 0 → 1`, same spring as hover.
- **Drag** — wrapper takes pointer position directly; physics paused per-body; velocity is sampled from the last 16ms of motion and re-applied on release (capped at ±22 px/frame).

---

## 2. Color tokens

Tokens are CSS custom properties. **Never reach for a raw hex in component CSS — always go through a token.**

### Daydream — light (default)

```css
/* Surfaces */
--bg-base:        #fbf6ef;   /* warm cream */
--bg-canvas:      radial-gradient(120% 80% at 50% 100%, #f0e3f7, #e6eefc 55%, #f1f3fb);
--surface:        #ffffff;
--surface-tint:   #fbf6ef;
--surface-sunken: #f4eee5;

/* Lines */
--border:         rgba(40, 30, 50, 0.08);
--border-strong:  rgba(40, 30, 50, 0.18);
--border-focus:   #ff5c8a;

/* Text */
--text:           #221a2e;
--text-dim:       #6b6378;
--text-faint:     #a39ba8;
--text-on-primary:#ffffff;

/* Semantic */
--primary:        #ff5c8a;   /* coral-rose — FAB, primary CTA */
--primary-hover:  #f74577;
--primary-press:  #d83567;
--danger:         #e8344c;
--success:        #1aa37e;
--warning:        #f0a93b;
--info:           #3a86ff;
```

### Daydream — dark companion (`[data-theme="dark"]`)

```css
--bg-base:        #1c1828;
--bg-canvas:      radial-gradient(120% 80% at 50% 100%, #2c2245, #1a1530 55%, #100c1f);
--surface:        #25203a;
--surface-sunken: #18142c;
--border:         rgba(255, 255, 255, 0.08);
--border-strong:  rgba(255, 255, 255, 0.20);
--text:           #f3edfa;
--text-dim:       #a89fc0;
--text-faint:     #6b6485;
/* --primary stays #ff5c8a — coral pops on dark too */
```

### Nightswim — deep / luminous

```css
--bg-base:        #001824;
--bg-canvas:      radial-gradient(140% 100% at 50% 110%, #023a59, #012133 40%, #00101a);
--surface:        #052f44;
--surface-sunken: #021823;
--border:         rgba(160, 180, 255, 0.10);
--border-strong:  rgba(160, 180, 255, 0.22);
--text:           #f0ecff;
--text-dim:       #9d96c4;
--text-faint:     #5e587e;
--primary:        #6be4c1;   /* mint — glows on deep teal */
--text-on-primary:#06251c;
--danger:         #ff6b80;
--success:        #5be4a8;
--warning:        #f7c062;
--info:           #79a8ff;
```

### Priority palette

| Token        | Daydream     | Nightswim    | Reads as  |
|--------------|--------------|--------------|-----------|
| `--prio-1`   | `#93a4c8`    | `#8b95d6`    | dust slate |
| `--prio-2`   | `#2eb6ff`    | `#3fc1ff`    | electric sky |
| `--prio-3`   | `#ffcc1f`    | `#ffd54a`    | hi-vis sunshine — default |
| `--prio-4`   | `#ff8a55`    | `#ff9670`    | clay |
| `--prio-5`   | `#f05a3a`    | `#ff6a4d`    | vermilion — urgent |

### Iridescent pair (used in bubble rim + empty-state bubble)

| Token     | Daydream    | Nightswim   |
|-----------|-------------|-------------|
| `--iri-a` | `#ffd5e8`   | `#6ad0ff`   |
| `--iri-b` | `#c4e2ff`   | `#ff9bd6`   |
| `--iri-c` | `#fff6c9`   | `#fff1a8`   |

---

## 3. Type

| Token         | Value                                            |
|---------------|--------------------------------------------------|
| `--font-display` | `"Fraunces", "Iowan Old Style", Georgia, serif` |
| `--font-body`    | `"Inter", system-ui, -apple-system, sans-serif` |
| `--font-mono`    | `ui-monospace, "SF Mono", monospace`            |

### Scale
| Token | px | Used for |
|-------|---:|----------|
| `--fs-xs`      | 12 | meta, hints, kbd |
| `--fs-sm`      | 14 | body small, secondary copy, button text |
| `--fs-md`      | 16 | body |
| `--fs-lg`      | 20 | detail title |
| `--fs-xl`      | 28 | modal title, empty title, wordmark |
| `--fs-display` | 40 | reserved for future hero |

Bubble label is `clamp(11px, 16%, 17px)` — scales with bubble size, never below 11.

Line heights: `--lh-tight 1.15`, `--lh-snug 1.32`, `--lh-body 1.5`.

Body / UI uses Inter; the wordmark, modal titles, and detail titles use Fraunces (just enough warmth to make the app feel personal without going full serif everywhere).

---

## 4. Spacing — 4px base

```
--space-1: 4   --space-2: 8    --space-3: 12
--space-4: 16  --space-5: 24   --space-6: 32
--space-7: 48  --space-8: 64
```

Component padding mostly lives in 16/24/32. Inline gaps lean on 8/12/16.

---

## 5. Radii

```
--radius-sm:   8px   /* inputs */
--radius-md:  16px   /* small cards */
--radius-lg:  24px   /* canvas wrap */
--radius-xl:  32px   /* modals */
--radius-pill: 9999px
```

A bubble app should be allergic to sharp corners — the smallest radius in use anywhere is 8px, and only on the form inputs.

---

## 6. Elevation

```css
--shadow-1: 0 1px  2px rgba(34,26,46,0.05), 0 2px  6px rgba(34,26,46,0.06);
--shadow-2: 0 4px 10px rgba(34,26,46,0.06), 0 12px 30px rgba(34,26,46,0.10);
--shadow-3: 0 12px 28px rgba(34,26,46,0.12), 0 32px 80px rgba(34,26,46,0.18);

--shadow-bubble: 0 6px 14px rgba(34,26,46,0.10), 0 2px 4px rgba(34,26,46,0.06);
--shadow-focus:  0 0 0 4px rgba(255, 92, 138, 0.28);
```

Nightswim uses heavier opacities (0.40–0.65) on the same recipe so depth survives the dark background.

`--shadow-1` is for resting FAB and modal-button rest. `--shadow-2` is for the FAB on hover, and the modal itself. `--shadow-3` is for the modal on entrance and any "lifted from page" surface. Bubble has its own bespoke shadow because the inset / outset balance is tuned for spheres specifically.

---

## 7. Motion

```
--ease-standard: cubic-bezier(0.32, 0.72, 0.21, 1);   /* everyday transitions */
--ease-spring:   cubic-bezier(0.22, 1.4, 0.36, 1);     /* modal in, FAB rotate */
--ease-out:      cubic-bezier(0.16, 1, 0.3, 1);        /* bubble pop, banner in */

--duration-fast: 140ms   /* hover, press */
--duration-mid:  260ms   /* modal in, banner in */
--duration-slow: 420ms   /* (reserved) */
```

Framer-motion springs (single source of truth — these are the motion vocabulary):
- **Bubble hover / squish:** `spring(stiffness: 320, damping: 22, mass: 1)`
- **Bubble enter:** same hover spring, from `{ scale: 0, opacity: 0 }`.
- **Bubble pop (done):** `tween 350ms ease-out` — scale 1 → 1.25 → 0, opacity 1 → 0.
- **FAB icon rotate (+ → ✕):** `spring(stiffness: 260, damping: 18)` — uses `--ease-spring`.
- **Modal entrance:** `tween 320ms ease-spring` — `{opacity: 0, translateY: 14, scale: 0.96}` → identity.
- **Backdrop entrance:** `tween 260ms ease-out` — opacity 0 → 1.
- **Banner entrance:** `tween 320ms ease-spring`.

Physics ticks (matter.js) at 60Hz — these aren't motion tokens, they're physics constants:
- `gravity = -0.16` (calm: -0.10, lively: -0.26)
- `drag = 0.990` per frame
- `attract = 0.0014 × (rA + rB) / 2 / d`, capped within 280px
- `jiggle = 0.08` magnitude every 1.5s per idle bubble

---

## 8. Components — per-component specs

### 8.1 Header (`.buoy-header`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Bu◔y     ●Live   7 active · 2 done                                  │
└──────────────────────────────────────────────────────────────────────┘
```

- Layout: `padding: 24px 32px 16px`, flex row, space-between.
- Wordmark (`.buoy-wordmark`): Fraunces 28px / weight 600 / tracking -0.02em. The **"o" is a real bubble** — `.buoy-wm-dot`, 0.7em diameter, full iridescent recipe, animated `transform: translateY ± 0.05em scale 1.04` on a 4.8s ease-in-out loop. It **bobs constantly** — that's the live-sync personality. When `sync="reconnecting"` the dot's bobbing is replaced by a yellow blink (see sync indicator).
- Sync indicator (`.buoy-sync`):
  - `data-state="live"` → green dot (`--success`) with a pulsing 9px radial shadow on a 2.6s loop. Label: "Live".
  - `data-state="reconnecting"` → yellow dot (`--warning`) blinking opacity 1↔0.35 every 0.9s. Label: "Reconnecting…".
  - `data-state="offline"` → red dot (`--danger`), static. Label: "Offline".
- Counts: `<strong>` for the number, `<em>` (no italic) for the label. Tabular-nums. A 2px round separator between active and done.

### 8.2 Canvas wrap (`.buoy-canvas-wrap`)

Inset card the bubbles live in. `flex: 1; margin: 0 24px 16px; border-radius: 32px; overflow: hidden; background: var(--bg-canvas);` plus a faint radial vignette via `::before` (6% darken at the edges). The whole thing is `position: relative; isolation: isolate` so popping particles & banner stack inside it.

### 8.3 Footer + FAB (`.buoy-footer`, `.buoy-fab`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [click] done · [hold] details · [dbl] delete · [drag] throw         │
│                                                                      │
│                          ╭───────────────╮                           │
│                          │  +  New todo  │  ← FAB pill, bottom-center│
│                          ╰───────────────╯                           │
└──────────────────────────────────────────────────────────────────────┘
```

**FAB — the restrained pill**
- Default: `padding: 14px 24px 14px 20px`, `border-radius: 9999px`, `font-weight: 600`, `font-size: 16px`. Label "New todo" with a 18×18 plus icon.
- Background `var(--primary)`. Color `var(--text-on-primary)`.
- Box-shadow: a 1px white inset top + 2px dark inset bottom + `--shadow-2` (the "stamped" look that says button without being skeuomorphic).
- **Hover:** `--primary-hover` + `translateY(-1px)` + `--shadow-3`.
- **Active / press:** `--primary-press` + `translateY(0)` + inset `0 2px 4px rgba(0,0,0,.18)` + `--shadow-1` (depresses into the page).
- **Focus-visible:** `--shadow-focus` (4px coral halo) added to the shadow stack.
- **Open state** (`data-open="true"`): swaps to `var(--surface)` background, text color `var(--text)`, inset 1px border, and the plus icon rotates 135° (becomes ✕) on a 260ms spring. The pill stays the same width — copy changes to "Close".

**Hint row** — `.buoy-hint` absolutely positioned bottom-left of the footer, `--fs-xs` `--text-faint`, with `<kbd>` chips for the verbs. Hides under 720px.

### 8.4 Add modal (`.buoy-modal`, opened on FAB tap)

```
            ┌─────────────────────────────────────┐
            │  New todo                           │
            │  Bubbles rise on their own —        │
            │  bigger and brighter the more       │
            │  urgent.                            │
            │                                     │
            │  Title                              │
            │  ┌───────────────────────────────┐  │
            │  │ e.g. Ship the PR              │  │
            │  └───────────────────────────────┘  │
            │                                     │
            │  Priority                           │
            │  ─────●────────────    [   P3   ]  │
            │                                     │
            │  Description · optional             │
            │  ┌───────────────────────────────┐  │
            │  │                               │  │
            │  └───────────────────────────────┘  │
            │                                     │
            │              [Cancel]  [+ Send it up]│
            └─────────────────────────────────────┘
```

- Backdrop: full-viewport `rgba(20,14,32,0.42)` + `backdrop-filter: blur(10px) saturate(140%)`. Click outside dismisses; Esc dismisses.
- Modal card: max-width 440px, `border-radius: 32px` (`--radius-xl`), `padding: 32px`, `background: var(--surface)`, 1px `--border`, `--shadow-3`.
- Entrance: `from { opacity:0, translateY:14px, scale:0.96 }` to identity via `--ease-spring`, 320ms.
- Title: Fraunces 28/600/-0.015em.

**Field (`.buoy-field`)**
- Stacked: label (`.buoy-field-label`, 14px/500/`--text-dim`) above input. Gap 8px.
- Input/textarea (`.buoy-input`, `.buoy-textarea`):
  - `padding: 12px 14px`, `border-radius: 16px` (`--radius-md`), `background: var(--surface-sunken)`, `border: 1px solid var(--border)`.
  - **Hover:** `border-color: var(--border-strong)`.
  - **Focus:** `border-color: var(--border-focus)` + `background: var(--surface)` + `box-shadow: var(--shadow-focus)`.
  - Placeholder color `var(--text-faint)`.
  - Textarea min-height 64px, resize: vertical.

**Priority chooser (`.buoy-prio`)**
- Row: track (`flex: 1`) + 76×40 colored chip.
- Track has a colored gradient strip behind the thumb showing the priority palette in segments.
- Thumb is a 22px circle, 2px `var(--text)` ring, white fill, `--shadow-1`.
- Chip uses the bubble recipe at small scale — same inset shadows, currently-selected prio color. Updates instantly on slider change. Reads "P1" through "P5".

**Modal actions (`.buoy-actions`)**
- Right-aligned, gap 12px.
- **Primary button (`.buoy-btn-primary`)** — pill, `--primary` bg, white text, the same stamped-button shadow recipe at `--shadow-1`. Hover lifts 1px to `--primary-hover`. Disabled at 50% opacity when title is empty.
- **Ghost button (`.buoy-btn-ghost`)** — transparent, `--text-dim` text. Hover fills with `--surface-sunken`, text → `--text`.

### 8.5 Detail overlay (`.buoy-modal` with detail content)

```
            ┌─────────────────────────────────────┐
            │  ╭P3╮  Buy milk                     │
            │  ╰──╯                               │
            │  From the corner store. Whole, not  │
            │  skim.                              │
            │                                     │
            │  ─────────────────────────────────  │
            │                                     │
            │  status     active                  │
            │  created    2026-05-25 08:00        │
            │  priority   P3 · steady             │
            │  id         a1b2c3d4                │
            │                                     │
            │  [Delete]               [Mark done] │
            └─────────────────────────────────────┘
```

Same modal shell as Add. Differences:
- **Detail head** — a 44×44 round chip (`.buoy-detail-chip`, the bubble recipe in miniature) carrying the priority text ("P3"), beside the title in Fraunces 20/600.
- **Body** — `--text-dim`, 14px, line-height 1.5.
- **Divider** — `.buoy-divider` 1px `--border`, no margin.
- **Meta list** — `<dl>` in CSS Grid `84px 1fr`, dt is `--text-faint`/500, dd is `--text`/tabular-nums. The `id` row uses `--font-mono` 13px / `--text-dim`.
- **Actions** — `justify-content: space-between`. Left: `.buoy-btn-danger` (transparent w/ 1px border, `--danger` text; hover → `--danger-soft` bg + 1px `--danger` border; active → `--danger` fill, white text). Right: `.buoy-btn-primary` "Mark done" (or "Send it up again" if already done).

### 8.6 Reconnecting banner (`.buoy-banner`)

```
                       ┌──────────────────────────────────┐
                       │ ● Can't reach the server.        │
                       │   Retrying… attempt 4    [Retry] │
                       └──────────────────────────────────┘
```

- Strip pinned to the top of the canvas wrap (not the page), centered horizontally with `transform: translateX(-50%)`.
- `padding: 10px 16px 10px 14px`, `border-radius: 9999px`, `background: var(--warning-soft)`, 1px border `color-mix(--warning 60%, transparent)`.
- Yellow blinking 7px dot on the left.
- Action button is ghost-style on the right ("Retry now"). Hover: 6% black overlay.
- Entrance: `opacity 0 / translateY(-8px)` → identity via `--ease-spring`.
- Appears after 3 consecutive failed WS reconnect attempts. Stays until reconnected.

### 8.7 Empty state (`.buoy-empty`)

```
                              ╭────╮
                              │    │   ← single, drifting iridescent bubble
                              ╰────╯      (96px, bobs ±10px on 5s loop)
                       All clear up here.
                Send your first thought up with the
                  [New todo] button below.
```

- A single 96px bubble (`.buoy-empty-bubble`) using the full iridescent recipe (with `::before` rim + the conic-gradient base, no priority filter), bobbing on a 5s ease-in-out loop.
- Title: Fraunces 28/600 — `--text`.
- Subtitle: 14px `--text-dim`. The string "New todo" is bolded into `--text` to nudge the eye toward the FAB.

### 8.8 Loading skeleton (`.buoy-skeleton`)

Three faintly-pulsing circles where bubbles would appear. Sizes 92 / 64 / 44 (mirroring P5 / P3 / P1) at fixed canvas positions (52/28, 30/52, 70/62). Each pulses opacity 0.35↔0.65 + scale 0.98↔1.02 on a 1.8s loop, staggered by 0.3s. **No shimmer** — too noisy for a calm app.

### 8.9 Scene picker (`.buoy-scene`)

**Prototype-only chrome.** Not part of the real app — it's the row of pills at the top of the prototype that lets the reviewer jump between Active / Empty / Loading / Reconnecting states. Strip it when shipping.

---

## 9. Tweaks exposed in the prototype

The Tweaks panel (bottom-right, toggle from the toolbar) reads/writes:

| Key            | Values                                  | Effect |
|----------------|-----------------------------------------|--------|
| `direction`    | `daydream` / `nightswim`                | Swaps the whole token set. |
| `theme`        | `light` / `dark`                         | Only meaningful in Daydream (Nightswim is dark-only). |
| `motion`       | `calm` / `normal` / `lively`            | Gravity, drag, attraction, jiggle magnitudes. |
| `density`      | `sparse` (3) / `normal` (7) / `full` (12) / `swarm` (20) | Bubble count + seeded titles. |

---

## 10. Accessibility checklist

- All modals trap focus on open, return focus to the FAB on close.
- Escape closes both modals; backdrop click closes both.
- Visible focus rings via `--shadow-focus` on every interactive element.
- `aria-expanded` on FAB; `role="dialog"` + `aria-labelledby` on detail overlay; `role="status" aria-live="polite"` on the reconnecting banner.
- Bubbles are mouse/touch-only by design — but the FAB, modal, and detail overlay are fully keyboard-navigable.
- `prefers-reduced-motion` → all CSS animations clamp to 0.01ms (kills the wordmark bob, the iridescent spin, the skeleton pulse, the banner-dot blink). Framer-motion respects the same media query.
- Touch targets: FAB ≥ 56px tall; modal buttons 40px tall; scene-picker pills 28px (prototype only).

---

## 11. What lives where

```
buoy-styles.css            — every token + every component class.
                             The single stylesheet you'll keep.
buoy-canvas.jsx            — physics + bubble rendering (replace with your matter.js if preferred).
buoy-overlays.jsx          — header, footer, FAB, add modal, detail, banner, empty, loading.
buoy-app.jsx               — top-level composition + tweak/scene state.
tweaks-panel.jsx           — the floating Tweaks UI (prototype only).
Buoy Prototype.html        — entry.
```

---

## 12. Open questions / things I'd push back on

1. **"Done" semantics.** The brief says click → mark done → bubble pops. Right now "done" = removed from screen. If you want a "done bin" (separate area / history view) that's worth a follow-up — the counts row already reserves the slot ("7 active · 2 done").
2. **Long-press timing.** 480ms feels right for desktop right-click parity, but on touch this competes with the system-level long-press menu. May need to suppress that via `touch-action: manipulation` + a brief CSS contextmenu prevent on the bubble wrapper.
3. **Wordmark "personality" on sync.** Currently the dot bobs on a fixed loop. An alternative is to one-shot a "ripple" animation every time a sync event arrives — sharper feedback, but requires you to surface that event from the WS layer.

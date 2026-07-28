# 11 — Keyboard UX patterns

Notes on keyboard-driven interactions in Buoy and the techniques used to
implement them cleanly.

---

## The invisible focus proxy

**Problem:** The priority field uses a `<input type="range">` slider for mouse
interaction. Range inputs participate in the tab order, but their keyboard
behaviour is awkward — you can't intercept digit keys cleanly, and any `0–4`
keydown that fires while a *real* text input has focus will leak the character
into that field.

**Solution:** Pull the range out of the tab order (`tabIndex={-1}`) and insert
a tiny invisible `<input type="text" readOnly>` — the *proxy* — in its place.
The proxy is visually hidden (`opacity:0; width:0; height:0`) so it takes up no
space and shows no cursor, but it's a real focusable DOM node. All keyboard
logic lives in its `onKeyDown`.

```jsx
// The proxy — invisible, in tab order, owns all keyboard logic
<input
  ref={priorityProxyRef}
  className="priority-proxy"
  type="text"
  inputMode="none"   // suppresses mobile soft keyboard
  readOnly           // prevents any character insertion
  aria-label="Priority selector — use 0–4 or arrow keys"
  onKeyDown={onPriorityProxyKey}
/>

// The visual slider — mouse only, out of tab order
<input
  tabIndex={-1}
  type="range"
  min="0" max="4" step="1"
  value={4 - priority}
  onChange={(e) => setPriority(4 - Number(e.target.value))}
  aria-hidden="true"
/>
```

```js
function onPriorityProxyKey(e) {
  if (e.key === 'Enter')       { e.preventDefault(); descRef.current?.focus(); return; }
  if (/^[0-4]$/.test(e.key))  { e.preventDefault(); setPriority(Number(e.key)); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')  { e.preventDefault(); setPriority((p) => Math.min(4, p + 1)); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   { e.preventDefault(); setPriority((p) => Math.max(0, p - 1)); }
}
```

**Why `readOnly` instead of `disabled`?** Disabled inputs are skipped by the
tab order entirely. `readOnly` keeps the element focusable but prevents the
browser from inserting characters — combined with `e.preventDefault()` on every
handled key, nothing ever reaches the input's value.

**Why `inputMode="none"`?** On mobile, focusing any text input normally pops
the soft keyboard. `inputMode="none"` suppresses it for this proxy.

**Focus ring:** The proxy itself stays invisible even when focused. A CSS
`:has()` rule on the parent `.field` applies the standard focus ring to the
visible `.priority-track` instead:

```css
.priority-proxy {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0; height: 0;
  padding: 0; border: 0;
}
.field:has(.priority-proxy:focus-visible) .priority-track {
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-focus);
}
```

**When to use this pattern:** Any time you have a custom visual control
(slider, colour swatch, star rating, segmented button) that needs to live in
the keyboard tab order and accept specific key inputs, but whose native element
type doesn't support clean `onKeyDown` interception without side-effects.

---

## Global shortcut keys

Single-letter shortcuts (e.g. `a` to open the add modal) are registered on
`window` via `useEffect`. Two rules keep them safe:

1. **Skip when a real input is focused** — check `document.activeElement.tagName`
   before acting.
2. **`e.preventDefault()`** — critical when the shortcut opens a modal that
   immediately focuses an input. Without it, the keystroke fires, the modal
   opens, the input receives focus, and the same event is then delivered to
   the now-focused input, typing the character.

```js
useEffect(() => {
  function onKey(e) {
    if (e.key !== 'a' && e.key !== 'A') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    e.preventDefault(); // must come before setOpen, which schedules a focus
    setOpen((v) => !v);
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

---

## Enter-to-advance flow

Rather than submitting on Enter from any field (the default form behaviour),
each field explicitly routes Enter to the next logical stop:

| Field | Enter goes to |
|-------|--------------|
| Title | Priority proxy |
| Priority proxy | Description |
| Description | Submit button (focused, not submitted) |
| Submit button | Submits the form |

This gives a predictable keyboard-only path through the form without the user
needing to reach for Tab. Tab/Shift-Tab still work normally alongside it.

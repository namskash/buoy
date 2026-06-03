// buoy-overlays.jsx
// Header, FAB, Add modal, Detail overlay, Banner, Empty + Loading states.

const { useState, useEffect, useRef } = React;

// ─── Icons (single-color SVG, inline) ──────────────────────────────────────
function PlusIcon() {
  return (
    <svg className="buoy-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="buoy-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────
function BuoyHeader({ active, done, sync }) {
  return (
    <header className="buoy-header">
      <div className="buoy-wordmark" aria-label="Buoy">
        Bu<span className="buoy-wm-dot" aria-hidden="true" />y
      </div>
      <div className="buoy-syncstrip">
        <span className="buoy-sync" data-state={sync}>
          <span className="buoy-sync-dot" />
          {sync === 'live' && 'Live'}
          {sync === 'reconnecting' && 'Reconnecting…'}
          {sync === 'offline' && 'Offline'}
        </span>
        <span className="buoy-counts">
          <strong>{active}</strong> <em>active</em>
          <span className="buoy-sep" />
          <strong>{done}</strong> <em>done</em>
        </span>
      </div>
    </header>
  );
}

// ─── FAB (pill, bottom-center) ─────────────────────────────────────────────
function BuoyFab({ open, onToggle }) {
  return (
    <button
      className="buoy-fab"
      data-open={open}
      onClick={onToggle}
      aria-label={open ? 'Close add todo' : 'Add a todo'}
      aria-expanded={open}
    >
      <span className="buoy-fab-icon">
        <PlusIcon />
      </span>
      <span>{open ? 'Close' : 'New todo'}</span>
    </button>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────
function BuoyFooter({ open, onToggleFab }) {
  return (
    <footer className="buoy-footer">
      <span className="buoy-hint">
        <kbd>click</kbd> done · <kbd>hold</kbd> details · <kbd>dbl</kbd> delete · <kbd>drag</kbd> throw
      </span>
      <BuoyFab open={open} onToggle={onToggleFab} />
    </footer>
  );
}

// ─── Add Modal ─────────────────────────────────────────────────────────────
function BuoyAddModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [desc, setDesc] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, priority, description: desc.trim() });
  };

  return (
    <div className="buoy-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="buoy-modal" onSubmit={submit}>
        <div>
          <h2 className="buoy-modal-title">New todo</h2>
          <p className="buoy-modal-sub" style={{ marginTop: 6 }}>
            Bubbles rise on their own — bigger and brighter the more urgent.
          </p>
        </div>

        <div className="buoy-field">
          <label className="buoy-field-label" htmlFor="todo-title">Title</label>
          <input
            ref={inputRef}
            id="todo-title"
            className="buoy-input"
            placeholder="e.g. Ship the PR"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="buoy-field">
          <label className="buoy-field-label">Priority</label>
          <div className="buoy-prio">
            <div className="buoy-prio-track">
              <div className="buoy-prio-bg" aria-hidden="true" />
              <input
                type="range"
                min={0} max={4} step={1}
                value={4 - priority}
                onChange={(e) => setPriority(4 - +e.target.value)}
                aria-label="Priority 0 to 4 (right is highest)"
              />
            </div>
            <span
              className="buoy-prio-chip"
              style={{ '--bubble-color': `var(--prio-${priority})` }}
            >
              P{priority}
            </span>
          </div>
        </div>

        <div className="buoy-field">
          <label className="buoy-field-label" htmlFor="todo-desc">Description <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· optional</span></label>
          <textarea
            id="todo-desc"
            className="buoy-textarea"
            placeholder="Anything to remember about this one…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
        </div>

        <div className="buoy-actions">
          <button type="button" className="buoy-btn buoy-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="buoy-btn buoy-btn-primary" disabled={!title.trim()}>
            <PlusIcon /> Send it up
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Detail Overlay ────────────────────────────────────────────────────────
function BuoyDetailOverlay({ todo, onClose, onDelete, onToggle }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!todo) return null;

  return (
    <div className="buoy-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="buoy-modal" style={{ maxWidth: 420 }} role="dialog" aria-labelledby="detail-title">
        <div className="buoy-detail-head">
          <span
            className="buoy-detail-chip"
            style={{ '--bubble-color': `var(--prio-${todo.priority})` }}
            aria-label={`Priority ${todo.priority}`}
          >
            P{todo.priority}
          </span>
          <h2 className="buoy-detail-title" id="detail-title">{todo.title}</h2>
        </div>

        {todo.description && (
          <p className="buoy-detail-body">{todo.description}</p>
        )}

        <hr className="buoy-divider" />

        <dl className="buoy-detail-meta">
          <dt>status</dt>      <dd>{todo.done ? 'done' : 'active'}</dd>
          <dt>created</dt>     <dd>{todo.created}</dd>
          <dt>priority</dt>    <dd>P{todo.priority} <span style={{ color: 'var(--text-faint)' }}>· {['urgent','hot','warm','steady','calm'][todo.priority]}</span></dd>
          <dt>id</dt>          <dd className="id-mono">{todo.id.slice(0, 8)}</dd>
        </dl>

        <div className="buoy-actions" style={{ justifyContent: 'space-between' }}>
          <button className="buoy-btn buoy-btn-danger" onClick={() => { onDelete(todo.id); onClose(); }}>
            Delete
          </button>
          <button className="buoy-btn buoy-btn-primary" onClick={() => { onToggle(todo.id); onClose(); }}>
            {todo.done ? 'Send it up again' : 'Mark done'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reconnecting banner ───────────────────────────────────────────────────
function BuoyBanner({ attempt, onRetry }) {
  return (
    <div className="buoy-banner" role="status" aria-live="polite">
      <span className="buoy-banner-dot" aria-hidden="true" />
      <span>Can't reach the server. Retrying…
        <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>attempt {attempt}</span>
      </span>
      <button className="buoy-banner-action" onClick={onRetry}>Retry now</button>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function BuoyEmpty({ onAdd }) {
  return (
    <div className="buoy-empty">
      <div className="buoy-empty-inner" style={{ pointerEvents: 'auto' }}>
        <div className="buoy-empty-bubble" />
        <h2 className="buoy-empty-title">All clear up here.</h2>
        <p className="buoy-empty-sub">
          Send your first thought up with the <strong style={{ color: 'var(--text)' }}>New todo</strong> button below.
        </p>
      </div>
    </div>
  );
}

// ─── Loading state ─────────────────────────────────────────────────────────
function BuoyLoading() {
  const skeletons = [
    { size: 92, x: '52%', y: '28%', delay: '0s' },
    { size: 64, x: '30%', y: '52%', delay: '0.3s' },
    { size: 44, x: '70%', y: '62%', delay: '0.6s' },
  ];
  return (
    <>
      {skeletons.map((s, i) => (
        <div
          key={i}
          className="buoy-skeleton"
          style={{
            width: s.size,
            height: s.size,
            left: s.x,
            top: s.y,
            transform: 'translate(-50%, -50%)',
            animationDelay: s.delay,
          }}
        />
      ))}
    </>
  );
}

window.BuoyHeader = BuoyHeader;
window.BuoyFooter = BuoyFooter;
window.BuoyFab = BuoyFab;
window.BuoyAddModal = BuoyAddModal;
window.BuoyDetailOverlay = BuoyDetailOverlay;
window.BuoyBanner = BuoyBanner;
window.BuoyEmpty = BuoyEmpty;
window.BuoyLoading = BuoyLoading;

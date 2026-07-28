// Floating + button bottom-right opens a modal with the add form.
// AnimatePresence handles the fade/scale of the modal.

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AddTodoModal({ onAdd, section }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [description, setDescription] = useState('');
  const titleRef = useRef(null);
  const priorityProxyRef = useRef(null);
  const descRef = useRef(null);
  const submitRef = useRef(null);

  // 'a' key toggles the modal (skip when user is typing in another input/textarea).
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'a' && e.key !== 'A') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the title field when the modal opens.
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  // Invisible proxy input that owns keyboard focus for the priority field.
  // 0-4 sets priority directly; arrows nudge it; Enter moves to description.
  function onPriorityProxyKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); descRef.current?.focus(); return; }
    if (/^[0-4]$/.test(e.key)) { e.preventDefault(); setPriority(Number(e.key)); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setPriority((p) => Math.min(4, p + 1)); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setPriority((p) => Math.max(0, p - 1)); }
  }

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), priority, description: description.trim() || undefined, section: section ?? undefined });
    setTitle(''); setPriority(2); setDescription('');
    setOpen(false);
  }

  return (
    <>
      <button
        className="fab"
        data-open={open}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close add todo' : 'Add a todo'}
        aria-expanded={open}
      >
        <span className="fab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        </span>
        <span>{open ? 'Close' : 'New todo'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.form
              className="modal add-modal"
              initial={{ scale: 0.96, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submit}
            >
              <div>
                <h2 className="modal-title">New todo</h2>
                <p className="modal-sub">Bubbles rise on their own — bigger and brighter the more urgent.</p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="todo-title">Title</label>
                <input
                  ref={titleRef}
                  id="todo-title"
                  className="text-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); priorityProxyRef.current?.focus(); } }}
                  placeholder="e.g. Ship the PR"
                  maxLength={120}
                />
              </div>

              <div className="field">
                <label className="field-label">Priority</label>
                {/* Invisible proxy that owns keyboard focus for priority — prevents 0-4 leaking into real inputs */}
                <input
                  ref={priorityProxyRef}
                  className="priority-proxy"
                  type="text"
                  inputMode="none"
                  readOnly
                  aria-label="Priority selector — use 0–4 or arrow keys"
                  onKeyDown={onPriorityProxyKey}
                />
                <div className="priority-row">
                  <div className="priority-track">
                    <div className="priority-bg" aria-hidden="true" />
                    <input
                      tabIndex={-1}
                      type="range"
                      min="0"
                      max="4"
                      step="1"
                      value={4 - priority}
                      onChange={(e) => setPriority(4 - Number(e.target.value))}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className="priority-chip"
                    style={{ '--bubble-color': `var(--prio-${priority})` }}
                  >
                    P{priority}
                  </span>
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="todo-desc">
                  Description <span className="field-optional">· optional</span>
                </label>
                <textarea
                  ref={descRef}
                  id="todo-desc"
                  className="text-input"
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitRef.current?.focus(); } }}
                  placeholder="Anything to remember about this one…"
                  maxLength={256}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button ref={submitRef} type="submit" className="btn btn-primary" disabled={!title.trim()}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  </svg>
                  Send it up
                </button>
              </div>

              <div className="modal-kbd-hints">
                <span><kbd>tab</kbd> next field</span>
                <span className="hint-sep">·</span>
                <span><kbd>shift+tab</kbd> prev</span>
                <span className="hint-sep">·</span>
                <span><kbd>0–4</kbd> priority</span>
                <span className="hint-sep">·</span>
                <span><kbd>enter</kbd> next / submit</span>
                <span className="hint-sep">·</span>
                <span><kbd>esc</kbd> close</span>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

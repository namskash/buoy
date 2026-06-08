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
                  placeholder="e.g. Ship the PR"
                  maxLength={120}
                />
              </div>

              <div className="field">
                <label className="field-label">Priority</label>
                <div className="priority-row">
                  <div className="priority-track">
                    <div className="priority-bg" aria-hidden="true" />
                    <input
                      type="range"
                      min="0"
                      max="4"
                      step="1"
                      value={4 - priority}
                      onChange={(e) => setPriority(4 - Number(e.target.value))}
                      aria-label="Priority 0 to 4 (right is highest)"
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
                  id="todo-desc"
                  className="text-input"
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.replace(/\n/g, ' '))}
                  placeholder="Anything to remember about this one…"
                  maxLength={256}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  </svg>
                  Send it up
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

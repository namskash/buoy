// Controlled modal for editing an existing todo. Opens when `todo` is non-null.
// Same form layout as AddTodoModal, pre-populated from the todo prop.

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function EditTodoModal({ todo, onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [description, setDescription] = useState('');
  const titleRef = useRef(null);

  // Sync form state when the todo being edited changes.
  useEffect(() => {
    if (todo) {
      setTitle(todo.title ?? '');
      setPriority(todo.priority ?? 2);
      setDescription(todo.description ?? '');
    }
  }, [todo]);

  // Close on Escape.
  useEffect(() => {
    if (!todo) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [todo, onClose]);

  // Focus title on open.
  useEffect(() => {
    if (todo) titleRef.current?.focus();
  }, [todo]);

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(todo.id, {
      title: title.trim(),
      priority,
      description: description.trim() || undefined,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {todo && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
              <h2 className="modal-title">Edit todo</h2>
              <p className="modal-sub">Update the details below.</p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="edit-todo-title">Title</label>
              <input
                ref={titleRef}
                id="edit-todo-title"
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
              <label className="field-label" htmlFor="edit-todo-desc">
                Description <span className="field-optional">· optional</span>
              </label>
              <textarea
                id="edit-todo-desc"
                className="text-input"
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value.replace(/\n/g, ' '))}
                placeholder="Anything to remember about this one…"
                maxLength={256}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                Save changes
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

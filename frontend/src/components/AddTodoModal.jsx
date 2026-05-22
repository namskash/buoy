// Floating + button bottom-right opens a modal with the add form.
// AnimatePresence handles the fade/scale of the modal.

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AddTodoModal({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(3);
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
    onAdd({ title: title.trim(), priority, description: description.trim() || undefined });
    setTitle(''); setPriority(3); setDescription('');
    setOpen(false);
  }

  return (
    <>
      <button
        className={`fab ${open ? 'fab-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Add a todo"
        aria-label="Add a todo"
      >
        <span className="fab-plus">+</span>
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
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submit}
            >
              <h2>New todo</h2>
              <label>
                Title
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs doing?"
                />
              </label>

              <label>
                Priority
                <div className="priority-row">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                  <span className={`priority-value prio-${priority}`}>P{priority}</span>
                </div>
              </label>

              <label>
                Description <span className="dim">(optional)</span>
                <textarea
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="More context, links, etc."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit">Add</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

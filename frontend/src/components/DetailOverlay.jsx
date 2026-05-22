// Detail overlay for a single todo. Opened via right-click or long-press
// on a bubble. Shows everything we know and exposes Done/Undone + Delete.

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function DetailOverlay({ todo, onClose, onToggle, onRemove }) {
  // Close on Escape.
  useEffect(() => {
    if (!todo) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [todo, onClose]);

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
          <motion.div
            className="modal detail-modal"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="detail-header">
              <span className={`priority-value prio-${todo.priority}`}>P{todo.priority}</span>
              <h2>{todo.title}</h2>
            </header>

            {todo.description ? (
              <p className="detail-desc">{todo.description}</p>
            ) : (
              <p className="detail-desc dim"><em>No description</em></p>
            )}

            <dl className="detail-meta">
              <dt>Status</dt>
              <dd>{todo.done ? '✓ Done' : '○ Active'}</dd>
              <dt>Created</dt>
              <dd>{formatDate(todo.created)}</dd>
              {todo.completed && (<>
                <dt>Completed</dt>
                <dd>{formatDate(todo.completed)}</dd>
              </>)}
              <dt>id</dt>
              <dd><code>{todo.id}</code></dd>
            </dl>

            <div className="modal-actions">
              <button
                type="button"
                className="danger"
                onClick={() => { onRemove(todo.id); onClose(); }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => { onToggle(todo); onClose(); }}
              >
                {todo.done ? 'Mark active' : 'Mark done'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

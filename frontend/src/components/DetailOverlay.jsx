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

export default function DetailOverlay({ todo, onClose, onToggle, onRemove, onEdit }) {
  // The caller closes the detail overlay before opening the edit form.
  useEffect(() => {
    if (!todo) return;
    function onKey(e) {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || e.repeat ||
          e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) return;

      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'd') { e.preventDefault(); onRemove(todo.id); onClose(); }
      else if (e.key === 'i' || e.key === 'a') { e.preventDefault(); onClose(); onEdit(todo); }
      else if (e.key === 'x') { e.preventDefault(); onToggle(todo); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [todo, onClose, onToggle, onRemove, onEdit]);

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
            role="dialog"
            aria-labelledby="detail-title"
            initial={{ scale: 0.96, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-head">
              <span
                className="detail-chip"
                style={{ '--bubble-color': `var(--prio-${todo.priority})` }}
                aria-label={`Priority ${todo.priority}`}
              >
                P{todo.priority}
              </span>
              <h2 className="detail-title" id="detail-title">{todo.title}</h2>
            </div>

            {todo.description && (
              <p className="detail-body">{todo.description}</p>
            )}

            <hr className="divider" />

            <dl className="detail-meta">
              <dt>status</dt>
              <dd>{todo.done ? 'done' : 'active'}</dd>
              <dt>created</dt>
              <dd>{formatDate(todo.created)}</dd>
              {todo.completed && (<>
                <dt>completed</dt>
                <dd>{formatDate(todo.completed)}</dd>
              </>)}
              <dt>priority</dt>
              <dd>
                P{todo.priority}
                <span className="meta-faint"> · {['urgent','hot','warm','steady','calm'][todo.priority]}</span>
              </dd>
              <dt>id</dt>
              <dd className="id-mono">{todo.id.slice(0, 8)}</dd>
            </dl>

            <div className="modal-actions detail-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => { onRemove(todo.id); onClose(); }}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { onClose(); onEdit(todo); }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { onToggle(todo); onClose(); }}
              >
                {todo.done ? 'Send it up again' : 'Mark done'}
              </button>
            </div>
            <div className="modal-kbd-hints">
              <span><kbd>d</kbd> delete</span><span className="hint-sep">·</span>
              <span><kbd>i/a</kbd> edit</span><span className="hint-sep">·</span>
              <span><kbd>x</kbd> {todo.done ? 'mark active' : 'mark done'}</span><span className="hint-sep">·</span>
              <span><kbd>esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function ConfirmModal({ open, title, message, confirmLabel, onClose, onConfirm, todo, confirmKey }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [open]);

  function onKey(e) {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.keyCode === 229 ||
        e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Tab') {
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.target === dialogRef.current || (e.shiftKey && e.target === first) || (!e.shiftKey && e.target === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
      return;
    }
    if (e.repeat) return;
    const target = e.target;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (e.key === 'Escape' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (confirmKey ? !e.shiftKey && e.key === confirmKey :
      (e.key === 'Enter' && target.tagName !== 'BUTTON') || e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      e.stopPropagation();
      onConfirm();
    }
  }

  // Handling keys on the focused dialog, rather than window, prevents the
  // keystroke that opened it from also confirming it.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            className="modal add-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKey}
            initial={{ scale: 0.96, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="modal-title" id={titleId}>{title}</h2>
              {message && !todo && <p className="modal-sub">{message}</p>}
            </div>

            {todo && (
              <div className="confirm-todo">
                <strong className="confirm-todo-title">{todo.title}</strong>
                {todo.description && <p className="confirm-todo-description">{todo.description}</p>}
                <span className="detail-chip" style={{ '--bubble-color': `var(--prio-${todo.priority})` }} aria-label={`Priority ${todo.priority}`}>P{todo.priority}</span>
              </div>
            )}

            <div className="modal-actions">
              <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
            </div>
            {confirmKey && (
              <div className="modal-kbd-hints">
                <span><kbd>{confirmKey}</kbd> {confirmLabel.toLowerCase()}</span><span className="hint-sep">·</span>
                <span><kbd>esc</kbd> cancel</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

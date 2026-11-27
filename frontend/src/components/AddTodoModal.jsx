// Floating + button bottom-right opens a modal with the add form.
// AnimatePresence handles the fade/scale of the modal.

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AddTodoModal({ open, onOpen, onClose, onAdd, section }) {
  const [mode, setMode] = useState('insert');
  const [preview, setPreview] = useState('title');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const [description, setDescription] = useState('');
  const titleRef = useRef(null);
  const priorityProxyRef = useRef(null);
  const descRef = useRef(null);

  const formRef = useRef(null);
  // Every opening starts in insert mode; closing retains the draft.
  useEffect(() => {
    if (open) {
      setMode('insert');
      setPreview('title');
      titleRef.current?.focus();
    }
  }, [open]);

  function enterNormal(field) {
    setPreview(field);
    setMode('normal');
    formRef.current?.focus();
  }

  function onFormKey(e) {
    if (e.nativeEvent.isComposing || e.keyCode === 229 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') {
      const controls = [...formRef.current.querySelectorAll('input:not([tabindex="-1"]), textarea, button:not(:disabled)')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.target === formRef.current || (e.shiftKey && e.target === first) || (!e.shiftKey && e.target === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'insert') enterNormal(preview);
      else onClose();
      return;
    }
    // Preserve native button activation while allowing Enter to submit from
    // normal-mode focus, including the priority control.
    if (mode === 'normal' && e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!e.repeat) formRef.current?.requestSubmit();
      return;
    }
    // Native Tab and button behavior always remain available. Normal-mode
    // commands only apply to the form host and the keyboard priority proxy.
    if (mode !== 'normal' || (e.target !== formRef.current && e.target !== priorityProxyRef.current)) return;
    if (e.shiftKey) return;
    const fields = ['title', 'priority', 'description'];
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const delta = e.key === 'j' ? 1 : -1;
      setPreview((field) => fields[Math.max(0, Math.min(fields.length - 1, fields.indexOf(field) + delta))]);
      formRef.current?.focus();
    } else if (e.key === 'i' && preview !== 'priority') {
      e.preventDefault();
      (preview === 'title' ? titleRef : descRef).current?.focus();
    } else if (preview === 'priority' && (e.key === 'h' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      setPriority((p) => Math.min(4, p + 1));
    } else if (preview === 'priority' && (e.key === 'l' || e.key === 'ArrowRight')) {
      e.preventDefault();
      setPriority((p) => Math.max(0, p - 1));
    } else if (preview === 'priority' && /^[0-4]$/.test(e.key)) {
      e.preventDefault();
      setPriority(Number(e.key));
    } else if (e.target === priorityProxyRef.current && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      enterNormal(e.key === 'ArrowDown' ? 'description' : 'title');
    }
  }

  function submit(e) {
    e.preventDefault();
    const cleanTitle = title.replace(/[\r\n]+/g, ' ').trim();
    if (!cleanTitle) return;
    onAdd({ title: cleanTitle, priority, description: description.replace(/[\r\n]+/g, ' ').trim() || undefined, section: section ?? undefined });
    setTitle(''); setPriority(2); setDescription('');
    onClose();
  }

  return (
    <>
      <button
        className="fab"
        data-open={open}
        onClick={open ? onClose : onOpen}
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
            onClick={onClose}
          >
            <motion.form
              ref={formRef}
              className="modal add-modal vim-add-modal"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-todo-title"
              onKeyDown={onFormKey}
              initial={{ scale: 0.96, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submit}
            >
              <div>
                <h2 className="modal-title" id="add-todo-title">New todo</h2>
                <p className="modal-sub">Bubbles rise on their own — bigger and brighter the more urgent.</p>
              </div>

              <div className="field vim-add-field" data-preview={mode === 'normal' && preview === 'title'}>
                <label className="field-label" htmlFor="todo-title">Title</label>
                <input
                  ref={titleRef}
                  id="todo-title"
                  className="text-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => { setPreview('title'); setMode('insert'); }}
                  placeholder="e.g. Ship the PR"
                  maxLength={120}
                />
              </div>

              <div className="field vim-add-field" data-preview={mode === 'normal' && preview === 'priority'}>
                <label className="field-label">Priority</label>
                {/* Invisible proxy that owns keyboard focus for priority — prevents 0-4 leaking into real inputs */}
                <input
                  ref={priorityProxyRef}
                  className="priority-proxy"
                  type="text"
                  inputMode="none"
                  readOnly
                  aria-label={`Priority P${priority} — use 0–4 or arrow keys`}
                  onFocus={() => { setPreview('priority'); setMode('normal'); }}
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
                      onFocus={() => { setPreview('priority'); setMode('normal'); }}
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

              <div className="field vim-add-field" data-preview={mode === 'normal' && preview === 'description'}>
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
                  onFocus={() => { setPreview('description'); setMode('insert'); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault();
                      e.currentTarget.form.requestSubmit();
                    }
                  }}
                  placeholder="Anything to remember about this one…"
                  maxLength={256}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  </svg>
                  Send it up
                </button>
              </div>

              <div className="vim-add-mode" role="status" aria-live="polite">
                {mode === 'insert' ? 'INSERT' : `NORMAL · ${preview === 'priority' ? `Priority P${priority}` : preview}`}
              </div>
              <div className="modal-kbd-hints">
                {mode === 'insert' ? (
                  <span><kbd>esc</kbd> normal mode</span>
                ) : (
                  <><span><kbd>j/k</kbd> select field</span><span className="hint-sep">·</span>{preview === 'priority' ? <span><kbd>h/l</kbd> priority</span> : <span><kbd>i</kbd> edit</span>}<span className="hint-sep">·</span><span><kbd>esc</kbd> close</span></>
                )}
                <span className="hint-sep">·</span><span><kbd>enter</kbd> submit</span>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

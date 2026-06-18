// App shell. The bubble canvas only sees ACTIVE todos — completed ones
// pop and disappear; they live on as `- [x]` in todos.md for history.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTodos } from './useTodos.js';
import { api } from './api.js';
import BubbleCanvas from './components/BubbleCanvas.jsx';
import AddTodoModal from './components/AddTodoModal.jsx';
import DetailOverlay from './components/DetailOverlay.jsx';
import EditTodoModal from './components/EditTodoModal.jsx';

const DIRECTION_KEY = 'buoy:direction';

function useDirection() {
  const [direction, setDirection] = useState(() => {
    if (typeof window === 'undefined') return 'daydream';
    return window.localStorage.getItem(DIRECTION_KEY) || 'daydream';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-direction', direction);
    window.localStorage.setItem(DIRECTION_KEY, direction);
  }, [direction]);
  return [direction, setDirection];
}

export default function App() {
  const [direction, setDirection] = useDirection();
  const toggleDirection = () =>
    setDirection((d) => (d === 'daydream' ? 'nightswim' : 'daydream'));
  const [showDone, setShowDone] = useState(false);
  const {
    todos,
    sections,
    loading,
    error,
    connected,
    reconnectAttempts,
    add,
    toggle,
    remove,
    edit,
  } = useTodos();
  const [detailId, setDetailId] = useState(null);
  const [editTodo, setEditTodo] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const newSectionInputRef = useRef(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editSectionName, setEditSectionName] = useState('');
  const editSectionInputRef = useRef(null);
  const [deletingSection, setDeletingSection] = useState(null);

  useEffect(() => {
    if (addingSection) newSectionInputRef.current?.focus();
  }, [addingSection]);

  useEffect(() => {
    if (editingSection) editSectionInputRef.current?.focus();
  }, [editingSection]);

  function startEditSection(name) {
    setEditingSection(name);
    setEditSectionName(name);
  }

  function commitEditSection() {
    const oldName = editingSection;
    const newName = editSectionName.trim();
    setEditingSection(null);
    setEditSectionName('');
    if (!newName || newName === oldName) return;
    api.renameSection(oldName, newName).then(() => {
      if (activeSection === oldName) setActiveSection(newName);
    }).catch(() => {});
  }

  function confirmDeleteSection(name) {
    setDeletingSection(null);
    api.deleteSection(name).then(() => {
      if (activeSection === name) setActiveSection(null);
    }).catch(() => {});
  }

  function commitNewSection() {
    const name = newSectionName.trim();
    setAddingSection(false);
    setNewSectionName('');
    if (!name) return;
    api.createSection(name).then(() => setActiveSection(name)).catch(() => {});
  }

  // Keep activeSection in sync when sections load or change.
  useEffect(() => {
    setActiveSection((prev) => {
      if (sections.includes(prev)) return prev;
      return sections[0] ?? null;
    });
  }, [sections]);

  const sectionTodos = useMemo(
    () => activeSection != null ? todos.filter((t) => t.section === activeSection) : todos,
    [todos, activeSection],
  );
  const activeTodos = useMemo(() => sectionTodos.filter((t) => !t.done), [sectionTodos]);
  const doneCount = sectionTodos.length - activeTodos.length;
  const canvasTodos = showDone ? sectionTodos : activeTodos;

  // Detail overlay binds to the latest todo each render (in case it updates).
  const detailTodo = useMemo(
    () => (detailId ? todos.find((t) => t.id === detailId) : null),
    [detailId, todos],
  );

  // Only nag about the WS once it has failed a few times in a row, so a
  // single dev-server restart doesn't flash a scary banner.
  const showReconnectBanner = !connected && reconnectAttempts >= 3;
  const syncState = connected ? 'live' : reconnectAttempts >= 3 ? 'offline' : 'reconnecting';
  const syncLabel = { live: 'Live', reconnecting: 'Reconnecting…', offline: 'Offline' }[syncState];

  return (
    <div className="app">
      <header className="app-header">
        <div className="wordmark" aria-label="Buoy">
          Bu<span className="wm-dot" aria-hidden="true" />y
        </div>
        <div className="sync-strip">
          {error && <span className="status error">{error.message}</span>}
          <span className="sync" data-state={syncState}>
            <span className="sync-dot" />
            {syncLabel}
          </span>
          <span className="counts">
            <strong>{activeTodos.length}</strong> <em>active</em>
            {doneCount > 0 && (
              <>
                <span className="sep" aria-hidden="true" />
                <strong>{doneCount}</strong> <em>done</em>
              </>
            )}
          </span>
          <button
            type="button"
            className="direction-toggle"
            onClick={() => setShowDone((v) => !v)}
            aria-pressed={showDone}
            aria-label={showDone ? 'Hide done todos' : 'Show done todos'}
            title={showDone ? 'Hide done' : 'Show done'}
          >
            {showDone ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill="currentColor"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M3 4l18 18M6.5 6.7C4 8.5 2 12 2 12s3 7 10 7c1.9 0 3.5-.5 4.9-1.2M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.1 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            className="direction-toggle"
            onClick={toggleDirection}
            aria-label={`Switch to ${direction === 'daydream' ? 'nightswim' : 'daydream'}`}
            title={`Switch to ${direction === 'daydream' ? 'Nightswim' : 'Daydream'}`}
          >
            {direction === 'daydream' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
                </g>
              </svg>
            )}
          </button>
        </div>
      </header>

      {sections.length > 0 && (
        <nav className="tab-strip" aria-label="Sections">
          {sections.map((s) => (
            editingSection === s ? (
              <input
                key={s}
                ref={editSectionInputRef}
                className="tab-new-input"
                type="text"
                value={editSectionName}
                onChange={(e) => setEditSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditSection();
                  if (e.key === 'Escape') { setEditingSection(null); setEditSectionName(''); }
                }}
                onBlur={commitEditSection}
                maxLength={60}
              />
            ) : deletingSection === s ? (
              <span key={s} className="tab-wrap tab-confirm">
                <span className="tab-confirm-label">Archive?</span>
                <button
                  type="button"
                  className="tab-confirm-yes"
                  onClick={() => confirmDeleteSection(s)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="tab-confirm-no"
                  onClick={() => setDeletingSection(null)}
                >
                  No
                </button>
              </span>
            ) : (
              <span key={s} className="tab-wrap">
                <button
                  type="button"
                  className="tab"
                  data-active={s === activeSection}
                  onClick={() => setActiveSection(s)}
                >
                  {s}
                </button>
                <button
                  type="button"
                  className="tab-edit"
                  onClick={() => startEditSection(s)}
                  aria-label={`Rename ${s}`}
                  title={`Rename "${s}"`}
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
                    <path d="M4 20h4L18 10l-4-4L4 16v4zM21.7 6.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L16 4l4 4 1.7-1.7z" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className="tab-delete"
                  onClick={() => setDeletingSection(s)}
                  aria-label={`Archive ${s}`}
                  title={`Archive "${s}"`}
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>
              </span>
            )
          ))}
          {addingSection ? (
            <input
              ref={newSectionInputRef}
              className="tab-new-input"
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNewSection();
                if (e.key === 'Escape') { setAddingSection(false); setNewSectionName(''); }
              }}
              onBlur={commitNewSection}
              placeholder="Section name…"
              maxLength={60}
            />
          ) : (
            <button
              type="button"
              className="tab-add"
              onClick={() => setAddingSection(true)}
              aria-label="Add section"
              title="Add section"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}
        </nav>
      )}

      <div className="canvas-wrap">
        {showReconnectBanner && (
          <div className="banner" role="status" aria-live="polite">
            <span className="banner-dot" aria-hidden="true" />
            <span>
              Can't reach the server. Retrying…
              <span className="banner-faint"> attempt {reconnectAttempts}</span>
            </span>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : canvasTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <BubbleCanvas
            todos={canvasTodos}
            onToggle={toggle}
            onRemove={remove}
            onShowDetails={(t) => setDetailId(t.id)}
          />
        )}
      </div>

      <DetailOverlay
        todo={detailTodo}
        onClose={() => setDetailId(null)}
        onToggle={toggle}
        onRemove={remove}
        onEdit={(t) => setEditTodo(t)}
      />

      <EditTodoModal
        todo={editTodo}
        onSave={edit}
        onClose={() => setEditTodo(null)}
      />

      <footer className="app-footer">
        <span className="hint">
          <kbd>click</kbd> done
          <span className="hint-sep">·</span>
          <kbd>hold</kbd> details
          <span className="hint-sep">·</span>
          <kbd>dbl</kbd> delete
          <span className="hint-sep">·</span>
          <kbd>drag</kbd> throw
        </span>
        <AddTodoModal onAdd={add} section={activeSection} />
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  // Three faint pulsing circles at fixed positions, matching the spec.
  const skeletons = [
    { size: 92, x: '52%', y: '28%', delay: '0s' },
    { size: 64, x: '30%', y: '52%', delay: '0.3s' },
    { size: 44, x: '70%', y: '62%', delay: '0.6s' },
  ];
  return (
    <div className="bubble-canvas" aria-busy="true">
      {skeletons.map((s, i) => (
        <div
          key={i}
          className="skeleton-bubble"
          style={{
            width: s.size,
            height: s.size,
            left: s.x,
            top: s.y,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bubble-canvas empty-canvas">
      <div className="empty-inner">
        <div className="empty-bubble" aria-hidden="true" />
        <h2 className="empty-title">All clear up here.</h2>
        <p className="empty-sub">
          Send your first thought up with the <strong>New todo</strong> button below.
        </p>
      </div>
    </div>
  );
}

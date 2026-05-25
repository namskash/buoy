// App shell. The bubble canvas only sees ACTIVE todos — completed ones
// pop and disappear; they live on as `- [x]` in todos.md for history.

import { useEffect, useMemo, useState } from 'react';
import { useTodos } from './useTodos.js';
import BubbleCanvas from './components/BubbleCanvas.jsx';
import AddTodoModal from './components/AddTodoModal.jsx';
import DetailOverlay from './components/DetailOverlay.jsx';

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
  const {
    todos,
    loading,
    error,
    connected,
    reconnectAttempts,
    add,
    toggle,
    remove,
  } = useTodos();
  const [detailId, setDetailId] = useState(null);

  // Canvas shows active todos only. Counts shown separately for context.
  const activeTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);
  const doneCount = todos.length - activeTodos.length;

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
        ) : activeTodos.length === 0 ? (
          <EmptyState />
        ) : (
          <BubbleCanvas
            todos={activeTodos}
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
        <AddTodoModal onAdd={add} />
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

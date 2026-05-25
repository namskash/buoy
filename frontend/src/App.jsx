// App shell. The bubble canvas only sees ACTIVE todos — completed ones
// pop and disappear; they live on as `- [x]` in todos.md for history.

import { useMemo, useState } from 'react';
import { useTodos } from './useTodos.js';
import BubbleCanvas from './components/BubbleCanvas.jsx';
import AddTodoModal from './components/AddTodoModal.jsx';
import DetailOverlay from './components/DetailOverlay.jsx';

export default function App() {
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
        </div>
      </header>

      {showReconnectBanner && (
        <div className="banner banner-warn" role="status">
          Can't reach the server. Retrying… (attempt {reconnectAttempts})
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

      <AddTodoModal onAdd={add} />

      <DetailOverlay
        todo={detailTodo}
        onClose={() => setDetailId(null)}
        onToggle={toggle}
        onRemove={remove}
      />

      <footer>
        <small>
          {connected ? 'live sync on' : 'offline'}
          <span className="hint"> · click: done · right-click / hold: details · dbl-click: delete · drag: throw</span>
        </small>
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  // Three faint pulsing circles where bubbles would appear.
  return (
    <div className="bubble-canvas skeleton-canvas" aria-busy="true">
      <span className="skeleton-bubble" style={{ width: 90, height: 90, left: '30%', top: '55%' }} />
      <span className="skeleton-bubble" style={{ width: 70, height: 70, left: '55%', top: '40%' }} />
      <span className="skeleton-bubble" style={{ width: 50, height: 50, left: '70%', top: '65%' }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bubble-canvas empty-canvas">
      <div className="empty-message">
        <div className="empty-title">No floating todos.</div>
        <div className="empty-sub">
          Tap the <span className="empty-plus">+</span> button to send one up.
        </div>
        <div className="empty-arrow" aria-hidden="true">↘</div>
      </div>
    </div>
  );
}

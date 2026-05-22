// App shell. The bubble canvas only sees ACTIVE todos — completed ones
// pop and disappear; they live on as `- [x]` in todos.md for history.

import { useMemo, useState } from 'react';
import { useTodos } from './useTodos.js';
import BubbleCanvas from './components/BubbleCanvas.jsx';
import AddTodoModal from './components/AddTodoModal.jsx';
import DetailOverlay from './components/DetailOverlay.jsx';

export default function App() {
  const { todos, loading, error, connected, add, toggle, remove } = useTodos();
  const [detailId, setDetailId] = useState(null);

  // Canvas shows active todos only. Counts shown separately for context.
  const activeTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);
  const doneCount = todos.length - activeTodos.length;

  // Detail overlay binds to the latest todo each render (in case it updates).
  const detailTodo = useMemo(
    () => (detailId ? todos.find((t) => t.id === detailId) : null),
    [detailId, todos],
  );

  return (
    <div className="app">
      <header>
        <h1>Buoy</h1>
        <span className={`ws-dot ${connected ? 'on' : 'off'}`} title={connected ? 'live' : 'reconnecting'} />
        {error && <span className="status error">· {error.message}</span>}
        <span className="counts">
          <strong>{activeTodos.length}</strong> active
          {doneCount > 0 && <> · <span className="dim">{doneCount} done</span></>}
        </span>
      </header>

      {loading ? (
        <p className="status">Loading…</p>
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

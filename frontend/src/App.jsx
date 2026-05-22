// App shell: header, add form, bubble canvas. The canvas does the physics;
// this file is mostly form state + wiring.

import { useState } from 'react';
import { useTodos } from './useTodos.js';
import BubbleCanvas from './components/BubbleCanvas.jsx';

export default function App() {
  const { todos, loading, error, connected, add, toggle, remove } = useTodos();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(3);

  function onSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    add({ title: title.trim(), priority });
    setTitle('');
    setPriority(3);
  }

  return (
    <div className="app">
      <header>
        <h1>Buoy</h1>
        <span className={`ws-dot ${connected ? 'on' : 'off'}`} title={connected ? 'live' : 'reconnecting'} />
        {error && <span className="status error">· {error.message}</span>}
      </header>

      <form className="add" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label>
          Priority
          <input
            type="range"
            min="1"
            max="5"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
          <span className={`priority-value prio-${priority}`}>P{priority}</span>
        </label>
        <button type="submit">Add</button>
      </form>

      {loading ? (
        <p className="status">Loading…</p>
      ) : (
        <BubbleCanvas todos={todos} onToggle={toggle} onRemove={remove} />
      )}

      <footer>
        <small>
          {todos.length} todo{todos.length !== 1 ? 's' : ''} · {connected ? 'live sync on' : 'offline'}
          <span className="hint"> · click to toggle · double-click to delete · drag to throw</span>
        </small>
      </footer>
    </div>
  );
}

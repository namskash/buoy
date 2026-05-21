// Skeleton App. Plain list + a tiny add form, so we can confirm the data
// pipeline works end-to-end. Bubble physics arrives in milestone 5.

import { useState } from 'react';
import { useTodos } from './useTodos.js';

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

  // Sort: incomplete first, highest priority first.
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.priority - a.priority;
  });

  return (
    <div className="app">
      <header>
        <h1>Buoy</h1>
        <span className={`ws-dot ${connected ? 'on' : 'off'}`} title={connected ? 'live' : 'reconnecting'} />
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
          <span className="priority-value">{priority}</span>
        </label>
        <button type="submit">Add</button>
      </form>

      {loading && <p className="status">Loading…</p>}
      {error && <p className="status error">Error: {error.message}</p>}

      <ul className="todos">
        {sorted.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
            <span className={`prio prio-${t.priority}`}>P{t.priority}</span>
            <span className="title">{t.title}</span>
            {t.description && <span className="desc">— {t.description}</span>}
            <button className="del" onClick={() => remove(t.id)} title="delete">✕</button>
          </li>
        ))}
      </ul>

      <footer>
        <small>{todos.length} todo{todos.length !== 1 ? 's' : ''} · {connected ? 'live sync on' : 'offline'}</small>
      </footer>
    </div>
  );
}

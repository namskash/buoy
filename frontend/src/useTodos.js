// Custom hook: owns the todos array and keeps it in sync with the backend
// via REST (initial load + mutations) and WebSocket (push updates).
//
// Return shape:
//   { todos, loading, error, connected, add, toggle, remove, refresh }

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';

// In dev VITE_WS_URL is explicit (different port). In prod we build with
// VITE_WS_URL="" and derive ws[s]://<current-host>/ws from window.location
// so http→ws and https→wss happen automatically.
function resolveWsUrl() {
  const fromEnv = import.meta.env.VITE_WS_URL;
  if (fromEnv) return fromEnv;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
const WS_URL = resolveWsUrl();

export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.list();
      setTodos(list);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial REST load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Long-lived WebSocket with simple backoff reconnect.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        attempt = 0;
        setConnected(true);
        setReconnectAttempts(0);
      });

      ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'todos:changed') setTodos(msg.todos);
        } catch (err) {
          console.error('[ws] bad message', err);
        }
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        if (cancelled) return;
        attempt += 1;
        setReconnectAttempts(attempt);
        const delay = Math.min(1000 * 2 ** attempt, 10000); // 2s, 4s, 8s, 10s cap
        reconnectTimerRef.current = setTimeout(connect, delay);
      });

      ws.addEventListener('error', () => {
        // 'close' will follow; backoff happens there.
      });
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Mutations. We don't update local state — we trust the WS broadcast to
  // come back within ~50ms with the new full list. Keeps the model simple.
  const add = useCallback(
    (payload) => api.create(payload).catch(setError),
    [],
  );
  const toggle = useCallback(
    (todo) => api.update(todo.id, { done: !todo.done }).catch(setError),
    [],
  );
  const remove = useCallback(
    (id) => api.remove(id).catch(setError),
    [],
  );
  const edit = useCallback(
    (id, patch) => api.update(id, patch).catch(setError),
    [],
  );

  return {
    todos,
    loading,
    error,
    connected,
    reconnectAttempts,
    add,
    toggle,
    remove,
    edit,
    refresh,
  };
}

// Tiny REST client. Wraps fetch with JSON handling + base URL.
//
// Vite exposes env vars prefixed with VITE_ as import.meta.env.VITE_*.
// In dev that comes from .env.development; in prod we can set them differently.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

async function request(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  list: () => request('GET', '/api/todos'),
  create: (payload) => request('POST', '/api/todos', payload),
  update: (id, patch) => request('PATCH', `/api/todos/${id}`, patch),
  remove: (id) => request('DELETE', `/api/todos/${id}`),
};

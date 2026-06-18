// Tiny REST client. Wraps fetch with JSON handling + base URL.
//
// Vite exposes env vars prefixed with VITE_ as import.meta.env.VITE_*.
// In dev that comes from .env.development; in prod we can set them differently.

// In dev VITE_API_URL points at the standalone backend (different port,
// hence CORS). In prod we build with VITE_API_URL="" so all requests are
// same-origin relative paths — Express serves both the bundle and the API.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3004';

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
  sections: () => request('GET', '/api/sections'),
  createSection: (name) => request('POST', '/api/sections', { name }),
  renameSection: (oldName, newName) => request('PATCH', `/api/sections/${encodeURIComponent(oldName)}`, { name: newName }),
  deleteSection: (name) => request('DELETE', `/api/sections/${encodeURIComponent(name)}`),
};

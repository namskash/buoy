# Production multi-stage build.
#
# Stage 1 (frontend-build): compile the React app with Vite into static files.
# Stage 2 (runtime): a slim Node image that runs Express, which serves BOTH
# the API/WebSocket and the built React bundle on one port (3004).
#
# Build:  docker build -t buoy:prod .
# Run:    docker run --rm -p 3004:3004 -v "$PWD/data:/app/data" buoy:prod

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the frontend bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build

# Empty API/WS URLs → api.js falls back to relative /api paths and useTodos.js
# derives ws[s]://<current-host>/ws from window.location. This makes the bundle
# host-agnostic: it works behind any reverse proxy, on any port, http or https.
ENV VITE_API_URL=""
ENV VITE_WS_URL=""

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build
# Output: /build/dist (index.html + assets/*).

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime image (Express + static files)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004
ENV STATIC_DIR=/app/public
ENV TODOS_FILE=/app/data/todos.md

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY backend/src ./src

# Pull the built frontend out of stage 1.
COPY --from=frontend-build /build/dist ./public

EXPOSE 3004
CMD ["node", "src/server.js"]

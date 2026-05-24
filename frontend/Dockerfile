# Dev image for the frontend (Vite + React).
# Same layered-install pattern as the backend.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 5173

# Vite needs --host to be reachable from outside the container.
# Our package.json's "dev" script already passes --host.
CMD ["npm", "run", "dev"]

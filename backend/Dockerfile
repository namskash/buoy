# Dev image for the backend (Express + ws + chokidar).
# We mount source over /app/src at compose time, so the image only needs deps.
# Node 20 is what the package.json was written against.

FROM node:20-alpine

WORKDIR /app

# Install deps first so the layer is cached when source changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest. In dev, compose mounts ./src and ./test on top of this.
COPY . .

EXPOSE 3004

# node --watch restarts on file changes (built into Node since 20).
CMD ["npm", "run", "dev"]

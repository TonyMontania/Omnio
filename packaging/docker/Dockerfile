# syntax=docker/dockerfile:1.6
#
# Omnio — headless Electron in a container, reachable from a browser via
# KasmVNC. The renderer + main-process code are the exact same bundle the
# desktop builds ship; only the packaging is different.
#
# Build from the repo root:
#   docker build -f packaging/docker/Dockerfile -t omnio:local .
#
# Run:
#   docker run -d --name omnio \
#     -p 3000:3000 -p 3001:3001 \
#     -v /host/omnio/config:/config \
#     --shm-size=1gb \
#     omnio:local
#
# Then open http://localhost:3000 (HTTP) or https://localhost:3001 (HTTPS).

# ---------------------------------------------------------------------------
# Stage 1 — Build the Vite + Electron bundles.
# Produces dist/ (renderer) and dist-electron/ (main + preload).
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /src

# Copy manifests first so `npm ci` is cached until they change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the sources needed for the build.
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY electron ./electron
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY build ./build

# tsc + vite build → dist/ + dist-electron/. Skip electron-builder here;
# the runtime stage runs the app directly via the electron binary, no
# installer wrapping needed.
RUN npx tsc && npx vite build

# ---------------------------------------------------------------------------
# Stage 2 — Runtime. linuxserver.io's KasmVNC base image gives us a Debian
# userspace with a KasmVNC server that exposes the desktop over HTTP(S) on
# 3000/3001. We add the Electron runtime deps and drop the bundle in place.
# ---------------------------------------------------------------------------
FROM lscr.io/linuxserver/baseimage-kasmvnc:debianbookworm

ARG OMNIO_VERSION=dev
ENV OMNIO_VERSION=${OMNIO_VERSION} \
    TITLE=Omnio \
    HOME=/config \
    PORTABLE_EXECUTABLE_DIR=/config

# Electron 30 runtime deps. libgtk-3-0, libnss3, libgbm1, libasound2 are
# the ones the base image doesn't already pull in.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libgtk-3-0 libnss3 libnspr4 \
      libx11-xcb1 fonts-noto-color-emoji ca-certificates curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node — the runtime needs the `electron` npm package to launch
# the app. Using the same major as the build stage keeps ABI in sync.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Only the runtime bits: built bundles + package.json (drives `main`) +
# icons that Electron loads at window-create time.
WORKDIR /app
COPY --from=build /src/dist          ./dist
COPY --from=build /src/dist-electron ./dist-electron
COPY --from=build /src/build         ./build
COPY --from=build /src/public        ./public
COPY package.json ./

# Production-only install — electron is the only runtime dep we actually
# need. `npm ci` would fail without a lockfile in this stage, so use
# `npm install --production` scoped to just electron.
RUN npm install --no-audit --no-fund --omit=dev electron@30 && \
    npm cache clean --force

# Startup file — the linuxserver base runs /defaults/autostart inside the
# KasmVNC session on boot. Our copy launches Electron pointed at the app.
COPY packaging/docker/root/ /

# Ports: 3000 = HTTP, 3001 = HTTPS (self-signed). Volumes: /config holds
# the whole data/ + assets/ tree so nothing is trapped inside the image.
EXPOSE 3000 3001
VOLUME ["/config"]

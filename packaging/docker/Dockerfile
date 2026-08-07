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
# installer wrapping needed. Also skip `npm run icon` — the packaged
# desktop builds use it to bake .ico/.icns; Docker only needs the .png
# for BrowserWindow.icon, which is already committed under build/.
RUN npx tsc && npx vite build

# ---------------------------------------------------------------------------
# Stage 2 — Runtime. linuxserver.io's KasmVNC base image gives us a Debian
# userspace with a KasmVNC server that exposes the desktop over HTTP(S) on
# 3000/3001. We add the Electron runtime deps and drop the bundle in place.
# ---------------------------------------------------------------------------
FROM lscr.io/linuxserver/baseimage-kasmvnc:debianbookworm

ARG OMNIO_VERSION=dev
# TITLE feeds the KasmVNC web UI's tab title and the taskbar of the
# streamed session. PORTABLE_EXECUTABLE_DIR redirects Omnio's storage
# root onto the /config bind-mount so nothing lands in a container path
# that vanishes on recreate. HOME follows for consistency.
ENV OMNIO_VERSION=${OMNIO_VERSION} \
    TITLE=Omnio \
    HOME=/config \
    PORTABLE_EXECUTABLE_DIR=/config

# Electron 30 runtime deps. libgtk-3-0, libnss3, libgbm1, libasound2 are
# the ones the base image doesn't already pull in.
#
# We deliberately do NOT install a fresh Node from NodeSource here — the
# linuxserver base ships Node 18 for its own /kclient audio helper, and
# that helper's native modules (pulseaudio2, compiled against ABI 108)
# crash on boot if we swap the system Node for a newer one. Electron's
# cli.js runs happily under the pinned Node 18 anyway; all it does is
# spawn the Electron binary and pass along argv.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libgtk-3-0 libnss3 libnspr4 \
      libx11-xcb1 fonts-noto-color-emoji ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Only the runtime bits: built bundles + icons for BrowserWindow.icon.
WORKDIR /app
COPY --from=build /src/dist          ./dist
COPY --from=build /src/dist-electron ./dist-electron
COPY --from=build /src/build         ./build
COPY --from=build /src/public        ./public

# Minimal manifest — `main` tells Electron where to load, and Electron is
# the sole runtime dependency. We deliberately do NOT copy the source
# package.json: it lists React / xlsx / TypeScript / etc as (dev)deps,
# and `npm install` on that manifest would drag ~200 MB of code into the
# runtime image even though every one of those packages is already bundled
# into dist/ by vite. This 3-line manifest keeps the runtime lean.
# `"type": "module"` matches the source package.json — vite emits ESM
# main.js / preload.mjs and Node refuses to load them without it.
RUN printf '{\n  "name": "omnio-runtime",\n  "version": "%s",\n  "type": "module",\n  "main": "dist-electron/main.js",\n  "dependencies": { "electron": "30.0.1" }\n}\n' "${OMNIO_VERSION}" > package.json && \
    npm install --no-audit --no-fund --no-package-lock && \
    npm cache clean --force

# Startup file — the linuxserver base runs /defaults/autostart inside the
# KasmVNC session on boot. Explicit chmod because Windows checkouts strip
# the executable bit and the base image's runner treats non-executable
# scripts as "no autostart configured".
COPY packaging/docker/root/ /
RUN chmod +x /defaults/autostart

# Ports: 3000 = HTTP, 3001 = HTTPS (self-signed). Volumes: /config holds
# the whole data/ + assets/ tree so nothing is trapped inside the image.
EXPOSE 3000 3001
VOLUME ["/config"]

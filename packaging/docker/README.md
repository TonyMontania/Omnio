# Omnio in Docker

Omnio is an Electron desktop app. Running it in a container works by
launching the real Electron binary inside a virtual X session and
streaming that session to your browser via
[KasmVNC](https://kasmweb.com/kasmvnc). You get the exact same app the
desktop builds ship — no feature is stripped and no code is forked for
the server flavor — reachable from any browser on your LAN.

This is the pragmatic path for NAS setups (Unraid, TrueNAS Scale,
Synology, Proxmox LXC) and headless home servers. On a normal desktop,
the native installer is still the better choice.

## Quick start (docker compose)

From the repo root:

```bash
docker compose -f packaging/docker/docker-compose.yml up -d --build
```

Open <http://localhost:3000> in any browser. Your library lives under
`packaging/docker/omnio-config/` on the host (change the volume mapping
in [`docker-compose.yml`](docker-compose.yml) to move it).

## Quick start (docker run)

```bash
docker build -f packaging/docker/Dockerfile -t omnio:local .

docker run -d --name omnio \
  -p 3000:3000 -p 3001:3001 \
  -v /path/on/host/omnio:/config \
  -e PUID=1000 -e PGID=1000 -e TZ=Etc/UTC \
  --shm-size=1gb \
  --restart unless-stopped \
  omnio:local
```

- **Port 3000** — HTTP KasmVNC web UI.
- **Port 3001** — HTTPS with a self-signed cert (useful behind a reverse
  proxy that requires an HTTPS backend).
- **`/config`** — your entire library. `data/` (JSONs + backups) and
  `assets/` (covers, banners, save files, screenshots) both land here so
  one `cp -r /path/on/host/omnio backup/` copies everything.
- **`--shm-size=1gb`** — Chromium (under Electron) OOMs the default
  64 MB `/dev/shm` on big lists. Not optional.

## Authentication

By default the web UI is open — fine on a home LAN, dangerous on the
open internet. Set both `CUSTOM_USER` and `PASSWORD` to require a login:

```bash
docker run -d --name omnio \
  -e CUSTOM_USER=admin -e PASSWORD=changeme \
  ...
```

## Unraid

Import [`unraid-template.xml`](unraid-template.xml) via the Docker tab
("Add Container" → "Template repository" or paste the file directly).
Default install path: `/mnt/user/appdata/omnio`.

## Synology / TrueNAS Scale / Proxmox LXC

Any container platform that supports `docker run` works. The two things
to remember:

1. Bind-mount a host folder to `/config`.
2. Raise the shared-memory size to at least 1 GB (compose does it via
   `shm_size`; Docker CLI via `--shm-size=1gb`).

## Updating

```bash
# Compose
docker compose -f packaging/docker/docker-compose.yml pull
docker compose -f packaging/docker/docker-compose.yml up -d

# Plain docker
docker pull ghcr.io/tonymontania/omnio:latest
docker stop omnio && docker rm omnio
# then re-run the `docker run` command above
```

Your data survives across recreations because it lives on the host under
the `/config` bind mount, never inside the container's writable layer.
Omnio's in-app auto-updater is disabled in the Docker build — the
container image itself is the update unit.

## Backing up

Everything lives under one folder:

```bash
tar czf omnio-backup-$(date +%F).tar.gz /path/on/host/omnio
```

The in-app "Snapshots" feature still works and rotates 5 copies under
`/config/data/backups/1..5/` — those are included in the tarball above.

## Troubleshooting

- **Black screen / "Failed to connect" on first load** — the KasmVNC
  server needs 5–10 seconds after container start. Refresh the page.
- **Container exits immediately with a Chromium error** — you're almost
  certainly missing `--shm-size=1gb`. Add it and recreate.
- **Files under `/config` owned by root** — set `PUID` / `PGID` to your
  host user's IDs (`id -u` / `id -g`).
- **Slow rendering on huge libraries (1000+ items)** — the bottleneck is
  the video stream, not Omnio itself. Give the container more CPU
  (`--cpus=4`) and use the HTTP port (3000) on a wired LAN rather than
  the HTTPS one over Wi-Fi.

## Why not a "pure web" build without KasmVNC?

Omnio's renderer talks to the Electron main process for every disk
operation — reading and writing JSONs, saving covers, rotating snapshots
— through `ipcRenderer.invoke`. A browser-only build would need every
one of those handlers reimplemented as an HTTP endpoint plus a matching
client shim in the renderer. That's a fork, not a package. Streaming
the real Electron session avoids the fork entirely, which is why every
"desktop-app-in-a-browser" project on Docker Hub (Firefox, LibreOffice,
KeePassXC, Krita, …) uses the same KasmVNC pattern.

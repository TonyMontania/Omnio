# Security Policy

## Supported versions

Omnio is a rolling-release desktop app. Only the **latest published release**
receives security fixes. Grab it from the
[releases page](https://github.com/TonyMontania/Omnio/releases/latest).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately via one of:

1. **GitHub Security Advisories** — preferred. Go to the
   [Security tab](https://github.com/TonyMontania/Omnio/security/advisories/new)
   of the repo and click *Report a vulnerability*.
2. **Email** — `ezebigplanet@gmail.com` with `[Omnio Security]` in the subject.

Include enough detail to reproduce the issue: Omnio version, OS, steps, and
what the observed vs. expected behavior is. If you have a proof-of-concept
build or patch, even better.

## What to expect

- Acknowledgement within **7 days**.
- A first assessment and severity call within **14 days**.
- Coordinated disclosure once a fix is in a release. Credit in the release
  notes if you want it (default: yes, unless you ask otherwise).

## Scope

Omnio is a local-first Electron app. Realistic threat surfaces:

- Path traversal / file writes via imported files (backups, MAL XML,
  Letterboxd CSV, Kindle My Clippings, Trakt JSON, Discogs API responses, …).
- XSS in the exported HTML site or in remote metadata rendered inside the app.
- IPC channel abuse from a compromised renderer process.
- Insecure handling of API tokens stored in `settings.json`.

Out of scope:
- Physical access to the user's machine (Omnio's storage is local and
  unencrypted — that's a design choice, documented in the README).
- Vulnerabilities in upstream metadata sources (AniList, TMDb, IGDB, MangaDex,
  MusicBrainz, …). Report those to the source's own security channel.

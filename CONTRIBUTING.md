# Contributing to Omnio

Thanks for wanting to help. Omnio is a personal, local-first hobby tracker
maintained mostly by one person, so contributions land faster when they match
the project's existing rhythm.

## Ways to help

- **Report a bug** — open an [issue](https://github.com/TonyMontania/Omnio/issues/new/choose)
  with the bug-report template. Include your OS, Omnio version (Settings → Data
  → About) and, if possible, the steps that trigger it.
- **Suggest a feature** — same tracker, feature-request template. Say what
  problem you're trying to solve, not just the mechanic you have in mind.
- **Send a pull request** — for anything beyond a typo, please open an issue
  first so we can agree on the shape before you spend time coding.
- **Improve docs** — README, `docs/FIELDS.md`, in-code comments. Docs PRs
  need zero prior discussion.

## Running Omnio locally

Requirements: Node 20+ and pnpm/npm.

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev          # Vite + Electron in dev mode with HMR
```

Your library lives under `data/` and `assets/` next to the running executable
(dev) or in the OS data dir (installer builds). To test with real data safely,
export a JSON backup first (Settings → Data → Export backup).

## Building for release

```bash
npm run build         # renderer + electron bundles
npm run electron:pack # unpacked dist for local install testing
```

CI cuts multi-OS builds automatically on every `v*` tag push.

## Code style

- **TypeScript strict.** New code should typecheck cleanly (`npx tsc --noEmit`).
- **Local-first, no telemetry.** New features must not require an account or
  phone home. Metadata fetchers (AniList, TMDb, …) are the exception and even
  those stay opt-in per user.
- **Progressive disclosure.** New editor fields hide their detail-modal
  section when empty; new library features hide until the user has data for
  them.
- **Tab distribution.** Every new field in the item editor belongs to exactly
  one of: Overview / Identity / Progress / Media / History / Related / Notes.
  See `docs/REDESIGN.md`.
- **Minimal deps.** Prefer a small util over a new package.

## Commits and PRs

- Keep commits focused; one topic per commit reads well in `git log`.
- Commit messages: short imperative subject, longer body explaining the *why*
  when it's not obvious from the diff.
- Reference the issue in the PR body (`Closes #123`).
- CI must pass. Screenshots or short screencasts help a lot on UI changes.

## Questions

Not sure whether an idea fits, or how deep to go? Open a draft issue and ask.
Better to align early than rewrite later.

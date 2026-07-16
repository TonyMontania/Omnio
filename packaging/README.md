# Packaging templates

Manifests for third-party package managers. Each subfolder targets one distribution channel and is submitted to its upstream repo — none of this ships inside the app.

**Preferred flow (CI).** Push a `v*` tag and [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds every platform, stamps the manifests, and attaches a `omnio-packaging-manifests-<version>.tar.gz` bundle to the GitHub Release. Download that tarball and open the PRs / push to AUR straight from it.

**Manual flow.** Run `npm run packaging:stamp` locally — the script reads `release/<version>/`, computes every SHA256 for the artifacts it finds, and writes fully-substituted copies of these manifests to `packaging/dist/<version>/`. Missing artifacts leave their placeholders untouched. Use `npm run packaging:check` to verify no `<VERSION>` / `<SHA256-*>` placeholders remain before opening PRs. Templates under `packaging/` stay untouched and reusable.

| Channel        | Platform | Where to submit                                                          |
| -------------- | -------- | ------------------------------------------------------------------------ |
| winget         | Windows  | PR to [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs) |
| Homebrew Cask  | macOS    | PR to [`homebrew/homebrew-cask`](https://github.com/Homebrew/homebrew-cask) |
| Flathub        | Linux    | PR to [`flathub/flathub`](https://github.com/flathub/flathub)             |
| Snap Store     | Linux    | `snapcraft upload` from a Linux build host                                |
| AUR            | Linux    | `git push` to `ssh://aur@aur.archlinux.org/omnio-bin.git`                 |

The `.deb`, `.tar.gz` and NSIS `.exe` targets are produced directly by `npm run build` via `electron-builder.json5` — no external manifest needed.

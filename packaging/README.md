# Packaging channels

Templates for the non-Tauri distribution channels — Arch AUR and the Windows Package Manager (winget). Tauri v2's bundler covers NSIS, MSI, DMG, AppImage, `.deb` and `.rpm` natively; anything not on that list needs a hand-authored manifest submitted to a third-party repo and stamped with a version + SHA256 per release.

## Files

```
packaging/
  aur/
    PKGBUILD                                # -bin package pulling the upstream .deb
  winget/
    TonyMontania.Omnio.yaml                 # version manifest
    TonyMontania.Omnio.installer.yaml       # NSIS + MSI + portable-zip installer entries
    TonyMontania.Omnio.locale.en-US.yaml    # metadata (description, tags, license)
scripts/
  stamp-packaging.mjs                       # fills @VERSION@ / @SHA256_*@ placeholders
```

All template placeholders are literal `@TOKEN@` strings — no templating engine. Grep for `@` in a stamped file to spot slots that didn't fill.

## Release flow

The release workflow (`.github/workflows/release.yml`) invokes `scripts/stamp-packaging.mjs` after every matrix build finishes. It:

1. Downloads every asset published to the tag via `gh release download`.
2. Computes SHA256 for each file the manifests reference.
3. Copies each template from `packaging/` into a temp `stamped/` directory with `@TOKEN@` replaced by the real values.
4. Uploads the stamped files back to the release as assets (`omnio-bin.PKGBUILD.txt`, `TonyMontania.Omnio.*.yaml`) so downstream tooling / maintainers can grab them.

The stamped files are **not** committed back to `main` — the source of truth stays under `packaging/`.

## Submitting

Neither channel auto-publishes; the release run only prepares the stamped manifests. To ship them:

### AUR (`omnio-bin`)

```bash
# One-time setup on a machine with SSH access to AUR
git clone ssh://aur@aur.archlinux.org/omnio-bin.git
cd omnio-bin

# For each new release
curl -LO "https://github.com/TonyMontania/Omnio/releases/download/v<version>/omnio-bin.PKGBUILD.txt"
mv omnio-bin.PKGBUILD.txt PKGBUILD
makepkg --printsrcinfo > .SRCINFO
git add PKGBUILD .SRCINFO
git commit -m "v<version>"
git push
```

### winget (`TonyMontania.Omnio`)

Use [`wingetcreate`](https://github.com/microsoft/winget-create) to submit the stamped manifests as a PR against `microsoft/winget-pkgs`:

```bash
wingetcreate submit \
    --token <your-github-pat> \
    ./TonyMontania.Omnio.yaml \
    ./TonyMontania.Omnio.installer.yaml \
    ./TonyMontania.Omnio.locale.en-US.yaml
```

Or run `wingetcreate update TonyMontania.Omnio` after the release lands and it will pull the new installer URLs / SHA256s from the manifest metadata automatically.

## Adding a new channel

Homebrew Cask, Flathub and Snap are the natural next candidates. Each follows the same shape:

1. Add a template with `@TOKEN@` placeholders under `packaging/<channel>/`.
2. Extend `scripts/stamp-packaging.mjs` with the manifest's own asset digests + a `stamp()` call for the template.
3. Wire the stamped output into `release.yml`'s upload step.
4. Document the submission command in this README.

Keep the source manifests in git; keep the stamped outputs ephemeral in `stamped/` (gitignored by `dist`/`release`/etc rules already).

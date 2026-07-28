// Repeat-forever helpers around <input type="file"> pickers. The renderer
// never talks to the disk directly — cover / banner / logo uploads all go
// through image:save in the main process, which decodes the data URL and
// writes bytes under assets/. These helpers just shorten "get a File out of
// an event and turn it into a data URL".

import type { ChangeEvent } from 'react'

// Filename-safe version of `raw` — strips filesystem-reserved chars, collapses
// whitespace, trims. Mirrors sanitizeAssetName in electron/main.ts so both
// sides pick the same on-disk name for the same title.
export function sanitizeForFilename(raw: string): string {
  if (!raw) return ''
  // eslint-disable-next-line no-control-regex
  const noBad = raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '')
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(noBad)) return `_${noBad}`
  return noBad.slice(0, 80)
}

// Compose the filename base ("Metro 2033 Redux cover") that gets passed to
// image:save / image:download. Keeping this in one place means the renderer
// and the main-process auto-rename step produce byte-identical names, so the
// rename step short-circuits on the common case.
// Wrap image:download so a fetch failure isn't silent — every fetcher
// previously took `null` to mean "failed" but had no way to tell the user
// why. Now the main process returns { ok, path | error } and this helper
// dispatches a window event with the reason so App.tsx can show a toast,
// while presenting the old string-or-null shape to callers.
export async function downloadImageAsset(url: string, categoryId: string, kind: string, basename?: string): Promise<string | null> {
  const r = await window.ipcRenderer.invoke('image:download', url, categoryId, kind, basename) as { ok: true; path: string } | { ok: false; error: string } | string | null
  // Backwards-compatibility branch: older builds still return a bare string
  // (or null) from cached preload — treat those as "just the path".
  if (typeof r === 'string') return r
  if (r === null) return null
  if (r.ok) return r.path
  window.dispatchEvent(new CustomEvent('omnio-image-download-error', { detail: { url, kind, error: r.error } }))
  return null
}

export function assetBasename(hint: string | undefined, kind: string, subLabel?: string | number): string | undefined {
  const clean = sanitizeForFilename(hint ?? '')
  if (!clean) return undefined
  const sub = subLabel === undefined || subLabel === null || subLabel === '' ? '' : sanitizeForFilename(String(subLabel))
  return sub ? `${clean} ${kind} ${sub}` : `${clean} ${kind}`
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Unexpected file reader result'))
    }
    reader.readAsDataURL(file)
  })
}

// Convenience: wire up an <input type="file" onChange> to a state setter
// that expects a data URL. Handles the "no file selected" branch and clears
// the input so picking the same file twice still fires onChange.
export function pickImageToDataUrl(onData: (dataUrl: string) => void) {
  return async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try { onData(await fileToDataUrl(f)) } catch { /* silent — user gets no cover, that's fine */ }
    e.target.value = ''
  }
}

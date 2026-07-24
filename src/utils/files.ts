// Repeat-forever helpers around <input type="file"> pickers. The renderer
// never talks to the disk directly — cover / banner / logo uploads all go
// through image:save in the main process, which decodes the data URL and
// writes bytes under assets/. These helpers just shorten "get a File out of
// an event and turn it into a data URL".

import type { ChangeEvent } from 'react'

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

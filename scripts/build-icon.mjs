import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
const svg = await readFile(path.join(root, 'public', 'omnio-logo.svg'))

await mkdir(path.join(root, 'build'), { recursive: true })

// Multiple resolutions for the Windows .ico (used for the exe embed + taskbar).
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoBuffers = await Promise.all(icoSizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()))

// Large PNG for Linux AppImage and macOS. electron-builder converts the PNG
// to a proper .icns for Mac but requires the source to be at least 512×512;
// we use 1024 so the generated icon looks crisp on retina displays too.
const bigPng = await sharp(svg).resize(1024, 1024).png().toBuffer()
await writeFile(path.join(root, 'build', 'icon.png'), bigPng)

const pngToIco = await import('png-to-ico').then((m) => m.default ?? m)
const ico = await pngToIco(icoBuffers)
await writeFile(path.join(root, 'build', 'icon.ico'), ico)

console.log('Generated build/icon.png (1024×1024) and build/icon.ico (16→256)')

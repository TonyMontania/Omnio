import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
const svg = await readFile(path.join(root, 'public', 'omnio-logo.svg'))

await mkdir(path.join(root, 'build'), { recursive: true })

const sizes = [16, 24, 32, 48, 64, 128, 256]
const buffers = await Promise.all(sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()))

await writeFile(path.join(root, 'build', 'icon.png'), buffers[buffers.length - 1])

const pngToIco = await import('png-to-ico').then((m) => m.default ?? m)
const ico = await pngToIco(buffers)
await writeFile(path.join(root, 'build', 'icon.ico'), ico)

console.log('Generated build/icon.png and build/icon.ico')

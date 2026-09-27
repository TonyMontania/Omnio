// Port of Nyx's main.js `parseF95Title`. Strips `[Engine] [VN] [Status]`
// prefixes and pulls version + creator out of the trailing brackets.

const ENGINES: [string, string][] = [
  ["Ren'Py", 'renpy'], ['RPGM', 'rpgm'], ['Unity', 'unity'],
  ['Unreal Engine', 'unreal'], ['Godot', 'godot'], ['WebGL', 'webgl'],
  ['HTML', 'html'], ['Flash', 'flash'], ['QSP', 'qsp'],
  ['Wolf RPG', 'wolfrpg'], ['Java', 'java'], ['Others', 'others'],
]
const STATUSES = ['Completed', 'Abandoned', 'OnHold', 'On Hold']
const VERSION_KW = /\b(v(?:er(?:sion)?)?[\s.]*\d|final|complete|full|demo|beta|alpha|public|prologue|preview|ea|early\s*access|rc|build|update|ep(?:isode)?[\s.]*\d|ch(?:apter)?[\s.]*\d|part[\s.]*\d)\b/i

export interface Parsed {
  name: string
  version: string
  creator: string
  engine: string
  status: string
  vn: boolean
}

export function parseF95Title(title: string): Parsed {
  let t = String(title).replace(/\s*\|\s*F95zone.*$/i, '').trim()
  let engine = '', status = '', vn = false

  const stripPrefix = (label: string): boolean => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^\\[?${escaped}\\]?\\s*[-–]?\\s*`, 'i')
    if (re.test(t)) { t = t.replace(re, ''); return true }
    return false
  }

  let changed = true
  while (changed) {
    changed = false
    if (!engine) {
      for (const [name] of ENGINES) if (stripPrefix(name)) { engine = name; changed = true; break }
    }
    if (!vn && stripPrefix('VN')) { vn = true; changed = true }
    if (!status) {
      for (const s of STATUSES) if (stripPrefix(s)) { status = s.replace(/\s+/g, ''); changed = true; break }
    }
  }

  const brackets: string[] = []
  const bre = /\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = bre.exec(t))) brackets.push(m[1].trim())
  const name = t.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()

  let version = '', creator = ''
  for (const b of brackets) {
    if (/^v?\d/i.test(b) || VERSION_KW.test(b)) { version = b; break }
  }
  if (brackets.length) {
    creator = brackets[brackets.length - 1]
    if (creator === version && brackets.length > 1) creator = brackets[brackets.length - 2]
  }
  if (!version && brackets.length >= 2) version = brackets[brackets.length - 2]

  return { name, version, creator, engine, status, vn }
}

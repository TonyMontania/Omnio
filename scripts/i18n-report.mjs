// Lists every interface string passed to t() / plural() and whether the
// Spanish dictionary has it. Writes i18n-strings.txt at the repo root:
//
//   [x] Search games = Buscar juegos
//   [ ] Add widget =
//
// Run with: npm run i18n:report

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const src = join(root, 'src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes(join('src', 'i18n'))) out.push(p)
  }
  return out
}

// t('…') / tk('…') and both arguments of plural(n, '…', '…').
const T_CALL = /\btk?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g
const PLURAL_CALL = /\bplural\([^,]+,\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3/g
// Library names: category('id', 'Label', 'singular') in categories.ts.
const CATEGORY_CALL = /\bcategory\(\s*'[^']+',\s*'([^']+)',\s*'([^']+)'\s*\)/g

const keys = new Set()
for (const file of walk(src)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(T_CALL)) keys.add(m[2].replace(/\\(['"])/g, '$1'))
  for (const m of text.matchAll(CATEGORY_CALL)) { keys.add(m[1]); keys.add(m[2]) }
  // Option lists wrapped in translated([...]): their label / short fields.
  if (text.includes('translated([')) {
    for (const m of text.matchAll(/\b(?:label|short):\s*'((?:\\.|[^'])*)'/g)) keys.add(m[1].replace(/\\'/g, "'"))
  }
  for (const m of text.matchAll(PLURAL_CALL)) {
    keys.add(m[2].replace(/\\(['"])/g, '$1'))
    keys.add(m[4].replace(/\\(['"])/g, '$1'))
  }
}

// Read the Spanish dictionary without a TS loader: entries are 'key': 'value'.
const esSource = readFileSync(join(src, 'i18n', 'es.ts'), 'utf8')
const es = new Map()
for (const m of esSource.matchAll(/^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3\s*,?\s*$/gm)) {
  es.set(m[2].replace(/\\(['"])/g, '$1'), m[4].replace(/\\(['"])/g, '$1'))
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b))
const done = sorted.filter((k) => es.has(k)).length
const lines = sorted.map((k) => `${es.has(k) ? '[x]' : '[ ]'} ${k} = ${es.get(k) ?? ''}`)
writeFileSync(join(root, 'i18n-strings.txt'), `${done} of ${sorted.length} strings translated\n\n${lines.join('\n')}\n`)
console.log(`${done} of ${sorted.length} strings translated — see i18n-strings.txt`)

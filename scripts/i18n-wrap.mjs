// One-off helper for the translation pass: wraps visible JSX text and
// user-facing string attributes in t() so the i18n report can list them.
//
//   <h3>Episodes</h3>            → <h3>{t('Episodes')}</h3>
//   placeholder="Search titles"  → placeholder={t('Search titles')}
//
// Adds `import { t } from '…/i18n'` where needed. Run with a list of files:
//   node scripts/i18n-wrap.mjs src/Foo.tsx src/Bar.tsx

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, join } from 'node:path'
import ts from 'typescript'

const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'label', 'hint', 'searchPlaceholder', 'addLabel', 'alt'])
const root = process.cwd()
const i18nDir = join(root, 'src', 'i18n')

// Worth translating: has letters, isn't a lone symbol / code-ish token.
function isText(s) {
  const v = s.trim()
  if (!/[A-Za-z]/.test(v)) return false
  if (/^[a-z0-9_.:/-]+$/.test(v) && !v.includes(' ')) return false // ids, urls, class-ish
  if (/^https?:/.test(v)) return false
  return true
}

function quote(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getFullText(sf)
      if (isText(raw)) {
        const text = decodeEntities(raw.replace(/\s+/g, ' ').trim())
        const lead = raw.match(/^\s*/)[0]
        const trail = raw.match(/\s*$/)[0]
        // Keep a single space where the original had inline spacing, drop
        // line-break indentation (JSX ignores it anyway).
        const keepLead = lead && !lead.includes('\n') ? '{\' \'}' : ''
        const keepTrail = trail && !trail.includes('\n') ? '{\' \'}' : ''
        edits.push({ start: node.getFullStart(), end: node.getEnd(), text: `${lead.includes('\n') ? lead : ''}${keepLead}{t(${quote(text)})}${keepTrail}${trail.includes('\n') ? trail : ''}` })
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf)
      const value = node.initializer.text
      if (ATTRS.has(name) && isText(value)) {
        edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(), text: `{t(${quote(value)})}` })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (edits.length === 0) continue

  // Import position from the original tree: after the last import (or the
  // existing i18n import gets `t` added). All JSX edits sit after it.
  const imports = sf.statements.filter(ts.isImportDeclaration)
  const i18nImport = imports.find((d) => /\/i18n['"]$/.test(d.moduleSpecifier.getText(sf)))
  const named = i18nImport?.importClause?.namedBindings
  const hasT = !!named && ts.isNamedImports(named) && named.elements.some((e) => e.name.text === 't')
  if (!hasT) {
    if (named && ts.isNamedImports(named)) {
      edits.push({ start: named.getStart(sf) + 1, end: named.getStart(sf) + 1, text: ' t,' })
    } else {
      let rel = relative(dirname(file), i18nDir).replace(/\\/g, '/')
      if (!rel.startsWith('.')) rel = './' + rel
      const at = imports.length ? imports[imports.length - 1].getEnd() : 0
      edits.push({ start: at, end: at, text: `\nimport { t } from '${rel}'` })
    }
  }

  let out = src
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  writeFileSync(file, out)
  console.log(`${file}: ${edits.length}`)
}

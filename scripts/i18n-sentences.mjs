// Second pass of the translation helper, run after i18n-wrap.mjs.
//
// Sentences: JSX text split around values becomes one key with
// placeholders, and "n item(s)" endings become plural():
//
//   {t('Import')}{' '}{selected.size} game{selected.size === 1 ? '' : 's'}
//     → {plural(selected.size, 'Import {n} game', 'Import {n} games')}
//
// Strings in code: toasts, confirms, labels, titles and conditional text
// shown in JSX get t(), template literals get placeholders:
//
//   `Delete "${game.title}"?`  → t('Delete "{title}"?', { title: game.title })
//
//   node scripts/i18n-sentences.mjs src/Foo.tsx src/Bar.tsx

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, join } from 'node:path'
import ts from 'typescript'

const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'label', 'hint', 'searchPlaceholder', 'addLabel', 'alt', 'saveLabel', 'emptyText', 'description', 'subtitle'])
const PROPS = new Set(['label', 'title', 'unit', 'hint', 'description', 'desc', 'placeholder', 'message', 'tooltip', 'emptyText', 'subtitle', 'short', 'heading', 'caption', 'confirmLabel', 'saveLabel', 'addLabel', 'searchPlaceholder', 'empty', 'blurb'])
const CALLS = new Set(['setToast', 'showToast', 'toast', 'notify', 'confirm', 'alert', 'setStatus', 'setError', 'setMessage', 'setNotice', 'setInfo', 'setHint', 'setProgress', 'setStatusText', 'setErr', 'pushToast', 'flash'])
const TRANSLATORS = new Set(['t', 'tk', 'plural'])
const root = process.cwd()
const i18nDir = join(root, 'src', 'i18n')

// Windows sometimes holds a file open for a moment (indexer, dev server).
function writeWithRetry(file, text) {
  for (let i = 0; ; i++) {
    try { writeFileSync(file, text); return } catch (err) {
      if (i >= 20) throw err
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
  }
}

const hasLetters = (s) => /[A-Za-z]/.test(s)
function isText(s) {
  const v = s.trim()
  if (!hasLetters(v)) return false
  if (/^[a-z0-9_.:/#-]+$/.test(v) && !v.includes(' ')) return false
  if (/^https?:/.test(v)) return false
  if (/^[A-Za-z0-9_-]+(\s+[a-z0-9_-]+)*$/.test(v) && /^[a-z]/.test(v) && v.includes('-')) return false // class lists
  return true
}
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
const unwrap = (e) => { while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e))) e = e.expression; return e }
const isStr = (e) => !!e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))

function jsxTextValue(raw) {
  const lines = raw.split(/\r?\n/)
  if (lines.length === 1) return raw
  const out = []
  lines.forEach((line, i) => {
    let l = line
    if (i > 0) l = l.replace(/^\s+/, '')
    if (i < lines.length - 1) l = l.replace(/\s+$/, '')
    if (l) out.push(l)
  })
  return out.join(' ')
}

function containsJsx(n) {
  let found = false
  const v = (x) => {
    if (found) return
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { found = true; return }
    ts.forEachChild(x, v)
  }
  v(n)
  return found
}

function isTCall(e) {
  return ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 't' && e.arguments.length === 1 && ts.isStringLiteral(e.arguments[0])
}

function pluralCond(e) {
  e = unwrap(e)
  if (!e || !ts.isConditionalExpression(e)) return null
  const w = unwrap(e.whenTrue), f = unwrap(e.whenFalse)
  if (!isStr(w) || !isStr(f)) return null
  const c = unwrap(e.condition)
  if (!ts.isBinaryExpression(c)) return null
  const isOne = (x) => ts.isNumericLiteral(unwrap(x)) && unwrap(x).text === '1'
  let count
  if (isOne(c.right)) count = c.left
  else if (isOne(c.left)) count = c.right
  else return null
  const k = c.operatorToken.kind
  if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.EqualsEqualsToken) return { count, one: w.text, other: f.text }
  if (k === ts.SyntaxKind.ExclamationEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken) return { count, one: f.text, other: w.text }
  return null
}

function baseName(e) {
  e = unwrap(e)
  if (!e) return null
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) {
    const n = e.name.text
    if (n === 'length' || n === 'size') return baseName(e.expression) || 'count'
    return n
  }
  if (ts.isCallExpression(e)) {
    const c = unwrap(e.expression)
    if (ts.isPropertyAccessExpression(c) && /^(toLocaleString|toLocaleDateString|toLocaleTimeString|toString|toFixed|join|trim|slice|toLowerCase|toUpperCase|padStart)$/.test(c.name.text)) return baseName(c.expression)
    if (ts.isIdentifier(c)) return (e.arguments[0] && baseName(e.arguments[0])) || c.text
    if (ts.isPropertyAccessExpression(c)) return c.name.text
  }
  if (ts.isElementAccessExpression(e)) return baseName(e.expression)
  if (ts.isConditionalExpression(e)) return baseName(e.whenTrue) || baseName(e.whenFalse)
  if (ts.isBinaryExpression(e)) return baseName(e.left) || baseName(e.right)
  if (ts.isNewExpression(e)) return 'date'
  return null
}

// Literal text a value expression can evaluate to: conditional branches
// and the fallback side of || / ??.
function resultNodes(e, out = []) {
  const u = unwrap(e)
  if (!u) return out
  if (ts.isConditionalExpression(u)) { resultNodes(u.whenTrue, out); resultNodes(u.whenFalse, out) }
  else if (ts.isBinaryExpression(u) && (u.operatorToken.kind === ts.SyntaxKind.BarBarToken || u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) { resultNodes(u.left, out); resultNodes(u.right, out) }
  else if (isStr(u) && isText(u.text)) out.push(u)
  else if (ts.isTemplateExpression(u)) out.push(u)
  return out
}

function createFile(file, src, sf) {
  const used = new Set()

  // Source of an expression with its literal results translated.
  function exprWithT(e) {
    const nodes = resultNodes(e)
    let text = src.slice(e.getStart(sf), e.getEnd())
    const base = e.getStart(sf)
    for (const n of nodes.sort((a, b) => b.getStart(sf) - a.getStart(sf))) {
      const rep = ts.isTemplateExpression(n) ? templateCall(n) : (used.add('t'), `t(${quote(n.text)})`)
      text = text.slice(0, n.getStart(sf) - base) + rep + text.slice(n.getEnd() - base)
    }
    return text
  }

  // pieces: { text } | { expr } | { plural }
  function buildCall(pieces) {
    const names = new Map()
    const taken = new Set(['n'])
    const vars = []
    const pl = pieces.find((p) => p.plural)?.plural
    const countSrc = pl ? src.slice(pl.count.getStart(sf), pl.count.getEnd()) : null
    let one = '', other = ''
    for (const p of pieces) {
      if (p.text !== undefined) { one += p.text; other += p.text; continue }
      if (p.plural) {
        const ps = src.slice(p.plural.count.getStart(sf), p.plural.count.getEnd())
        if (ps === countSrc) { one += p.plural.one; other += p.plural.other; continue }
      }
      const expr = p.expr ?? null
      const exprSrc = expr ? src.slice(expr.getStart(sf), expr.getEnd()) : null
      if (exprSrc && exprSrc === countSrc) { one += '{n}'; other += '{n}'; continue }
      const node = expr ?? p.plural.count
      const key = exprSrc ?? src.slice(node.getStart(sf), node.getEnd())
      let name = names.get(key)
      if (!name) {
        let b = (baseName(node) || 'value').replace(/\W/g, '') || 'value'
        name = b
        for (let i = 2; taken.has(name); i++) name = `${b}${i}`
        taken.add(name)
        names.set(key, name)
        vars.push(`${name}: ${expr ? exprWithT(expr) : key}`)
      }
      one += `{${name}}`; other += `{${name}}`
    }
    const clean = (s) => s.replace(/\s+/g, ' ')
    one = clean(one); other = clean(other)
    const lead = /^\s/.test(other), trail = /\s$/.test(other)
    one = one.trim(); other = other.trim()
    const varsSrc = vars.length ? `, { ${vars.join(', ')} }` : ''
    let call
    if (pl) { used.add('plural'); call = `plural(${countSrc}, ${quote(one)}, ${quote(other)}${varsSrc})` }
    else { used.add('t'); call = `t(${quote(other)}${varsSrc})` }
    return { call, lead, trail, letters: hasLetters(other.replace(/\{\w+\}/g, '')) }
  }

  function templateCall(n) {
    const pieces = [{ text: n.head.text }]
    for (const span of n.templateSpans) {
      const pc = pluralCond(span.expression)
      pieces.push(pc ? { plural: pc } : { expr: span.expression })
      pieces.push({ text: span.literal.text })
    }
    const r = buildCall(pieces)
    if (!r.lead && !r.trail) return r.call
    return `\`${r.lead ? ' ' : ''}\${${r.call}}${r.trail ? ' ' : ''}\``
  }

  return { used, exprWithT, buildCall, templateCall }
}

function insideTranslator(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && TRANSLATORS.has(p.expression.text)) return true
    if (ts.isImportDeclaration(p) || ts.isTypeNode(p)) return true
  }
  return false
}

// --only <list>: wrap just the literals named in a list of
// "path:line<TAB>text" rows (as printed by a scan), nothing else.
const args = process.argv.slice(2)
let only = null
if (args[0] === '--only') {
  only = new Map()
  for (const row of readFileSync(args[1], 'utf8').split(/\r?\n/)) {
    const m = row.match(/^(.+?):(\d+)\t(.*)$/)
    if (!m) continue
    const f = m[1].replace(/\\/g, '/')
    if (!only.has(f)) only.set(f, new Set())
    only.get(f).add(Number(m[2]))
  }
  args.splice(0, 2, ...only.keys())
}

for (const file of args) {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const h = createFile(file, src, sf)
  const edits = []
  let sentences = 0

  if (only) {
    const lines = only.get(file.replace(/\\/g, '/'))
    const visitOnly = (n) => {
      const lit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)
      if (lit) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
        const isName = n.parent && (ts.isPropertyAssignment(n.parent) || ts.isPropertySignature(n.parent)) && n.parent.name === n
        if (lines.has(line) && !isName && !insideTranslator(n) && !ts.isImportDeclaration(n.parent) && !ts.isLiteralTypeNode(n.parent)) {
          const text = ts.isTemplateExpression(n) ? h.templateCall(n) : (h.used.add('t'), `t(${quote(n.text)})`)
          const inAttr = ts.isJsxAttribute(n.parent)
          edits.push({ start: n.getStart(sf), end: n.getEnd(), text: inAttr ? `{${text}}` : text })
          return
        }
      }
      ts.forEachChild(n, visitOnly)
    }
    visitOnly(sf)
  }

  // Phase 1: JSX sentence runs.
  const handleChildren = (children) => {
    let run = []
    const flush = () => {
      const meaningful = run.filter((c) => !c.neutral)
      run = []
      if (meaningful.length < 2) return
      const textLetters = meaningful.filter((c) => c.piece.text !== undefined && hasLetters(c.piece.text)).length
      const values = meaningful.filter((c) => c.piece.text === undefined).length
      if (textLetters === 0 || (values === 0 && textLetters < 2)) return
      const r = h.buildCall(meaningful.map((c) => c.piece))
      if (!r.letters) return
      const first = meaningful[0], last = meaningful[meaningful.length - 1]
      let start = first.node.getStart(sf), end = last.node.getEnd()
      if (ts.isJsxText(first.node)) start = first.node.pos + (src.slice(first.node.pos, first.node.end).match(/^\s*\n\s*/)?.[0].length ?? 0)
      if (ts.isJsxText(last.node)) end = last.node.end - (src.slice(last.node.pos, last.node.end).match(/\s*\n\s*$/)?.[0].length ?? 0)
      edits.push({ start, end, text: `${r.lead ? "{' '}" : ''}{${r.call}}${r.trail ? "{' '}" : ''}` })
      sentences++
    }
    for (const c of children) {
      if (ts.isJsxText(c)) {
        const v = jsxTextValue(src.slice(c.pos, c.end))
        run.push({ node: c, piece: { text: v }, neutral: v === '' })
        continue
      }
      if (ts.isJsxExpression(c)) {
        const e = unwrap(c.expression)
        if (!e) { run.push({ node: c, piece: { text: '' }, neutral: true }); continue }
        if (isStr(e)) { run.push({ node: c, piece: { text: e.text }, neutral: e.text === '' }); continue }
        if (isTCall(e)) { run.push({ node: c, piece: { text: e.arguments[0].text } }); continue }
        const pc = pluralCond(e)
        if (pc) { run.push({ node: c, piece: { plural: pc } }); continue }
        const isAnd = ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        const translated = ts.isCallExpression(e) && ts.isIdentifier(e.expression) && TRANSLATORS.has(e.expression.text)
        if (!containsJsx(e) && !isAnd && !translated) { run.push({ node: c, piece: { expr: c.expression } }); continue }
      }
      flush()
    }
    flush()
  }
  const visit1 = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) handleChildren(node.children)
    ts.forEachChild(node, visit1)
  }
  if (!only) visit1(sf)

  // Phase 2: strings in code. Nodes inside a phase-1 edit are left alone.
  const inEdit = (n) => edits.some((e) => n.getStart(sf) >= e.start && n.getEnd() <= e.end)
  const literalEdits = new Map()
  const take = (expr) => {
    if (!expr) return
    for (const n of resultNodes(expr)) {
      if (insideTranslator(n) || inEdit(n) || literalEdits.has(n.getStart(sf))) continue
      const text = ts.isTemplateExpression(n) ? h.templateCall(n) : (h.used.add('t'), `t(${quote(n.text)})`)
      literalEdits.set(n.getStart(sf), { start: n.getStart(sf), end: n.getEnd(), text })
    }
  }
  const visit2 = (node) => {
    if (ts.isJsxExpression(node) && node.expression) {
      const parent = node.parent
      if (ts.isJsxAttribute(parent)) { if (ATTRS.has(parent.name.getText(sf))) take(node.expression) }
      else if (!ts.isJsxSpreadAttribute(parent)) take(node.expression)
    } else if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && PROPS.has(node.name.text)) {
      take(node.initializer)
    } else if (ts.isCallExpression(node)) {
      const c = unwrap(node.expression)
      const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null
      if (name && CALLS.has(name) && node.arguments[0]) take(node.arguments[0])
    }
    ts.forEachChild(node, visit2)
  }
  if (!only) visit2(sf)
  // Drop literal edits nested inside other literal edits (templates).
  const lits = [...literalEdits.values()].sort((a, b) => a.start - b.start || b.end - a.end)
  let lastEnd = -1
  for (const e of lits) { if (e.start < lastEnd) continue; edits.push(e); lastEnd = e.end }

  if (edits.length === 0) continue

  const imports = sf.statements.filter(ts.isImportDeclaration)
  const i18nImport = imports.find((d) => /\/i18n['"]$/.test(d.moduleSpecifier.getText(sf)))
  const named = i18nImport?.importClause?.namedBindings
  const have = new Set(named && ts.isNamedImports(named) ? named.elements.map((e) => e.name.text) : [])
  const missing = [...h.used].filter((n) => !have.has(n)).sort()
  if (missing.length) {
    if (named && ts.isNamedImports(named)) {
      edits.push({ start: named.getStart(sf) + 1, end: named.getStart(sf) + 1, text: ` ${missing.join(', ')},` })
    } else {
      let rel = relative(dirname(file), i18nDir).replace(/\\/g, '/')
      if (!rel.startsWith('.')) rel = './' + rel
      const at = imports.length ? imports[imports.length - 1].getEnd() : 0
      edits.push({ start: at, end: at, text: `\nimport { ${missing.join(', ')} } from '${rel}'` })
    }
  }

  let out = src
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  writeWithRetry(file, out)
  console.log(`${file}: ${sentences} sentences, ${edits.length - sentences} strings`)
}

// Interface translations. The English text written in the code is the
// key: `t('Search games')` shows "Search games" in English and whatever
// the active dictionary maps it to otherwise. Anything not translated yet
// falls back to the English text, so screens can be translated a piece at
// a time without breaking.
//
//   t('Add widget')                     → "Add widget" / "Agregar widget"
//   t('{n} items', { n: 4 })            → "4 items"    / "4 ítems"
//   plural(n, '{n} item', '{n} items')  → picks the form, then translates it

import es from './es'

export type Language = 'en' | 'es'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, es }

// Locale used for dates and numbers in each language.
const LOCALES: Record<Language, string> = { en: 'en-US', es: 'es-AR' }

// Remembered between launches so strings built when a module loads (option
// tables, default labels) come out in the right language from the start.
const STORAGE_KEY = 'omnio.language'

function storedLanguage(): Language {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY)
    return v === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

let current: Language = storedLanguage()
const listeners = new Set<() => void>()

export function setLanguage(language: Language): void {
  const next = DICTIONARIES[language] ? language : 'en'
  if (typeof document !== 'undefined') document.documentElement.lang = next
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
  if (next === current) return
  current = next
  for (const fn of listeners) fn()
}

/** Runs `fn` whenever the interface language changes. */
export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Compares two strings alphabetically in the interface language. */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, LOCALES[current], { sensitivity: 'base' })
}

export function getLanguage(): Language {
  return current
}

/** Locale string for `toLocaleDateString` / `toLocaleString` / `Intl`. */
export function locale(): string {
  return LOCALES[current]
}

/** Translate an English interface string, filling `{name}` placeholders. */
export function t(text: string, vars?: Record<string, unknown>): string {
  const out = DICTIONARIES[current][text] ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name] ?? '') : whole))
}

/**
 * Marks a string defined outside render (module constants, option tables)
 * as translatable without translating it yet; the code that shows it calls
 * t() on it. Lets the i18n report find it.
 */
export function tk(text: string): string {
  return text
}

/** Singular / plural form for `n`, translated. Both forms may use `{n}` and any of `vars`. */
export function plural(n: number, one: string, other: string, vars?: Record<string, unknown>): string {
  return t(n === 1 ? one : other, { ...vars, n: n.toLocaleString(locale()) })
}

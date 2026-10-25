import { afterEach, describe, expect, it } from 'vitest'
import { getLanguage, locale, plural, setLanguage, t } from './index'

afterEach(() => setLanguage('en'))

describe('i18n', () => {
  it('returns the English text when no translation exists', () => {
    setLanguage('es')
    expect(t('Some text nobody translated')).toBe('Some text nobody translated')
  })

  it('translates known strings in the active language', () => {
    expect(t('Language')).toBe('Language')
    setLanguage('es')
    expect(t('Language')).toBe('Idioma')
  })

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(t('{n} of {total}', { n: 3, total: 9 })).toBe('3 of 9')
    expect(t('{n} and {missing}', { n: 1 })).toBe('1 and {missing}')
  })

  it('picks singular or plural', () => {
    expect(plural(1, '{n} item', '{n} items')).toBe('1 item')
    expect(plural(4, '{n} item', '{n} items')).toBe('4 items')
  })

  it('switches the date locale with the language', () => {
    expect(locale()).toBe('en-US')
    setLanguage('es')
    expect(getLanguage()).toBe('es')
    expect(locale()).toBe('es-AR')
  })
})

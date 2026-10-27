import { describe, expect, it } from 'vitest'
import changelogEn from '../../CHANGELOG.md?raw'
import changelogEs from '../../CHANGELOG.es.md?raw'
import pkg from '../../package.json'
import { parseReleaseNotes } from './ReleaseNotes'

describe('release notes', () => {
  it('has notes for the current version in both languages', () => {
    const en = parseReleaseNotes(changelogEn, pkg.version)
    const es = parseReleaseNotes(changelogEs, pkg.version)
    expect(en.length).toBeGreaterThan(0)
    expect(es.map((s) => s.items.length)).toEqual(en.map((s) => s.items.length))
  })

  it('reads headings, items and nested items of one version only', () => {
    const md = [
      '## v1.2.0 — 2026-01-01', '', '### Added', '', '- **One.** First.', '  - nested a', '- Two', '',
      '### Fixed', '', '- Three', '', '## v1.1.0 — 2025-12-01', '', '### Added', '', '- Older',
    ].join('\n')
    expect(parseReleaseNotes(md, '1.2.0')).toEqual([
      { heading: 'Added', items: [{ text: '**One.** First.', children: ['nested a'] }, { text: 'Two', children: [] }] },
      { heading: 'Fixed', items: [{ text: 'Three', children: [] }] },
    ])
    expect(parseReleaseNotes(md, '1.2')).toEqual([])
    expect(parseReleaseNotes(md, '9.9.9')).toEqual([])
  })
})

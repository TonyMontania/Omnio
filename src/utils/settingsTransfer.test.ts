import { describe, expect, it } from 'vitest'
import { buildSettingsFile, mergeImportedSettings, mergeSmartLists, parseSettingsFile } from './settingsTransfer'

const settings = {
  theme: 'nord', accent: 'gold', tmdbApiKey: 'secret', httpProxy: 'http://u:p@proxy',
  lastExportFolder: 'C:/exports', autoBackupTarget: 'D:/backups', unlockedPlugins: ['x'],
  homeWidgets: [{ id: 'pinned', size: 'large' }],
}

describe('buildSettingsFile', () => {
  it('drops machine-specific and plugin fields, and keys unless asked', () => {
    const f = buildSettingsFile(settings, [], false)
    expect(f.settings).toEqual({ theme: 'nord', accent: 'gold', homeWidgets: [{ id: 'pinned', size: 'large' }] })
    expect(buildSettingsFile(settings, [], true).settings).toMatchObject({ tmdbApiKey: 'secret', httpProxy: 'http://u:p@proxy' })
  })
})

describe('parseSettingsFile', () => {
  it('round-trips an exported file', () => {
    const text = JSON.stringify(buildSettingsFile(settings, [{ id: 's1' }], false))
    expect(parseSettingsFile(text).smartLists).toEqual([{ id: 's1' }])
  })
  it('rejects other files', () => {
    expect(() => parseSettingsFile('{"items":[]}')).toThrow('Omnio settings file')
    expect(() => parseSettingsFile('nope')).toThrow('valid JSON')
  })
  it('ignores machine fields smuggled into a file', () => {
    const f = parseSettingsFile(JSON.stringify({ app: 'omnio', kind: 'settings', settings: { theme: 'nord', autoBackupTarget: 'X:/' } }))
    expect(f.settings).toEqual({ theme: 'nord' })
  })
})

describe('merging', () => {
  it('keeps this computer\'s own folders and keys when the file has none', () => {
    const file = parseSettingsFile(JSON.stringify(buildSettingsFile({ theme: 'nord' }, [], false)))
    expect(mergeImportedSettings({ theme: 'dark', tmdbApiKey: 'mine', lastExportFolder: 'C:/x' }, file))
      .toEqual({ theme: 'nord', tmdbApiKey: 'mine', lastExportFolder: 'C:/x' })
  })
  it('replaces smart lists with the same id and adds new ones', () => {
    expect(mergeSmartLists([{ id: 'a', name: 'old' }, { id: 'b', name: 'keep' }], [{ id: 'a', name: 'new' }, { id: 'c', name: 'added' }]))
      .toEqual([{ id: 'b', name: 'keep' }, { id: 'a', name: 'new' }, { id: 'c', name: 'added' }])
  })
})

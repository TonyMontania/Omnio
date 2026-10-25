// Steam library importer. Reads a public Steam profile's game list via
// the community XML endpoint (no API key). The user pastes their profile
// URL or vanity id; we fetch, parse, and let them choose which titles
// to import into Games. Playtime maps to `playTime` in hours; ownership
// defaults to 'owned'.

import { useState } from 'react'
import type { Item } from './types'
import { plural, t } from './i18n'

interface Props {
  onImport: (items: Item[]) => void
  onClose: () => void
}

interface SteamGame {
  appId: string
  name: string
  hoursOnRecord?: string
  logoUrl?: string
}

function parseSteamXml(xml: string): SteamGame[] {
  // Simple regex parse — the XML is flat and predictable; a full DOMParser
  // roundtrip works too but this keeps the module dependency-free.
  const games: SteamGame[] = []
  const re = /<game>([\s\S]*?)<\/game>/g
  const pick = (block: string, tag: string) => {
    const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`).exec(block)
    return m ? m[1].trim() : undefined
  }
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const b = m[1]
    const appId = pick(b, 'appID')
    const name = pick(b, 'name')
    if (!appId || !name) continue
    games.push({ appId, name, hoursOnRecord: pick(b, 'hoursOnRecord'), logoUrl: pick(b, 'logo') })
  }
  return games
}

export default function SteamImporter({ onImport, onClose }: Props) {
  const [input, setInput] = useState('')
  const [games, setGames] = useState<SteamGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchProfile = async () => {
    if (!input.trim()) { setError(t('Enter your Steam profile URL or vanity name.')); return }
    setLoading(true); setError(null)
    try {
      const r = await window.ipcRenderer.invoke('steam:library', input) as { ok: boolean; xml?: string; error?: string }
      if (!r?.ok) { setError(r?.error ?? t('Fetch failed')); return }
      const xml = r.xml ?? ''
      if (xml.includes('This profile is private')) { setError(t('That profile is private. Enable "Game details" in Steam privacy settings.')); return }
      const list = parseSteamXml(xml)
      if (list.length === 0) { setError(t('No games found in that profile.')); return }
      setGames(list)
      setSelected(new Set(list.map((g) => g.appId)))
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => setSelected((s) => s.size === games.length ? new Set() : new Set(games.map((g) => g.appId)))

  const doImport = () => {
    const items: Item[] = games.filter((g) => selected.has(g.appId)).map((g) => ({
      id: crypto.randomUUID(),
      categoryId: 'videojuegos',
      title: g.name,
      createdAt: Date.now(),
      platforms: ['PC (Microsoft Windows)'],
      ownership: 'owned',
      playTime: g.hoursOnRecord ? String(parseFloat(g.hoursOnRecord.replace(/,/g, ''))) : undefined,
      gameStatus: g.hoursOnRecord && parseFloat(g.hoursOnRecord) > 0 ? 'played' : 'backlog',
    }))
    onImport(items)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>{t('Import from Steam')}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto' }}>
          <p className="hint">{t('Paste your Steam profile URL (e.g.')}{' '}<code>https://steamcommunity.com/id/gabelogannewell</code>{t(') or just your vanity name (')}<code>gabelogannewell</code>{t('). Your')}{' '}<strong>{t('Game details')}</strong>{' '}{t('privacy must be public — check under Steam > Edit Profile > Privacy Settings. No API key needed.')}</p>
          <div className="fetch-search-row" style={{ marginTop: 12 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchProfile() }}
              placeholder={t('Steam profile URL or vanity name')}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={fetchProfile} disabled={loading}>{loading ? t('Fetching…') : t('Fetch library')}</button>
          </div>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}

          {games.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 8 }}>
                <button type="button" className="secondary-btn" onClick={toggleAll}>
                  {selected.size === games.length ? t('Deselect all') : t('Select all')}
                </button>
                <span className="hint" style={{ margin: 0 }}>{t('{selected} of {games} selected · Total {reduce}h played', { selected: selected.size, games: games.length, reduce: games.reduce((s, g) => s + (g.hoursOnRecord ? parseFloat(g.hoursOnRecord.replace(/,/g, '')) : 0), 0).toFixed(0) })}</span>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                {games.map((g) => (
                  <label key={g.appId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(g.appId)} onChange={() => toggle(g.appId)} />
                    <span style={{ flex: 1 }}>{g.name}</span>
                    {g.hoursOnRecord && <span className="hint" style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t('{hoursOnRecord}h', { hoursOnRecord: g.hoursOnRecord })}</span>}
                  </label>
                ))}
              </div>
              <div className="settings-actions" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary-btn" onClick={onClose}>{t('Cancel')}</button>
                <button type="button" className="primary" onClick={doImport} disabled={selected.size === 0}>{plural(selected.size, 'Import {n} game', 'Import {n} games')}</button>
              </div>
              <p className="hint" style={{ marginTop: 12 }}>{t('Playtime and status are pre-filled. Covers are not — after importing, open any item and click')}{' '}<strong>{t('↗ IGDB')}</strong> or <strong>{t('↗ SteamGridDB')}</strong>{' '}{t('to fetch metadata and artwork.')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

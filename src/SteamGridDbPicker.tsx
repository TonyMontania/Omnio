// Two-step picker for SteamGridDB artwork. Step 1 picks the game
// (autocomplete), step 2 shows the grid of assets (covers / banners /
// logos) for that game and lets the user pick one — we then download
// it to assets/videojuegos/{kind}/ and hand back the relative path.

import { useEffect, useMemo, useState } from 'react'

type Kind = 'grids' | 'heroes' | 'logos'

interface Props {
  apiKey?: string
  initialQuery?: string
  kind: Kind
  onPick: (relativePath: string) => void
  onClose: () => void
}

interface Game {
  id: number
  name: string
  types?: string[]
  release_date?: number
}

interface Asset {
  id: number
  url: string
  thumb: string
  width: number
  height: number
  style?: string
  notes?: string
}

const KIND_LABEL: Record<Kind, string> = {
  grids: 'Cover',
  heroes: 'Banner',
  logos: 'Logo',
}
const KIND_TO_LOCAL: Record<Kind, string> = {
  grids: 'cover',
  heroes: 'banner',
  logos: 'logo',
}

export default function SteamGridDbPicker({ apiKey, initialQuery, kind, onPick, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [games, setGames] = useState<Game[]>([])
  const [gameSearchLoading, setGameSearchLoading] = useState(false)
  const [gameSearchError, setGameSearchError] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)

  const keyLooksSet = useMemo(() => (apiKey ?? '').trim().length >= 20, [apiKey])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const searchGame = async () => {
    if (!keyLooksSet) { setGameSearchError('No API key configured'); return }
    if (!query.trim()) return
    setGameSearchLoading(true)
    setGameSearchError(null)
    setGame(null)
    setAssets([])
    const r = await window.ipcRenderer.invoke('sgdb:search', apiKey, query.trim())
    setGameSearchLoading(false)
    if (r?.ok) setGames((r.data as Game[]) ?? [])
    else setGameSearchError(r?.error ?? 'Search failed')
  }

  // Auto-run first search if we have both key and query on mount.
  useEffect(() => {
    if (keyLooksSet && (initialQuery ?? '').trim()) searchGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickGame = async (g: Game) => {
    setGame(g)
    setAssetsLoading(true)
    setAssetsError(null)
    const r = await window.ipcRenderer.invoke('sgdb:assets', apiKey, kind, g.id)
    setAssetsLoading(false)
    if (r?.ok) setAssets((r.data as Asset[]) ?? [])
    else setAssetsError(r?.error ?? 'Failed to load assets')
  }

  const pickAsset = async (a: Asset) => {
    setDownloading(a.id)
    const rel = await window.ipcRenderer.invoke('image:download', a.url, 'videojuegos', KIND_TO_LOCAL[kind])
    setDownloading(null)
    if (rel) { onPick(rel); onClose() }
    else alert('Download failed. Try another asset or check your connection.')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>SteamGridDB · {KIND_LABEL[kind]}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!keyLooksSet && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              Set your SteamGridDB API key in Settings → Data → Integrations first.
              Register a free one at <code>steamgriddb.com/profile/preferences/api</code>.
            </p>
          )}

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchGame() }}
              placeholder="Search a game…"
              disabled={!keyLooksSet}
            />
            <button type="button" className="secondary-btn" onClick={searchGame} disabled={!keyLooksSet || gameSearchLoading}>
              {gameSearchLoading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {gameSearchError && <p className="hint" style={{ color: 'var(--danger)' }}>{gameSearchError}</p>}

          {!game && games.length > 0 && (
            <ul className="fetch-game-list">
              {games.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => pickGame(g)}>
                    <span className="fetch-game-name">{g.name}</span>
                    {g.release_date && <span className="fetch-game-year">{new Date(g.release_date * 1000).getFullYear()}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {game && (
            <>
              <p className="fetch-selected-game">
                <span>Showing {KIND_LABEL[kind].toLowerCase()}s for <strong>{game.name}</strong></span>
                <button type="button" className="link-btn" onClick={() => { setGame(null); setAssets([]) }}>← different game</button>
              </p>
              {assetsLoading && <p className="hint">Loading artwork…</p>}
              {assetsError && <p className="hint" style={{ color: 'var(--danger)' }}>{assetsError}</p>}
              {!assetsLoading && !assetsError && assets.length === 0 && (
                <p className="hint">No {KIND_LABEL[kind].toLowerCase()}s uploaded for this game yet.</p>
              )}
              {assets.length > 0 && (
                <div className={`fetch-asset-grid ${kind}`}>
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`fetch-asset ${downloading === a.id ? 'downloading' : ''}`}
                      onClick={() => pickAsset(a)}
                      disabled={downloading !== null}
                      title={a.notes || `${a.width}×${a.height}`}
                    >
                      <img src={a.thumb} alt="" loading="lazy" />
                      {downloading === a.id && <span className="fetch-asset-status">Downloading…</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

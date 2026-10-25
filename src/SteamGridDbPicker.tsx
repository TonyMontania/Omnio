// Two-step picker for SteamGridDB artwork. Step 1 picks the game
// (autocomplete), step 2 shows the grid of assets (covers / banners /
// logos) for that game and lets the user pick one — we then download
// it to assets/videojuegos/{kind}/ and hand back the relative path.

import { useEffect, useMemo, useState } from 'react'
import { assetBasename, downloadImageAsset } from './utils/files'
import { t, tk } from './i18n'

type Kind = 'grids' | 'heroes' | 'logos'

interface Props {
  apiKey?: string
  initialQuery?: string
  kind: Kind
  onPick: (relativePath: string) => void
  onClose: () => void
  // Override the on-disk asset folder (defaults to KIND_TO_LOCAL[kind]).
  // Used for bundle sub-covers which live under assets/videojuegos/bundle/.
  saveAsKind?: string
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
  grids: tk('Cover'),
  heroes: tk('Banner'),
  logos: tk('Logo'),
}
const KIND_PLURAL: Record<Kind, string> = {
  grids: tk('covers'),
  heroes: tk('banners'),
  logos: tk('logos'),
}
const KIND_TO_LOCAL: Record<Kind, string> = {
  grids: 'cover',
  heroes: 'banner',
  logos: 'logo',
}

export default function SteamGridDbPicker({ apiKey, initialQuery, kind, onPick, onClose, saveAsKind }: Props) {
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
    if (!keyLooksSet) { setGameSearchError(t('No API key configured')); return }
    if (!query.trim()) return
    setGameSearchLoading(true)
    setGameSearchError(null)
    setGame(null)
    setAssets([])
    const r = await window.ipcRenderer.invoke('sgdb:search', apiKey, query.trim())
    setGameSearchLoading(false)
    if (r?.ok) setGames((r.data as Game[]) ?? [])
    else setGameSearchError(r?.error ?? t('Search failed'))
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
    else setAssetsError(r?.error ?? t('Failed to load assets'))
  }

  const pickAsset = async (a: Asset) => {
    setDownloading(a.id)
    // Prefer the picked-game name (SGDB match), fall back to the query the
    // user typed. Bundle sub-covers pass their sub-game name as initialQuery
    // so this still ends up with the right on-disk name.
    const hint = game?.name || query.trim() || initialQuery || ''
    const folderKind = saveAsKind ?? KIND_TO_LOCAL[kind]
    // Filename always uses the semantic kind ('cover' / 'banner' / 'logo'),
    // even when folderKind='bundle' — matches the on-disk convention where
    // bundle sub-covers are named "{sub-game} cover.ext".
    const filenameKind = KIND_TO_LOCAL[kind]
    const rel = await downloadImageAsset( a.url, 'videojuegos', folderKind, assetBasename(hint, filenameKind))
    setDownloading(null)
    if (rel) { onPick(rel); onClose() }
    else alert(t('Download failed. Try another asset or check your connection.'))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('SteamGridDB · {KIND_LABEL}', { KIND_LABEL: t(KIND_LABEL[kind]) })}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!keyLooksSet && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              {t('Set your SteamGridDB API key in Settings → Data → Integrations first. Register a free one at')}{' '}<code>steamgriddb.com/profile/preferences/api</code>.
            </p>
          )}

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchGame() }}
              placeholder={t('Search a game…')}
              disabled={!keyLooksSet}
            />
            <button type="button" className="secondary-btn" onClick={searchGame} disabled={!keyLooksSet || gameSearchLoading}>
              {gameSearchLoading ? t('Searching…') : t('Search')}
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
                <span>{t('Showing {kinds} for', { kinds: t(KIND_PLURAL[kind]) })}{' '}<strong>{game.name}</strong></span>
                <button type="button" className="link-btn" onClick={() => { setGame(null); setAssets([]) }}>{t('← different game')}</button>
              </p>
              {assetsLoading && <p className="hint">{t('Loading artwork…')}</p>}
              {assetsError && <p className="hint" style={{ color: 'var(--danger)' }}>{assetsError}</p>}
              {!assetsLoading && !assetsError && assets.length === 0 && (
                <p className="hint">{t('No {kinds} uploaded for this game yet.', { kinds: t(KIND_PLURAL[kind]) })}</p>
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
                      title={a.notes || t('{width}×{height}', { width: a.width, height: a.height })}
                    >
                      <img src={a.thumb} alt="" loading="lazy" />
                      {downloading === a.id && <span className="fetch-asset-status">{t('Downloading…')}</span>}
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

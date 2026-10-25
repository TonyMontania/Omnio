import { useEffect, useMemo, useState } from 'react'
import type { ArtistImageHit } from './types/ipc-contract'
import { assetBasename, downloadImageAsset } from './utils/files'
import { t } from './i18n'

type Target = 'photo' | 'banner'

interface Props {
  artistName: string
  target: Target
  onPick: (path: string) => void
  onClose: () => void
}

const SOURCE_LABEL: Record<ArtistImageHit['source'], string> = { deezer: 'Deezer', theaudiodb: 'TheAudioDB' }

function fitsTarget(hit: ArtistImageHit, target: Target): boolean {
  return target === 'photo' ? hit.kind === 'photo' : hit.kind !== 'photo'
}

export default function ArtistImagePicker({ artistName, target, onPick, onClose }: Props) {
  const [query, setQuery] = useState(artistName)
  const [hits, setHits] = useState<ArtistImageHit[] | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Target>(target)
  const [saving, setSaving] = useState<string | null>(null)

  const search = async (term: string) => {
    if (!term.trim()) return
    setHits(null); setError('')
    const r = await window.ipcRenderer.invoke('artist:images-search', term.trim())
    if (r?.ok) setHits(r.data)
    else { setHits([]); setError(r?.error ?? t('Search failed')) }
  }

  useEffect(() => { void search(artistName) }, [artistName])

  const shown = useMemo(() => (hits ?? []).filter((h) => fitsTarget(h, tab)), [hits, tab])
  const counts = useMemo(() => ({
    photo: (hits ?? []).filter((h) => fitsTarget(h, 'photo')).length,
    banner: (hits ?? []).filter((h) => fitsTarget(h, 'banner')).length,
  }), [hits])

  const pick = async (hit: ArtistImageHit) => {
    setSaving(hit.url)
    const path = await downloadImageAsset(hit.url, 'artists', 'photo', assetBasename(artistName || hit.artist, target))
    setSaving(null)
    if (path) { onPick(path); onClose() }
    else setError(t('Could not download that image. Try another one.'))
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-panel fetch-modal artist-img-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{target === 'photo' ? t('Find a photo') : t('Find a banner')}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form className="artist-img-search" onSubmit={(e) => { e.preventDefault(); void search(query) }}>
            <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Artist name')} autoFocus />
            <button type="submit" className="secondary-btn">{t('Search')}</button>
          </form>
          <div className="artist-img-tabs" role="tablist">
            {(['photo', 'banner'] as const).map((kind) => (
              <button key={kind} type="button" role="tab" className={tab === kind ? 'pill active' : 'pill'} onClick={() => setTab(kind)}>
                {kind === 'photo' ? t('Photos') : t('Banners & backdrops')}{hits ? ` (${counts[kind]})` : ''}
              </button>
            ))}
          </div>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {hits === null ? (
            <p className="hint">{t('Searching Deezer and TheAudioDB…')}</p>
          ) : shown.length === 0 ? (
            <p className="hint">{t('No {value} found. Try another spelling of the name.', { value: tab === 'photo' ? 'photos' : 'banners' })}</p>
          ) : (
            <div className={`artist-img-grid ${tab}`}>
              {shown.map((hit) => (
                <button key={hit.url} type="button" className="artist-img-card" disabled={saving !== null} onClick={() => void pick(hit)} title={t('{artist} — {SOURCE_LABEL}', { artist: hit.artist, SOURCE_LABEL: SOURCE_LABEL[hit.source] })}>
                  <div className="artist-img-thumb">
                    <img src={hit.thumb} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = hit.url }} />
                    {saving === hit.url && <span className="anilist-applying">{t('Saving…')}</span>}
                  </div>
                  <div className="artist-img-name">{hit.artist}</div>
                  <div className="artist-img-meta">{SOURCE_LABEL[hit.source]} · {hit.detail}</div>
                </button>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 12 }}>{t('Images from Deezer and TheAudioDB. The one you pick is saved with your library.')}</p>
        </div>
      </div>
    </div>
  )
}

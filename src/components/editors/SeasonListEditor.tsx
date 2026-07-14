// Seasons for a Series. Each row can be expanded to also manage per-episode
// rows (title, watched, rating). "Bulk add" fills N seasons at once, and
// "Fill from total" auto-generates episode rows from the season's episode count.

import { useState } from 'react'
import type { Season, Episode } from '../../types'
import { StarRatingInput } from '../../StarRating'

export default function SeasonListEditor({ seasons, onAdd, onRemove, onUpdate, onToggleWatched, onRatingChange, onBulkAdd, onEpisodesChange }: {
  seasons: Season[]
  onAdd: (s: Omit<Season, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Season>) => void
  onToggleWatched: (id: string) => void
  onRatingChange: (id: string, r: number) => void
  onBulkAdd: (count: number) => void
  onEpisodesChange: (seasonId: string, episodes: Episode[]) => void
}) {
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [totalEps, setTotalEps] = useState('')
  const [bulkCount, setBulkCount] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleAdd = () => {
    if (!number.trim()) return
    onAdd({ number: number.trim(), title: title.trim() || undefined, year: year.trim() || undefined, totalEpisodes: totalEps.trim() || undefined })
    setNumber(''); setTitle(''); setYear(''); setTotalEps('')
  }
  const handleBulk = () => {
    const n = parseInt(bulkCount, 10)
    if (isNaN(n) || n <= 0) return
    onBulkAdd(n)
    setBulkCount('')
  }
  const addEpisodeToSeason = (season: Season) => {
    const eps = season.episodes ?? []
    const next: Episode = { id: crypto.randomUUID(), number: String(eps.length + 1) }
    onEpisodesChange(season.id, [...eps, next])
  }
  const bulkAddEpisodesToSeason = (season: Season, count: number) => {
    const eps = season.episodes ?? []
    const start = eps.length + 1
    const additions: Episode[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
    onEpisodesChange(season.id, [...eps, ...additions])
  }
  const updateEpisode = (season: Season, epId: string, patch: Partial<Episode>) => {
    const eps = season.episodes ?? []
    onEpisodesChange(season.id, eps.map((e) => e.id === epId ? { ...e, ...patch } : e))
  }
  const removeEpisode = (season: Season, epId: string) => {
    const eps = season.episodes ?? []
    onEpisodesChange(season.id, eps.filter((e) => e.id !== epId))
  }

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input className="track-num" placeholder="S#" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder="Season title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="track-num" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        <input className="track-num" placeholder="Eps" value={totalEps} onChange={(e) => setTotalEps(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      <div className="track-editor-row">
        <input className="track-num" placeholder="Count" value={bulkCount} onChange={(e) => setBulkCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={handleBulk}>Bulk add seasons</button>
      </div>
      {seasons.length > 0 && (
        <div className="season-list">
          {seasons.map((s) => {
            const isOpen = expanded === s.id
            const epsWatched = s.episodes ? s.episodes.filter((e) => e.watched).length : (s.watched ? parseInt(s.totalEpisodes || '0', 10) : 0)
            const epsTotal = s.episodes && s.episodes.length > 0 ? s.episodes.length : parseInt(s.totalEpisodes || '0', 10)
            return (
              <div key={s.id} className="season-row">
                <div className="season-head">
                  <button type="button" className="season-expand" onClick={() => setExpanded(isOpen ? null : s.id)}>{isOpen ? '▾' : '▸'}</button>
                  <span className="season-label">S{s.number}</span>
                  <input className="track-artist-cell" placeholder="Title" value={s.title ?? ''} onChange={(e) => onUpdate(s.id, { title: e.target.value })} />
                  <input className="track-num" placeholder="Year" value={s.year ?? ''} onChange={(e) => onUpdate(s.id, { year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                  <input className="track-num" placeholder="Eps" value={s.totalEpisodes ?? ''} onChange={(e) => onUpdate(s.id, { totalEpisodes: e.target.value.replace(/\D/g, '') })} />
                  <span className="season-count">{epsWatched}/{epsTotal || '?'}</span>
                  <StarRatingInput value={s.rating ?? 0} onChange={(v) => onRatingChange(s.id, v)} />
                  <button type="button" className={s.watched ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleWatched(s.id)}>{s.watched ? '✓' : ''}</button>
                  <button type="button" className="track-remove" onClick={() => onRemove(s.id)}>✕</button>
                </div>
                {isOpen && (
                  <div className="season-episodes">
                    <div className="track-editor-row">
                      <button type="button" onClick={() => addEpisodeToSeason(s)}>+ Add episode</button>
                      <button type="button" onClick={() => bulkAddEpisodesToSeason(s, parseInt(s.totalEpisodes || '0', 10))} disabled={!s.totalEpisodes}>Fill from total ({s.totalEpisodes || 0})</button>
                    </div>
                    {s.episodes && s.episodes.length > 0 && (
                      <table className="track-table">
                        <thead>
                          <tr>
                            <th className="col-num">#</th>
                            <th className="col-title">Title</th>
                            <th className="col-listened">Watched</th>
                            <th className="col-rating">Rating</th>
                            <th />
                            <th className="col-spacer"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.episodes.map((ep) => (
                            <tr key={ep.id}>
                              <td className="col-num">{ep.number}</td>
                              <td className="col-title"><input className="track-artist-cell" value={ep.title ?? ''} onChange={(e) => updateEpisode(s, ep.id, { title: e.target.value })} placeholder="—" /></td>
                              <td className="col-listened">
                                <button type="button" className={ep.watched ? 'track-listened-check active' : 'track-listened-check'} onClick={() => updateEpisode(s, ep.id, { watched: !ep.watched, watchedDate: !ep.watched ? new Date().toISOString().slice(0, 10) : ep.watchedDate })}>{ep.watched ? '✓' : ''}</button>
                              </td>
                              <td className="col-rating"><StarRatingInput value={ep.rating ?? 0} onChange={(v) => updateEpisode(s, ep.id, { rating: v || undefined })} /></td>
                              <td><button type="button" className="track-remove" onClick={() => removeEpisode(s, ep.id)}>✕</button></td>
                              <td className="col-spacer"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

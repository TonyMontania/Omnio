// End-of-year retrospective — a Spotify-Wrapped-style summary computed
// live from what you finished this year. Nothing extra to fill in; it
// leans on finishedAt, rewatches, ratings, playTime, episodesWatched
// and chaptersRead that the existing editors already write.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  items: Item[]
  onClose: () => void
}

function itemYear(i: Item): string | null {
  const m = /^(\d{4})/.exec(i.finishedAt ?? '')
  return m ? m[1] : null
}

function num(s?: string): number {
  const n = parseFloat(s ?? '')
  return isNaN(n) ? 0 : n
}

export default function YearlyWrapped({ items, onClose }: Props) {
  const availableYears = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) {
      const y = itemYear(it)
      if (y) s.add(y)
    }
    if (s.size === 0) s.add(String(new Date().getFullYear()))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [items])

  const [year, setYear] = useState<string>(availableYears[0])

  const finishedInYear = useMemo(
    () => items.filter((i) => itemYear(i) === year),
    [items, year],
  )

  const perCategory = useMemo(() => {
    const m: Record<string, Item[]> = {}
    for (const it of finishedInYear) {
      if (!m[it.categoryId]) m[it.categoryId] = []
      m[it.categoryId].push(it)
    }
    return m
  }, [finishedInYear])

  const games = perCategory['videojuegos'] ?? []
  const movies = perCategory['peliculas'] ?? []
  const series = perCategory['series'] ?? []
  const anime = [...(perCategory['anime'] ?? []), ...(perCategory['donghua'] ?? [])]
  const manga = [
    ...(perCategory['manga'] ?? []),
    ...(perCategory['manhwa'] ?? []),
    ...(perCategory['manhua'] ?? []),
    ...(perCategory['comics_west'] ?? []),
  ]
  const music = perCategory['musica'] ?? []

  const totalPlayHours = games.reduce((s, g) => s + num(g.playTime), 0)
  const totalEpisodes = [...series, ...anime].reduce((s, g) => s + num(g.episodesWatched), 0)
  const totalChapters = manga.reduce((s, g) => s + num(g.chaptersRead), 0)

  const ratedInYear = finishedInYear.filter((i) => i.rating)
  const avgRating = ratedInYear.length
    ? (ratedInYear.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedInYear.length).toFixed(2)
    : null

  const topRated = [...ratedInYear].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5)

  // Bucket by ISO month to find your busiest.
  const monthCounts: Record<string, number> = {}
  for (const it of finishedInYear) {
    const m = /^\d{4}-(\d{2})/.exec(it.finishedAt ?? '')
    if (m) monthCounts[m[1]] = (monthCounts[m[1]] ?? 0) + 1
  }
  const bestMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]
  const monthName = (mm: string) => new Date(Date.UTC(2000, parseInt(mm, 10) - 1, 1)).toLocaleString('en', { month: 'long' })

  // Top talent — mix categories that have the field.
  const tally = (getter: (i: Item) => string[] | undefined) => {
    const m: Record<string, number> = {}
    for (const it of finishedInYear) for (const v of getter(it) ?? []) m[v] = (m[v] ?? 0) + 1
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const topDevs = tally((i) => i.devs)
  const topStudios = tally((i) => i.studios)
  const topGenres = tally((i) => i.genres)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel wrapped-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span className="wrapped-year">Wrapped {year}</span>
          </h2>
          <div className="wrapped-year-picker">
            {availableYears.map((y) => (
              <button key={y} type="button" className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {finishedInYear.length === 0 ? (
            <p className="hint">
              You didn't mark anything as finished in {year}. Fill in the <em>Completion date</em>
              or <em>Listened on</em> field on your items and come back.
            </p>
          ) : (
            <>
              <div className="wrapped-hero">
                <div className="wrapped-big">
                  <div className="n">{finishedInYear.length}</div>
                  <div className="l">items finished</div>
                </div>
                {avgRating && (
                  <div className="wrapped-big">
                    <div className="n"><span className="accent">★</span> {avgRating}</div>
                    <div className="l">average rating</div>
                  </div>
                )}
                {bestMonth && (
                  <div className="wrapped-big">
                    <div className="n">{monthName(bestMonth[0])}</div>
                    <div className="l">busiest month · {bestMonth[1]} finished</div>
                  </div>
                )}
              </div>

              <div className="wrapped-cats">
                {games.length > 0 && (
                  <CatBlock label="Games" count={games.length}
                    subline={totalPlayHours ? `${totalPlayHours.toFixed(1)}h played` : undefined} />
                )}
                {movies.length > 0 && <CatBlock label="Movies" count={movies.length} />}
                {series.length > 0 && (
                  <CatBlock label="Series" count={series.length}
                    subline={totalEpisodes ? `${totalEpisodes} episodes` : undefined} />
                )}
                {anime.length > 0 && (
                  <CatBlock label="Anime + Donghua" count={anime.length}
                    subline={totalEpisodes ? `${totalEpisodes} episodes` : undefined} />
                )}
                {manga.length > 0 && (
                  <CatBlock label="Comics + Manga" count={manga.length}
                    subline={totalChapters ? `${totalChapters} chapters` : undefined} />
                )}
                {music.length > 0 && <CatBlock label="Music" count={music.length} />}
              </div>

              {topRated.length > 0 && (
                <div className="wrapped-section">
                  <h3>Top rated</h3>
                  <div className="wrapped-cover-strip">
                    {topRated.map((it) => (
                      <div key={it.id} className="wrapped-cover">
                        <div className="wrapped-mini">
                          {assetSrc(it.cover) ? <img src={assetSrc(it.cover)} alt={it.title} /> : <span>{it.title.charAt(0)}</span>}
                        </div>
                        <div className="wrapped-title">{it.title}</div>
                        <div className="wrapped-sub">★ {it.rating?.toFixed(1)} · {CATEGORIES.find((c) => c.id === it.categoryId)?.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(topDevs.length > 0 || topStudios.length > 0 || topGenres.length > 0) && (
                <div className="wrapped-section">
                  <h3>Highlights</h3>
                  <div className="wrapped-highlights">
                    {topDevs.length > 0 && <TopList label="Developers" data={topDevs} />}
                    {topStudios.length > 0 && <TopList label="Studios" data={topStudios} />}
                    {topGenres.length > 0 && <TopList label="Genres" data={topGenres} />}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CatBlock({ label, count, subline }: { label: string; count: number; subline?: string }) {
  return (
    <div className="wrapped-cat">
      <div className="n">{count}</div>
      <div className="l">{label}</div>
      {subline && <div className="s">{subline}</div>}
    </div>
  )
}

function TopList({ label, data }: { label: string; data: [string, number][] }) {
  return (
    <div className="wrapped-top">
      <div className="wrapped-top-label">{label}</div>
      <ol>
        {data.map(([name, n]) => (
          <li key={name}><span>{name}</span><em>{n}</em></li>
        ))}
      </ol>
    </div>
  )
}

import { useState } from 'react'
import type { Item, MusicArtist, MusicField } from './types'
import { assetSrc, getBandStatusLabel, getMemberStatus } from './types'
import ItemCard from './ItemCard'
import BandTimeline from './components/BandTimeline'

type SortMode = 'recent' | 'alpha' | 'rating' | 'yearDesc' | 'yearAsc' | 'duration'
type Tab = 'discography' | 'about' | 'concerts'

interface Props {
  artist: MusicArtist
  items: Item[]
  layout: 'list' | 'grid' | 'compact'
  // Search, sort, layout and Edit live in the top bar (App's page meta).
  search: string
  sortMode: SortMode
  onOpenItem: (item: Item) => void
  onDeleteItem: (item: Item) => void
  musicFields?: Record<MusicField, boolean>
}

export default function ArtistDetailView({ artist, items, layout, search, sortMode, onOpenItem, onDeleteItem, musicFields }: Props) {
  const [tab, setTab] = useState<Tab>('discography')

  const pickYear = (i: Item) => {
    if (i.releaseDate) return new Date(i.releaseDate).getFullYear()
    return parseInt(i.releaseYear || '0', 10) || 0
  }
  const pickDuration = (i: Item) => {
    if (!i.tracks) return 0
    return i.tracks.reduce((a, t) => a + (parseInt(t.duration || '0', 10) || 0), 0)
  }
  const query = search.trim().toLowerCase()
  const shownItems = [...items]
    .filter((item) => !query || item.title.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortMode === 'alpha') return a.title.localeCompare(b.title)
      if (sortMode === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sortMode === 'recent') return b.createdAt - a.createdAt
      if (sortMode === 'yearAsc') return (pickYear(a) || 9999) - (pickYear(b) || 9999)
      if (sortMode === 'duration') return pickDuration(b) - pickDuration(a)
      return pickYear(b) - pickYear(a)
    })

  const ratedItems = items.filter((i) => i.rating)
  const avgRating = ratedItems.length ? (ratedItems.reduce((a, i) => a + (i.rating || 0), 0) / ratedItems.length).toFixed(1) : null
  const listened = items.filter((i) => i.consumed).length

  const activePeriod = [artist.activeFrom, artist.activeTo].some(Boolean)
    ? `${artist.activeFrom || '?'} – ${artist.activeTo || 'present'}`
    : null

  const allMembers = artist.members ?? []
  const memberSections = [
    { list: allMembers.filter((m) => getMemberStatus(m) === 'current'), label: 'Current members', formerish: false },
    { list: allMembers.filter((m) => getMemberStatus(m) === 'current-touring'), label: 'Touring members', formerish: false },
    { list: allMembers.filter((m) => getMemberStatus(m) === 'former'), label: 'Former members', formerish: true },
    { list: allMembers.filter((m) => getMemberStatus(m) === 'former-touring'), label: 'Former touring', formerish: true },
  ]
  const facts: [string, string | null | undefined][] = [
    ['Origin', artist.origin],
    ['Status', artist.bandStatus ? getBandStatusLabel(artist.bandStatus) : null],
    ['Years active', activePeriod],
    ['Genres', artist.genres?.join(', ')],
    ['Labels', artist.labels?.join(', ')],
  ]
  const shownFacts = facts.filter(([, v]) => !!v)
  const concerts = artist.concerts ?? []
  const chips = [artist.bandStatus ? getBandStatusLabel(artist.bandStatus) : null, artist.origin, activePeriod].filter(Boolean) as string[]
  const stats = [
    `${items.length} ${items.length === 1 ? 'release' : 'releases'}`,
    listened ? `${listened} listened` : null,
    avgRating ? `★ ${avgRating} average` : null,
  ].filter(Boolean).join(' · ')

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'discography', label: 'Discography', count: items.length },
    { id: 'about', label: 'About' },
    ...(concerts.length > 0 ? [{ id: 'concerts' as Tab, label: 'Concerts', count: concerts.length }] : []),
  ]
  const backdrop = artist.bannerImage || artist.photo

  return (
    <div className="content-scroll artist-page">
      <header className="hero">
        <div className={`hero-stage${artist.bannerImage ? '' : ' no-banner'}`}>
          {backdrop && <img className="hero-bg" src={assetSrc(backdrop)} alt="" aria-hidden />}
          {artist.bannerImage && <img className="hero-banner zoomable" src={assetSrc(artist.bannerImage)} alt="" data-zoom-label="Banner" />}
        </div>
        <div className="hero-body">
          <div className="hero-avatar">
            {artist.photo
              ? <img className="zoomable" src={assetSrc(artist.photo)} alt={artist.name} data-zoom-label="Photo" />
              : <span>{artist.name.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="hero-text">
            {chips.length > 0 && <div className="hero-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
            <h1>{artist.name}</h1>
            <p className="hero-meta">{stats}</p>
          </div>
        </div>
      </header>

      <nav className="hero-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && t.count > 0 && <span className="hero-tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {tab === 'discography' && (
        <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
          {shownItems.length === 0 && <p className="empty">{query ? 'No releases match your search.' : 'Nothing from this artist yet.'}</p>}
          {shownItems.map((item) => (
            <ItemCard key={item.id} item={item} layout={layout} onOpen={onOpenItem} onDelete={onDeleteItem} musicFields={musicFields} />
          ))}
        </div>
      )}

      {tab === 'about' && (
        <div className="hero-panel">
          {shownFacts.length > 0
            ? <dl className="facts">{shownFacts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            : <p className="empty">No details yet. Add origin, genres or members from Edit.</p>}
          {allMembers.length > 0 && memberSections.map((section) => section.list.length === 0 ? null : (
            <section key={section.label} className="hero-section">
              <h3>{section.label}</h3>
              <ul className="member-list">
                {section.list.map((m) => (
                  <li key={m.id} className={section.formerish ? 'former' : ''}>
                    <span className="member-name">{m.name}{m.deceased && <span className="m-deceased" title="Deceased"> †</span>}</span>
                    {m.roles.length > 0 && <span className="member-roles">{m.roles.join(', ')}</span>}
                    {(m.joinedIn || (section.formerish && m.leftIn)) && (
                      <span className="member-period">{m.joinedIn || '?'} – {section.formerish ? (m.leftIn || '?') : 'present'}</span>
                    )}
                    {m.stints?.map((st) => (
                      <span key={st.id} className="member-stint">
                        {st.touring ? 'touring' : 'also'} {st.roles.length > 0 ? st.roles.join(', ') : '—'}
                        {(st.from || st.to) && ` (${st.from || '?'} – ${st.to || (section.formerish ? '?' : 'present')})`}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {allMembers.length > 0 && (
            <section className="hero-section">
              <h3>Timeline</h3>
              <BandTimeline artist={artist} releases={items} />
            </section>
          )}
        </div>
      )}

      {tab === 'concerts' && (
        <div className="hero-panel">
          <ul className="concert-list detail">
            {[...concerts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((c) => (
              <li key={c.id} className="concert-row">
                <div className="concert-head">
                  <span className="concert-date">{c.date || '—'}</span>
                  <span className="concert-venue">{c.venue}</span>
                  {c.city && <span className="concert-city">{c.city}</span>}
                </div>
                {c.setlist && <pre className="concert-setlist">{c.setlist}</pre>}
                {c.notes && <p className="concert-notes">{c.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Welcome screen shown once on a brand-new install (items.length === 0
// AND settings.welcomeShown !== true). Not a tutorial — just a launcher
// that surfaces the three friction points a first-time user hits:
//
//   1. "How do I get my existing library in here?" → jump to importers
//   2. "How do I add my first item?" → open a category with the add panel
//   3. "How do I set up API keys for TMDb / IGDB / …?" → settings shortcut
//
// Dismissed permanently the first time the user takes any of the three
// actions, or via the "skip" button.

import { CATEGORIES } from './categories'
import type { CategoryId } from './types/items'

interface Props {
  onImport: () => void
  onAddFirst: (categoryId: CategoryId) => void
  onOpenIntegrations: () => void
  onDismiss: () => void
}

export default function FirstRunWizard({ onImport, onAddFirst, onOpenIntegrations, onDismiss }: Props) {
  return (
    <div className="modal-overlay first-run-overlay" onClick={onDismiss}>
      <div className="modal-panel first-run-panel" onClick={(e) => e.stopPropagation()}>
        <div className="first-run-hero">
          <img src="omnio-logo.svg" alt="" className="first-run-logo" />
          <h1>Welcome to Omnio</h1>
          <p className="first-run-tagline">
            One local library for every hobby you track — games, music, movies, series, anime, donghua, manga family and books. No accounts, no cloud, no telemetry. Your data lives next to the app.
          </p>
        </div>

        <div className="first-run-cards">
          <button type="button" className="first-run-card" onClick={onImport}>
            <div className="first-run-card-icon">↓</div>
            <h3>Import an existing library</h3>
            <p>Steam · Letterboxd · MAL / AniList XML · Discogs · Last.fm · Trakt · Kindle highlights · Excel / CSV / Notion.</p>
          </button>

          <button type="button" className="first-run-card" onClick={onOpenIntegrations}>
            <div className="first-run-card-icon">🔑</div>
            <h3>Set up metadata sources</h3>
            <p>TMDb, IGDB, ComicVine, SteamGridDB and AniDB need a free key. AniList, MusicBrainz, MangaDex, OpenLibrary work out of the box.</p>
          </button>

          <div className="first-run-card first-run-add-card">
            <div className="first-run-card-icon">＋</div>
            <h3>Add your first item</h3>
            <p>Pick a library to jump into. The add panel opens straight away.</p>
            <div className="first-run-cat-grid">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="first-run-cat-chip"
                  onClick={() => onAddFirst(c.id)}
                >{c.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="first-run-footer">
          <button type="button" className="ghost-btn" onClick={onDismiss}>Skip — I'll figure it out</button>
        </div>
      </div>
    </div>
  )
}

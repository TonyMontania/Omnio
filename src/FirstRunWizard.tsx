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
import { DownloadIcon, KeyIcon, PlusIcon } from './icons'
import type { CategoryId } from './types/items'
import { t } from './i18n'

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
          <h1>{t('Welcome to Omnio')}</h1>
          <p className="first-run-tagline">
            {t('One local library for every hobby you track — games, music, movies, series, anime, donghua, manga family and books. No accounts, no cloud, no telemetry. Your data stays on your computer.')}
          </p>
        </div>

        <div className="first-run-cards">
          <button type="button" className="first-run-card" onClick={onImport}>
            <div className="first-run-card-icon"><DownloadIcon size={18} /></div>
            <h3>{t('Import an existing library')}</h3>
            <p>{t('Steam · Letterboxd · MAL / AniList XML · Discogs · Last.fm · Trakt · Kindle highlights · Excel / CSV / Notion.')}</p>
          </button>

          <button type="button" className="first-run-card" onClick={onOpenIntegrations}>
            <div className="first-run-card-icon"><KeyIcon size={18} /></div>
            <h3>{t('Set up metadata sources')}</h3>
            <p>{t('TMDb, IGDB, ComicVine, SteamGridDB and AniDB need a free key. AniList, MusicBrainz, MangaDex, OpenLibrary work out of the box.')}</p>
          </button>

          <div className="first-run-card first-run-add-card">
            <div className="first-run-card-icon"><PlusIcon size={18} /></div>
            <h3>{t('Add your first item')}</h3>
            <p>{t('Pick a library to jump into. The add panel opens straight away.')}</p>
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
          <button type="button" className="ghost-btn" onClick={onDismiss}>{t('Skip — I\'ll figure it out')}</button>
        </div>
      </div>
    </div>
  )
}

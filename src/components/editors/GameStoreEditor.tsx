// Sprint F — Games polish. One editor section that owns three
// game-specific slots: store links, purchase log, and platform
// compatibility (Steam Deck + ProtonDB). Kept together because
// they all describe "where does this game live and how well does it
// run there" — one visual home makes it easier to skim.

import type { StoreLink, StoreSlug, Purchase, DeckCompat, ProtonRating } from '../../types/entities'
import { t } from '../../i18n'

interface Props {
  storeLinks: StoreLink[]
  onStoreLinksChange: (next: StoreLink[]) => void
  purchases: Purchase[]
  onPurchasesChange: (next: Purchase[]) => void
  deckCompat?: DeckCompat
  onDeckCompatChange: (next: DeckCompat | undefined) => void
  protonRating?: ProtonRating
  onProtonRatingChange: (next: ProtonRating | undefined) => void
}

const STORE_OPTIONS: { value: StoreSlug; label: string }[] = [
  { value: 'steam',      label: t('Steam') },
  { value: 'gog',        label: t('GOG') },
  { value: 'epic',       label: t('Epic Games') },
  { value: 'itch',       label: 'itch.io' },
  { value: 'humble',     label: t('Humble') },
  { value: 'ubi',        label: t('Ubisoft Connect') },
  { value: 'ea',         label: t('EA App') },
  { value: 'battlenet',  label: t('Battle.net') },
  { value: 'rockstar',   label: t('Rockstar') },
  { value: 'nintendo',   label: t('Nintendo eShop') },
  { value: 'playstation',label: t('PlayStation Store') },
  { value: 'xbox',       label: t('Xbox / Microsoft') },
  { value: 'official',   label: t('Official site') },
  { value: 'other',      label: t('Other') },
]

const DECK_OPTIONS: { value: DeckCompat; label: string; hint: string }[] = [
  { value: 'verified',    label: t('Verified'),    hint: t('Runs great, no tweaks.') },
  { value: 'playable',    label: t('Playable'),    hint: t('Runs, minor tweaks may help.') },
  { value: 'unsupported', label: t('Unsupported'), hint: t('Anti-cheat, controls, or launch issues.') },
  { value: 'unknown',     label: t('Unknown'),     hint: t('Not tested yet.') },
]

const PROTON_OPTIONS: { value: ProtonRating; label: string }[] = [
  { value: 'platinum', label: t('Platinum — flawless out of the box') },
  { value: 'gold',     label: t('Gold — works with tweaks') },
  { value: 'silver',   label: t('Silver — playable with issues') },
  { value: 'bronze',   label: t('Bronze — starts but rough') },
  { value: 'borked',   label: t('Borked — does not run') },
]

export default function GameStoreEditor({
  storeLinks, onStoreLinksChange,
  purchases, onPurchasesChange,
  deckCompat, onDeckCompatChange,
  protonRating, onProtonRatingChange,
}: Props) {
  // -- Store links -----------------------------------------------
  const addStore = () => {
    onStoreLinksChange([...storeLinks, { id: crypto.randomUUID(), store: 'steam', url: '' }])
  }
  const patchStore = (id: string, fn: (s: StoreLink) => StoreLink) => {
    onStoreLinksChange(storeLinks.map((s) => (s.id === id ? fn(s) : s)))
  }
  const removeStore = (id: string) => onStoreLinksChange(storeLinks.filter((s) => s.id !== id))

  // -- Purchases -------------------------------------------------
  const addPurchase = () => {
    onPurchasesChange([...purchases, { id: crypto.randomUUID(), createdAt: Date.now() }])
  }
  const patchPurchase = (id: string, fn: (p: Purchase) => Purchase) => {
    onPurchasesChange(purchases.map((p) => (p.id === id ? fn(p) : p)))
  }
  const removePurchase = (id: string) => onPurchasesChange(purchases.filter((p) => p.id !== id))

  return (
    <div className="game-store-editor">
      <div className="field-group">
        <div className="game-store-head">
          <label>{t('Store links')}</label>
          <button type="button" className="secondary-btn" onClick={addStore}>{t('+ Add store')}</button>
        </div>
        {storeLinks.length === 0 ? (
          <p className="hint">{t('One row per storefront where this game lives — Steam, GOG, Nintendo eShop…')}</p>
        ) : (
          <ul className="game-store-list">
            {storeLinks.map((s) => (
              <li key={s.id} className="game-store-link">
                <select
                  value={s.store}
                  onChange={(e) => patchStore(s.id, (x) => ({ ...x, store: e.target.value as StoreSlug }))}
                >
                  {STORE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  placeholder="https://store.steampowered.com/app/…"
                  value={s.url}
                  onChange={(e) => patchStore(s.id, (x) => ({ ...x, url: e.target.value }))}
                />
                <input
                  placeholder={t('Note (family library, gift, …)')}
                  value={s.note ?? ''}
                  onChange={(e) => patchStore(s.id, (x) => ({ ...x, note: e.target.value || undefined }))}
                />
                <button type="button" className="game-store-remove" onClick={() => removeStore(s.id)} title={t('Remove link')} aria-label={t('Remove store link')}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field-group">
        <div className="game-store-head">
          <label>{t('Purchase log')}</label>
          <button type="button" className="secondary-btn" onClick={addPurchase}>{t('+ Add purchase')}</button>
        </div>
        {purchases.length === 0 ? (
          <p className="hint">{t('One row per time you bought this game — sale, gift, bundle, physical copy.')}</p>
        ) : (
          <ul className="game-purchase-list">
            {purchases.map((p) => (
              <li key={p.id} className="game-purchase">
                <input type="date" value={p.date ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, date: e.target.value || undefined }))} />
                <input placeholder={t('Price (e.g. 19.99, ¥2200)')} value={p.price ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, price: e.target.value || undefined }))} />
                <input placeholder={t('Currency (USD, EUR…)')} value={p.currency ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, currency: e.target.value || undefined }))} />
                <input placeholder={t('Store')} value={p.storeLabel ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, storeLabel: e.target.value || undefined }))} />
                <input placeholder={t('Discount (-75%, $40 off)')} value={p.discount ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, discount: e.target.value || undefined }))} />
                <input placeholder={t('Note (gift, bundle, resale…)')} value={p.note ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, note: e.target.value || undefined }))} />
                <button type="button" className="game-store-remove" onClick={() => removePurchase(p.id)} title={t('Remove purchase')} aria-label={t('Remove purchase')}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field-row">
        <div className="field-group">
          <label>{t('Steam Deck compatibility')}</label>
          <select value={deckCompat ?? ''} onChange={(e) => onDeckCompatChange((e.target.value || undefined) as DeckCompat | undefined)}>
            <option value="">{t('— not tracked')}</option>
            {DECK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('ProtonDB rating')}</label>
          <select value={protonRating ?? ''} onChange={(e) => onProtonRatingChange((e.target.value || undefined) as ProtonRating | undefined)}>
            <option value="">{t('— not tracked')}</option>
            {PROTON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

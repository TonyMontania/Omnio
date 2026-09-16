// Sprint F — Games polish. One editor section that owns three
// game-specific slots: store links, purchase log, and platform
// compatibility (Steam Deck + ProtonDB). Kept together because
// they all describe "where does this game live and how well does it
// run there" — one visual home makes it easier to skim.

import type { StoreLink, StoreSlug, Purchase, DeckCompat, ProtonRating } from '../../types/entities'

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
  { value: 'steam',      label: 'Steam' },
  { value: 'gog',        label: 'GOG' },
  { value: 'epic',       label: 'Epic Games' },
  { value: 'itch',       label: 'itch.io' },
  { value: 'humble',     label: 'Humble' },
  { value: 'ubi',        label: 'Ubisoft Connect' },
  { value: 'ea',         label: 'EA App' },
  { value: 'battlenet',  label: 'Battle.net' },
  { value: 'rockstar',   label: 'Rockstar' },
  { value: 'nintendo',   label: 'Nintendo eShop' },
  { value: 'playstation',label: 'PlayStation Store' },
  { value: 'xbox',       label: 'Xbox / Microsoft' },
  { value: 'official',   label: 'Official site' },
  { value: 'other',      label: 'Other' },
]

const DECK_OPTIONS: { value: DeckCompat; label: string; hint: string }[] = [
  { value: 'verified',    label: 'Verified',    hint: 'Runs great, no tweaks.' },
  { value: 'playable',    label: 'Playable',    hint: 'Runs, minor tweaks may help.' },
  { value: 'unsupported', label: 'Unsupported', hint: 'Anti-cheat, controls, or launch issues.' },
  { value: 'unknown',     label: 'Unknown',     hint: 'Not tested yet.' },
]

const PROTON_OPTIONS: { value: ProtonRating; label: string }[] = [
  { value: 'platinum', label: 'Platinum — flawless out of the box' },
  { value: 'gold',     label: 'Gold — works with tweaks' },
  { value: 'silver',   label: 'Silver — playable with issues' },
  { value: 'bronze',   label: 'Bronze — starts but rough' },
  { value: 'borked',   label: 'Borked — does not run' },
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
          <label>Store links</label>
          <button type="button" className="secondary-btn" onClick={addStore}>+ Add store</button>
        </div>
        <p className="hint">One row per storefront where this game lives. Clicking a link on the detail view will open it in your browser.</p>
        {storeLinks.length === 0 ? (
          <p className="hint" style={{ opacity: 0.6 }}>No store links yet.</p>
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
                  placeholder="Note (family library, gift, …)"
                  value={s.note ?? ''}
                  onChange={(e) => patchStore(s.id, (x) => ({ ...x, note: e.target.value || undefined }))}
                />
                <button type="button" className="game-store-remove" onClick={() => removeStore(s.id)} title="Remove link" aria-label="Remove store link">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field-group">
        <div className="game-store-head">
          <label>Purchase log</label>
          <button type="button" className="secondary-btn" onClick={addPurchase}>+ Add purchase</button>
        </div>
        <p className="hint">One entry per time you bought this game — physical copy, Steam sale, gift, humble bundle. Nothing here is mandatory.</p>
        {purchases.length === 0 ? (
          <p className="hint" style={{ opacity: 0.6 }}>No purchases logged yet.</p>
        ) : (
          <ul className="game-purchase-list">
            {purchases.map((p) => (
              <li key={p.id} className="game-purchase">
                <input type="date" value={p.date ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, date: e.target.value || undefined }))} />
                <input placeholder="Price (e.g. 19.99, ¥2200)" value={p.price ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, price: e.target.value || undefined }))} />
                <input placeholder="Currency (USD, EUR…)" value={p.currency ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, currency: e.target.value || undefined }))} />
                <input placeholder="Store" value={p.storeLabel ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, storeLabel: e.target.value || undefined }))} />
                <input placeholder="Discount (-75%, $40 off)" value={p.discount ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, discount: e.target.value || undefined }))} />
                <input placeholder="Note (gift, bundle, resale…)" value={p.note ?? ''} onChange={(e) => patchPurchase(p.id, (x) => ({ ...x, note: e.target.value || undefined }))} />
                <button type="button" className="game-store-remove" onClick={() => removePurchase(p.id)} title="Remove purchase" aria-label="Remove purchase">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field-group">
        <label>Steam Deck compatibility</label>
        <div className="yesno" style={{ flexWrap: 'wrap' }}>
          <button type="button" className={!deckCompat ? 'pill active' : 'pill'} onClick={() => onDeckCompatChange(undefined)}>—</button>
          {DECK_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={deckCompat === o.value ? 'pill active' : 'pill'}
              onClick={() => onDeckCompatChange(o.value)}
              title={o.hint}
            >{o.label}</button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>ProtonDB rating</label>
        <select value={protonRating ?? ''} onChange={(e) => onProtonRatingChange((e.target.value || undefined) as ProtonRating | undefined)}>
          <option value="">— not tracked</option>
          {PROTON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="hint">Linux-side compatibility as ProtonDB grades it. Leave blank if you don't play on Linux / Steam Deck.</p>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { VN_STATUS_OPTIONS } from './types'
import { planVndbImport, type VndbImportPlan, type VndbListEntry } from './utils/vndbList'
import { t } from './i18n'

interface Props {
  existingItems: Item[]
  onImport: (plan: VndbImportPlan) => void
  onClose: () => void
}

const statusLabel = (v?: string) => VN_STATUS_OPTIONS.find((s) => s.value === v)?.label ?? ''

export default function VndbListImporter({ existingItems, onImport, onClose }: Props) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<VndbListEntry[] | null>(null)
  const [owner, setOwner] = useState('')

  const plan = useMemo(() => (entries ? planVndbImport(entries, existingItems) : null), [entries, existingItems])
  const titleById = useMemo(() => new Map(existingItems.map((i) => [i.id, i.title])), [existingItems])

  const load = async () => {
    if (!username.trim()) return
    setLoading(true); setError(''); setEntries(null)
    const r = await window.ipcRenderer.invoke('vndb:user-list', username.trim())
    setLoading(false)
    if (!r?.ok) { setError(r?.error ?? t('Could not load the list')); return }
    setOwner(r.data.user)
    setEntries(r.data.entries)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '95vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>{t('Import your VNDB list')}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            {t('Enter your VNDB username (or your')}{' '}<code>u12345</code>{' '}{t('id). Your list has to be public. Statuses come from your labels (Playing, Finished, Stalled, Dropped, Wishlist) and votes become star ratings. Visual novels you already have are matched by VNDB id or title and only get your status, rating and dates. Blacklisted ones are skipped.')}
          </p>
          <form className="artist-img-search" onSubmit={(e) => { e.preventDefault(); void load() }}>
            <input className="search-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('VNDB username')} autoFocus />
            <button type="submit" className="secondary-btn" disabled={loading || !username.trim()}>{loading ? t('Loading…') : t('Load list')}</button>
          </form>
          {error && <p className="save-files-error">{error}</p>}
          {plan && entries && (
            <>
              <div className="importer-summary">
                <span><b>{owner}</b>{' '}{t('· {entries} entries', { entries: entries.length })}</span>
                <span className="importer-new">{t('{creates} to add', { creates: plan.creates.length })}</span>
                <span className="importer-dupe">{t('{updates} to update', { updates: plan.updates.size })}</span>
                {plan.skipped > 0 && <span>{t('{skipped} skipped', { skipped: plan.skipped })}</span>}
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th>{t('Title')}</th><th>{t('Status')}</th><th>{t('Rating')}</th><th></th></tr></thead>
                  <tbody>
                    {plan.creates.map((it) => (
                      <tr key={it.id}><td>{it.title}</td><td>{statusLabel(it.visualNovelStatus)}</td><td>{it.rating ? t('★ {rating}', { rating: it.rating }) : ''}</td><td>{t('New')}</td></tr>
                    ))}
                    {Array.from(plan.updates).map(([id, patch]) => (
                      <tr key={id} className="dupe"><td>{titleById.get(id)}</td><td>{statusLabel(patch.visualNovelStatus)}</td><td>{patch.rating ? t('★ {rating}', { rating: patch.rating }) : ''}</td><td>{t('Update')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost-btn" onClick={onClose}>{t('Cancel')}</button>
          <button
            type="button"
            className="primary-btn"
            disabled={!plan || (plan.creates.length === 0 && plan.updates.size === 0)}
            onClick={() => { if (plan) { onImport(plan); onClose() } }}
          >{t('Import')}</button>
        </div>
      </div>
    </div>
  )
}

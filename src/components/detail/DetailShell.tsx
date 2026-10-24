// Shared layout for every library's detail page: hero header (banner or
// blurred cover backdrop, cover overlapping it, chips, title, creators,
// quick stats, actions) and underline tabs. Each library only decides
// which facts, stats and tabs it has.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AnyItem } from '../../types'
import { assetSrc } from '../../types'
import CoverPlaceholder from '../CoverPlaceholder'

export interface DetailTab {
  id: string
  label: string
  count?: number
  content: ReactNode
  /** Hidden when the library has nothing for it on this item. */
  hidden?: boolean
}

interface Props {
  item: AnyItem
  coverShape?: 'poster' | 'square'
  /** Wide artwork; defaults to the item's banner image. */
  banner?: string
  chips: (string | null | undefined | false)[]
  subtitle?: ReactNode
  meta?: ReactNode
  stats?: [string, ReactNode][]
  tabs: DetailTab[]
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
}

export default function DetailShell({ item, coverShape = 'poster', banner = item.bannerImage, chips, subtitle, meta, stats, tabs, onEdit, onDuplicate, onExport }: Props) {
  const shown = tabs.filter((t) => !t.hidden)
  const [tab, setTab] = useState(shown[0]?.id ?? '')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // A different item (related / franchise navigation) starts on its first tab.
  useEffect(() => { setTab(shown[0]?.id ?? '') }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const current = shown.find((t) => t.id === tab) ?? shown[0]
  const backdrop = banner || item.cover
  const chipList = chips.filter(Boolean) as string[]
  const statList = (stats ?? []).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)

  return (
    <div className="content-scroll detail-page">
      <header className="hero item-hero">
        <div className={`hero-stage${banner ? '' : ' no-banner'}`}>
          {backdrop && <img className="hero-bg" src={assetSrc(backdrop)} alt="" aria-hidden />}
          {banner && <img className="hero-banner zoomable" src={assetSrc(banner)} alt="" data-zoom-label="Banner" />}
          {item.logoImage && <img className="hero-logo zoomable" src={assetSrc(item.logoImage)} alt={item.title} data-zoom-label="Logo" />}
        </div>
        <div className="hero-body">
          <div className={`hero-cover ${coverShape}`}>
            {item.cover
              ? <img className="zoomable" src={assetSrc(item.cover)} alt={item.title} data-zoom-label="Cover" />
              : <CoverPlaceholder categoryId={item.categoryId} />}
          </div>
          <div className="hero-text">
            {chipList.length > 0 && <div className="hero-chips">{chipList.map((c) => <span key={c}>{c}</span>)}</div>}
            <h1>{item.title}</h1>
            {subtitle && <p className="hero-subtitle">{subtitle}</p>}
            {meta && <p className="hero-meta">{meta}</p>}
          </div>
          <div className="hero-actions">
            <button type="button" className="add-btn" onClick={onEdit}>✎ Edit</button>
            <div className="pop-wrap" ref={menuRef}>
              <button type="button" className={`icon-btn${menuOpen ? ' on' : ''}`} aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
              {menuOpen && (
                <div className="pop" role="menu">
                  <div className="pop-list">
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate() }}><span className="pop-icon" aria-hidden>⧉</span>Duplicate</button>
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExport() }}><span className="pop-icon" aria-hidden>↓</span>Export as JSON</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {statList.length > 0 && (
          <dl className="hero-stats">
            {statList.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
      </header>

      {shown.length > 1 && (
        <nav className="hero-tabs" role="tablist">
          {shown.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={current?.id === t.id} className={current?.id === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}{t.count != null && t.count > 0 && <span className="hero-tab-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      )}

      <div className="detail-tab-body" role="tabpanel">{current?.content}</div>
    </div>
  )
}

/** Label / value grid used on the Overview tab. Empty values are skipped. */
export function DetailFacts({ facts }: { facts: [string, ReactNode][] }) {
  const shown = facts.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0))
  if (shown.length === 0) return null
  return <dl className="facts">{shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
}

/** Titled block inside a tab. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="hero-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

/** Chip row (genres, tags, platforms, groups). Renders nothing when empty. */
export function DetailChips({ values }: { values?: string[] }) {
  if (!values || values.length === 0) return null
  return <div className="detail-chips">{values.map((v) => <span key={v}>{v}</span>)}</div>
}

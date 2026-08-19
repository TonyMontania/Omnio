// Persistent left sidebar. Brand + Home + every enabled library + a
// utility footer (Search / Calendar / Random / Stats / Settings).
// The old sidebar was retired in commit 30b78d0 in favor of a
// top-nav + home-dashboard combo; users wanted the desktop-native
// feel back and Home widgets alone weren't enough, so this is a
// leaner take on the original — pure nav, no per-category
// collections (those live in each library's own toolbar now).

import type { Item, Collection } from './types'
import { CATEGORIES } from './categories'
import {
  CategoryIcon, HomeIcon, CalendarIcon, InsightsIcon, SettingsIcon, DiceIcon,
} from './icons'

export type SidebarView =
  | { kind: 'home' }
  | { kind: 'library'; categoryId: string }
  | { kind: 'arcade' }
  | { kind: 'special'; id: 'calendar' | 'stats' | 'settings' }

interface Props {
  items: Item[]
  collections: Collection[]                 // reserved for future "pinned collections" section
  enabledCategories?: string[]
  active: SidebarView
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenHome: () => void
  onOpenLibrary: (categoryId: string) => void
  onOpenCalendar: () => void
  onOpenStats: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenRandomizer?: () => void
  onOpenArcade: () => void
}

function isActiveLibrary(active: SidebarView, id: string): boolean {
  return active.kind === 'library' && active.categoryId === id
}
function isActiveSpecial(active: SidebarView, id: 'calendar' | 'stats' | 'settings'): boolean {
  return active.kind === 'special' && active.id === id
}

export default function Sidebar(props: Props) {
  const {
    items, enabledCategories, active, collapsed, onToggleCollapsed,
    onOpenHome, onOpenLibrary, onOpenCalendar, onOpenStats, onOpenSettings, onOpenSearch, onOpenRandomizer, onOpenArcade,
  } = props

  const cats = CATEGORIES.filter((c) => !enabledCategories || enabledCategories.includes(c.id))

  return (
    <aside className={collapsed ? 'sidebar sidebar-icons' : 'sidebar'}>
      <div className="sidebar-brand">
        <svg className="brand-logo" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
          <path d="M64 26 L71.5 56.5 L102 64 L71.5 71.5 L64 102 L56.5 71.5 L26 64 L56.5 56.5 Z" fill="currentColor" />
          <circle cx="64" cy="64" r="6" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
        {!collapsed && <span className="sidebar-brand-name">Omnio</span>}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <path d="M9 6l6 6-6 6" />
              : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </button>
      </div>

      <button
        type="button"
        className={active.kind === 'home' ? 'sidebar-item active' : 'sidebar-item'}
        onClick={onOpenHome}
        title="Home"
      >
        <span className="sidebar-icon"><HomeIcon /></span>
        <span className="sidebar-label">Home</span>
      </button>

      <div className="sidebar-section">
        {!collapsed && <span className="sidebar-section-title">Libraries</span>}
        {cats.map((c) => {
          const n = items.filter((i) => i.categoryId === c.id).length
          return (
            <button
              key={c.id}
              type="button"
              className={isActiveLibrary(active, c.id) ? 'sidebar-item active' : 'sidebar-item'}
              onClick={() => onOpenLibrary(c.id)}
              title={`${c.label} — ${n} ${n === 1 ? 'item' : 'items'}`}
            >
              <span className="sidebar-icon"><CategoryIcon id={c.id} /></span>
              <span className="sidebar-label">{c.label}</span>
              {!collapsed && <span className="sidebar-count">{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="sidebar-section">
        {!collapsed && <span className="sidebar-section-title">Extras</span>}
        <button
          type="button"
          className={active.kind === 'arcade' ? 'sidebar-item active' : 'sidebar-item'}
          onClick={onOpenArcade}
          title="Arcade — score log, 1cc grid, run tracker"
        >
          <span className="sidebar-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M8 10v4M6 12h4" />
              <circle cx="15" cy="11" r="1" fill="currentColor" />
              <circle cx="17.5" cy="13.5" r="1" fill="currentColor" />
            </svg>
          </span>
          <span className="sidebar-label">Arcade</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-item" onClick={onOpenSearch} title="Search (Ctrl+K)">
          <span className="sidebar-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          </span>
          <span className="sidebar-label">Search</span>
        </button>
        <button
          type="button"
          className={isActiveSpecial(active, 'calendar') ? 'sidebar-item active' : 'sidebar-item'}
          onClick={onOpenCalendar}
          title="Release calendar"
        >
          <span className="sidebar-icon"><CalendarIcon /></span>
          <span className="sidebar-label">Calendar</span>
        </button>
        {onOpenRandomizer && (
          <button type="button" className="sidebar-item" onClick={onOpenRandomizer} title="Pick a random backlog item">
            <span className="sidebar-icon"><DiceIcon /></span>
            <span className="sidebar-label">Random</span>
          </button>
        )}
        <button
          type="button"
          className={isActiveSpecial(active, 'stats') ? 'sidebar-item active' : 'sidebar-item'}
          onClick={onOpenStats}
          title="Statistics"
        >
          <span className="sidebar-icon"><InsightsIcon /></span>
          <span className="sidebar-label">Stats</span>
        </button>
        <button
          type="button"
          className={isActiveSpecial(active, 'settings') ? 'sidebar-item active' : 'sidebar-item'}
          onClick={onOpenSettings}
          title="Settings"
        >
          <span className="sidebar-icon"><SettingsIcon /></span>
          <span className="sidebar-label">Settings</span>
        </button>
      </div>
    </aside>
  )
}

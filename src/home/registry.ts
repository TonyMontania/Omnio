// Home widget registry. Each widget declares its id, display name,
// available sizes, default size, and a `render(ctx)` that returns the
// JSX. The board reads the user's saved layout (or the default one) and
// renders whichever widgets are enabled.
//
// The context carries every callback and slice a widget might need — so
// widgets themselves stay pure functions of props, easy to unit-test.

import type { ReactElement } from 'react'
import type { Item } from '../types'
import type { CategoryId } from '../types/items'

export type WidgetSize = 'small' | 'medium' | 'large'

export interface HomeContext {
  items: Item[]
  enabledCategories: readonly string[]
  onOpenItem: (item: Item) => void
  onOpenCategory: (categoryId: CategoryId) => void
  onOpenCalendar: () => void
  onOpenStats: () => void
}

export interface HomeWidget {
  id: string
  label: string
  description: string
  defaultSize: WidgetSize
  sizesSupported: readonly WidgetSize[]
  render: (ctx: HomeContext, size: WidgetSize) => ReactElement | null
}

// The saved layout entry. Users edit these via the board's "Edit
// layout" mode; App.tsx persists the resulting array on
// Settings.homeWidgets.
export interface HomeWidgetSlot {
  id: string
  size: WidgetSize
}

const registry = new Map<string, HomeWidget>()

export function registerHomeWidget(widget: HomeWidget): void {
  registry.set(widget.id, widget)
}

export function getHomeWidget(id: string): HomeWidget | undefined {
  return registry.get(id)
}

export function listHomeWidgets(): HomeWidget[] {
  return Array.from(registry.values())
}

// Default layout for users who never touched Edit mode. Mirrors what
// the old Home dashboard showed, in the same order: library portals
// first, then Currently, then Upcoming.
// Libraries no longer show up here — the persistent sidebar lists them.
// Home is now pure content: what you're doing, what's coming, what you
// loved recently.
export const DEFAULT_HOME_LAYOUT: readonly HomeWidgetSlot[] = [
  { id: 'currently',      size: 'large' },
  { id: 'upcoming',       size: 'medium' },
  { id: 'recently-rated', size: 'medium' },
]

export function _clearHomeRegistryForTests(): void {
  registry.clear()
}

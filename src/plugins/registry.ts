// Plugin registry — shared type definitions and the global list of
// plugin bundles baked into the app.
//
// Each plugin exposes a `default` export of type `PluginDef`. The
// backend sandbox lives in `src-tauri/src/handlers/plugins.rs`;
// every plugin drives the same generic `plugin:*` IPC commands,
// keyed by its `slug`.
//
// A plugin registered here is compiled into every build but is not
// necessarily visible in the UI — App.tsx gates each plugin's
// sidebar entry, "Enabled libraries" toggle, and card-field defaults
// behind a runtime flag (`settings.unlockedPlugins`). That flag is
// only flipped by an explicit user action (e.g. the Home keyboard
// shortcut), so a plugin the user hasn't opted into never shows up
// anywhere in the chrome even though its code is present.
import type { ComponentType, ReactNode } from 'react'
import erogesPlugin from './eroges'

// Meta a plugin publishes so the Omnio host chrome (title / count /
// chips / actions in the topnav) renders it just like a native
// library page.
export interface PluginPageMeta {
  icon: ReactNode
  title: string
  count?: { n: number; unit: string }
  onBack?: () => void
  actions?: ReactNode
  chips?: { key: string; label: string; count: number; active: boolean; onClick: () => void }[]
}

export interface PluginViewProps {
  setPageMeta: (meta: PluginPageMeta | null) => void
  // Which optional card-fields the user has enabled for this plugin
  // — resolved against the plugin's own `cardFields` declaration and
  // the user's overrides in Settings → Card fields. Keys that aren't
  // in the plugin's declaration default to true (opt-out).
  cardFields: Record<string, boolean>
}

export interface PluginCardField {
  value: string
  label: string
  // Whether the field is on by default when the user has never set
  // an override. Defaults to true.
  default?: boolean
}

export interface PluginDef {
  slug: string
  label: string
  icon: ComponentType
  View: ComponentType<PluginViewProps>
  preload?: () => Promise<void> | void
  // Optional card-field toggles the app exposes under Settings →
  // Card fields → <plugin label>. Each entry is one on/off button.
  cardFields?: PluginCardField[]
}

// All plugins compiled into the build. App.tsx decides which ones
// appear in the UI by intersecting with `settings.unlockedPlugins`.
export const PLUGINS: PluginDef[] = [erogesPlugin]

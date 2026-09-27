// Data shapes for the Eroges plugin. Persisted as a single JSON
// blob at `data/plugins/eroges.json` via `plugin:data-load` /
// `plugin:data-save`.

export type BacklogStatus = 'playing' | 'backlog' | 'played'
export type F95Status = 'OnGoing' | 'Completed' | 'OnHold' | 'Abandoned'

export interface ErogeItem {
  id: string
  name: string
  originalTitle?: string       // Japanese/native title from Ryuugames
  version?: string
  creator?: string
  engine?: string
  vn?: boolean
  status?: F95Status | ''
  backlogStatus?: BacklogStatus | ''
  releaseDate?: string
  language?: string            // e.g. "Japanese, English, Chinese"
  dlsiteId?: string
  dlsiteUrl?: string           // full DLSITE page URL
  steamUrl?: string            // Steam store URL
  itchUrl?: string             // itch.io page URL
  ryuugamesUrl?: string        // Ryuugames page URL (used for re-import)
  link?: string                // F95 or primary link
  description?: string
  coverFile?: string           // filename inside assets/plugins/eroges/cover/
  favorite?: boolean
  latestVersion?: string       // last version seen on F95
  threadUpdated?: string       // last "Thread Updated" seen on F95
  lastCheckedAt?: number       // ms since epoch
  updateAvailable?: boolean
  createdAt?: number
  updatedAt?: number
  collectionIds?: string[]     // denormalized for filter perf
}

export interface ErogeCollection {
  id: string
  name: string
  itemIds: string[]
  createdAt?: number
}

export interface ErogeSettings {
  // F95 auth cookie header, e.g. `xf_user=...; xf_session=...`. When
  // set, the F95 importer sends it so external store links (dlsite /
  // steam) that F95 hides from anonymous visitors become visible.
  // Stored in the plugin's own JSON — never leaves the machine.
  f95Cookie?: string
}

export interface ErogeData {
  games: ErogeItem[]
  collections: ErogeCollection[]
  settings?: ErogeSettings
}

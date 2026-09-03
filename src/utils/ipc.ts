// Renderer-side wrapper around `window.ipcRenderer.invoke` that
// enforces the IPC contract at compile time.
//
// Instead of:
//     window.ipcRenderer.invoke('vndb:search', term) as Promise<...>
//
// callers write:
//     invoke('vndb:search', term)
//
// and TypeScript already knows `term` must be a string and the
// resolved value is `FetcherHitsEnvelope`. Typos in the channel name
// are compile errors. Wrong number of arguments is a compile error.
// Reading a field that doesn't exist on the response type is a compile
// error.
//
// The contract itself lives in `src/types/ipc-contract.ts` (single
// source of truth — the shim in `ipc-shim.ts` routes each channel to
// its Tauri command via the `CHANNEL_ARG_NAMES` map).

import type { IpcChannel, IpcArgs, IpcResult } from '../types/ipc-contract'

export function invoke<K extends IpcChannel>(
  channel: K,
  ...args: IpcArgs<K>
): Promise<IpcResult<K>> {
  return window.ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<K>>
}

// Re-export the contract types so callers doing `import { invoke } from
// '../utils/ipc'` also get quick access to the response shape they
// need to destructure.
export type {
  IpcContract, IpcChannel, IpcArgs, IpcResult,
  Envelope, SimpleResult,
  UpdatesCheckResult, UpdatesInstallKind, UpdatesDownloadResult,
  ItemExportResult, ImageDownloadResult, AssetBlobEntry, AssetBlobSaveResult,
  DataSaveResult, DataLoadResult, BackupRow,
  BrokenAssetRow, AuditBrokenAssetsResult, ClearAssetRefsResult,
  StorageCopyDataToResult, StorageCleanOrphanResult, StorageRenameAllResult,
  StorageImportAssetsResult, StorageCleanupArtifactsResult,
  SteamLibraryResult, FetcherHitsEnvelope, FetcherObjectEnvelope,
  LrclibResult, AnidbResult, PcgwSearchResult, PcgwSavePathsResult,
  DiscogsCollectionResult,
} from '../types/ipc-contract'

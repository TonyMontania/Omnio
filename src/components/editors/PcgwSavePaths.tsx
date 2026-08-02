// Inline panel that fetches Save + Config paths from PCGamingWiki's Cargo
// API and shows them right next to the Save files uploader. If the game
// title matches a wiki page uniquely, resolves silently on mount. If
// multiple candidates come back, shows a picker. Once a page is chosen
// it's persisted on the item (pcgwPage) so we don't re-search.

import { useEffect, useState, useCallback } from 'react'

type PathRow = { OS: string; Type: string; Location: string }
type PathsResp = { pageName: string; pageUrl: string; rows: PathRow[] }
type SearchHit = { title: string; url: string }

type Props = {
  gameTitle: string
  pcgwPage?: string
  onPageMatched: (pageName: string | undefined) => void
}

export default function PcgwSavePaths({ gameTitle, pcgwPage, onPageMatched }: Props) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'searching' }
    | { kind: 'loading' }
    | { kind: 'paths'; data: PathsResp }
    | { kind: 'pick'; hits: SearchHit[] }
    | { kind: 'no-paths'; data: PathsResp }
    | { kind: 'not-found' }
    | { kind: 'error'; error: string }
  >({ kind: 'idle' })
  const [copied, setCopied] = useState<string | null>(null)

  const loadPaths = useCallback(async (pageName: string) => {
    setState({ kind: 'loading' })
    const res = await window.ipcRenderer.invoke('pcgw:save-paths', pageName) as
      | { ok: true; data: PathsResp }
      | { ok: false; error: string }
    if (!res.ok) { setState({ kind: 'error', error: res.error }); return }
    // Page exists on PCGW but its wikitext has no {{Game data/…}} templates
    // yet — different signal from "the wiki has no page at all".
    if (res.data.rows.length === 0) { setState({ kind: 'no-paths', data: res.data }); return }
    setState({ kind: 'paths', data: res.data })
  }, [])

  const runSearch = useCallback(async () => {
    const t = gameTitle.trim()
    if (!t) { setState({ kind: 'idle' }); return }
    setState({ kind: 'searching' })
    const res = await window.ipcRenderer.invoke('pcgw:search', t) as
      | { ok: true; data: SearchHit[] }
      | { ok: false; error: string }
    if (!res.ok) { setState({ kind: 'error', error: res.error }); return }
    const hits = res.data
    if (hits.length === 0) { setState({ kind: 'not-found' }); return }
    // Auto-pick when there's exactly one hit or when the top hit is an
    // exact title match (case-insensitive) — saves the user a click.
    const exact = hits.find((h) => h.title.toLowerCase() === t.toLowerCase())
    const pick = exact ?? (hits.length === 1 ? hits[0] : null)
    if (pick) {
      onPageMatched(pick.title)
      await loadPaths(pick.title)
    } else {
      setState({ kind: 'pick', hits })
    }
  }, [gameTitle, onPageMatched, loadPaths])

  // On mount / when the persisted page changes: if we have a page, fetch its
  // paths straight away. Never auto-search — spare unnecessary Wiki hits for
  // every game the user opens. The search runs only when the user clicks.
  useEffect(() => {
    if (pcgwPage) loadPaths(pcgwPage)
    else setState({ kind: 'idle' })
  }, [pcgwPage, loadPaths])

  const handlePick = async (hit: SearchHit) => {
    onPageMatched(hit.title)
    await loadPaths(hit.title)
  }

  const handleRematch = () => {
    onPageMatched(undefined)
    runSearch()
  }

  const copyLocation = async (loc: string) => {
    try {
      await navigator.clipboard.writeText(loc)
      setCopied(loc)
      window.setTimeout(() => setCopied((c) => (c === loc ? null : c)), 1400)
    } catch { /* clipboard blocked — no fallback needed */ }
  }

  return (
    <div className="pcgw-panel">
      <div className="pcgw-header">
        <span className="pcgw-label">Save locations · PCGamingWiki</span>
        {(state.kind === 'paths' || state.kind === 'no-paths') && (
          <>
            <a className="pcgw-link" href={state.data.pageUrl} target="_blank" rel="noopener noreferrer" title="Open wiki page">
              {state.data.pageName} ↗
            </a>
            <button type="button" className="pcgw-rematch" onClick={handleRematch} title="Match a different wiki page">Re-match</button>
          </>
        )}
      </div>

      {state.kind === 'idle' && (
        <button
          type="button"
          className="pcgw-search-btn"
          onClick={runSearch}
          disabled={!gameTitle.trim()}
          title={gameTitle.trim() ? 'Search PCGamingWiki for this title' : 'Give the game a title first'}
        >
          Find save locations
        </button>
      )}

      {(state.kind === 'searching' || state.kind === 'loading') && (
        <span className="pcgw-status">{state.kind === 'searching' ? 'Searching PCGamingWiki…' : 'Fetching paths…'}</span>
      )}

      {state.kind === 'pick' && (
        <>
          <p className="pcgw-status">Multiple matches — pick the right game:</p>
          <ul className="pcgw-hits">
            {state.hits.map((hit) => (
              <li key={hit.title}>
                <button type="button" onClick={() => handlePick(hit)}>{hit.title}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.kind === 'not-found' && (
        <div className="pcgw-notfound">
          <span>No match on PCGamingWiki.</span>
          <button type="button" onClick={runSearch} disabled={!gameTitle.trim()}>Retry</button>
        </div>
      )}

      {state.kind === 'no-paths' && (
        <p className="pcgw-status">
          Wiki page found but no save/config paths have been documented there yet.
          Check the page for other info (mods, cloud sync, tweaks).
        </p>
      )}

      {state.kind === 'error' && (
        <div className="pcgw-notfound">
          <span className="pcgw-error">{state.error}</span>
          <button type="button" onClick={runSearch}>Retry</button>
        </div>
      )}

      {state.kind === 'paths' && (
        <table className="pcgw-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>OS</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.data.rows.map((row, i) => (
              <tr key={`${row.OS}-${row.Type}-${i}`}>
                <td className="pcgw-type"><span className={row.Type.toLowerCase() === 'save' ? 'pcgw-badge save' : 'pcgw-badge config'}>{row.Type}</span></td>
                <td className="pcgw-os">{row.OS}</td>
                <td className="pcgw-loc" title={row.Location}>{row.Location}</td>
                <td className="pcgw-copy-cell">
                  <button
                    type="button"
                    className="pcgw-copy"
                    onClick={() => copyLocation(row.Location)}
                    title="Copy path to clipboard"
                  >{copied === row.Location ? 'Copied' : 'Copy'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

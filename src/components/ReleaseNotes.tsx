// "New in this release" in Settings → About. Reads this version's
// section straight from CHANGELOG.md (the same text GitHub Releases
// shows) or from CHANGELOG.es.md when the interface is in Spanish, so the
// notes are written once and never drift. Supports the subset the
// changelog uses: `### headings`, `- ` items (two-space nesting),
// **bold**, `code` and [links](url).

import { Fragment, type ReactNode } from 'react'
import changelogEn from '../../CHANGELOG.md?raw'
import changelogEs from '../../CHANGELOG.es.md?raw'
import { getLanguage } from '../i18n'

interface Item { text: string; children: string[] }
interface Section { heading: string; items: Item[] }

/** The `## v<version>` section of a changelog, split into headings and items. */
export function parseReleaseNotes(source: string, version: string): Section[] {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((l) => new RegExp(`^## v${version.replace(/\./g, '\\.')}(?=\\s|$)`).test(l))
  if (start < 0) return []
  const sections: Section[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    const heading = line.match(/^### (.+)/)
    if (heading) { sections.push({ heading: heading[1].trim(), items: [] }); continue }
    const current = sections[sections.length - 1]
    if (!current) continue
    const nested = line.match(/^ {2,}- (.+)/)
    const item = line.match(/^- (.+)/)
    if (item) current.items.push({ text: item[1], children: [] })
    else if (nested && current.items.length) current.items[current.items.length - 1].children.push(nested[1])
  }
  return sections.filter((s) => s.items.length > 0)
}

function inline(text: string, onLink: (url: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[1] !== undefined) out.push(<b key={key}>{inline(m[1], onLink)}</b>)
    else if (m[2] !== undefined) out.push(<code key={key}>{m[2]}</code>)
    else {
      const url = m[4]
      out.push(<a key={key} href={url} className="about-releases-link" onClick={(e) => { e.preventDefault(); onLink(url) }}>{m[3]}</a>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function ReleaseNotes({ version, onOpenLink }: { version: string; onOpenLink: (url: string) => void }) {
  const localized = getLanguage() === 'es' ? parseReleaseNotes(changelogEs, version) : []
  const sections = localized.length ? localized : parseReleaseNotes(changelogEn, version)
  if (!sections.length) return null
  return (
    <div className="about-notes">
      {sections.map((s) => (
        <Fragment key={s.heading}>
          <p className="about-notes-heading">{s.heading}</p>
          <ul className="about-changelog">
            {s.items.map((item, i) => (
              <li key={i}>
                {inline(item.text, onOpenLink)}
                {item.children.length > 0 && (
                  <ul className="about-changelog nested">
                    {item.children.map((c, j) => <li key={j}>{inline(c, onOpenLink)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  )
}

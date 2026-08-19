// Add-a-run form + list of existing runs for a single arcade game.
// Fields adapt to what the game tracks — a game without a grid still
// shows character/difficulty inputs so score-only entries work.

import { useState } from 'react'
import type { ArcadeGame, Run, RunFlag } from '../types/arcade'
import { RUN_FLAG_OPTIONS } from '../types/arcade'

interface Props {
  game: ArcadeGame
  onAdd: (run: Omit<Run, 'id'>) => void
  onRemove: (runId: string) => void
  onUpdate: (runId: string, patch: Partial<Run>) => void
}

function toNumber(s: string): number | undefined {
  if (!s.trim()) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export default function ArcadeRunEditor({ game, onAdd, onRemove }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [character, setCharacter] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [score, setScore] = useState('')
  const [credits, setCredits] = useState('')
  const [misses, setMisses] = useState('')
  const [bombs, setBombs] = useState('')
  const [flags, setFlags] = useState<RunFlag[]>([])
  const [notes, setNotes] = useState('')

  const characters = game.grid?.characters ?? []
  const difficulties = game.grid?.difficulties ?? []
  const flagOptions = game.grid?.trackedFlags ?? RUN_FLAG_OPTIONS.map((o) => o.value)

  const toggleFlag = (f: RunFlag) =>
    setFlags((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])

  const submit = () => {
    if (!date) return
    onAdd({
      date,
      character: character || undefined,
      difficulty: difficulty || undefined,
      score: toNumber(score),
      credits: toNumber(credits),
      misses: toNumber(misses),
      bombs: toNumber(bombs),
      flags,
      notes: notes.trim() || undefined,
    })
    // Reset all but date so quick successive runs stay ergonomic.
    setCharacter(''); setDifficulty(''); setScore('')
    setCredits(''); setMisses(''); setBombs('')
    setFlags([]); setNotes('')
  }

  return (
    <div className="arcade-run-editor">
      <div className="arcade-run-form">
        <div className="field-row">
          <div className="field-group">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Character</label>
            {characters.length > 0
              ? <select value={character} onChange={(e) => setCharacter(e.target.value)}>
                  <option value="">—</option>
                  {characters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              : <input value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="Optional" />}
          </div>
          <div className="field-group">
            <label>Difficulty</label>
            {difficulties.length > 0
              ? <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">—</option>
                  {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              : <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Optional" />}
          </div>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label>Score</label>
            <input value={score} onChange={(e) => setScore(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 1200000000" />
          </div>
          <div className="field-group">
            <label>Credits</label>
            <input value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="1 for 1cc" />
          </div>
          <div className="field-group">
            <label>Misses</label>
            <input value={misses} onChange={(e) => setMisses(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0-9" />
          </div>
          <div className="field-group">
            <label>Bombs</label>
            <input value={bombs} onChange={(e) => setBombs(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0-9" />
          </div>
        </div>
        <div className="field-group">
          <label>Flags</label>
          <div className="arcade-flag-row">
            {RUN_FLAG_OPTIONS.filter((o) => flagOptions.includes(o.value)).map((o) => (
              <button
                key={o.value}
                type="button"
                className={flags.includes(o.value) ? 'pill active' : 'pill'}
                onClick={() => toggleFlag(o.value)}
                title={o.label}
              >{o.short}</button>
            ))}
          </div>
        </div>
        <div className="field-group">
          <label>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <button type="button" className="primary-btn" onClick={submit}>Log run</button>
        </div>
      </div>

      {game.runs.length > 0 && (
        <table className="arcade-run-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Character</th>
              <th>Difficulty</th>
              <th>Score</th>
              <th>Credits</th>
              <th>Misses</th>
              <th>Bombs</th>
              <th>Flags</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...game.runs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.character ?? '—'}</td>
                <td>{r.difficulty ?? '—'}</td>
                <td>{r.score?.toLocaleString() ?? '—'}</td>
                <td>{r.credits ?? '—'}</td>
                <td>{r.misses ?? '—'}</td>
                <td>{r.bombs ?? '—'}</td>
                <td>
                  {r.flags.map((f) => {
                    const opt = RUN_FLAG_OPTIONS.find((o) => o.value === f)
                    return <span key={f} className="arcade-flag-tag" title={opt?.label}>{opt?.short ?? f}</span>
                  })}
                </td>
                <td>{r.notes ?? ''}</td>
                <td><button type="button" className="track-remove" onClick={() => onRemove(r.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

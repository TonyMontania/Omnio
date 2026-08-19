// Modal shown when the user clicks "+ Add game" on the Arcade chart.
// Collects title, cover image (optional drag-and-drop), and the game
// type (grid tracker vs simple score log). Grid axes are added later
// from the game's own detail view — this modal doesn't try to be a
// grid editor too.

import { useState } from 'react'
import type { ArcadeGame, ArcadeGameType } from '../types/arcade'
import { pickImageToDataUrl, imageDropHandlers } from '../utils/files'

interface Props {
  onCreate: (game: ArcadeGame) => void
  onClose: () => void
}

export default function NewGameModal({ onCreate, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [franchise, setFranchise] = useState('')
  const [logo, setLogo] = useState<string | undefined>(undefined)
  const [type, setType] = useState<ArcadeGameType>('grid')

  const submit = () => {
    const t = title.trim()
    if (!t) return
    const game: ArcadeGame = {
      id: crypto.randomUUID(),
      title: t,
      abbreviation: abbreviation.trim() || undefined,
      franchise: franchise.trim() || undefined,
      logo,
      type,
      createdAt: Date.now(),
      runs: [],
      section: '1cc',
    }
    if (type === 'grid') {
      // Seed an empty grid — the user fills characters + difficulties
      // themselves once inside the detail view.
      game.grid = { characters: [], difficulties: [], trackedFlags: ['1cc', 'no-miss', 'no-bomb'] }
    }
    onCreate(game)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '92vw' }}>
        <div className="modal-header">
          <h2>New arcade game</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body arcade-new-form">

          <div className="field-group">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Perfect Cherry Blossom" autoFocus />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label>Abbreviation (optional)</label>
              <input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="e.g. PCB" maxLength={8} />
            </div>
            <div className="field-group">
              <label>Franchise (optional)</label>
              <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Touhou Project" />
            </div>
          </div>

          <div className="field-group">
            <label>Logo (optional)</label>
            <div
              className="arcade-cover-drop"
              {...imageDropHandlers((d) => setLogo(d))}
            >
              {logo
                ? <img src={logo} alt="" />
                : <span className="hint">Drop a logo image here, or click to pick a file.</span>}
              <input type="file" accept="image/*" onChange={pickImageToDataUrl((d) => setLogo(d))} />
            </div>
            {logo && (
              <button type="button" className="ghost-btn" onClick={() => setLogo(undefined)}>Remove logo</button>
            )}
          </div>

          <div className="field-group">
            <label>Tracking type</label>
            <div className="arcade-type-picker">
              <button
                type="button"
                className={type === 'grid' ? 'arcade-type-tile active' : 'arcade-type-tile'}
                onClick={() => setType('grid')}
              >
                <span className="arcade-type-title">◆ Grid tracker</span>
                <span className="arcade-type-desc">
                  Character × difficulty chart with per-cell flag markers (1cc, no-miss, no-bomb…).
                  You define the axes and legend inside the game.
                </span>
              </button>
              <button
                type="button"
                className={type === 'score' ? 'arcade-type-tile active' : 'arcade-type-tile'}
                onClick={() => setType('score')}
              >
                <span className="arcade-type-title">▲ Score log</span>
                <span className="arcade-type-desc">
                  Simple: a run log with score + flags per attempt. No grid, no axes.
                  Best when you're chasing a single high score.
                </span>
              </button>
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-btn" disabled={!title.trim()} onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  )
}

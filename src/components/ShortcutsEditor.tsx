// Keyboard-shortcut editor rendered inside the Settings pane.
//
// One row per KEYBOARD_ACTIONS entry. Each row shows the current
// binding (the user's override, or the built-in default), plus a
// "Record" button that captures the next keystroke into a new
// override. A "Reset" button drops the override so the default takes
// over again. Duplicate combos are allowed on purpose — some users
// legitimately want two rows firing off the same combo (e.g. rebind
// the "shortcuts cheat sheet" onto F1 alongside "?").

import { useEffect, useRef, useState } from 'react'
import { KEYBOARD_ACTIONS, formatCombo } from '../utils/keyboardActions'

interface Props {
  overrides: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

export default function ShortcutsEditor({ overrides, onChange }: Props) {
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!recordingId) return
    const cancel = () => setRecordingId(null)
    const capture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cancel(); return }
      const combo = formatCombo(e)
      if (!combo) return   // still pressing modifiers alone
      e.preventDefault()
      e.stopPropagation()
      onChange({ ...overrides, [recordingId]: combo })
      setRecordingId(null)
    }
    // Capture phase so we intercept before App.tsx's own dispatcher
    // reroutes the combo to whatever action is currently mapped.
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [recordingId, overrides, onChange])

  const reset = (id: string) => {
    const next = { ...overrides }
    delete next[id]
    onChange(next)
  }
  const disable = (id: string) => {
    onChange({ ...overrides, [id]: '' })
  }
  const resetAll = () => onChange({})

  return (
    <div className="shortcuts-editor" ref={rowRef}>
      <div className="shortcuts-editor-head">
        <p className="hint" style={{ margin: 0, flex: 1 }}>
          Click <b>Record</b> and press a keystroke to rebind an action.
          Press <kbd>Esc</kbd> to cancel a recording. Empty binding = the
          action is disabled entirely.
        </p>
        <button type="button" className="secondary-btn" onClick={resetAll}>Reset all to defaults</button>
      </div>
      <ul className="shortcuts-editor-list">
        {KEYBOARD_ACTIONS.map((action) => {
          const bound = overrides[action.id] !== undefined ? overrides[action.id] : action.defaultCombo
          const overridden = overrides[action.id] !== undefined
          const disabled = bound === ''
          const isRecording = recordingId === action.id
          return (
            <li key={action.id} className="shortcut-row">
              <div className="shortcut-row-label">
                <div className="shortcut-row-title">{action.label}</div>
                <div className="shortcut-row-desc">{action.description}</div>
              </div>
              <div className="shortcut-row-combo">
                {isRecording
                  ? <span className="shortcut-recording">Press a key…</span>
                  : disabled
                    ? <span className="shortcut-disabled">Disabled</span>
                    : <kbd className={overridden ? 'shortcut-kbd overridden' : 'shortcut-kbd'}>{bound}</kbd>}
              </div>
              <div className="shortcut-row-actions">
                <button
                  type="button"
                  className={isRecording ? 'pill active' : 'pill'}
                  onClick={() => setRecordingId(isRecording ? null : action.id)}
                >{isRecording ? 'Cancel' : 'Record'}</button>
                <button type="button" className="pill" onClick={() => disable(action.id)} disabled={disabled}>Disable</button>
                <button type="button" className="pill" onClick={() => reset(action.id)} disabled={!overridden}>Reset</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

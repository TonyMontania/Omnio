// Smart lists — create, edit, delete + apply.
//
// Ships as a single-modal CRUD panel. The left column lists every
// saved smart list; the right column edits the selected one. Rules
// use a fixed vocabulary declared in `types/smartLists` so any new
// rule kind lights up here automatically (add a case in `renderRule`
// and the pickers stay in sync with the matcher).

import { useMemo, useState } from 'react'
import type { SmartList, SmartListRule } from '../types/smartLists'
import { CATEGORIES } from '../categories'
import { getUniversalStatusOptions } from '../utils/statusUniversal'
import type { CategoryId } from '../types/items'

interface Props {
  open: boolean
  smartLists: SmartList[]
  onClose: () => void
  onSave: (list: SmartList) => void
  onDelete: (id: string) => void
  onApply: (list: SmartList) => void
  allTags: string[]
}

type RuleKind = SmartListRule['kind']

const RULE_LABELS: Record<RuleKind, string> = {
  favorite: 'Favorite',
  minRating: 'Minimum rating',
  maxRating: 'Maximum rating',
  hasTag: 'Has tag',
  status: 'Status is one of',
  yearMin: 'Year ≥',
  yearMax: 'Year ≤',
  hasReview: 'Has review',
  hasCover: 'Has cover',
  consumed: 'Finished / consumed',
}

const RULE_KINDS = Object.keys(RULE_LABELS) as RuleKind[]

function makeRule(kind: RuleKind): SmartListRule {
  switch (kind) {
    case 'favorite':
    case 'hasReview':
    case 'hasCover':
    case 'consumed':
      return { kind, value: true }
    case 'minRating':
    case 'maxRating':
      return { kind, value: 4 }
    case 'hasTag':
      return { kind, value: '' }
    case 'status':
      return { kind, values: [] }
    case 'yearMin':
      return { kind, value: 2020 }
    case 'yearMax':
      return { kind, value: new Date().getFullYear() }
  }
}

export default function SmartListsModal({ open, smartLists, onClose, onSave, onDelete, onApply, allTags }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SmartList | null>(null)

  const selected = useMemo(
    () => smartLists.find((l) => l.id === selectedId) ?? null,
    [smartLists, selectedId],
  )

  const activeDraft: SmartList | null = draft ?? selected

  if (!open) return null

  const startNew = () => {
    const list: SmartList = {
      id: crypto.randomUUID(),
      name: 'Untitled list',
      categoryId: 'all',
      rules: [],
      createdAt: Date.now(),
    }
    setSelectedId(list.id)
    setDraft(list)
  }

  const commit = () => {
    if (!activeDraft) return
    onSave({ ...activeDraft, updatedAt: Date.now() })
    setDraft(null)
  }

  const patch = (fields: Partial<SmartList>) => {
    if (!activeDraft) return
    setDraft({ ...activeDraft, ...fields })
  }

  const patchRule = (idx: number, next: SmartListRule) => {
    if (!activeDraft) return
    const rules = activeDraft.rules.slice()
    rules[idx] = next
    setDraft({ ...activeDraft, rules })
  }
  const removeRule = (idx: number) => {
    if (!activeDraft) return
    const rules = activeDraft.rules.slice()
    rules.splice(idx, 1)
    setDraft({ ...activeDraft, rules })
  }
  const addRule = (kind: RuleKind) => {
    if (!activeDraft) return
    setDraft({ ...activeDraft, rules: [...activeDraft.rules, makeRule(kind)] })
  }

  const statusOptionsForScope = activeDraft && activeDraft.categoryId !== 'all'
    ? getUniversalStatusOptions(activeDraft.categoryId as CategoryId)
    : []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal smart-lists-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Smart lists</h2>
          <button className="modal-close" onClick={onClose} title="Close">✕</button>
        </header>

        <div className="smart-lists-body">
          <aside className="smart-lists-side">
            <button className="secondary-btn" onClick={startNew}>+ New smart list</button>
            <ul className="smart-lists-nav">
              {smartLists.length === 0 && <li className="empty">No smart lists yet.</li>}
              {smartLists.map((l) => (
                <li
                  key={l.id}
                  className={selectedId === l.id ? 'active' : ''}
                  onClick={() => { setSelectedId(l.id); setDraft(null) }}
                >
                  <div className="smart-list-name">{l.name}</div>
                  <div className="smart-list-meta">
                    {l.categoryId === 'all' ? 'All libraries' : (CATEGORIES.find((c) => c.id === l.categoryId)?.label ?? l.categoryId)}
                    {' · '}{l.rules.length} rule{l.rules.length === 1 ? '' : 's'}
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <section className="smart-lists-editor">
            {!activeDraft && <p className="empty">Pick a list on the left, or create a new one.</p>}
            {activeDraft && (
              <>
                <div className="field-row">
                  <label>Name</label>
                  <input
                    value={activeDraft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="e.g. 4-star games I never finished"
                  />
                </div>
                <div className="field-row">
                  <label>Scope</label>
                  <select
                    value={activeDraft.categoryId}
                    onChange={(e) => patch({ categoryId: e.target.value })}
                  >
                    <option value="all">All libraries</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="smart-lists-rules">
                  <div className="smart-lists-rules-header">
                    <span>Rules</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const k = e.target.value as RuleKind | ''
                        if (k) addRule(k)
                        e.target.value = ''
                      }}
                    >
                      <option value="">+ Add rule…</option>
                      {RULE_KINDS.map((k) => (
                        <option key={k} value={k}>{RULE_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  {activeDraft.rules.length === 0 && (
                    <p className="hint">No rules yet — the list matches everything in scope.</p>
                  )}
                  <ul className="smart-lists-rule-list">
                    {activeDraft.rules.map((rule, i) => (
                      <li key={i} className="smart-list-rule">
                        <div className="smart-list-rule-kind">{RULE_LABELS[rule.kind]}</div>
                        <div className="smart-list-rule-input">
                          <RuleInput
                            rule={rule}
                            onChange={(r) => patchRule(i, r)}
                            allTags={allTags}
                            statusOptions={statusOptionsForScope}
                          />
                        </div>
                        <button className="delete" onClick={() => removeRule(i)} title="Remove rule">✕</button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="smart-lists-actions">
                  <button className="secondary-btn" onClick={() => onDelete(activeDraft.id)}>Delete list</button>
                  <div className="spacer" />
                  <button className="secondary-btn" onClick={() => onApply(activeDraft)}>Apply</button>
                  <button className="primary-btn" onClick={commit}>Save</button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

interface RuleInputProps {
  rule: SmartListRule
  onChange: (next: SmartListRule) => void
  allTags: string[]
  statusOptions: { value: string; label: string }[]
}

function RuleInput({ rule, onChange, allTags, statusOptions }: RuleInputProps) {
  switch (rule.kind) {
    case 'favorite':
    case 'hasReview':
    case 'hasCover':
    case 'consumed':
      return (
        <select value={rule.value ? 'y' : 'n'} onChange={(e) => onChange({ ...rule, value: e.target.value === 'y' })}>
          <option value="y">Yes</option>
          <option value="n">No</option>
        </select>
      )
    case 'minRating':
    case 'maxRating':
      return (
        <select value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )
    case 'hasTag':
      return (
        <>
          <input
            list="smart-list-tags"
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            placeholder="tag"
          />
          <datalist id="smart-list-tags">
            {allTags.map((t) => <option key={t} value={t} />)}
          </datalist>
        </>
      )
    case 'status':
      if (statusOptions.length === 0) {
        return <span className="hint">Status filter needs a specific library scope.</span>
      }
      return (
        <div className="status-multi">
          {statusOptions.map((o) => {
            const on = rule.values.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                className={on ? 'chip active' : 'chip'}
                onClick={() => onChange({ ...rule, values: on ? rule.values.filter((v) => v !== o.value) : [...rule.values, o.value] })}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )
    case 'yearMin':
    case 'yearMax':
      return (
        <input
          type="number"
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          min={1900}
          max={2200}
        />
      )
  }
}

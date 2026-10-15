import { describe, expect, it } from 'vitest'
import type { AnyItem } from '../types'
import { planVndbImport, ratingFromVote, statusFromLabels, type VndbListEntry } from './vndbList'

const entry = (fields: Partial<VndbListEntry>): VndbListEntry => ({
  id: 'v17',
  vote: 85,
  labels: [{ id: 2, label: 'Finished' }, { id: 7, label: 'Voted' }],
  started: '2025-01-02',
  finished: '2025-02-03',
  vn: { title: 'Ever17', released: '2002-08-29', length_minutes: 1800, image: { url: 'https://t.vndb.org/cv/1.jpg' }, developers: [{ name: 'KID' }] },
  ...fields,
})

describe('statusFromLabels', () => {
  it('maps the built-in labels, preferring finished', () => {
    expect(statusFromLabels(entry({}))).toBe('completed')
    expect(statusFromLabels(entry({ labels: [{ id: 3, label: 'Stalled' }] }))).toBe('paused')
    expect(statusFromLabels(entry({ labels: [{ id: 5, label: 'Wishlist' }, { id: 13, label: 'Waiting' }], vote: null }))).toBe('plan_to_play')
  })
  it('treats a vote with no status label as finished', () => {
    expect(statusFromLabels(entry({ labels: [{ id: 7, label: 'Voted' }] }))).toBe('completed')
  })
})

describe('ratingFromVote', () => {
  it('converts 10–100 into half stars', () => {
    expect(ratingFromVote(85)).toBe(4.5)
    expect(ratingFromVote(100)).toBe(5)
    expect(ratingFromVote(10)).toBe(0.5)
    expect(ratingFromVote(null)).toBeUndefined()
  })
})

describe('planVndbImport', () => {
  it('creates new VNs with list and VN data', () => {
    const plan = planVndbImport([entry({})], [], 1000)
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0]).toMatchObject({
      categoryId: 'visual_novels', title: 'Ever17', vndbId: 'v17', visualNovelStatus: 'completed',
      rating: 4.5, finishedAt: '2025-02-03', vnLengthHours: '30', devs: ['KID'], cover: 'https://t.vndb.org/cv/1.jpg',
    })
  })

  it('updates an existing VN by id or title without touching its other fields', () => {
    const mine = { id: 'mine', categoryId: 'visual_novels', title: 'ever 17', createdAt: 0, vnDescription: 'my notes' } as AnyItem
    const plan = planVndbImport([entry({})], [mine])
    expect(plan.creates).toHaveLength(0)
    expect(plan.updates.get('mine')).toEqual({ vndbId: 'v17', visualNovelStatus: 'completed', rating: 4.5, startDate: '2025-01-02', finishedAt: '2025-02-03' })
  })

  it('skips blacklisted entries', () => {
    expect(planVndbImport([entry({ labels: [{ id: 6, label: 'Blacklist' }] })], []).skipped).toBe(1)
  })
})

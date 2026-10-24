import { describe, expect, it } from 'vitest'
import { statusTone } from './statusUniversal'

describe('statusTone', () => {
  it('groups every library status into one colour family', () => {
    expect(statusTone('watching')).toBe('progress')
    expect(statusTone('reading')).toBe('progress')
    expect(statusTone('completed')).toBe('done')
    expect(statusTone('played')).toBe('done')
    expect(statusTone('watched')).toBe('done')
    expect(statusTone('paused')).toBe('paused')
    expect(statusTone('dropped')).toBe('dropped')
    expect(statusTone('plan_to_watch')).toBe('planned')
    expect(statusTone('backlog')).toBe('planned')
    expect(statusTone('unlistened')).toBe('planned')
  })
})

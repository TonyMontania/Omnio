import { describe, expect, it } from 'vitest'
import { cachedThreadFrom } from './f95Cache'

const real = {
  name: "Ariana's Dark Christmas",
  version: 'Final',
  developer: 'Sieglinnde',
  status: '2',
  type: '14',
  last_updated: '1704150000',
  image_url: 'https://attachments.f95zone.to/2024/01/3250431_Christmascover.png',
  tags: '[2, 8, 36, 37, 42, 46, 48, 54, 61, 62, 70, 77, 80, 87, 90, 91, 97, 134, 139]',
  description: 'The main character decided to spend Christmas with his girlfriend',
  INDEX_ERROR: '',
}

describe('cachedThreadFrom', () => {
  it('decodes a real cache response', () => {
    const t = cachedThreadFrom(real)!
    expect(t).toMatchObject({
      name: "Ariana's Dark Christmas", version: 'Final', creator: 'Sieglinnde',
      engine: "Ren'Py", status: 'Completed', threadUpdated: '2024-01-01',
      coverUrl: 'https://attachments.f95zone.to/2024/01/3250431_Christmascover.png',
    })
    expect(t.tags).toHaveLength(19)
    expect(t.tags).toContain('2dcg')
    expect(t.tags).toContain('animated')
  })

  it('returns null for threads the cache could not index', () => {
    expect(cachedThreadFrom({ ...real, INDEX_ERROR: 'missing' })).toBeNull()
  })
})

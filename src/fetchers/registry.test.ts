import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerFetcher, getFetchersFor, authReady, _clearFetcherRegistryForTests,
  type FetcherRegistration,
} from './registry'

const dummy = (id: string, categories: readonly string[], auth: FetcherRegistration['auth'] = 'none'): FetcherRegistration => ({
  id, label: id, categories, auth,
  render: () => null,
})

beforeEach(() => _clearFetcherRegistryForTests())

describe('fetcher registry', () => {
  it('filters registrations by category id', () => {
    registerFetcher(dummy('igdb', ['videojuegos']))
    registerFetcher(dummy('tmdb', ['peliculas', 'series']))
    registerFetcher(dummy('mangadex', ['manga', 'manhwa']))

    expect(getFetchersFor('videojuegos').map((r) => r.id)).toEqual(['igdb'])
    expect(getFetchersFor('series').map((r) => r.id)).toEqual(['tmdb'])
    expect(getFetchersFor('manhwa').map((r) => r.id)).toEqual(['mangadex'])
    expect(getFetchersFor('libros')).toEqual([])
  })

  it('re-registering the same id replaces the previous entry', () => {
    registerFetcher(dummy('tmdb', ['peliculas']))
    registerFetcher(dummy('tmdb', ['peliculas', 'series']))
    const hits = getFetchersFor('series')
    expect(hits).toHaveLength(1)
    expect(hits[0].categories).toEqual(['peliculas', 'series'])
  })
})

describe('authReady', () => {
  it('returns true for keyless sources regardless of settings', () => {
    expect(authReady('none', {})).toBe(true)
  })

  it('requires the named single-key settings field', () => {
    expect(authReady('tmdbApiKey', {})).toBe(false)
    expect(authReady('tmdbApiKey', { tmdbApiKey: 'k' })).toBe(true)
  })

  it('requires both IGDB credentials together', () => {
    expect(authReady('igdb', { igdbClientId: 'id' })).toBe(false)
    expect(authReady('igdb', { igdbClientSecret: 's' })).toBe(false)
    expect(authReady('igdb', { igdbClientId: 'id', igdbClientSecret: 's' })).toBe(true)
  })
})

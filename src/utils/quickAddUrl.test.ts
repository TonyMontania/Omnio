import { describe, it, expect } from 'vitest'
import { detectQuickAddUrl } from './quickAddUrl'

const ALL = ['igdb', 'tmdb', 'anilist', 'vndb', 'mangadex', 'openlibrary']

describe('detectQuickAddUrl', () => {
  it('ignores non-URLs', () => {
    expect(detectQuickAddUrl('The Witcher 3', ALL)).toBeNull()
    expect(detectQuickAddUrl('', ALL)).toBeNull()
  })

  it('detects IGDB slug URLs', () => {
    const m = detectQuickAddUrl('https://www.igdb.com/games/the-witcher-3-wild-hunt', ALL)
    expect(m).toEqual({ fetcherId: 'igdb', source: 'IGDB', query: 'the witcher 3 wild hunt' })
  })

  it('detects TMDb movie with id+slug', () => {
    const m = detectQuickAddUrl('https://www.themoviedb.org/movie/272-batman-begins', ALL)
    expect(m).toEqual({ fetcherId: 'tmdb', source: 'TMDb', query: 'batman begins' })
  })

  it('detects TMDb tv with id+slug', () => {
    const m = detectQuickAddUrl('https://www.themoviedb.org/tv/1399-game-of-thrones', ALL)
    expect(m).toEqual({ fetcherId: 'tmdb', source: 'TMDb', query: 'game of thrones' })
  })

  it('detects AniList anime', () => {
    const m = detectQuickAddUrl('https://anilist.co/anime/16498/Attack-on-Titan/', ALL)
    expect(m).toEqual({ fetcherId: 'anilist', source: 'AniList', query: 'Attack on Titan' })
  })

  it('detects MyAnimeList (routed via AniList)', () => {
    const m = detectQuickAddUrl('https://myanimelist.net/anime/16498/Shingeki_no_Kyojin', ALL)
    expect(m).toEqual({ fetcherId: 'anilist', source: 'MyAnimeList', query: 'Shingeki no Kyojin' })
  })

  it('detects VNDB', () => {
    const m = detectQuickAddUrl('https://vndb.org/v17', ALL)
    expect(m).toEqual({ fetcherId: 'vndb', source: 'VNDB', query: 'v17' })
  })

  it('detects MangaDex uuid + slug', () => {
    const m = detectQuickAddUrl(
      'https://mangadex.org/title/a96676e5-8ae2-425e-b549-7f15dd34a6d8/komi-san-can-t-communicate',
      ALL,
    )
    expect(m?.fetcherId).toBe('mangadex')
    expect(m?.query).toBe('komi san can t communicate')
  })

  it('detects OpenLibrary work URL', () => {
    const m = detectQuickAddUrl('https://openlibrary.org/works/OL45804W/The_Witcher', ALL)
    expect(m).toEqual({ fetcherId: 'openlibrary', source: 'OpenLibrary', query: 'The Witcher' })
  })

  it('routes Steam URLs through IGDB', () => {
    const m = detectQuickAddUrl(
      'https://store.steampowered.com/app/292030/The_Witcher_3_Wild_Hunt/',
      ALL,
    )
    expect(m).toEqual({ fetcherId: 'igdb', source: 'Steam', query: 'The Witcher 3 Wild Hunt' })
  })

  it('respects availableFetcherIds', () => {
    // igdb URL but igdb not in available (wrong category) → no match
    const m = detectQuickAddUrl('https://www.igdb.com/games/hollow-knight', ['tmdb', 'anilist'])
    expect(m).toBeNull()
  })
})

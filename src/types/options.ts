// Runtime constants: option lists for dropdowns/pickers and default field visibility maps.
// One block per domain (games, music, manga, anime, series, movies, shared).

import type {
  Ownership, GameStatus, GameSource, GameField,
  MusicType, MusicSource, MusicField,
  MangaStatus, PublicationStatus, MangaSource, MangaField,
  AnimeStatus, AiringStatus, AnimeFormat, AnimeSeason, Demographic, AnimeSource, AnimeField,
  SeriesStatus, SeriesFormat, SeriesField,
  MovieSource, MovieField, WatchLocation,
  AgeRating, RelationKind, Platform,
} from './entities'

// ---- Shared ----

export const PLATFORM_SUGGESTIONS: Platform[] = ['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'Xbox One', 'Nintendo Switch', 'Steam Deck', 'Mobile']

export const AGE_RATING_OPTIONS: { value: AgeRating; label: string }[] = [
  { value: 'e', label: 'E (Everyone)' },
  { value: 'e10', label: 'E10+ (Everyone 10+)' },
  { value: 't', label: 'T (Teen)' },
  { value: 'm', label: 'M (Mature 17+)' },
  { value: 'ao', label: 'AO (Adults Only 18+)' },
  { value: 'rp', label: 'RP (Rating Pending)' },
]

export const RELATION_OPTIONS: { value: RelationKind; label: string }[] = [
  { value: 'sequel', label: 'Sequel' },
  { value: 'prequel', label: 'Prequel' },
  { value: 'side_story', label: 'Side story' },
  { value: 'spin_off', label: 'Spin-off' },
  { value: 'alt_version', label: 'Alternative version' },
  { value: 'adaptation', label: 'Adaptation' },
  { value: 'other', label: 'Other' },
]

// ---- Games ----

export const OWNERSHIP_OPTIONS: { value: Ownership; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'shared', label: 'Shared' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'unlicensed', label: 'Unlicensed' },
]

export const GAME_STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'playing', label: 'Playing' },
  { value: 'played', label: 'Played' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
]

export const GAME_SOURCE_OPTIONS: { value: GameSource; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'remake', label: 'Remake' },
  { value: 'remaster', label: 'Remaster' },
  { value: 'port', label: 'Port' },
  { value: 'sequel', label: 'Sequel' },
  { value: 'spinoff', label: 'Spin-off' },
  { value: 'other', label: 'Other' },
]

export const GAME_FIELD_OPTIONS: { value: GameField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'playTime', label: 'Time played' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
]

export const DEFAULT_GAME_FIELDS: Record<GameField, boolean> = {
  title: true, status: true, playTime: true, rating: true, tags: true,
}

// ---- Music ----

export const MUSIC_TYPE_OPTIONS: { value: MusicType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'ep', label: 'EP' },
  { value: 'album', label: 'Album' },
  { value: 'ost', label: 'OST' },
  { value: 'live', label: 'Live' },
  { value: 'recopilation', label: 'Recopilation' },
]

export const MUSIC_SOURCE_OPTIONS: { value: MusicSource; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'compilation', label: 'Compilation' },
  { value: 'soundtrack', label: 'Soundtrack' },
  { value: 'remaster', label: 'Remaster' },
  { value: 'deluxe', label: 'Deluxe edition' },
  { value: 'reissue', label: 'Reissue' },
  { value: 'other', label: 'Other' },
]

export const MUSIC_FIELD_OPTIONS: { value: MusicField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'releaseYear', label: 'Release year' },
  { value: 'type', label: 'Type' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
]

export const DEFAULT_MUSIC_FIELDS: Record<MusicField, boolean> = {
  title: true, artist: true, releaseYear: true, type: true, rating: true, tags: true,
}

// ---- Manga / Manhwa / Manhua / Western Comics ----

export const MANGA_STATUS_OPTIONS: { value: MangaStatus; label: string }[] = [
  { value: 'plan_to_read', label: 'Plan to read' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'dropped', label: 'Dropped' },
]

export const PUBLICATION_STATUS_OPTIONS: { value: PublicationStatus; label: string }[] = [
  { value: 'publishing', label: 'Publishing' },
  { value: 'finished', label: 'Finished' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'not_yet_released', label: 'Not yet released' },
]

export const MANGA_SOURCE_OPTIONS: { value: MangaSource; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'light_novel', label: 'Light novel' },
  { value: 'novel', label: 'Novel' },
  { value: 'game', label: 'Game' },
  { value: 'visual_novel', label: 'Visual novel' },
  { value: 'anime', label: 'Anime' },
  { value: 'other', label: 'Other' },
]

export const MANGA_FIELD_OPTIONS: { value: MangaField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'chapters', label: 'Chapters read/total' },
]

export const DEFAULT_MANGA_FIELDS: Record<MangaField, boolean> = {
  title: true, status: true, chapters: true,
}

// ---- Anime / Donghua ----

export const ANIME_STATUS_OPTIONS: { value: AnimeStatus; label: string }[] = [
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'dropped', label: 'Dropped' },
]

export const AIRING_STATUS_OPTIONS: { value: AiringStatus; label: string }[] = [
  { value: 'airing', label: 'Airing' },
  { value: 'finished', label: 'Finished' },
  { value: 'not_yet_aired', label: 'Not yet aired' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const ANIME_FORMAT_OPTIONS: { value: AnimeFormat; label: string }[] = [
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movie' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Special' },
  { value: 'music', label: 'Music Video' },
]

export const ANIME_SEASON_OPTIONS: { value: AnimeSeason; label: string }[] = [
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
]

export const DEMOGRAPHIC_OPTIONS: { value: Demographic; label: string }[] = [
  { value: 'shonen', label: 'Shonen' },
  { value: 'shojo', label: 'Shojo' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'josei', label: 'Josei' },
]

export const ANIME_SOURCE_OPTIONS: { value: AnimeSource; label: string }[] = [
  { value: 'manga', label: 'Manga' },
  { value: 'light_novel', label: 'Light Novel' },
  { value: 'web_novel', label: 'Web Novel' },
  { value: 'novel', label: 'Novel' },
  { value: 'original', label: 'Original' },
  { value: 'game', label: 'Game' },
  { value: 'visual_novel', label: 'Visual Novel' },
  { value: 'other', label: 'Other' },
]

export const ANIME_FIELD_OPTIONS: { value: AnimeField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'episodes', label: 'Episodes watched/total' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
]

export const DEFAULT_ANIME_FIELDS: Record<AnimeField, boolean> = {
  title: true, status: true, episodes: true, rating: true, tags: true,
}

// ---- Series ----

export const SERIES_STATUS_OPTIONS: { value: SeriesStatus; label: string }[] = [
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'dropped', label: 'Dropped' },
]

export const SERIES_FORMAT_OPTIONS: { value: SeriesFormat; label: string }[] = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'ended', label: 'Ended' },
  { value: 'miniseries', label: 'Miniseries' },
  { value: 'limited', label: 'Limited series' },
  { value: 'anthology', label: 'Anthology' },
  { value: 'other', label: 'Other' },
]

export const SERIES_FIELD_OPTIONS: { value: SeriesField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'episodes', label: 'Episodes watched/total' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
]

export const DEFAULT_SERIES_FIELDS: Record<SeriesField, boolean> = {
  title: true, status: true, episodes: true, rating: true, tags: true,
}

// ---- Movies ----

export const MOVIE_SOURCE_OPTIONS: { value: MovieSource; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'book', label: 'Book' },
  { value: 'comic', label: 'Comic' },
  { value: 'game', label: 'Game' },
  { value: 'true_story', label: 'True story' },
  { value: 'remake', label: 'Remake' },
  { value: 'sequel', label: 'Sequel' },
  { value: 'other', label: 'Other' },
]

export const MOVIE_FIELD_OPTIONS: { value: MovieField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Watched status' },
  { value: 'year', label: 'Release year' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
]

export const DEFAULT_MOVIE_FIELDS: Record<MovieField, boolean> = {
  title: true, status: true, year: true, rating: true, tags: true,
}

export const WATCH_LOCATION_OPTIONS: { value: WatchLocation; label: string }[] = [
  { value: 'cinema', label: 'Cinema' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'physical', label: 'Physical Media' },
  { value: 'tv', label: 'TV' },
  { value: 'other', label: 'Other' },
]

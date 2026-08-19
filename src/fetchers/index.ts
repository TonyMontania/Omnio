// Barrel entry for the fetcher registry. Importing this module
// registers every built-in fetcher for its side effect; consumers
// then use `getFetchersFor(categoryId)` from './registry'.
//
//   import 'src/fetchers'      // seeds the registry once
//   import { getFetchersFor } from 'src/fetchers/registry'

import './registrations'

export {
  registerFetcher, getFetchersFor, authReady, resolveHint,
  type FetcherRegistration, type FetcherContext, type FetcherAuth,
  type FetcherSettings, type FetcherApplyHints,
} from './registry'

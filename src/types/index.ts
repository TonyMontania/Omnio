// Barrel export. `import ... from './types'` from anywhere in src resolves here
// and gets the same symbols the old flat types.ts used to expose.
//
// The split is:
//   entities.ts → pure types and interfaces (no runtime code)
//   options.ts  → OPTIONS lists, DEFAULT_* maps, PLATFORM_SUGGESTIONS
//   helpers.ts  → assetSrc, label lookups, derived counts, formatters, mini markdown

export * from './entities'
export * from './options'
export * from './helpers'

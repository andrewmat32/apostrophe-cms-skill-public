# Services & external data

## Service module shape

`extend: '@apostrophecms/module'` + camelCase `options.alias` + everything in
`methods( self )`. Consumers call through the alias:
`self.apos.productService.x(...)` — never HTTP to your own server. Data-heavy
modules cache aliases in `init( self )`
(`self.apiService = self.apos.apiService;`).

## External APIs: funnel through ONE wrapper service

Give every external API a service module and a named wrapper method per
endpoint — feature code never builds URLs or headers itself. A proven
three-layer chain inside the wrapper:

1. **Cached request** — compute a stable cache key (hash of URL + options),
   check `self.apos.cache.get( namespace, key )` (Mongo-backed, TTL'd);
   convention: namespace = the wrapper method's name. Hit → return.
2. **In-flight de-duplication** — a module-level
   `const runningRequests = new Map()` keyed by the same cache key. **Store the
   PROMISE, not the resolved value** — concurrent identical requests then share
   one network call. (Awaiting first and storing the value is a real-world bug:
   dedup never fires and the Map degrades into a short-TTL value cache. Add
   catch-cleanup so a failed request doesn't poison the Map.)
3. **Raw transport** — the actual fetch, with per-host auth headers resolved
   from config. Call it directly only to deliberately bypass caching.

## Known pitfalls (learned in production)

- **Shared-reference mutation:** any in-memory cache or dedup Map hands the
  SAME object to concurrent callers. Downstream code that mutates API
  responses in place (merges, splices, added fields) corrupts what a
  concurrent caller receives. Either deep-copy before mutating or never mutate
  API responses. (`apos.cache` is Mongo-backed and returns fresh copies —
  safe.)
- **Optional-service guards disable silently:** call sites written as
  `if( self.apos.someService ) { ... }` mean an unregistered module silently
  turns the feature off (e.g. a captcha/verification service). Know this
  before "cleaning up" the guard — and decide deliberately whether a missing
  verification service should fail open (dev) or closed (prod).
- **Cache enablement toggles**: if the repo gates caching on a global-doc
  property, diagnosing "stale API data" starts there.

## Database access & constants

- Centralize raw Mongo access behind a db service module
  (`findManyInCollectionProjection(...)`, `getGlobalDocProperty( req, key )`)
  rather than sprinkling `self.apos.db.collection(...)` through feature code.
- Look for existing code→label mapping collections/tables before hardcoding
  label maps.
- Global constants live in the repo's app.js settings option →
  `self.apos.options.settings` — add new constants there, not scattered
  through modules.

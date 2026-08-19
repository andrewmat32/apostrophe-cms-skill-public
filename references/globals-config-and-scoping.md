# Globals, config layers & scoping

## The config layers — where a value belongs

| Layer | Where | Nature | Read idiom |
|---|---|---|---|
| custom top-level option module | `app.js` (e.g. `settings: { alias: 'settings', ... }`) | build-time constants, environment vocabularies | `self.apos.options.settings.X` (or via the alias) |
| `@apostrophecms/global` doc | editor-controlled, per-locale, draft/published | ops toggles, branding, menus, legal links, site-wide AREAS | `data.global.X` in templates, `req.data.global.X` server-side |
| `data/local.js` | per-instance file, deep-merged over app.js options | environment type, dev flags, per-instance URLs | merged into `apos.options` |
| process-memory cache | a `Map` on an app.js option or module property | derived data too hot to recompute | get-or-build accessor |

Before inventing a new config location, check which of these the repo already
uses for similar values and put yours there.

## Reading the global doc — pick deliberately

1. **`req.data.global.X`** — free (already loaded), correct locale, respects
   draft/published. Use in `beforeSend`, widget `load()`, routes with a real
   req. This is the default.
2. **Raw `aposDocs.findOne({ type: '@apostrophecms/global' })`** — only where
   no `req` exists. Always memoize it, and always filter
   `aposMode: 'published'` explicitly — raw reads that omit the mode can pick
   up drafts.

Global **areas** are the site-wide-UI mechanism: define the area on the global
schema, render with `{% area data.global, 'name' %}` from any template.

## Nunjucks helper ownership — where a new helper belongs

- Pure string/number/date formatting → a utilities module: implement in
  `methods`, re-export by reference in `helpers( self )` so it works
  server-side AND in templates.
- Helpers needing settings/i18n context → the `@apostrophecms/global` project
  module (helpers defined inline).
- **Widgets and pieces should not define helpers** — widget computation goes in
  `load()`/`methods()` onto `widget.*`, then the template just reads it.

## Browser-side scoping — three tiers + the choosing rule

1. **`window` globals** — ONLY when markup forces it: Alpine inline `@click`
   expressions, `x-data="factory()"` factories, declarative-swap callback
   attributes, third-party callbacks. Expose via
   `Object.assign( window, { fn } )`.
2. **Shared module exports** — reusable JS consumed by ≥2 modules: a shared
   file under the asset module's `ui/src`, imported via the `Modules/` alias
   (if the repo uses that pattern — check first).
3. **Player closures** — everything else, especially anything closing over
   per-widget data.

Collision discipline: before adding a `window.*` name, grep for it. Two widgets
defining the same global means the last one wins; shared code that CALLS a
global only some widget defines throws when that widget is absent. Both are
real production bug classes — prefix widget-specific names or keep them in the
closure.

## `req.data.*` population — the ordering rule

`app.js` express middleware (every request) → module `beforeSend` handlers
(page-scoped keys) → widget `load()` (attaches to `widget.*`, only
exceptionally to `req.data`). **A widget may only rely on `req.data` keys set
by the first two layers; nothing set in one widget's `load()` is reliably
visible to sibling widgets.** An early-return guard
(`if( req.data.x ) { return; }`) in a generic beforeSend lets more specific
code pre-empt it — check for that pattern before "fixing" double-set keys.

## Process-memory caches — the caveats

The get-or-build Map pattern is fine for derived data, but know its limits
before trusting it: no TTL unless you add one, process-local (not shared across
cluster workers, gone on restart), and **not locale-aware** unless the key
includes the locale. For anything that must survive restarts or be shared, use
`apos.cache` (Mongo-backed, TTL'd) instead. And read cache-helper BODIES before
assuming which layer they use — names lie.

Before "cleaning up" shared browser or cache code, grep for cross-module
consumers — shared entries importing from widget modules, and fragments
consuming factories defined in some widget's bundle, both occur in real
codebases.

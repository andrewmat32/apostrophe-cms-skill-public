# Module anatomy (verified against official docs + Apostrophe core source)

All modules are ESM: `export default { ... }`. Match the repo's existing code
style exactly (brace placement, spacing) — greps that assume one style will miss
the other.

## Registration — how it ACTUALLY works

A module that exists on disk but is registered nowhere **silently does not
exist** — no error, no warning worth trusting. Registration happens in `app.js`
(`modules: { ... }`) or, when the project sets `nestedModuleSubdirs: true`, in
`modules.js` aggregator files: Apostrophe globs every `modules.js` anywhere
under `modules/` and merges them. Consequences:

- Per-directory `modules.js` aggregators are the mechanism; registering a
  *family folder* at the parent level is optional readability.
- The no-code warning for a grouping directory can be silenced with a stub
  `index.js` containing `ignoreNoCodeWarning: true`, with
  `options.ignoreNoCodeWarning` inline in the parent `modules.js`, or by simply
  not registering the grouping dir at all.
- Some projects enable modules from `app.js` by path
  (`'services/db-service': {}`) — check both mechanisms before assuming a
  module runs.

## Piece families — a common project convention

- Typical grouping: `modules/pieces/blog-module/{blog, blog-page, blog-widget,
  modules.js}` under `nestedModuleSubdirs`.
- A `-module` suffix on the family dir is NOT required — a family dir may share
  its piece's name, with the registered module resolved to the NESTED
  `pieces/thing/thing/`; don't add an `index.js` to such a family dir.
- Flat schema-only pieces directly under `modules/pieces/` are legitimate.
- Widget modules are not confined to a `modules/widgets/` dir — they appear
  inside piece families and admin dirs too. Locate by `extend:
  '@apostrophecms/widget-type'`, not by path.

## Piece-type module

```js
export default {
    extend: '@apostrophecms/piece-type',
    options: {
        label: 'Blog', pluralLabel: 'Blogs',
        sort: { updatedAt: -1 }
    },
    fields: { add: { ... }, group: { ... } }
};
```

Options worth knowing (use when applicable; prefer options you can see used in
the repo you're in — don't cargo-cult):
- `seoFields: false` + `openGraph: false` for utility pieces that never render
  as pages.
- `slugPrefix: 'xx-'` to namespace utility-piece slugs.
- `quickCreate: true|false`, `searchable: false`.
- `group:` is usual but not mandatory (schema-only pieces may skip `fields`
  entirely). Reuse the repo's existing group names rather than inventing new
  vocabulary.

## Piece-page-type

```js
export default {
    extend: '@apostrophecms/piece-page-type',
    options: { label: 'Blogs Page', perPage: 12 },
    ...
};
```

- **`pieceModuleName` is opt-OUT**: core derives it as the module name minus
  `-page` (verified in core source). Set it only when the piece name differs
  (`help-center-page` → `'help-article'`).
- Index/show data shaping — three coexisting mechanisms; pick what the repo
  already uses:
  1. `extendMethods → indexQuery( _super, req )` — filter/limit the index
     cursor (publish gating, an editor-configurable per-page count overriding
     `perPage`).
  2. `handlers['@apostrophecms/page:beforeSend']` with a guard
     (`if( req.data.piece || req.data.page?.type !== 'blog-page' ) { return; }`)
     — this event fires for every page type and both routes, hence the guard.
  3. `beforeIndex( req )` / `beforeShow( req )` writing onto `req.data.*`
     (breadcrumbs, SEO data).
- `piecesFilters: [ { name: '_category' }, { name: 'difficulty' } ]` for
  query-string faceting.
- Index-only pages: `beforeShow` sets `req.notFound = true` and
  `views/show.html` exists but is EMPTY (the file is required).
- Proper 404 is three lines: `req.notFound = true; req.res.statusCode = 404;
  self.setTemplate( req, 'notFound' );` — and `req.redirect = '/'` works as an
  auth gate from before-hooks.
- Templates: `views/index.html` + `views/show.html` (both always present).
  Pagination has no universal convention — imitate the repo's existing pager
  before inventing one.

## Page types, `types:` and `park:`

- Custom page: `extend: '@apostrophecms/page-type'` + `views/page.html`,
  registered like any module.
- **`types:` (in the project's `modules/@apostrophecms/page/index.js`) is the
  editor's "add page" menu** — often a deliberately SHORT allowlist. Fixed
  pages mount via **`park:`** instead; piece-pages typically mount ONLY via
  park. A page type can be in both.
- Park entries can carry page-schema defaults beyond
  `{ title, slug, type, parkedId }` — any schema field of that page type.
- Truly global per-request data belongs in `@apostrophecms/express` middleware
  in `app.js`, not in a page `beforeSend`; `beforeSend` handlers add
  page-scoped things (canonical URL, preload images, structured data).

## Widget-type module

See references/examples.md for the full shape. Key correctness points:
- Widgets that need server-side data use `load( req, widgets )` in `methods`
  (batch over the widgets array), or shape data in an `output()` override.
- An `output()` override MUST be `extendMethods` with the full
  `_super( req, widget, options, _with )` call — a `methods()`-style `output()`
  silently replaces (and thereby bypasses) anything the project layered into
  the render chain.
- Area options: `options.widgets` keyed by widget name minus `-widget` (core
  behavior); per-widget options inside the map are normal (`contextual: true`,
  image `sizes`); `expanded: true` +
  `groups: { key: { label, widgets, columns } }` organizes a large widget menu.
- Optional widget polish options: `contextualStyles: true`, `previewUrl` +
  a preview SVG in `public/`, `description`. Icon values are
  vue-material-design-icons component names, conventionally registered with an
  `-icon` suffix.

## Rich text configuration (every project touches this)

Projects override `modules/@apostrophecms/rich-text-widget/index.js` at project
level (core-module override — no `extend:`, no registration needed). The knobs,
all verified real core options:

```js
export default {
    options: {
        contextualStyles: true,                    // in-context style editing
        previewUrl: '/previews/rich-text-widget.svg',
        defaultOptions: {
            toolbar: [ 'styles', '|', 'bold', 'italic', 'strike', 'link',
                'anchor', '|', 'bulletList', 'orderedList', '|', 'blockquote',
                'codeBlock', '|', 'alignLeft', 'alignCenter', 'alignRight',
                'alignJustify', '|', 'undo', 'redo' ],   // '|' = separator
            styles: [                                    // the 'styles' dropdown
                { label: 'Heading 2', tag: 'h2' },
                { label: 'Heading 2 Style', tag: 'div', class: 'h2-style' }
            ],
            insert: [ 'table', 'image', 'horizontalRule' ]  // slash-insert menu
        }
    }
};
```

- **The `tag`-vs-`class` trick**: give each real heading level a twin
  `div.hN-style` entry — same look via CSS, without adding an extra `<hN>` to
  the document outline/SEO.
- **Per-area overrides:** inside any area's `options.widgets`,
  `'@apostrophecms/rich-text': {}` inherits `defaultOptions`; passing
  `{ toolbar: […] }` there REPLACES the toolbar for that area only (full
  editor by default, reduced toolbars for constrained spots like bios).
- **Extra schema fields on the widget** are normal `fields.add` + `group` in
  the same override.
- **`styles: { add: { … } }` cascade** (top level, NEXT TO `fields` — not the
  `defaultOptions.styles` dropdown): per-widget CSS controls
  (`{ type: 'color', property, selector }`, `preset: 'alignment' | 'padding' |
  'margin'`). VERSION-GATED: the widget-type `styles` cascade exists in newer
  4.x cores (verified present in 4.31/4.32, absent in 4.22) — check
  `node_modules/apostrophe/modules/@apostrophecms/widget-type/index.js`
  `cascades:` before using it.
- A project may also override `views/widget.html` in the same module dir —
  don't clobber it when editing options.

## Plain service module

```js
export default {
    extend: '@apostrophecms/module',
    options: { alias: 'searchBarService' },
    async init( self ) { self.dbService = self.apos.dbService; },   // alias caching idiom
    methods( self ) { return { ... }; }
};
```

Cross-module calls go through aliases (`self.apos.searchBarService.x()`),
never HTTP to your own server.

## Schema field idioms

- Area: `type: 'area'` + `options.widgets`; `max: 1` singletons (`max: 1` also
  appears on arrays/relationships).
- Relationship: see references/relationships.md.
- Select: `choices: [ { label, value } ]` + `def`; dynamic choices via
  `choices: 'methodName'` resolved by a method returning the array.
- Conditionals: `if:` / `requiredIf:` on a sibling discriminator field.
- `columns`/`filters` on pieces customize the admin manager; custom cells via
  `component: 'SomeCell'` + `ui/apos/components/SomeCell.vue`.
- `handlers` with `beforeSave` for slug/title derivation.

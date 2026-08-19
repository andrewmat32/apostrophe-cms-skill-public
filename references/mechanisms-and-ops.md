# Mechanisms & ops

## CLI tasks — `tasks( self )`

Belong in dedicated tool modules (seed/import/localize style). Shape: a
`usage:` string literally spelling the invocation
(`node app.js seed-task:seed - ...`); the task opens with
`const req = self.apos.task.getReq();` and delegates to a `methods()`
implementation. Args: positional via `argv._[1]` or `--flag=` style.
`getReq({ mode: 'draft' })` when draft docs are needed.

⚠ Before running ANY app task in a project: check its CLAUDE.md — some
projects forbid app tasks entirely (destructive against a live dev DB).

## Event handlers — `handlers( self )` map

- **Own doc events unquoted** (`beforeSave:`) — typical uses: denormalization
  (write relationship-derived fields onto the doc:
  `doc.parentSlug = doc._parent?.[0]?.slug`) and slug/title derivation.
- **Cross-module events quoted**:
  - `'@apostrophecms/page:beforeSend'` — the universal "inject `req.data` for
    templates" slot (guard by page type; it fires for every page).
  - `'apostrophe:modulesRegistered'` — plugin/registry self-registration
    (guard for the host's absence).
  - `'apostrophe:ready'`, `'@apostrophecms/global:afterSave'` — load-and-refresh
    memoized config.
  - `'@apostrophecms/express:compileRoutes'` — push raw binary/streaming routes
    ordered after session middleware.
  - `'@apostrophecms/migration:after'` — idempotent seeding.
- **`page:serve` vs `page:beforeSend`**: a login gate must set `req.redirect`
  on `serve` — `beforeSend` is too late; beforeSend is for render-time flags.
- `extendMethods`/`extendHandlers` with `_super` when wrapping core behavior.

## Official features to use per the docs (thin project precedent)

Async components (`components( self )` + `{% component %}`), programmatic
migrations (`apos.migration.add`), and `queries( self, query )` custom builders
are all official and fine — but many production codebases solve the same
problems with AJAX endpoints, CLI-task seeders, and `extendMethods →
indexQuery` respectively. Check the repo's precedent first; don't introduce a
second mechanism where one already exists. Every project's `release` script
should run `node app.js @apostrophecms/migration:migrate` after build.

A production `asset:build` (NODE_ENV=production) requires a release id: core
autodetects the current git commit / HEROKU_RELEASE_VERSION / PLATFORM_TREE_ID,
but in a checkout with no `.git` it errors out — set `APOS_RELEASE_ID` or write
a short unique string to a tracked `release-id` file (field-proven).

## Admin UI customization — the escalation ladder (least invasive first)

1. **DOM-observing `ui/apos/apps/*.js`** (vanilla, not Vue):
   `apos.bus.$on( 'admin-menu-click' )` hooks, style injection,
   MutationObserver-driven tweaks — write them to silently no-op if core class
   names change.
2. **Manager cells**: `columns.add.<field>.component: 'SomeCell'` +
   `ui/apos/components/SomeCell.vue`.
3. **Admin-bar + modal**: `self.apos.adminBar.add( name, label, perm,
   { contextUtility: true, icon } )` paired with
   `self.apos.modal.add( name, 'ModalComponent', { moduleName } )`; icons must
   first be mapped in the module's `icons: { 'x-icon': 'MaterialName' }`
   section. Admin-bar groups are configured in app.js.
4. **File-shadowing core Vue** (last resort): same filename under
   `ui/apos/components/`.
5. Data to admin UI: `self.enableBrowserData()` + `getBrowserData( req )`.
6. User feedback: `self.apos.notify( req, msg, { type, dismiss } )`.

Full admin-UI wiring detail (modal name-pairs, launcher registries, AposModal
scaffold): the `apostrophe-admin-ui` agent definition.

## Images

- Native pipeline: `apos.image.first( areaOrRelationship )` →
  `apos.attachment.url( img, { size } )` in templates and JSON payloads alike;
  focal point via `apos.attachment.hasFocalPoint`. Use the size ladder + a
  `<picture>`/srcset for anything content-sized, and preload the LCP image.
- Server-side upload (seed/import paths): build a multer-like object from
  `fs.statSync` → `apos.attachment.insert( req, file )` → create the image
  piece with a slugified title. Stamp seeded docs (`seeded: true`-style) so
  reruns can find them.

## Seeding content programmatically (field-proven traps)

- Insert via the module API with a **draft req**
  (`apos.task.getReq( { mode: 'draft' } )`), then `publish( req, doc )` each
  doc — pieces and pages alike.
- **Set relationships via the relationship FIELD** (`_author: [ authorDoc ]`),
  never by writing the ids storage (`authorIds`) directly: `publish()`
  re-derives relationship storage from the schema field, so a manual
  `authorIds` write is silently DROPPED from the published copy and every
  join comes back empty.
- **Hand-built area objects need their OWN `_id`**:
  `{ _id: apos.util.generateId(), metaType: 'area', items: [ ... ] }` — and
  each widget item needs `{ _id, metaType: 'widget', type: '<name>' }`. A
  missing area `_id` makes core throw at render time, and Apostrophe serves
  its error template **with HTTP 200** — so verify seeded pages by their
  CONTENT, never by status code.
- Make seeds idempotent (upsert by slug / check a `seeded: true` stamp) —
  a blind re-run duplicates content.

## Errors, email, logging

- Transactional mail: a dedicated mailer service module (nodemailer or an API
  transport) with secrets encrypted at rest — never inline SMTP config in
  feature code, never a secret in a tracked file.
- Error reporting to external services: dedupe repeats (increment a counter on
  the same signature instead of re-sending), and never let the reporting path
  throw into the feature path.
- Prefer `apos.util.log/warn/error` over bare console in server code; add
  process-level `unhandledRejection`/`uncaughtException` handlers when running
  under a supervisor (PM2 etc.).

## SEO / sitemap / robots / redirects

Use and **extend** the official modules, never reimplement them:
`@apostrophecms/seo`, `@apostrophecms/sitemap`
(`extendMethods.writeSitemap`), `@apostrophecms/open-graph`
(`extendMethods.tags`), `@apostrophecms/security-headers`,
`@apostrophecms/soft-redirect` (`extendHandlers` for slash normalization).
Derive the canonical origin per-request rather than baking it into the DB (a
prod DB dump then can't leak a stale origin into dev). Pick ONE trailing-slash
policy and enforce it consistently.

## devMode & environment

- A `data/local.js` dev flag can gate module registration
  (`...( devMode ? { 'seed-tool': {} } : {} )` spread in app.js), page access,
  and outbound side effects (forms returning `{ sent: false, devMode: true }`).
- `req.data.isDev = ( process.env.NODE_ENV !== 'production' )` set once by the
  asset module is a handy template gate — check an existing gate's polarity
  before copying it.

## Running locally (the first question every task raises)

- Start: `node app.js` (check `package.json` scripts for a `dev` variant
  first — and the project's CLAUDE.md for restrictions).
- Admin user: `node app.js @apostrophecms/user:add <name> admin`.
- Asset changes: vite bundles/SCSS recompile on app restart; admin-UI
  (`ui/apos`) changes additionally need a build + hard browser reload. When in
  doubt: restart, hard-refresh.
- A throwing widget `load()` takes down the WHOLE page render — wrap risky
  fetches, degrade to an empty state.

## Draft vs published (the "why isn't my change showing" trap)

Docs exist per mode (`aposMode: 'draft'|'published'`) and per locale.
Logged-out requests see published; the editor works on drafts until Publish.
Raw Mongo reads must filter `aposMode` explicitly. `find( req )` follows
`req.mode` — use a task req with the mode you mean
(`apos.task.getReq( { mode: 'draft' } )`).

## Testing reality

Many production Apostrophe projects ship no automated test suite; verification
is operational (run the app, exercise the feature, lint, review). Match the
repo — don't unilaterally introduce a test framework; if the user wants tests,
that's a project decision.

# apostrophe-cms skill (public edition) — changelog

## 1.0.10 — 2026-08-20 — audit pass over every accepted difference

A line-by-line pass over all 216 differences between this edition and the
internal one it derives from: 198 were correctly absent house material, 10 were
real losses of generic ApostropheCMS knowledge, now restored:
- a rate limiter (or any middleware) mounted at `/api/v1` never runs for
  leading-slash routes, which mount at the site root — where public visitor
  endpoints usually live;
- non-player module JS should bind with `apos.util.onReady( fn )`, which also
  fires after content refreshes, not `DOMContentLoaded`;
- `@apostrophecms/seo`'s own extension API (`registerSchema`,
  `seoFieldMappings`, per-document `seoRobots`);
- core ships `@apostrophecms/email` — `self.email( req, template, data, opts )`
  — so a project need not build a mailer from scratch;
- `apos.template.appendNodes`/`prependNodes` is the supported way to inject into
  `<head>` from a module;
- two rungs missing from the admin-UI escalation ladder: `utilityOperations` /
  `apos.doc.addContextOperation`, and `options: { components: {...} }` which
  swaps a component for ONE module where file-shadowing swaps it for all;
- `apos.util.slugify`, the `{ def, launder, finalize }` query-builder triad and
  its `$exists: false` nuance, and `req.t` with a runtime-computed key (plus:
  don't translate through `self.apos.i18n.i18next`).

## 1.0.9 — 2026-08-20 — port the relationships work that 1.0.4 claimed

The 1.0.4 entry said polymorphic `withType: [...]` was documented as a trap
here. It was not: that whole block — the polymorphic trap, the relationship
options table (per-join `fields`/`_fields`, `withRelationships`,
`builders.areas`/`relationships`, `ifOnlyOne`, storage overrides, editor-UX
options), the free id/slug query builders, and the nested-join and projection
traps — reached the internal edition and never got ported. 86 lines, now here.

Found by the sync auditor added in 1.0.8, which is the reason it exists.

## 1.0.8 — 2026-08-20 — citations are now verified

`verify.js` fails if any citation points at a reference file that does not
exist, or at a numbered trap that does not exist in the file it names. A
half-finished edit that leaves a dangling pointer is now a failing test rather
than something a reader discovers. Found and fixed one on introduction: a
pointer to an appendix this edition deliberately does not ship.

## 1.0.7 — 2026-08-20 — four traps from a real feature build

- **Widget styles land on a wrapper div**, so a widget whose own template paints
  its padding or full-bleeds gets a padding knob that is a no-op horizontally,
  additive vertically, and a shadow hidden behind the band.
- **Full-bleed layouts need `box-sizing: border-box`** — starters ship
  normalize.css, which does not set it, so `width: 100vw` + padding widens the
  document and pushes `margin-left: auto` content off-screen at every width.
- **Do not emit DOM hooks nothing consumes**; the integrator now reports
  unconsumed hooks as a dead contract.
- **Seed date/time fields as strings** — a seeder bypassing `convert()` stores a
  BSON Date where the admin UI stores a string, and the first editor save flips
  the type.

## 1.0.6 — 2026-08-20 — dogfooding pass: three documented claims refuted

The 1.0.4 references were used as the spec for building a real feature set.
Doing so exposed errors in them; all corrected, plus 3 new pins:
- **Refuted:** `autopublish: true` with the default contributor edit role does
  NOT grant publish rights (measured: forbidden on both insert and update).
- **Refuted:** `placeholder` reaches ~10 field types, not 4.
- **Over-generalized:** the image-projection trap applies to direct image
  relationships, not to images held in an area on the related doc.
- **Corrected:** conditional fields reset to `def` only when `convert` throws.
- **New core bug:** `apos.boxField.toCss()` emits invalid CSS for asymmetric
  boxes (no `;` between declarations) — caveat added and pinned as a bug watch.
- **New trap:** a colon in any editor-facing literal or `__t()` string is
  silently truncated by i18next's default namespace separator.
- **New:** the global stylesheet renders on save and is mirrored onto the
  global doc (code edits are invisible until the singleton is re-saved); widget
  `styles` and `fields` share one namespace and fields win silently.
- **L7 gap:** `data.localizations` is absent on 404 renders, so a gated
  language switcher disappears there — give it a fallback branch.
- **slice-map.js fix:** namespaced i18n keys no longer report as missing.

## 1.0.5 — 2026-08-20 — multi-locale means a language SWITCHER, not just translations

A field report ("users cannot change the language") turned out to be a working
switcher that *looked* disabled: faint low-contrast locale codes read as a label
rather than a control. Affordance is part of correctness, so the rule is now
encoded in four places:
- **templating-fragments.md § i18n** — "2+ locales ⇒ ship a visitor-facing
  switcher", with the full `data.localizations` recipe, the piece-page
  `/locale/<loc>` redirect note, the translated-vs-fallback distinction, and the
  affordance requirement. `data.localizations` was previously undocumented.
- **apostrophe-templates agent** — building it in `layout.html` is part of any
  multi-locale work.
- **apostrophe-design agent** — style it as an operable control, not faint text.
- **apostrophe-integrator agent** — new slice link **L7**: it must exist, render
  on every page type, and actually navigate (markup alone is not evidence).
- **lint-apos.js W4** (new) — warns when 2+ locales are configured but no
  template reads `data.localizations`. Fixture-tested in both directions.

## 1.0.4 — 2026-08-20 — coverage sweep: styles, layout, fields, media, workflow

An audit against all 68 core `@apostrophecms` modules found whole subsystems
undocumented. Four new references, written from 4.32.1 core source, plus 22 new
core-source pins (verify-docs 80 → 102):
- **references/styles-and-layout.md** — global styles (4.26+) and widget styles:
  the cascade, CSS metadata, the 8 presets, `<link>` vs inline delivery, and the
  specificity trap (target `:root` tokens rather than fighting your own cascade).
  Layout/column widgets (4.23+): options, the three-level gap system (4.30+), the
  grid CSS contract, capping nesting depth, and the 4.29 breaking column-schema
  flatten.
- **references/schema-fields.md** — the complete 26-type inventory, cross-cutting
  field options, and 16 traps. Headline: `required` is not enforced server-side
  for most field types.
- **references/media.md** — images, attachments, files, video/oembed, uploadfs,
  image sizes, crop vs focal point. Headline trap: a relationship projection
  omitting `attachment` makes images vanish silently.
- **references/editorial-workflow.md** — roles, submitted drafts, `apos.notify`,
  `busy`, command shortcuts, archive vs delete. Headline: `autopublish: true`
  with the default `editRole: 'contributor'` grants contributors direct publish
  rights.
- **relationships.md** — polymorphic `withType: [...]` documented as a trap: it
  is A2 leftover that boots clean and throws on the first query that loads it.
  Plus per-join `_fields`, `withRelationships`, builder cost controls, the free
  query builders, and the nested-join/projection traps.

## 1.0.3 — 2026-08-19 — third field test — the page-type action trap

A full-pattern test project (pieces, piece-page filters, async component,
widgets/players, three locales, seeder) was built end-to-end by the producer
agents and verified by the integrator, which caught one new cross-layer trap
the whole chain missed. Folded in:
- **frontend-backend-flow + CHEATSHEET**: page-type modules share the
  `@apostrophecms/page` action (core `page-type/index.js` overrides
  `enableAction()`), so their named apiRoutes mount at
  `/api/v1/@apostrophecms/page/<route>` and the "obvious"
  `/api/v1/<page-module>/<route>` 404s. Fix: leading-slash site-relative route
  name, or host the route on a non-page module. Proven live (404 → 200), with
  the core pin added to verify-docs.
- **mechanisms-and-ops**: production `asset:build` in a checkout with no
  `.git` needs `APOS_RELEASE_ID` or a `release-id` file.

## 1.0.2 — 2026-08-19 — second field test (agent-pipeline run)

A second fresh project was built end-to-end BY the skill's producer agents
(backend → templates → frontend via verbatim handoff notes), then verified by
the integrator agent working blind — it caught both cross-layer bugs the
producer chain let through, with core-source and live-HTTP evidence. Lessons
folded in:
- **mechanisms-and-ops**: new "Seeding content programmatically" section
  (relationships via the schema FIELD — publish drops manual ids-storage
  writes; hand-built areas need their own `_id`; Apostrophe serves render
  errors as HTTP 200 — verify content, not status; idempotent seeds).
- **frontend-backend-flow**: named apiRoutes are KEBAB-CASED in the URL
  (`loadMore` → `/api/v1/<module>/load-more`, core `getRouteUrl`/`cssName`) —
  a hand-built camelCase endpoint string 404s.
- **relationships**: `aposDocId` is never auto-projected — name it explicitly
  when downstream code reads it off query results (core adds only
  type/metaType/ids-storage to projections).
- **lint-apos**: W1's JS scan now runs on the comment/string-blanked copy —
  `._field[0]` inside a comment no longer fires a false warning (reference-repo
  finding counts unchanged).

## 1.0.1 — 2026-08-19 — field-test fixes

Built a fresh Apostrophe 4.32 project strictly from this skill's cookbook
(2 piece types with a relationship, a widget on the home page, an AJAX
endpoint + widget player), verified it with the integrator/reviewer agents and
live HTTP tests. Two defects in the skill's own teaching were caught and
fixed:
- **examples §4 taught a silent no-op**: a `methods()`-level `load()` replaces
  core widget-type's `load()` — the method that joins schema relationships
  (`schema.relate`) — so the widget's `_fields` never populate and the
  hybrid's "selected" branch was dead as written. The cookbook now uses
  `extendMethods` + `await _super( req, widgets )`; module-anatomy documents
  the trap (a `methods()`-level `load()` is only viable when the widget
  queries by ids storage and never reads joined `_fields`).
- **`self.render` context trap** documented in frontend-backend-flow: data
  passed to `self.render( req, 'x.html', { items } )` is exposed as
  `data.items`, not bare `items` — an AJAX target looping a bare local renders
  empty; the robust shared-markup shape is a fragment both templates import.
Also confirmed live during the test: named `/api/v1` routes enforce CSRF where
bare site-root routes did not, and Apostrophe serves template render errors as
an HTTP **200** error page — verify page content, never just the status code.

## 1.0.0 — 2026-08-19 — initial public release

Derived from an internally-verified edition (built and adversarially audited
2026-08, including a full line-by-line audit of all files, seeded-defect
fixture testing of the tools, and a live smoke test of the admin-ui agent).
For this public release, all project-identifying material from the private
reference codebases was removed or genericized; every remaining claim is
either verified against the official docs / Apostrophe core source
(`tests/verify-docs.js`) or explicitly framed as a per-repo convention to
discover. `tests/verify.js` carries sanitization pins so private references
cannot drift back in.

Contents:
- `SKILL.md` — rules, convention-discovery, common-mistakes table, agent flow.
- 9 references: module-anatomy (incl. rich-text configuration with the
  version-gated `styles` cascade), relationships, frontend-backend-flow,
  templating-fragments, client-js, services-and-data,
  globals-config-and-scoping, mechanisms-and-ops, examples (the Testimonials
  cookbook).
- `tools/lint-apos.js` (E1–E7, W1–W2, I1) and `tools/slice-map.js`.
- `tests/verify.js` (generic + integrity + docs) and `tests/verify-docs.js`
  (official docs + core source, `APOS_CORE_PATH`-pinnable).
- 7 agents: backend / frontend / templates / design / admin-ui producers,
  integrator / reviewer read-only verifiers.
- `CHEATSHEET.md`, `GUIDE.md`, this changelog.

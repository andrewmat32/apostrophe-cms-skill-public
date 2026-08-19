# apostrophe-cms skill (public edition) — changelog

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

---
name: apostrophe-cms
description: Use when working in any ApostropheCMS project (a repo whose package.json depends on apostrophe) — creating or editing widgets, pieces, pages, services, Nunjucks templates, fragments, widget players, AJAX endpoints, vite bundles, admin UI, or SCSS; or when unsure how an Apostrophe project structures modules and passes data between server and browser.
---

# ApostropheCMS patterns (Apostrophe 3.x/4.x)

## Overview

Works on ANY Apostrophe 3/4 project. Two things go wrong without this skill:
generic answers use official-but-unfitting patterns for codebases that have
their own conventions, and silent-failure traps (options that don't exist,
projections that never apply, modules that register nowhere) ship looking
correct. So: **discover the repo's conventions first, imitate the codebase,
and know the traps**.

The patterns here were mined from production Apostrophe codebases and verified
against the official docs AND Apostrophe core source (the test suites in
`tests/` re-check every claim).

## First: discover the project's conventions

Before writing anything, establish (grep + read the nearest existing file of
the same kind):

- **Route style** — `apiRoutes` with leading-slash public names? Named
  `/api/v1` routes? `renderRoutes`? What response envelope do existing
  handlers return?
- **Server→browser data** — widget players parsing a serialized attribute, or
  self-contained `ui/src/index.js` reading kebab `data-*` attributes?
- **Template imports** — plain absolute imports, or wrapped in a theme-resolver
  helper?
- **i18n location** — one central `modules/localization/i18n/`, or per-module
  `i18n/` dirs? How many locales?
- **SCSS placement** — a central `modules/asset/ui/src/index.scss` cascade, or
  per-module bundles?
- **Client libraries** — is Alpine (or htmx, or a custom swap directive)
  vendored?

Where the repo shows no precedent, follow the official docs. Never transplant
another project's house machinery (central AJAX hubs, custom headers, theme
resolvers) into a project that doesn't have it.

## Hard rules

1. **Fragments, never macros**, for reusable template chunks — macros lack
   request context (`__t()`, `data.*`, async). Call with `{% render %}`, import
   with the absolute `"/fragments/x.html"` form.
   Details: references/templating-fragments.md
2. **AJAX endpoints**: named `apiRoutes` mount under `/api/v1/<module>/<route>`;
   leading-slash names are literal top-level URLs. Response shape follows the
   consumer — objects for JSON consumers, raw HTML strings for markup swaps.
   Admin routes gated `permission.can( req, 'admin' )`; launder all input.
   Details: references/frontend-backend-flow.md
3. **Server→browser data**: build ONE serializable object server-side, emit via
   `| jsonAttribute` into a `data-*` attribute (or individual kebab `data-*`
   attributes), parse in an `apos.util.widgetPlayers` player or the module's
   `ui/src` entry. No inline scripts.
4. **Modules are ESM** `export default { extend, options, fields,
   methods(self), ... }`; new modules MUST be registered — in `app.js`, or in a
   `modules.js` where the project uses `nestedModuleSubdirs`. Never Apostrophe
   2 idioms (`construct`, `self.route`, moog).
5. **Cross-module calls go through aliases** (`self.apos.productService.x()`),
   never HTTP to your own server; external APIs through one wrapper service.
   Never mutate API responses in place (shared-reference cache).
6. **Join content with relationships, not fetching**: related doc types are
   joined via `_`-prefixed relationship fields, auto-populated at query time —
   templates and server code read `piece._field[0]` directly (always an array,
   even `max: 1`; guard with `| length` / `?.[0]`). Never fetch related types
   via JS/AJAX or manual re-queries on a read path; query only for dynamic
   modes ("show all", filters), relationship-first.
   Details: references/relationships.md
7. **Reuse first**: check the repo's fragment/helper/service catalogs before
   writing new ones.
8. **Client-side interactivity — pick in this order:**
   1. **Alpine.js, IF the repo has it** (vendored `alpine*.js` or `alpinejs`
      in package.json).
   2. **Vanilla JS otherwise** — plain DOM APIs inside the widget player.
   3. **htmx / a swap directive only as a last resort**: when the repo already
      uses it AND the feature is a declarative HTML-swap matching that
      existing pattern.
   Never introduce jQuery, React, or any new client framework/library.
9. A project's own CLAUDE.md overrides this skill — including command
   restrictions (some projects forbid running app tasks).

## Which reference to load

| Task | Read |
|---|---|
| new/changed widget, piece, page, service module; schema fields; rich-text editor config (toolbar/styles/insert) | references/module-anatomy.md |
| linking/joining doc types, `_fields`, reverse/nested joins, projections | references/relationships.md |
| dynamic data on a page, AJAX endpoint, click-to-fetch HTML | references/frontend-backend-flow.md |
| reusable template chunk, template conventions, `__t`, areas | references/templating-fragments.md |
| widget player, vite bundle, Alpine/htmx, SCSS, shared browser helpers | references/client-js.md |
| editor-controlled design: global styles, widget styles, layout/column widgets | references/styles-and-layout.md |
| any schema field type, field options (`if`, `readOnly`, `help`…), field traps | references/schema-fields.md |
| images, attachments, files, video/oembed, uploadfs, image sizes | references/media.md |
| draft/publish, roles, submitted drafts, apos.notify, shortcuts, the archive | references/editorial-workflow.md |
| calling external APIs, caching, Mongo access, settings | references/services-and-data.md |
| config/settings/global doc, helper ownership, window vs shared vs player JS, req.data | references/globals-config-and-scoping.md |
| CLI tasks, event handlers, admin UI, caching layers, images, error/email, SEO, deployment | references/mechanisms-and-ops.md |
| copy-paste starting point for ANY element type | references/examples.md |

## Common mistakes (silent-failure traps)

| Instinct | Reality |
|---|---|
| `deferred: true` | not a real option — `defer: true` (silent no-op otherwise) |
| relationship `project:` at field top level | must be INSIDE `builders:` — ignored otherwise |
| query `.project()` omitting a `_field` later read | the join silently skips; `?.[0]` hides it |
| writing a module and not registering it | it silently does not exist |
| bundle key = module name | key must equal the `ui/src/<key>.js` filename |
| `{% import "fragments/x.html" %}` (relative) | `{% import "/fragments/x.html" %}` (absolute) |
| writing a new macro | write a fragment |
| `piece._field.title` (object access) | always an array, even `max: 1`: `_field[0]` guarded with `\| length` / `?.[0]` |
| fetching related docs via JS/AJAX or `find()` on a read path | relationships auto-join: read `piece._field[0]` off the loaded doc |
| returning JSON to a markup-swap endpoint | return the raw HTML string |
| `if( req.user )` as an admin gate | `permission.can( req, 'admin' )` |
| `self.name` for the module's name | doesn't exist — `self.__meta.name` |
| putting a function on `window` "to be safe" | window only when markup forces it; else shared export or player closure |
| a `methods()`-style `output()` override | `extendMethods` + full `_super( req, widget, options, _with )` |
| new keys in one locale JSON | every key goes into EVERY locale JSON |

## Specialist agents (when available)

Seven subagents ship with this skill (`agents/`, registered in
`~/.claude/agents/`).

Five **producers**: **apostrophe-backend** (modules/pieces/services/endpoints),
**apostrophe-frontend** (players/ui-src/bundles/interactivity),
**apostrophe-templates** (Nunjucks/fragments/areas/i18n),
**apostrophe-design** (SCSS/theming),
**apostrophe-admin-ui** (`ui/apos` Vue: admin-bar/modal/icons wiring, tool
modals, config panels, plugin-launcher registries). Each pre-loads its slice of
these references, enforces its scope, and emits a handoff note (its
data/DOM/class contract) for the others.

Two **verifiers** (read-only): **apostrophe-integrator** — traces a feature's
full vertical slice (schema → relationships → backend → HTML → JS → CSS) and
verifies every handoff link L1–L6 (L1 registration, L2
relationships/projections, L3 backend→template data, L4 template→JS DOM hooks,
L5 JS→backend endpoint, L6 template→SCSS classes), reporting SLICE
LINKED/BROKEN; **apostrophe-reviewer** — audits new/changed code against the
hard rules AND the silent-failure defect patterns, verdict
APPROVE / APPROVE-WITH-NITS / REQUEST-CHANGES.

Cross-layer flow: **backend first** (defines the data contract) → **templates**
(implements markup + emits DOM hooks/classes) → **frontend + design in
parallel** (frontend consumes the DOM-hook handoff; design the class handoff) →
**integrator** on the finished slice → **reviewer** on the diff. Admin-facing
features swap the middle: **backend first → admin-ui** (consumes the endpoint
handoff; there is no templates/design leg for `ui/apos` work). Run
`tools/lint-apos.js` for the mechanical checks at any point. When dispatching,
paste the upstream agent's handoff note VERBATIM into the next agent's prompt —
subagents share no context; the note is the only wire between them. For
single-layer touch-ups, work directly — dispatching an agent for a one-line
change is overhead. If a `subagent_type` isn't recognized, the registry hasn't
refreshed (loads at session start) — do the work inline following the same
references.

## Verification

- `node ~/.claude/skills/apostrophe-cms/tests/verify.js` — generic project
  checks + skill integrity (+ quick docs checks); accepts repo paths as args;
  prints its totals.
- `node ~/.claude/skills/apostrophe-cms/tests/verify-docs.js` — deep audit of
  every official Apostrophe API/syntax the skill teaches, against the official
  docs pages AND Apostrophe core source in node_modules; prints its totals.
- `node ~/.claude/skills/apostrophe-cms/tools/lint-apos.js <repo>` — mechanical
  lint (silent no-ops, registration traps, i18n parity).
- `node ~/.claude/skills/apostrophe-cms/tools/slice-map.js <repo> <module>` —
  print a module's slice grouped under the integrator's L-numbers.
Quick syntax lookups: `CHEATSHEET.md` (one page).
Run both suites after editing this skill; run verify-docs.js after Apostrophe
upgrades. Human documentation of how this skill works and is maintained:
`GUIDE.md` (not auto-loaded).

# apostrophe-cms: a self-verifying Claude Code skill for ApostropheCMS

A skill + agent team for working in [ApostropheCMS](https://apostrophecms.com)
3.x/4.x projects with Claude Code: module and schema patterns, all 26 field
types and their traps, relationships and the silent failures around
projections, fragments and templating, i18n and multi-locale sites, widget
players and vite bundles, AJAX endpoints, media (images, attachments, video),
editor-controlled design (global styles, widget styles, layout widgets),
draft/publish and editorial workflow, admin-UI (modals, admin bar, `ui/apos`
Vue), and SCSS placement, plus two mechanical tools and seven specialist
subagents.

Its bias is toward the things that **fail silently**: an option that isn't real,
a projection that drops a field, a `required` that isn't enforced server-side, a
hook nothing consumes, a cascade whose key is shadowed. Those cost hours and
produce no error message.

## What the agent team is for

Getting Apostrophe code working is usually not a writing problem, it is an
**iteration** problem. Code that puts `project:` at the wrong nesting level,
defines `load()` where it replaces the one doing the joining, or emits a hook
nothing consumes will boot cleanly and render a page. It just won't do what you
asked. There is no error. You find out by running it, noticing the image is
missing or the filter does nothing, going back, and repeating. That loop is most
of the real cost of the work, and an assistant that only writes code doesn't
remove that loop. It feeds it.

This skill splits the work the way the framework is actually layered (backend,
templates, browser JS, SCSS, admin UI) and makes each specialist hand the next
one an **explicit contract**: the data shape it produces, the DOM hooks it emits,
the class names it expects. Subagents share no memory, so that note is the only
wire between them, which forces the contract to be written down instead of
assumed.

Then two read-only verifiers check the seams rather than the prose:

- the **integrator** traces one feature end to end, from registration through
  relationships, template data, DOM hooks and the endpoint to the CSS, and
  confirms every link actually connects, against a running site rather than by
  reading;
- the **reviewer** audits the diff against the failure patterns that don't
  announce themselves.

The aim is a handoff you can use, not a draft you debug into existence.

**It does not always get there on the first pass, and the design assumes that.**
In the run that produced this skill's own test fixture, the producing agents
shipped a form endpoint that 404'd on every submission, because page-type modules
mount their API routes under a prefix almost nobody expects. Static review missed
it; the integrator caught it with a live request as evidence, and the trap is now
documented in `references/frontend-backend-flow.md`. That is the intended shape:
plausible-looking code is the normal failure mode, so the verification layer is
not optional polish. It is the part that makes the output trustworthy.

**What makes it different: it tests itself.**

- `tests/verify-docs.js` pins every official API/syntax claim against the
  official docs pages **and Apostrophe core source** in `node_modules`. Run it
  after an Apostrophe upgrade and it tells you exactly which claims moved.
- `tests/verify.js` pins the skill's own integrity: the reference router, agent
  definitions, tool parseability, portability, and that **every citation
  resolves** (no pointer to a reference file or numbered trap that doesn't
  exist). It also runs generic sanity checks on any Apostrophe repo you point it
  at.
- `tools/lint-apos.js` mechanically catches the traps that look right and
  aren't: `deferred: true` (not a real option), relationship `project:`
  outside `builders:` (silently ignored), unregistered modules, bundle keys
  matching no `ui/src` file, i18n locale-parity gaps, unguarded `_field[0]`, and
  a multi-locale site that ships no visitor-facing language switcher.

## Quick start

```bash
git clone <this-repo> ~/.claude/skills/apostrophe-cms
for f in ~/.claude/skills/apostrophe-cms/agents/*.md; do
    ln -s "$f" ~/.claude/agents/"$(basename "$f")"
done
# fresh Claude Code session, then verify:
node ~/.claude/skills/apostrophe-cms/tests/verify.js
node ~/.claude/skills/apostrophe-cms/tests/verify-docs.js
```

## What's in the box

| Piece | What it is |
|---|---|
| `SKILL.md` | The skill entry point agents load: hard rules, convention-discovery step, reference router, common-mistakes table. |
| `CHEATSHEET.md` | One-page syntax reference for quick lookups. |
| `GUIDE.md` | The human manual: install, how the agents cooperate, maintenance workflow. |
| `CHANGELOG.md` | What changed and which field test taught it. |
| `references/` | Thirteen deep-dive references (below) loaded on demand, per task. |
| `agents/` | Seven specialist subagent definitions (below). |
| `tools/` | Two mechanical analyzers runnable on any Apostrophe repo (below). |
| `tests/` | The self-verification suites (below). |

### References (loaded per task, routed from SKILL.md)

| Reference | Covers |
|---|---|
| `module-anatomy.md` | Widgets, pieces, piece-pages, page types, services, schema fields, rich-text configuration. |
| `relationships.md` | Joining doc types, `_fields`, reverse/nested relationships, projections and their traps. |
| `frontend-backend-flow.md` | AJAX endpoints, `apiRoutes`/`renderRoutes`, route mounting (incl. the page-type action trap), server→browser data. |
| `templating-fragments.md` | Fragments vs macros, `__t()` i18n, areas, template conventions. |
| `client-js.md` | Widget players, `ui/src` entries, vite bundles, Alpine/htmx decisions, scoping. |
| `services-and-data.md` | External APIs, caching, Mongo access, settings. |
| `globals-config-and-scoping.md` | Config layers, the global doc, `req.data`, window vs shared vs player JS. |
| `mechanisms-and-ops.md` | CLI tasks, event handlers, async components, seeding, admin-UI customization, images, errors, deployment (incl. `release-id`). |
| `schema-fields.md` | All 26 field types, cross-cutting field options, and the field traps (server-side `required`, conditional-field resets, array `limit` vs `max`). |
| `styles-and-layout.md` | Editor-controlled design: global styles, widget styles, layout/column widgets and the gap system. |
| `media.md` | Images, attachments, files, video/oembed, uploadfs, image sizes, crop vs focal point. |
| `editorial-workflow.md` | Draft/publish, roles, submitted drafts, `apos.notify`, keyboard commands, archive vs delete. |
| `examples.md` | Copy-paste cookbook: a working starting point for every element type. |

### The seven agents

Five **producers**, each scoped to one layer and emitting a handoff note (its
data/DOM/class contract) for the next:

| Agent | Layer | Writes |
|---|---|---|
| `apostrophe-backend` | Modules, pieces, piece-pages, schemas, relationships, endpoints (server half), tasks, caching | `modules/*/index.js` |
| `apostrophe-templates` | Nunjucks: fragments, widget/page/piece templates, areas, i18n keys | `views/**`, `modules/**/views/**` |
| `apostrophe-frontend` | Widget players, `ui/src` browser JS, vite bundles, AJAX calls from the browser | `modules/*/ui/src/*.js` |
| `apostrophe-design` | SCSS partials, the global cascade, responsive/visual design | `**/*.scss` |
| `apostrophe-admin-ui` | Admin bar, modals, `ui/apos` Vue components, icons, launcher registries | `modules/*/ui/apos/**` |

Two read-only **verifiers**:

| Agent | Checks |
|---|---|
| `apostrophe-integrator` | Traces a feature's full vertical slice (registration → relationships → backend→template data → DOM hooks → JS→endpoint/bundling → SCSS classes) and reports each link LINKED or BROKEN, with live-boot evidence. |
| `apostrophe-reviewer` | Audits a diff/module against the hard rules and the known silent-failure defect patterns; verdict APPROVE / APPROVE-WITH-NITS / REQUEST-CHANGES. |

Recommended pipeline for cross-layer features: **backend → templates →
frontend + design in parallel → integrator → reviewer**, pasting each agent's
handoff note **verbatim** into the next agent's prompt. Subagents share no
context, so that note is the contract (see *What the agent team is for* above).
Admin-facing work swaps the middle: backend → admin-ui.

In field tests this pipeline built complete multi-locale sites end to end, and
the integrator has repeatedly caught cross-layer bugs the producing chain let
through. Dispatching an agent for a single-layer touch-up is overhead. The
value is in the handoffs and the verification, not in the delegation itself.

### Tools

| Tool | What it does |
|---|---|
| `tools/lint-apos.js <repo>` | Mechanical lint for the silent-failure traps listed above; safe to run on any Apostrophe repo, no boot required. |
| `tools/slice-map.js <repo> <module>` | Prints a module's full vertical slice grouped by the integrator's link numbers (registration → relationships → templates → DOM hooks → bundles/players → SCSS), plus i18n-parity rows. |

### Tests

| Suite | What it pins |
|---|---|
| `tests/verify.js` | The skill's own integrity: reference router targets exist, every citation resolves (no pointer to a missing reference file or a missing numbered trap), agent frontmatter parses, tools parse, sanitization pins hold; plus generic sanity checks on any repo path you pass as an argument. |
| `tests/verify-docs.js` | Every official API/syntax claim the skill teaches, checked against the official docs pages and Apostrophe core source (set `APOS_CORE_PATH` or run near a `node_modules/apostrophe`). |

## Provenance

The patterns were mined from production Apostrophe codebases, adversarially
audited, and verified against Apostrophe core (4.22–4.32). This public edition
contains no project-identifying material. Everything is either
official-docs/core-verified or framed as a convention to discover in the repo
you're working in (which is itself the skill's core rule: imitate the
codebase, not memory). `verify.js` enforces that with sanitization pins.

## License

MIT

# apostrophe-cms — a self-verifying Claude Code skill for ApostropheCMS

A skill + agent team for working in [ApostropheCMS](https://apostrophecms.com)
3.x/4.x projects with Claude Code: schema/module patterns, relationships and
their silent-failure traps, fragments/templating, widget players and vite
bundles, AJAX endpoints, admin-UI (modals, admin bar, `ui/apos` Vue), rich-text
configuration, SCSS placement — plus two mechanical tools and seven specialist
subagents.

**What makes it different: it tests itself.**

- `tests/verify-docs.js` pins every official API/syntax claim against the
  official docs pages **and Apostrophe core source** in `node_modules` — run it
  after an Apostrophe upgrade and it tells you exactly which claims moved.
- `tests/verify.js` pins the skill's own integrity (reference router, agent
  definitions, tool parseability, portability) and runs generic sanity checks
  on any Apostrophe repo you point it at.
- `tools/lint-apos.js` mechanically catches the traps that look right and
  aren't: `deferred: true` (not a real option), relationship `project:`
  outside `builders:` (silently ignored), unregistered modules, bundle keys
  matching no `ui/src` file, i18n locale-parity gaps, unguarded `_field[0]`.

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
| `references/` | Nine deep-dive references (below) loaded on demand, per task. |
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
handoff note verbatim into the next agent's prompt (subagents share no
context). Admin-facing work swaps the middle: backend → admin-ui. In field
tests this pipeline built complete multi-locale sites, and the integrator has
repeatedly caught real cross-layer bugs the producer chain missed.

### Tools

| Tool | What it does |
|---|---|
| `tools/lint-apos.js <repo>` | Mechanical lint for the silent-failure traps listed above; safe to run on any Apostrophe repo, no boot required. |
| `tools/slice-map.js <repo> <module>` | Prints a module's full vertical slice grouped by the integrator's link numbers (registration → relationships → templates → DOM hooks → bundles/players → SCSS), plus i18n-parity rows. |

### Tests

| Suite | What it pins |
|---|---|
| `tests/verify.js` | The skill's own integrity: reference router targets exist, agent frontmatter parses, tools parse, sanitization pins hold; plus generic sanity checks on any repo path you pass as an argument. |
| `tests/verify-docs.js` | Every official API/syntax claim the skill teaches, checked against the official docs pages and Apostrophe core source (set `APOS_CORE_PATH` or run near a `node_modules/apostrophe`). |

## Provenance

The patterns were mined from production Apostrophe codebases, adversarially
audited, and verified against Apostrophe core (4.22–4.32). This public edition
contains no project-identifying material — everything is either
official-docs/core-verified or framed as a convention to discover in the repo
you're working in (which is itself the skill's core rule: imitate the
codebase, not memory). `verify.js` enforces that with sanitization pins.

## License

MIT

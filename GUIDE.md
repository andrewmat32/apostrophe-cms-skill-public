# apostrophe-cms skill — guide

Human documentation: what this skill is, how to install and verify it, and how
to maintain it. (Not auto-loaded; `SKILL.md` is the entry point agents read.)

## 1. What it is

A Claude Code skill for ApostropheCMS 3.x/4.x work: a rule set + reference
library + two mechanical tools + seven specialist subagents. Its distinguishing
feature is that it is **self-verifying**: every official API/syntax claim is
pinned by `tests/verify-docs.js` against the official docs AND Apostrophe core
source, and the skill's own structure (router targets, agent definitions,
portability) is pinned by `tests/verify.js`. Green means current; red tells you
exactly what moved.

The content was mined from production Apostrophe codebases and then
adversarially audited; project-identifying material was removed for this public
edition — what remains is either official-docs/core-verified or stated as a
convention to discover per repo.

## 2. Install

1. Clone/copy this folder to `~/.claude/skills/apostrophe-cms/` (or a
   project's `.claude/skills/apostrophe-cms/`).
2. **Link the agents**: symlink each `agents/*.md` into `~/.claude/agents/`:
   ```bash
   for f in ~/.claude/skills/apostrophe-cms/agents/*.md; do
       ln -s "$f" ~/.claude/agents/"$(basename "$f")"
   done
   ```
   Agents register at session start — start a fresh session after linking.
3. Run the suites (§4) to confirm everything is green on your machine.

## 3. The seven specialist agents

| Agent | Owns | Refuses (hands off) |
|---|---|---|
| `apostrophe-backend` | module `index.js` files: pieces/pages/widgets server side, services, schemas/relationships, endpoints, handlers, tasks, registration, config | templates, `ui/src`, `ui/apos`, SCSS |
| `apostrophe-frontend` | players, `ui/src` entries, vite bundles, interactivity-tier choice, browser AJAX, window/scoping discipline (public site only) | module logic, templates, SCSS, `ui/apos` admin UI |
| `apostrophe-templates` | Nunjucks/fragments/areas/layouts (incl. `views/layout.html`), i18n keys, filters/helpers, theme-aware imports | server logic, browser JS, SCSS |
| `apostrophe-design` | SCSS partials + cascade placement, theme files/`data-theme` scoping, visual polish (loads `frontend-design` when available) | markup structure, JS, server |
| `apostrophe-admin-ui` | `ui/apos` Vue components (AposModal tool managers, config panels), `apos.modal.add`/`apos.adminBar.add`/`icons` wiring, plugin-launcher registries, admin browser data, secret-field UX | module business logic/routes, public `ui/src`, templates, site SCSS |
| `apostrophe-integrator` *(verifier, read-only)* | traces a feature's full vertical slice and verifies the six handoff links L1–L6; verdict SLICE LINKED/BROKEN with file:line evidence and the responsible layer | editing anything |
| `apostrophe-reviewer` *(verifier, read-only)* | audits new/changed code against the hard rules and the silent-failure defect patterns, severity-ranked; verdict APPROVE / APPROVE-WITH-NITS / REQUEST-CHANGES | editing anything; flagging documented legacy precedent as new findings |

Coordination: agents share no context — they exchange explicit **handoff
notes** (data contracts, DOM hooks, class names, endpoint shapes). Flow:
backend → templates → frontend + design in parallel → integrator → reviewer.
Admin-facing features: backend → admin-ui → reviewer. For single-layer
touch-ups, work inline; an agent per one-line change is overhead.

## 4. Verification

- `node tests/verify.js` — generic checks on any project you point it at
  (args, `APOS_SKILL_REPOS`, or cwd), skill-integrity checks (router, agents,
  tools, portability + sanitization pins), and quick official-docs checks
  (`--offline` to skip).
- `node tests/verify-docs.js` — the deep official audit: every API/syntax
  element the skill teaches, checked against the official docs pages and
  against Apostrophe core source (`APOS_CORE_PATH` to pin a specific core;
  otherwise it walks up from cwd).
- `node tools/lint-apos.js <repo>` — mechanical lint for any Apostrophe repo:
  silent no-ops (E1 `deferred:`, E2 projection-outside-builders),
  registration traps (E3–E5), i18n parity (E6), relative imports (E7),
  unguarded `_field[0]` (W1), orphan SCSS partials (W2), unlaundered
  `req.body` (I1).
- `node tools/slice-map.js <repo> <module>` — prints a module's vertical slice
  grouped under the integrator's L-numbers.

Run both suites after editing the skill; run verify-docs after Apostrophe
upgrades.

## 5. Extending & maintaining

- **Editing a rule or claim**: verify the change against real code/official
  docs first, then pin it as a check in the right test section. Never edit
  without re-running both suites.
- **Adding house conventions for YOUR workspace**: add a
  `project-differences.md` appendix of your own under `references/`,
  documenting your repos' conventions and known defects, route it from
  `SKILL.md`, and add repo-claim checks to `verify.js` (pass your repo paths).
  The internal edition this skill was derived from works exactly that way.
  (No such file ships here — this is a suggestion, not a missing file.)
- **Known limits**: depth follows the official docs plus the mined patterns —
  areas with thin production precedent (headless REST consumption, roles
  beyond admin-gating, programmatic migrations, `@apostrophecms/job`) fall
  back to the official docs. Assumes the Vite-era asset pipeline. Admin-UI
  (`ui/apos`) slices sit outside the integrator's L1–L6 and the tools' scan
  scope — verification there is the admin-ui agent's output contract plus the
  reviewer.

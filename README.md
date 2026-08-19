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

Entry point for agents: `SKILL.md`. One-page syntax reference:
`CHEATSHEET.md`. Human manual (install, agents, maintenance): `GUIDE.md`.
Copy-paste cookbook for every element type: `references/examples.md`.

## Provenance

The patterns were mined from production Apostrophe codebases, adversarially
audited, and verified against Apostrophe core (4.22–4.32). This public edition
contains no project-identifying material — everything is either
official-docs/core-verified or framed as a convention to discover in the repo
you're working in (which is itself the skill's core rule: imitate the
codebase, not memory). `verify.js` enforces that with sanitization pins.

## License

MIT

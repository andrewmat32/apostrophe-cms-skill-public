# apostrophe-cms skill (public edition) — changelog

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

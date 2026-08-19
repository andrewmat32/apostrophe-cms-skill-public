#!/usr/bin/env node
/**
 * Verification test for the apostrophe-cms skill (public edition).
 *
 * Layers:
 *   1. GENERIC checks — run against ANY ApostropheCMS project (pass paths as
 *      args, set APOS_SKILL_REPOS, or run from inside a project).
 *   2. SKILL-INTEGRITY checks — the skill's own files: router targets exist,
 *      agents valid + registered, verifiers read-only, tools parse, and the
 *      doc surface stays portable (no machine paths, no private-codebase
 *      references).
 *   3. OFFICIAL-DOCS checks — the syntax the skill teaches must match the
 *      official documentation (skip with --offline).
 *
 * Usage:
 *   node verify.js                          # cwd project (if any) + integrity + docs
 *   node verify.js /path/to/any/apos/repo   # add any Apostrophe project
 *   node verify.js --offline                # skip official docs checks
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isApostropheRepo(p) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
        return !!((pkg.dependencies && pkg.dependencies.apostrophe) || (pkg.devDependencies && pkg.devDependencies.apostrophe));
    } catch (e) { return false; }
}

const args = process.argv.slice(2).filter(a => a !== '--offline');
const offline = process.argv.includes('--offline');
const envRepos = (process.env.APOS_SKILL_REPOS || '').split(path.delimiter).filter(Boolean);
const cwdRepo = isApostropheRepo(process.cwd()) ? [process.cwd()] : [];
const projects = [...new Set([...args, ...envRepos, ...cwdRepo])].filter(p => fs.existsSync(p));

let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok    ${name}`); }
    else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function skipCheck(name, why) { skip++; console.log(`  skip  ${name} (${why})`); }

function fileContains(file, pattern) {
    try {
        const src = fs.readFileSync(file, 'utf8');
        return pattern instanceof RegExp ? pattern.test(src) : src.includes(pattern);
    } catch (e) { return false; }
}
function grepRepo(dir, pattern, glob) {
    try {
        const out = execSync(
            `grep -rl ${JSON.stringify(pattern)} ${JSON.stringify(dir)} --include=${JSON.stringify(glob)} 2>/dev/null | grep -v node_modules | grep -v apos-build | head -1`,
            { encoding: 'utf8' }
        ).trim();
        return out.length > 0;
    } catch (e) { return false; }
}
function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

/* ============ Layer 1: generic checks (any Apostrophe project) ============ */
function genericChecks(p) {
    const name = path.basename(p);
    console.log(`\n-- ${name}: generic Apostrophe checks --`);

    const pkg = readJson(`${p}/package.json`);
    const dep = pkg && ((pkg.dependencies && pkg.dependencies.apostrophe) || (pkg.devDependencies && pkg.devDependencies.apostrophe));
    check(`${name}: package.json declares an apostrophe dependency`, !!dep, 'not an Apostrophe project?');
    if (!dep) return false;

    check(`${name}: apostrophe is 3.x/4.x (skill does not cover A2)`, /^[\^~]?[34]\./.test(dep), `found ${dep}`);
    check(`${name}: app.js boots apostrophe`, fileContains(`${p}/app.js`, /apostrophe\s*\(/));
    check(`${name}: modules/ directory exists`, fs.existsSync(`${p}/modules`));

    const esm = pkg.type === 'module';
    if (esm) {
        check(`${name}: ESM modules use export default`, grepRepo(`${p}/modules`, 'export default', '*.js'));
    } else {
        check(`${name}: CJS modules use module.exports`, grepRepo(`${p}/modules`, 'module.exports', '*.js'));
    }

    // No A2 idioms anywhere (the skill's "never A2" rule)
    check(`${name}: no A2 construct() idiom`, !grepRepo(`${p}/modules`, 'construct: function', '*.js'));
    check(`${name}: no A2 apos.define idiom`, !grepRepo(`${p}/modules`, 'apos.define(', '*.js'));

    // Conditional generic conventions — only asserted when the feature is present
    if (fs.existsSync(`${p}/views/fragments`)) {
        check(`${name}: fragments are called with {% render %}`,
            grepRepo(`${p}/views`, '{% render ', '*.html') || grepRepo(`${p}/modules`, '{% render ', '*.html'));
        check(`${name}: fragment files use {% fragment %}`,
            grepRepo(`${p}/views/fragments`, '{% fragment', '*.html'));
    } else {
        skipCheck(`${name}: fragment conventions`, 'no views/fragments');
    }

    const hasPlayers = grepRepo(`${p}/modules`, 'widgetPlayers', '*.js');
    if (hasPlayers) {
        check(`${name}: players registered via apos.util.widgetPlayers`,
            grepRepo(`${p}/modules`, 'apos.util.widgetPlayers', '*.js'), 'widgetPlayers referenced but never via apos.util.widgetPlayers');
    } else {
        skipCheck(`${name}: widget player conventions`, 'no widgetPlayers usage found');
    }
    return true;
}

/* ============ Layer 2: skill-integrity checks ============ */
function skillIntegrityChecks() {
    console.log('\n-- skill integrity: files, agents, router targets, portability --');
    const SKILL = path.join(__dirname, '..');
    const read = f => { try { return fs.readFileSync(path.join(SKILL, f), 'utf8'); } catch (e) { return null; } };
    const skillMd = read('SKILL.md') || '';

    // Every references/*.md mentioned by SKILL.md's router actually exists
    const routed = [ ...new Set([ ...skillMd.matchAll(/references\/[\w-]+\.md/g) ].map(m => m[0])) ];
    check('integrity: SKILL.md routes to at least 8 reference files', routed.length >= 8);
    for (const r of routed) {
        check(`integrity: routed file exists — ${r}`, fs.existsSync(path.join(SKILL, r)));
    }
    // No orphaned references (files the router never mentions)
    const refFiles = fs.readdirSync(path.join(SKILL, 'references')).filter(f => f.endsWith('.md'));
    for (const f of refFiles) {
        check(`integrity: references/${f} is reachable from SKILL.md`, skillMd.includes(`references/${f}`));
    }

    // Seven agent definitions with valid frontmatter
    const agents = [ 'apostrophe-backend', 'apostrophe-frontend', 'apostrophe-templates', 'apostrophe-design', 'apostrophe-admin-ui', 'apostrophe-integrator', 'apostrophe-reviewer' ];
    for (const a of agents) {
        const src = read(`agents/${a}.md`);
        const fm = src && src.startsWith('---\n') ? src.slice(4, src.indexOf('\n---', 4)) : '';
        check(`integrity: agents/${a}.md has frontmatter name+description`,
            /(^|\n)name:\s*\S/.test(fm) && /(^|\n)description:\s*\S/.test(fm) && fm.includes(`name: ${a}`));
    }
    // Registration links are an INSTALL step, not a repo invariant — report, don't fail
    for (const a of agents) {
        const link = path.join(process.env.HOME || '', '.claude', 'agents', `${a}.md`);
        if (fs.existsSync(link)) { pass++; console.log(`  ok    install: ~/.claude/agents/${a}.md registered`); }
        else skipCheck(`install: ~/.claude/agents/${a}.md`, 'not symlinked on this machine — see GUIDE install step');
    }
    // Verifiers must stay read-only
    for (const v of [ 'apostrophe-integrator', 'apostrophe-reviewer' ]) {
        const src = read(`agents/${v}.md`) || '';
        check(`integrity: ${v} tools stay read-only (Read, Bash)`, /tools:\s*Read,\s*Bash/.test(src));
    }

    // Tools exist and parse
    for (const t of [ 'tools/lint-apos.js', 'tools/slice-map.js' ]) {
        check(`integrity: ${t} exists`, fs.existsSync(path.join(SKILL, t)));
        try {
            execSync(`node --check ${path.join(SKILL, t)}`, { stdio: 'pipe' });
            check(`integrity: ${t} parses (node --check)`, true);
        } catch (e) { check(`integrity: ${t} parses (node --check)`, false, String(e.message).slice(0, 120)); }
    }
    check('integrity: CHEATSHEET.md exists', fs.existsSync(path.join(SKILL, 'CHEATSHEET.md')));
    check('integrity: CHANGELOG.md exists', fs.existsSync(path.join(SKILL, 'CHANGELOG.md')));

    // Portability + sanitization pins — the FULL doc surface
    const agentFiles = fs.readdirSync(path.join(SKILL, 'agents')).filter(f => f.endsWith('.md')).map(f => `agents/${f}`);
    const docSurface = [ 'SKILL.md', 'GUIDE.md', 'CHEATSHEET.md', 'CHANGELOG.md', 'README.md',
        ...refFiles.map(f => `references/${f}`), ...agentFiles ];
    // Names of the private codebases the internal edition was mined from must
    // never appear in the public edition.
    const PRIVATE = /dw4|wedive|minisite|gloobus|victoury|\bVCT\b|ajaxhandler|theme-registry-family/i;
    for (const f of docSurface) {
        const src = read(f);
        if (src === null) { skipCheck(`integrity: ${f}`, 'absent'); continue; }
        check(`integrity: no /home/<user> absolute paths in ${f}`, !/\/home\/\w+\//.test(src));
        check(`integrity: no private-codebase references in ${f}`, !PRIVATE.test(src),
            (src.match(PRIVATE) || [])[0]);
    }
    for (const f of [ 'tools/lint-apos.js', 'tools/slice-map.js', 'tests/verify-docs.js' ]) {
        const src = read(f) || '';
        check(`integrity: no private-codebase references in ${f}`, !PRIVATE.test(src), (src.match(PRIVATE) || [])[0]);
    }
}

/* ============ Layer 3: official docs ============ */
async function fetchText(url) {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.text();
}
async function docsChecks() {
    console.log('\n== Official ApostropheCMS docs checks ==\n');
    const pages = {
        fragments: 'https://apostrophecms.com/docs/guide/fragments.html',
        widgets: 'https://apostrophecms.com/docs/guide/custom-widgets.html',
        moduleOverview: 'https://apostrophecms.com/docs/reference/module-api/module-overview.html',
        frontEnd: 'https://apostrophecms.com/docs/guide/front-end-assets.html'
    };
    const html = {};
    for (const [key, url] of Object.entries(pages)) {
        try { html[key] = await fetchText(url); }
        catch (e) { check(`fetch official docs page: ${key}`, false, e.message); html[key] = ''; }
    }
    check('docs: {% fragment %} tag', /\{%\s*fragment/.test(html.fragments));
    check('docs: {% render %} call', /\{%\s*render/.test(html.fragments));
    check('docs: {% endfragment %}', html.fragments.includes('{% endfragment %}'));
    check('docs: rendercall block-passing', /rendercall/i.test(html.fragments));
    check('docs: fragments vs macros discussed', /macro/i.test(html.fragments));
    check('docs: apos.util.widgetPlayers', html.widgets.includes('widgetPlayers') || html.frontEnd.includes('widgetPlayers'));
    check('docs: jsonAttribute filter', html.widgets.includes('jsonAttribute') || html.frontEnd.includes('jsonAttribute'));
    check('docs: @apostrophecms/widget-type', html.widgets.includes('@apostrophecms/widget-type'));
    check('docs: methods(self)', /methods\s*\(\s*self\s*\)/.test(html.moduleOverview) || html.moduleOverview.includes('methods(self)'));
    check('docs: apiRoutes', /apiRoutes/.test(html.moduleOverview));
    check('docs: extendMethods', /extendMethods/.test(html.moduleOverview));
    check('docs: options.alias', /alias/.test(html.moduleOverview));
    check('docs: fields schema', /fields/.test(html.moduleOverview));
}

/* ============ run ============ */
(async () => {
    console.log(`Projects under test: ${projects.map(p => path.basename(p)).join(', ') || '(none — integrity + docs only)'}`);
    for (const p of projects) genericChecks(p);
    skillIntegrityChecks();
    if (!offline) await docsChecks(); else console.log('\n(offline: docs checks skipped)');
    console.log(`\n=== ${pass} passed, ${fail} failed, ${skip} skipped ===`);
    if (failures.length) {
        console.log('Failures:');
        failures.forEach(f => console.log('  - ' + f));
        process.exit(1);
    }
})();

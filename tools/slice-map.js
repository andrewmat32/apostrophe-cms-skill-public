#!/usr/bin/env node
/**
 * slice-map — print a module's full vertical slice (schema → backend → templates
 * → browser JS → SCSS → i18n) so a human or the apostrophe-integrator agent can
 * see every layer and handoff at a glance.
 *
 * The L-numbers printed here are FILE-INVENTORY rows grouped under the same
 * numbering the integrator agent uses for its contract links (L1 registration,
 * L2 relationships, L3 templates, L4 DOM hooks, L5 browser JS/bundles, L6 SCSS),
 * plus L-backend (module sections) and L-i18n (key parity) rows that feed the
 * integrator's L1/L3 evidence.
 *
 * Usage: node slice-map.js <repoPath> <module-name>
 *        node slice-map.js ~/my-project blog-widget
 */
const fs = require('fs');
const path = require('path');

const [ , , repoArg, modName ] = process.argv;
if (!repoArg || !modName) {
    console.error('Usage: node slice-map.js <repoPath> <module-name>');
    process.exit(2);
}
const REPO = path.resolve(repoArg);
function isAposRepo(p) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
        return !!((pkg.dependencies || {}).apostrophe || (pkg.devDependencies || {}).apostrophe);
    } catch (e) { return false; }
}
if (!isAposRepo(REPO)) {
    console.error(`Not an Apostrophe repo (missing path or no apostrophe dependency): ${REPO}`);
    process.exit(2);
}
const SKIP = new Set([ 'node_modules', 'apos-build', 'public', '.git', 'data', 'localize-work' ]);

function* walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
        if (e.isDirectory()) { if (!SKIP.has(e.name)) yield* walk(path.join(dir, e.name)); }
        else yield path.join(dir, e.name);
    }
}
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const rel = f => path.relative(REPO, f);

/* Length-preserving blank-out of JS comments and string contents, so brace
 * matching can't be fooled by `}` inside strings; names/lines read from the
 * original. Same helpers as lint-apos.js. */
function blank(src) {
    const out = src.split('');
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        const c2 = src[i + 1];
        if (c === '/' && c2 === '/') {
            while (i < n && src[i] !== '\n') { out[i] = ' '; i++; }
        } else if (c === '/' && c2 === '*') {
            out[i] = ' '; out[i + 1] = ' '; i += 2;
            while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; }
            if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
        } else if (c === "'" || c === '"' || c === '`') {
            const q = c;
            i++;
            while (i < n && src[i] !== q) {
                if (src[i] === '\\') { out[i] = ' '; i++; if (i < n && src[i] !== '\n') out[i] = ' '; }
                else if (src[i] !== '\n') out[i] = ' ';
                i++;
            }
            i++;
        } else i++;
    }
    return out.join('');
}
function matchBrace(blanked, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < blanked.length; i++) {
        if (blanked[i] === '{') depth++;
        else if (blanked[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
}
function enclosingBlock(blanked, pos) {
    let depth = 0, start = -1;
    for (let i = pos; i >= 0; i--) {
        const c = blanked[i];
        if (c === '}') depth++;
        else if (c === '{') { if (depth === 0) { start = i; break; } depth--; }
    }
    if (start < 0) return null;
    const end = matchBrace(blanked, start);
    if (end < 0) return null;
    return { start, end };
}
function topLevelKeys(original, blanked, openIdx, closeIdx) {
    const keys = [];
    let depth = 0;
    for (let i = openIdx; i <= closeIdx; i++) {
        const c = blanked[i];
        if (c === '{' || c === '[' || c === '(') { depth++; continue; }
        if (c === '}' || c === ']' || c === ')') { depth--; continue; }
        if (depth !== 1) continue;
        // the char must have SURVIVED blanking (not comment/string interior)
        if (!/[\w'"@]/.test(blanked[i])) continue;
        const m = original.slice(i).match(/^['"]?([@\w./-]+)['"]?\s*:/);
        if (m && !/[\w'"@$.]/.test(blanked[i - 1] || '')) {
            keys.push(m[1]);
            i += m[0].length - 1;
        }
    }
    return keys;
}

// 1. Locate the module — ALL matches; duplicates are ambiguous, say so
const matches = [];
for (const f of walk(path.join(REPO, 'modules'))) {
    if (f.endsWith(`${path.sep}${modName}${path.sep}index.js`)) matches.push(path.dirname(f));
}
if (!matches.length) { console.error(`module '${modName}' not found under ${REPO}/modules`); process.exit(1); }
const modDir = matches[0];
const src = read(path.join(modDir, 'index.js'));
const bsrc = blank(src);
console.log(`SLICE MAP — ${modName}  (${rel(modDir)})\n`);
if (matches.length > 1) {
    console.log(`  NOTE        ${matches.length} module dirs share this name (${matches.map(rel).join(', ')}) — mapping the first; Apostrophe registers by name, so duplicates collide`);
}

// 2. Backend layer
const extend = (src.match(/extend:\s*['"]([^'"]+)['"]/) || [])[1] || '(none — plain module)';
const sections = [ 'fields', 'methods', 'extendMethods', 'apiRoutes', 'routes', 'renderRoutes', 'handlers', 'components', 'helpers', 'tasks', 'queries', 'icons', 'init', 'middleware' ]
    .filter(s => new RegExp(`(^|[\\s,{])${s}\\s*[(:]`, 'm').test(bsrc));
console.log(`  L-backend   extend: ${extend}`);
console.log(`  L-backend   sections: ${sections.join(', ') || '(none)'}`);
const alias = (src.match(/alias:\s*['"]([^'"]+)['"]/) || [])[1];
if (alias) console.log(`  L-backend   alias: self.apos.${alias}`);

// 3. Registration — modules/**/modules.js, root modules.js, app.js
let registered = null;
const regFiles = [ ...walk(path.join(REPO, 'modules')) ].filter(f => f.endsWith('modules.js'))
    .concat([ path.join(REPO, 'modules.js'), path.join(REPO, 'app.js') ].filter(f => fs.existsSync(f)));
for (const f of regFiles) {
    const s = read(f);
    if (new RegExp(`['"\`/]${modName}['"\`/]|(^|[\\s{,])${modName}\\s*:`, 'm').test(s)) { registered = rel(f); break; }
}
console.log(`  L1 register ${registered ? 'OK — ' + registered : 'NOT FOUND in any modules.js/app.js  ← module may silently not exist'}`);

// 4. Relationships — field extent via brace matching, project-vs-builders positional
let printedRel = false;
let tm; const tre = /type\s*:\s*['"]relationship(Reverse)?['"]/g;
while ((tm = tre.exec(src))) {
    const block = enclosingBlock(bsrc, tm.index);
    if (!block) continue;
    printedRel = true;
    // field name: identifier immediately before the opening brace
    const head = src.slice(Math.max(0, block.start - 80), block.start);
    const fieldName = (head.match(/([\w$]+)\s*:\s*$/) || [])[1] || '(?)';
    const fieldSrc = src.slice(block.start, block.end + 1);
    const fieldBlank = bsrc.slice(block.start, block.end + 1);
    const withType = (fieldSrc.match(/withType:\s*['"]([^'"]+)['"]/) || [])[1] || '?';
    const bm = fieldBlank.match(/builders\s*:\s*\{/);
    let bStart = -1, bEnd = -1;
    if (bm) { bStart = bm.index + bm[0].length - 1; bEnd = matchBrace(fieldBlank, bStart); }
    let strayProject = false;
    let pm; const pre = /(^|[^\w$])project\s*:/g;
    while ((pm = pre.exec(fieldBlank))) {
        const at = pm.index + pm[1].length;
        if (bStart >= 0 && at > bStart && at < bEnd) continue;
        strayProject = true;
    }
    console.log(`  L2 relation ${fieldName} → ${withType}${tm[1] ? ' (reverse)' : ''}${strayProject ? '  ← project: OUTSIDE builders — IGNORED' : bStart >= 0 ? ' (projected)' : ' (full docs)'}`);
}
if (!printedRel) console.log('  L2 relation (no relationship fields)');

// 5. Templates
const views = fs.existsSync(path.join(modDir, 'views')) ? [ ...walk(path.join(modDir, 'views')) ] : [];
for (const v of views) {
    const s = read(v);
    const imports = [ ...s.matchAll(/\{%[-\s]*(?:import|from)\s+["']([^"']+)["']/g) ].map(m => m[1]);
    const dataAttrs = [ ...s.matchAll(/data-[\w-]+(?=[=\s>/])/g) ].map(m => m[0]);
    console.log(`  L3 template ${rel(v)}${imports.length ? '  imports: ' + [ ...new Set(imports) ].join(', ') : ''}`);
    if (dataAttrs.length) console.log(`  L4 DOM-hook ${[ ...new Set(dataAttrs) ].join(', ')}`);
}
if (!views.length) console.log(`  L3 template (no views/ — ${modName.endsWith('-widget') ? 'MISSING widget.html?' : 'ok for services'})`);

// 6. Browser JS: bundles + ui/src + players
const bundles = [];
let bm2; const bre = /(^|[^\w$])bundles\s*:\s*\{/g;
while ((bm2 = bre.exec(bsrc))) {
    const open = bm2.index + bm2[0].length - 1;
    const close = matchBrace(bsrc, open);
    if (close >= 0) bundles.push(...topLevelKeys(src, bsrc, open, close));
}
const uiSrc = fs.existsSync(path.join(modDir, 'ui')) ? [ ...walk(path.join(modDir, 'ui')) ] : [];
for (const b of bundles) {
    const local = uiSrc.find(f => path.basename(f) === `${b}.js` || path.basename(f) === `${b}.scss`);
    console.log(`  L5 bundle   '${b}' → ${local ? rel(local) : 'NO ui/src/' + b + '.js|.scss in this module  ← bundle silently empty?'}`);
}
for (const f of uiSrc.filter(f => f.endsWith('.js'))) {
    const s = read(f);
    const player = (s.match(/widgetPlayers\.(\w+)/) || [])[1];
    const posts = [ ...s.matchAll(/apos\.http\.(?:post|get)\(\s*['"`]([^'"`]+)['"`]/g) ].map(m => m[1]);
    console.log(`  L5 ui/src   ${rel(f)}${player ? `  player: ${player}` : ''}${posts.length ? '  calls: ' + posts.join(', ') : ''}`);
}
if (!bundles.length && !uiSrc.length) console.log('  L5 browser  (no bundles / ui files in module)');

// 7. SCSS partials elsewhere that look like this module's styles
const base = modName.replace(/-widget$|-page$/, '');
const scssHits = [];
for (const f of walk(path.join(REPO, 'modules'))) {
    if (!f.endsWith('.scss')) continue;
    if (path.basename(f).toLowerCase().includes(base.toLowerCase().replace(/-/g, '_')) || path.basename(f).toLowerCase().includes(base.toLowerCase())) scssHits.push(rel(f));
}
console.log(scssHits.length ? scssHits.map(h => `  L6 scss     ${h}`).join('\n') : '  L6 scss     (no partial matching module name — styles may live in a shared file)');

// 8. i18n keys used in this module's views, checked against every locale JSON
const keys = [ ...new Set(views.flatMap(v => [ ...read(v).matchAll(/__t\(\s*['"]([^'"]+)['"]/g) ].map(m => m[1]))) ];
if (keys.length) {
    const locales = [ ...walk(path.join(REPO, 'modules')) ].filter(f => /i18n[\\/].*\.json$/.test(f));
    const dicts = locales.map(f => ({ f: rel(f), d: (() => { try { return JSON.parse(read(f)); } catch (e) { return {}; } })() }));
    for (const k of keys) {
        const missing = dicts.filter(({ d }) => !(k in d)).map(({ f }) => f);
        console.log(`  L-i18n      '${k}' ${missing.length === 0 ? 'in all locales' : missing.length === dicts.length ? 'MISSING EVERYWHERE' : 'missing in: ' + missing.join(', ')}`);
    }
} else console.log('  L-i18n      (no __t() keys in module views)');

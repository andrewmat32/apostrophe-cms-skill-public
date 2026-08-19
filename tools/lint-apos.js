#!/usr/bin/env node
/**
 * lint-apos — mechanical ApostropheCMS linter for the apostrophe-cms skill.
 *
 * Automates the MECHANICALLY-detectable subset of the skill's rules and
 * known silent-failure defect patterns. Judgment calls (contract mismatches,
 * convention-fit nuance) remain the reviewer agent's job.
 *
 * Checks:
 *   E1  `deferred: true`             — silent no-op (real option: `defer: true`)
 *   E2  relationship `project:` outside `builders:` — silently ignored
 *       (flagged even when a `builders:` block also exists in the same field)
 *   E3  module with code but registered in no modules.js/app.js
 *       (sources: every modules.js under modules/, a root-level modules.js, and the
 *        `modules:` block of app.js; duplicate module dir names get a WARN —
 *        registration is by name, so duplicates are ambiguous to Apostrophe too)
 *   E4  widget-type module without views/widget.html
 *   E5  vite bundle key with no matching ui/src/<key>.js|.scss anywhere
 *   E6  i18n locale JSONs with mismatched key sets (per i18n directory)
 *   E7  relative (non-leading-slash) fragment/macro import — both the
 *       `{% import %}` and `{% from %}` forms (WARN — and silently unthemed
 *       in repos with exact-string theme resolution)
 *   W1  unguarded `._field[0]` (templates without a `| length`-style guard in
 *       the surrounding lines, JS without `?.[0]` / a nearby check).
 *       NOT flagged: a use inside an `{% if %}`/`{% elif %}` tag expression
 *       (the use IS the guard) and the postfix form
 *       `x._f[0] if x._f | length else …` (guard follows the use on the
 *       same line) — both are the house-endorsed guard idioms.
 *   W2  SCSS partial never imported by the global index.scss
 *   I1  file reads `req.body.*` without any laundering
 *
 * Structure detection (brace matching, key scanning) runs on a comment- and
 * string-blanked copy of each source so braces inside strings/comments can't
 * derail it; messages and line numbers always come from the original text.
 *
 * Usage:
 *   node lint-apos.js [repoPath]      (default: cwd)
 *   node lint-apos.js repoPath --errors-only
 * Exit code 1 if any ERROR.
 */
const fs = require('fs');
const path = require('path');

const repo = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.cwd());
const errorsOnly = process.argv.includes('--errors-only');
const SKIP_DIRS = new Set(['node_modules', 'apos-build', 'public', '.git', 'data', 'localize-work', 'apos-build-cache']);
const findings = [];
function add(sev, file, line, rule, msg) { findings.push({ sev, file: path.relative(repo, file), line, rule, msg }); }

function isAposRepo(p) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
        return !!((pkg.dependencies || {}).apostrophe || (pkg.devDependencies || {}).apostrophe);
    } catch (e) { return false; }
}
if (!isAposRepo(repo)) { console.error(`Not an Apostrophe repo (no apostrophe dependency): ${repo}`); process.exit(2); }


function walk(dir, out = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const e of entries) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
        else out.push(path.join(dir, e.name));
    }
    return out;
}
const allFiles = walk(path.join(repo, 'modules')).concat(walk(path.join(repo, 'views')));
const jsFiles = allFiles.filter(f => f.endsWith('.js') && !f.includes(`${path.sep}ui${path.sep}apos${path.sep}`));
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/**
 * Length-preserving blank-out of JS comments and string/template-literal
 * contents. Newlines survive (line numbers stay aligned); delimiters survive
 * (so `'name':` still scans as a quoted key — only the text between quotes is
 * spaced out in the copy used for STRUCTURE; key NAMES are always re-read from
 * the original at the positions structure discovery yields).
 */
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
/** In blanked text, return index of the `}` matching the `{` at openIdx (or -1). */
function matchBrace(blanked, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < blanked.length; i++) {
        if (blanked[i] === '{') depth++;
        else if (blanked[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
}
/** Walk back in blanked text from pos to the `{` opening the enclosing object. */
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
/** Object-key names at DEPTH 1 of the block opened at openIdx (names from original). */
function topLevelKeys(original, blanked, openIdx, closeIdx) {
    const keys = [];
    let depth = 0;
    for (let i = openIdx; i <= closeIdx; i++) {
        const c = blanked[i];
        if (c === '{' || c === '[' || c === '(') { depth++; continue; }
        if (c === '}' || c === ']' || c === ')') { depth--; continue; }
        if (depth !== 1) continue;
        // the char must have SURVIVED blanking (not comment/string interior):
        // bare keys survive as-is; quoted keys keep their quote delimiters.
        // At depth 1 a key looks like  name:  or  'name':  in the ORIGINAL text.
        if (!/[\w'"@]/.test(blanked[i])) continue;
        const m = original.slice(i).match(/^['"]?([@\w./-]+)['"]?\s*:/);
        if (m && !/[\w'"@$.]/.test(blanked[i - 1] || '')) {
            keys.push(m[1]);
            i += m[0].length - 1;
            // consume until the value ends at this depth (next , or closing brace handles itself)
        }
    }
    return keys;
}

// Pre-read + pre-blank each index.js once
const blanked = new Map();
const blankOf = f => { if (!blanked.has(f)) blanked.set(f, blank(read(f))); return blanked.get(f); };

/* ---------- E1: deferred no-op ---------- */
for (const f of jsFiles.filter(f => f.endsWith('index.js'))) {
    const src = read(f);
    const b = blankOf(f);
    let m; const re = /(^|[^\w$])deferred\s*:\s*true/g;
    while ((m = re.exec(b))) add('ERROR', f, lineOf(src, m.index + m[1].length), 'E1', "`deferred: true` is a silent no-op — the real option is `defer: true`");
}

/* ---------- E2: relationship project outside builders ---------- */
for (const f of jsFiles.filter(f => f.endsWith('index.js'))) {
    const src = read(f);
    const b = blankOf(f);
    let m; const re = /type\s*:\s*['"]relationship(Reverse)?['"]/g;
    // regex must run on ORIGINAL (the quoted value is blanked in the copy)
    while ((m = re.exec(src))) {
        const block = enclosingBlock(b, m.index);
        if (!block) continue;
        // builders sub-block extent (if any), located structurally
        const bSlice = b.slice(block.start, block.end + 1);
        const bm = bSlice.match(/builders\s*:\s*\{/);
        let bStart = -1, bEnd = -1;
        if (bm) {
            const open = block.start + bm.index + bm[0].length - 1;
            bStart = open;
            bEnd = matchBrace(b, open);
        }
        // every project: at any depth of the field that is NOT inside builders
        let p; const pre = /(^|[^\w$])project\s*:/g;
        while ((p = pre.exec(bSlice))) {
            const abs = block.start + p.index + p[1].length;
            if (bStart >= 0 && abs > bStart && abs < bEnd) continue; // inside builders — fine
            add('ERROR', f, lineOf(src, abs), 'E2', "relationship `project:` is at field top level — silently IGNORED; move it inside `builders: { project: {...} }`");
        }
    }
}

/* ---------- registration map (E3) ---------- */
const registered = new Set();
const regSources = jsFiles.filter(f => f.endsWith(`${path.sep}modules.js`));
for (const extra of [path.join(repo, 'modules.js'), path.join(repo, 'app.js')]) {
    if (fs.existsSync(extra)) regSources.push(extra);
}
for (const f of regSources) {
    const src = read(f);
    const b = blank(src);
    const isAppJs = path.basename(f) === 'app.js';
    // In app.js only the `modules:` block registers modules — scanning the whole
    // file would sweep in option keys (settings:, categories:, …) and mask E3.
    let scanStart = 0, scanEnd = src.length - 1;
    if (isAppJs) {
        const mm = b.match(/(^|[^\w$])modules\s*:\s*\{/);
        if (!mm) continue;
        scanStart = mm.index + mm[0].length - 1;
        scanEnd = matchBrace(b, scanStart);
        if (scanEnd < 0) continue;
        for (const k of topLevelKeys(src, b, scanStart, scanEnd)) registered.add(k.split('/').pop());
        // quoted keys at ANY depth in the block — catches registrations wrapped in
        // spread ternaries like ...( devMode ? { 'seed-tool': {} } : {} )
        let qm; const qre = /['"]([\w@./-]+)['"]\s*:/g;
        const blockOrig = src.slice(scanStart, scanEnd + 1);
        const blockBlank = b.slice(scanStart, scanEnd + 1);
        while ((qm = qre.exec(blockOrig))) {
            if (/['"]/.test(blockBlank[qm.index])) registered.add(qm[1].split('/').pop());
        }
    } else {
        let m;
        const q = /['"]([\w@./-]+)['"]\s*:/g;                    // 'name': {} / 'services/x': {}
        while ((m = q.exec(src))) registered.add(m[1].split('/').pop());
        const bare = /^[ \t]+([a-zA-Z][\w-]*)\s*:\s*\{/gm;       // bare: {} — any indentation incl. tabs
        while ((m = bare.exec(src))) registered.add(m[1]);
    }
}
const moduleDirsByName = new Map(); // basename -> [dirs] (duplicate names are ambiguous to Apostrophe)
for (const f of jsFiles.filter(f => f.endsWith(`${path.sep}index.js`) && f.includes(`${path.sep}modules${path.sep}`))) {
    if (f.includes(`${path.sep}@apostrophecms${path.sep}`) || f.includes(`${path.sep}@`)) continue; // core overrides auto-apply
    const dir = path.dirname(f);
    if (path.basename(dir) === 'modules') continue;
    const src = read(f);
    if (!/extend:\s*'/.test(src)) continue;               // grouping stubs / optionless helpers
    const name = path.basename(dir);
    if (!moduleDirsByName.has(name)) moduleDirsByName.set(name, []);
    moduleDirsByName.get(name).push(dir);
    if (!registered.has(name)) add('ERROR', f, 1, 'E3', `module '${name}' extends a type but is registered in no modules.js/app.js — it silently does not exist`);
}
for (const [name, dirs] of moduleDirsByName) {
    if (dirs.length > 1) {
        add('WARN', dirs[1] + `${path.sep}index.js`, 1, 'E3', `duplicate module directory name '${name}' (${dirs.map(d => path.relative(repo, d)).join(', ')}) — Apostrophe registers by name, so these collide and registration checks are ambiguous`);
    }
}

/* ---------- E4: widget without widget.html ---------- */
for (const f of jsFiles.filter(f => f.endsWith(`${path.sep}index.js`))) {
    const src = read(f);
    if (!/extend:\s*'@apostrophecms\/widget-type'/.test(src)) continue;
    const views = path.join(path.dirname(f), 'views');
    if (!fs.existsSync(path.join(views, 'widget.html'))) {
        const sev = fs.existsSync(views) ? 'WARN' : 'ERROR';
        add(sev, f, 1, 'E4', `widget-type module has no views/widget.html${sev === 'WARN' ? ' (views/ exists — theme-only templates?)' : ''}`);
    }
}

/* ---------- E5: bundle key vs ui/src filename ---------- */
const uiSrcIndex = new Map(); // bundleName -> owning module dir
for (const f of allFiles.filter(f => /ui[\\/]src[\\/][^\\/]+\.(js|scss)$/.test(f))) {
    uiSrcIndex.set(path.basename(f).replace(/\.(js|scss)$/, ''), path.dirname(f));
}
for (const f of jsFiles.filter(f => f.endsWith(`${path.sep}index.js`))) {
    const src = read(f);
    const b = blankOf(f);
    let bm; const bre = /(^|[^\w$])bundles\s*:\s*\{/g;
    while ((bm = bre.exec(b))) {
        const open = bm.index + bm[0].length - 1;
        const close = matchBrace(b, open);
        if (close < 0) continue;
        for (const key of topLevelKeys(src, b, open, close)) {
            const local = path.join(path.dirname(f), 'ui', 'src');
            if (fs.existsSync(path.join(local, `${key}.js`)) || fs.existsSync(path.join(local, `${key}.scss`))) continue;
            if (uiSrcIndex.has(key)) add('INFO', f, lineOf(src, open), 'E5', `bundle key '${key}' has no local ui/src file — cross-module reference to ${path.relative(repo, uiSrcIndex.get(key))} (ok if intentional)`);
            else add('ERROR', f, lineOf(src, open), 'E5', `bundle key '${key}' matches no ui/src/${key}.js|.scss in any module — bundle silently empty`);
        }
    }
}

/* ---------- E6: i18n key parity (every i18n dir, checked per directory) ---------- */
const i18nDirs = new Map(); // dir -> [locale files]
for (const f of allFiles.filter(f => /[\\/]i18n[\\/][^\\/]+\.json$/.test(f))) {
    const d = path.dirname(f);
    if (!i18nDirs.has(d)) i18nDirs.set(d, []);
    i18nDirs.get(d).push(f);
}
for (const [dir, files] of i18nDirs) {
    if (files.length < 2) continue; // single-locale dir: nothing to compare
    const keysets = {};
    for (const f of files) {
        try { keysets[path.basename(f)] = new Set(Object.keys(JSON.parse(read(f)))); }
        catch (e) { add('ERROR', f, 1, 'E6', 'unparseable locale JSON'); }
    }
    const names = Object.keys(keysets);
    for (let i = 0; i < names.length; i++) for (let j = 0; j < names.length; j++) {
        if (i === j) continue;
        const missing = [...keysets[names[i]]].filter(k => !keysets[names[j]].has(k));
        if (missing.length) add('ERROR', path.join(dir, names[j]), 1, 'E6', `missing ${missing.length} key(s) present in ${names[i]}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`);
    }
}

/* ---------- E7: relative fragment/macro imports (import AND from forms) ---------- */
const relSev = 'WARN';
for (const f of htmlFiles) {
    const src = read(f);
    let m; const re = /\{%[-\s]*(?:import|from)\s+["'](?!\/|@|\.\/)(fragments|macros|components)\//g;
    while ((m = re.exec(src))) {
        add(relSev, f, lineOf(src, m.index), 'E7', `relative '${m[1]}/…' import — use the leading-slash absolute form (in theme-resolver repos a relative import is silently unthemed)`);
    }
}

/* ---------- W1: unguarded _field[0] ---------- */
const GUARD_WINDOW = 10; // lines of preceding context in which a guard counts
for (const f of htmlFiles) {
    const src = read(f);
    const lines = src.split('\n');
    let m; const re = /\._([a-zA-Z][\w]*)\[0\]/g;
    const seen = new Set();
    while ((m = re.exec(src))) {
        const name = m[1];
        const line = lineOf(src, m.index);
        const key = `${name}:${line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // same-line guard idioms — both endorsed by the skill, neither visible
        // to the preceding-window scan:
        //   (a) the use sits inside an {% if %}/{% elif %} tag expression
        //       ({% elif w.linkType == 'page' and w._linkPage[0] %}) — the use IS the guard;
        //   (b) postfix conditional AFTER the use on the same line whose condition
        //       re-tests the field ({% set a = x._f[0] if x._f | length else null %}).
        const lineStart = src.lastIndexOf('\n', m.index) + 1;
        let lineEnd = src.indexOf('\n', m.index);
        if (lineEnd < 0) lineEnd = src.length;
        const tagOpen = src.lastIndexOf('{%', m.index);
        const tagClose = tagOpen >= 0 ? src.indexOf('%}', tagOpen) : -1;
        if (tagOpen >= 0 && tagClose > m.index && /^\{%[-\s]*(el)?if\s/.test(src.slice(tagOpen, m.index))) continue;
        const restOfLine = src.slice(m.index + m[0].length, lineEnd);
        if (new RegExp(`\\sif\\s[^%]*_${name}\\s*(\\|\\s*length|\\[0\\]|\\.length)`).test(restOfLine)) continue;
        // context: the preceding window, TRUNCATED at the use
        // itself so a guard later in the file can't vouch for this occurrence
        const upto = src.slice(0, m.index);
        const winStart = lines.slice(0, Math.max(0, line - 1 - GUARD_WINDOW)).join('\n').length;
        const ctx = upto.slice(winStart);
        const guard = new RegExp(`_${name}\\s*(\\|\\s*length|\\.length|and\\s|&&)|_${name}\\[0\\]\\s*(if|and)|if\\s[^%]*_${name}`, 'g');
        let gm, lastGuardEnd = -1;
        while ((gm = guard.exec(ctx))) lastGuardEnd = gm.index + gm[0].length;
        // a guard only counts if no {% endif %} closed it before the use
        const guarded = lastGuardEnd >= 0 && !/\{%[-\s]*endif/.test(ctx.slice(lastGuardEnd));
        if (!guarded) add('WARN', f, line, 'W1', `unguarded '._${name}[0]' — relationships are arrays; guard with '| length' before indexing`);
    }
}
for (const f of jsFiles) {
    const src = read(f);
    const b = blankOf(f);
    // scan the comment/string-blanked copy so `._field[0]` in a comment can't fire
    let m; const re = /\._([a-zA-Z][\w]*)\[0\]/g;
    const seen = new Set();
    while ((m = re.exec(b))) {
        const before = src.slice(Math.max(0, m.index - 2), m.index + 1);
        if (before.includes('?')) continue; // ?.[0] handled by preceding optional chain — approximate
        const name = m[1];
        const key = `${name}:${lineOf(src, m.index)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ctx = src.slice(Math.max(0, m.index - 300), m.index);
        if (new RegExp(`_${name}(\\?\\.|\\s*&&|\\.length)`).test(ctx)) continue;
        add('WARN', f, lineOf(src, m.index), 'W1', `unguarded '._${name}[0]' in JS — use '?.[0]' or a length check`);
    }
}

/* ---------- W2: SCSS partial not imported ---------- */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const assetRoot of ['modules/asset/ui/src', 'modules/@apostrophecms/asset/ui/src']) {
    const scssIndex = path.join(repo, assetRoot, 'index.scss');
    if (!fs.existsSync(scssIndex)) continue;
    const idx = read(scssIndex);
    for (const f of walk(path.join(repo, assetRoot, 'scss'))) {
        if (!/\/_[^/]+\.scss$/.test(f.replace(/\\/g, '/'))) continue;
        const base = path.basename(f).replace(/^_|\.scss$/g, '');
        if (base === 'template') continue; // theme scaffold, deliberately unimported
        // whole-segment match: `nav` must not be satisfied by `navbar`
        const refd = new RegExp(`(^|[/'"\\s])_?${escapeRe(base)}(['"/\\s;]|$)`, 'm').test(idx);
        if (!refd) add('WARN', f, 1, 'W2', `partial '_${base}.scss' is not referenced by index.scss — it never loads`);
    }
}

/* ---------- I1: req.body without laundering ---------- */
for (const f of jsFiles) {
    const src = read(f);
    if (/req\.body\./.test(src) && !/launder/.test(src)) {
        add('INFO', f, lineOf(src, src.indexOf('req.body.')), 'I1', 'reads req.body without any laundering — prefer self.apos.launder.* on new code');
    }
}

/* ---------- report ---------- */
const order = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);
const counts = { ERROR: 0, WARN: 0, INFO: 0 };
console.log(`lint-apos — ${repo}\n`);
for (const fnd of findings) {
    counts[fnd.sev]++;
    if (errorsOnly && fnd.sev !== 'ERROR') continue;
    console.log(`  ${fnd.sev.padEnd(5)} ${fnd.rule}  ${fnd.file}:${fnd.line}  ${fnd.msg}`);
}
console.log(`\n${counts.ERROR} errors, ${counts.WARN} warnings, ${counts.INFO} info`);
process.exit(counts.ERROR ? 1 : 0);

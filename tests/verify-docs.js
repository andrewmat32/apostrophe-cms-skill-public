#!/usr/bin/env node
/**
 * DEEP official-documentation audit for the apostrophe-cms skill.
 *
 * Validates every Apostrophe API / syntax element taught by SKILL.md, the
 * references (incl. references/examples.md) against:
 *   Part 1: the official docs (apostrophecms.com/docs)
 *   Part 2: Apostrophe CORE SOURCE in a local node_modules (ground truth for
 *           exact behaviors: route-name resolution, defer option, jsonAttribute,
 *           pieceModuleName derivation, the Modules/ vite alias)
 *
 * Project-convention material (route-style choices, data-attribute naming)
 * is deliberately NOT asserted against docs — the skill labels those as
 * conventions to discover per repo.
 *
 * Run:  node ~/.claude/skills/apostrophe-cms/tests/verify-docs.js
 */
const fs = require('fs');

/**
 * Locate Apostrophe core source (location-agnostic):
 *   1. APOS_CORE_PATH env var (a node_modules/apostrophe dir).
 *   2. Walk upward from cwd looking for node_modules/apostrophe.
 */
const path = require('path');
function findCore() {
    if (process.env.APOS_CORE_PATH && fs.existsSync(process.env.APOS_CORE_PATH)) return process.env.APOS_CORE_PATH;
    let dir = process.cwd();
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, 'node_modules', 'apostrophe');
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined;
}
const CORE = findCore();

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok    ${name}`); }
    else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function coreContains(rel, pattern) {
    try {
        const src = fs.readFileSync(`${CORE}/${rel}`, 'utf8');
        return pattern instanceof RegExp ? pattern.test(src) : src.includes(pattern);
    } catch (e) { return false; }
}

const PAGES = {
    pieces: 'guide/pieces',
    piecePages: 'guide/piece-pages',
    pages: 'guide/pages',
    areas: 'guide/areas-and-widgets',
    relationships: 'guide/relationships',
    relField: 'reference/field-types/relationship',
    areaField: 'reference/field-types/area',
    selectField: 'reference/field-types/select',
    asyncComponents: 'guide/async-components',
    caching: 'guide/caching',
    i18nStatic: 'guide/localization/static',
    i18nDynamic: 'guide/localization/dynamic',
    moduleOverview: 'reference/module-api/module-overview',
    moduleOptions: 'reference/module-api/module-options',
    frontEnd: 'guide/front-end-assets',
    widgets: 'guide/custom-widgets',
    fragments: 'guide/fragments',
    media: 'guide/media',
    imageMod: 'reference/modules/image',
    users: 'guide/users',
    httpMod: 'reference/modules/http'
};

async function fetchText(url) {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
}

(async () => {
    console.log(`Fetching ${Object.keys(PAGES).length} official docs pages...`);
    const d = {};
    for (const [key, path] of Object.entries(PAGES)) {
        try { d[key] = await fetchText(`https://apostrophecms.com/docs/${path}.html`); }
        catch (e) { d[key] = ''; check(`fetch ${path}`, false, e.message); }
    }
    // Docs wrap code tokens in syntax-highlight spans — strip tags + decode
    // entities so multi-token assertions ('{% area', quoted extends) can match.
    const textify = h => h
        .replace(/<[^>]+>/g, '')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    for (const k of Object.keys(d)) d[k] = textify(d[k]);
    const anyPage = Object.values(d).join('\n');

    console.log('\n== Part 1a: module structure the skill teaches ==\n');
    check('extend @apostrophecms/piece-type', d.pieces.includes("'@apostrophecms/piece-type'"));
    check('extend @apostrophecms/piece-page-type', d.piecePages.includes("'@apostrophecms/piece-page-type'"));
    check('extend @apostrophecms/page-type', d.pages.includes("'@apostrophecms/page-type'"));
    check('extend @apostrophecms/widget-type', d.widgets.includes("'@apostrophecms/widget-type'"));
    check('methods(self) section', /methods\s*\(\s*self\s*\)|methods\(self\)/.test(d.moduleOverview));
    check('extendMethods section', d.moduleOverview.includes('extendMethods'));
    check('apiRoutes section', d.moduleOverview.includes('apiRoutes'));
    check('routes section (raw express)', /[^a-zA-Z]routes\(self\)|routes\s*\(\s*self\s*\)/.test(d.moduleOverview));
    check('renderRoutes documented (skill: exists officially, unused in repos)', d.moduleOverview.includes('renderRoutes'));
    check('handlers section', d.moduleOverview.includes('handlers'));
    check('helpers section', d.moduleOverview.includes('helpers'));
    check('components section (async components)', d.moduleOverview.includes('components'));
    check('tasks section', d.moduleOverview.includes('tasks'));
    check('init section', /init\s*\(\s*self\s*\)|init\(self\)/.test(d.moduleOverview));
    check('middleware section', d.moduleOverview.includes('middleware'));
    check('queries section', d.moduleOverview.includes('queries'));
    check('icons section', d.moduleOverview.includes('icons'));
    check('fields add/group cascade', d.moduleOverview.includes('fields') && anyPage.includes('group'));

    console.log('\n== Part 1b: options the skill/examples use ==\n');
    check('options.alias', d.moduleOptions.includes('alias'));
    check('options.label / pluralLabel', d.moduleOptions.includes('label') && d.moduleOptions.includes('pluralLabel'));
    check('piece-page perPage', d.moduleOptions.includes('perPage') || d.piecePages.includes('perPage'));
    check('pieceModuleName', d.moduleOptions.includes('pieceModuleName') || d.piecePages.includes('pieceModuleName'));
    check('park + parkedId', (d.moduleOptions.includes('park') || d.pages.includes('park')) && anyPage.includes('parkedId'));
    check('page types option (editor page-type menu)', d.pages.includes('types') || d.moduleOptions.includes('types'));
    check('ignoreNoCodeWarning documented or core-verified', anyPage.includes('ignoreNoCodeWarning') || (CORE && fs.readFileSync(`${CORE}/index.js`, 'utf8').includes('ignoreNoCodeWarning')));
    check('quickCreate', anyPage.includes('quickCreate'));
    check('piecesFilters', anyPage.includes('piecesFilters'));
    check('sort option on pieces', d.moduleOptions.includes('sort') || d.pieces.includes('sort'));

    console.log('\n== Part 1c: schema field types + relationship mechanics ==\n');
    check('relationship field type + withType', d.relField.includes('withType'));
    check('relationship builders.project', d.relField.includes('builders') && d.relField.includes('project'));
    check('relationship max', d.relField.includes('max'));
    check('reverse relationships (relationshipReverse/reverseOf)',
        anyPage.includes('relationshipReverse') || anyPage.includes('reverseOf'));
    check('relationships auto-populate as _field arrays (docs show _ prefix)',
        d.relationships.includes('_') && /_[a-zA-Z]+\[0\]|\._[a-zA-Z]+/.test(d.relationships));
    check('area field type + widgets option', d.areaField.includes('widgets'));
    check('area max option', d.areaField.includes('max'));
    check('area expanded/groups options', d.areaField.includes('expanded') && d.areaField.includes('groups'));
    check('select choices + def', d.selectField.includes('choices') && d.selectField.includes('def'));
    check('dynamic choices via method name string', d.selectField.includes('choices') && /choices.{0,200}(method|string)/is.test(d.selectField));

    console.log('\n== Part 1d: templates, fragments, areas in templates ==\n');
    check('{% fragment %} / {% endfragment %}', /\{%\s*fragment/.test(d.fragments) && d.fragments.includes('{% endfragment %}'));
    check('{% render %}', /\{%\s*render/.test(d.fragments));
    check('{% rendercall %}', /rendercall/i.test(d.fragments));
    check('fragments recommended where macros fail (async)', /macro/i.test(d.fragments) && /async/i.test(d.fragments));
    check('{% area %} template tag', /\{%\s*area/.test(d.areas) || /\{%\s*area/.test(d.widgets));
    check('with context for areas', d.areas.includes('with') || d.widgets.includes('with'));
    check('{% component %} tag (documented; repos use zero — skill states this)', /\{%\s*component/.test(d.asyncComponents));

    console.log('\n== Part 1e: front-end, widgets, players ==\n');
    check('apos.util.widgetPlayers', d.widgets.includes('widgetPlayers') || d.frontEnd.includes('widgetPlayers'));
    check('player selector + el pattern', /selector/.test(d.widgets) || /selector/.test(d.frontEnd));
    check('apos.util.onReady/runPlayers (core browser utils)', anyPage.includes('runPlayers') || anyPage.includes('onReady')
        || (CORE && fs.readFileSync(`${CORE}/modules/@apostrophecms/util/ui/src/util.js`, 'utf8').includes('runPlayers')));
    check('apos.http documented', anyPage.includes('apos.http'));
    check('jsonAttribute filter', d.widgets.includes('jsonAttribute') || d.frontEnd.includes('jsonAttribute'));
    check('ui/src front-end code placement', d.frontEnd.includes('ui/src'));

    console.log('\n== Part 1f: i18n + caching + misc APIs ==\n');
    check('__t() template translation', d.i18nStatic.includes('__t'));
    check('req.t server-side translation', d.i18nStatic.includes('req.t'));
    check('i18n JSON files in module i18n/ dir', d.i18nStatic.includes('i18n'));
    check('namespaced i18n keys (apostrophe: — docs or core)', d.i18nStatic.includes('apostrophe:')
        || (CORE && /i18n namespace/i.test(fs.readFileSync(`${CORE}/modules/@apostrophecms/i18n/index.js`, 'utf8'))));
    check('locale prefix config', d.i18nDynamic.includes('prefix'));
    check('apos.cache get/set', d.caching.includes('cache') && (d.caching.includes('get') && d.caching.includes('set')));
    check('apos.error for route errors', anyPage.includes('apos.error') || anyPage.includes("self.apos.error"));
    check('apos.launder', anyPage.includes('launder'));
    check('apos.task.getReq', anyPage.includes('getReq') || anyPage.includes('apos.task'));
    check('apos.attachment.url with size', anyPage.includes('attachment') && anyPage.includes('size'));
    check('apos.image.first', anyPage.includes('apos.image.first') || anyPage.includes('image.first'));
    check('permission.can (docs or core)', anyPage.includes('permission.can') || anyPage.includes('apos.permission')
        || (CORE && /can\s*\(\s*req/.test(fs.readFileSync(`${CORE}/modules/@apostrophecms/permission/index.js`, 'utf8'))));

    console.log('\n== Part 2: Apostrophe core source ground truth ==\n');
    if (!CORE) {
        check('core source available', false, 'no node_modules/apostrophe found');
    } else {
        console.log(`(core: ${CORE})`);
        check("core: leading-slash route names are literal site-relative URLs (getRouteUrl)",
            coreContains('modules/@apostrophecms/module/index.js', /substring\(0, 1\) === '\/'|name\.substring\( ?0, ?1 ?\) === '\/'/));
        check('core: named routes resolve under /api/v1/<module> (action)',
            coreContains('modules/@apostrophecms/module/index.js', '/api/v1/'));
        check("core: page-type subclasses share @apostrophecms/page's action (enableAction override)",
            coreContains('modules/@apostrophecms/page-type/index.js', "['@apostrophecms/page'].action"));
        check('core: @apostrophecms/styles module declares the styles cascade (global styles, 4.26+)',
            coreContains('modules/@apostrophecms/styles/index.js', "cascades: [ 'styles' ]"));
        check('core: widget-type carries a styles cascade (per-widget styles)',
            coreContains('modules/@apostrophecms/widget-type/index.js', /cascades:.*'styles'/));
        check('core: stylesWrapper option controls automatic widget style wrapping',
            coreContains('modules/@apostrophecms/widget-type/index.js', 'stylesWrapper'));
        check('core: style presets include layoutGap, boxShadow and background',
            coreContains('modules/@apostrophecms/styles/lib/presets.js', 'layoutGap') &&
            coreContains('modules/@apostrophecms/styles/lib/presets.js', 'boxShadow') &&
            coreContains('modules/@apostrophecms/styles/lib/presets.js', 'background'));
        check('core: a style value beginning with -- is emitted as var(--x)',
            coreContains('modules/@apostrophecms/styles/ui/apos/universal/render.mjs', 'var(${fieldValue})'));
        check('core: polymorphic withType arrays still fall through to single-type getManager (do NOT use)',
            coreContains('modules/@apostrophecms/schema/index.js', 'if (Array.isArray(relationship.withType)) {'));
        check('core: min/required are not enforced server-side for relationships',
            coreContains('modules/@apostrophecms/schema/lib/addFieldTypes.js', '"min" and "required" are not enforced server-side for relationships'));
        check('core: relationship subfields arrive as _fields on each joined doc',
            coreContains('modules/@apostrophecms/schema/lib/joinr.js', '_fields: fieldsById[id] || {}'));
        check('core: layout widget still exposes grid geometry + cell alignment options',
            coreContains('modules/@apostrophecms/layout-widget/index.js', 'defaultCellHorizontalAlignment'));
        check('core: layoutGap preset still writes --apos-layout-gap at :root',
            coreContains('modules/@apostrophecms/styles/lib/presets.js', "property: '--apos-layout-gap'"));
        check('core: layout grid CSS resolves gap via --grid-gap then --apos-layout-gap',
            coreContains('modules/@apostrophecms/layout-widget/ui/src/layout.css', 'gap: var(--grid-gap, var(--apos-layout-gap,'));
        check('core: box/color/oembed field types keep their registered names',
            coreContains('modules/@apostrophecms/box-field/index.js', "name: 'box',") &&
            coreContains('modules/@apostrophecms/color-field/index.js', "name: 'color',") &&
            coreContains('modules/@apostrophecms/oembed-field/index.js', "name: 'oembed',"));
        check('core: conditional field keys are exactly if and requiredIf',
            coreContains('modules/@apostrophecms/schema/index.js', "const conditionTypes = [ 'if', 'requiredIf' ];"));
        check('core: readOnly fields are skipped entirely by convert',
            coreContains('modules/@apostrophecms/schema/index.js', 'if (field.readOnly) {'));
        check('core: apos.notify aliases the notification module trigger method',
            coreContains('modules/@apostrophecms/notification/index.js', 'self.apos.notify = self.trigger'));
        check('core: notify signature is trigger(req, message, options, interpolate)',
            coreContains('modules/@apostrophecms/notification/index.js', 'async trigger(req, message, options = {}, interpolate = {})'));
        check('core: submitted-draft review state is written by doc-type submit()',
            coreContains('modules/@apostrophecms/doc-type/index.js', 'async submit(req, draft)'));
        check('core: contributors see only their own submitted drafts',
            coreContains('modules/@apostrophecms/submitted-draft/index.js', "'submitted.byId': req.user && req.user._id"));
        check('core: piece types default to a G,<letter> manager shortcut overridable via options.shortcut',
            coreContains('modules/@apostrophecms/doc-type/index.js', 'shortcut: self.options.shortcut ??'));
        check('core: apos.http busy option drives the busy overlay',
            coreContains('modules/@apostrophecms/util/ui/src/http.js', "const busyName = options.busy === true ? 'busy' : options.busy;"));
        check('core: .archived() tri-state is decided in finalize from query.get',
            coreContains('modules/@apostrophecms/doc-type/index.js', "const archived = query.get('archived');"));
        check('core: attachment ships the imageSizes cascade with the six-name ladder',
            coreContains('modules/@apostrophecms/attachment/index.js', "cascades: [ 'imageSizes' ]") &&
            coreContains('modules/@apostrophecms/attachment/index.js', "'one-sixth': {"));
        check("core: apos.attachment.url defaults to the 'full' size for images",
            coreContains('modules/@apostrophecms/attachment/index.js', "effectiveSize = options.size || 'full'"));
        check('core: apos.image.srcset exists and takes (attachment, cropFields)',
            coreContains('modules/@apostrophecms/image/index.js', 'srcset(attachment, cropFields)'));
        check('core: focal point is exposed as object-position, not baked into the URL',
            coreContains('modules/@apostrophecms/attachment/index.js', 'focalPointToObjectPosition(attachment) {'));
        check('core: archived attachments keep only the one-sixth preview size',
            coreContains('modules/@apostrophecms/attachment/index.js', "self.options.sizeAvailableInArchive || 'one-sixth'"));
        check('core: video widget resolves embeds through the oembed proxy at runtime',
            coreContains('modules/@apostrophecms/video-widget/ui/src/index.js', '/api/v1/@apostrophecms/oembed/query'));
        check('core: global stylesheet is rendered on save and mirrored onto the global doc',
            coreContains('modules/@apostrophecms/styles/lib/handlers.js', 'stylesStylesheet: css'));
        check('core: widget styles are merged into the SAME flat schema as fields (addStylesFields)',
            coreContains('modules/@apostrophecms/widget-type/index.js', 'addStylesFields()'));
        check('core BUG WATCH: box-field toCss still joins declarations with a bare space (no ;) — asymmetric boxes emit invalid CSS',
            coreContains('modules/@apostrophecms/box-field/index.js', "parts.join(' ')"));
        check('core: template view watcher is skipped on WSL (template edits need a restart there)',
            coreContains('modules/@apostrophecms/template/lib/viewWatcher.js', 'if (isWsl)'));
        check('core: defer is the real widget lazy option (options.defer)',
            coreContains('modules/@apostrophecms/doc-type/index.js', 'options.defer'));
        check("core: 'options.deferred' does not exist (defer is the real option)",
            !coreContains('modules/@apostrophecms/doc-type/index.js', 'options.deferred') &&
            !coreContains('modules/@apostrophecms/widget-type/index.js', 'options.deferred'));
        check('core: ignoreNoCodeWarning is the real no-code-lint option',
            coreContains('index.js', 'ignoreNoCodeWarning'));
        check('core: jsonAttribute is a core template filter',
            coreContains('modules/@apostrophecms/template/index.js', 'jsonAttribute'));
        check('core: pieceModuleName derived as name minus -page',
            coreContains('modules/@apostrophecms/piece-page-type/index.js', /replace\(\/-page\$\/,\s*''\)/));
        check('core: vite Modules/ alias plugin exists',
            fs.existsSync(`${CORE}/../@apostrophecms/vite/lib/vite-plugin-apostrophe-alias.mjs`));
        check('core: apiRoutes returned string sent verbatim / object as JSON (res.send)',
            coreContains('modules/@apostrophecms/module/index.js', 'res.send'));
        check('core: fragments implemented with render/rendercall tags',
            fs.existsSync(`${CORE}/lib/fragments.js`) || coreContains('modules/@apostrophecms/template/index.js', 'fragment'));
        check('core: widget bundles resolve ui/src/<name>.js by bundle key',
            coreContains('modules/@apostrophecms/asset/lib/webpack/utils.js', 'ui/src/${bundleName}') ||
            coreContains('modules/@apostrophecms/asset/lib/webpack/utils.js', 'bundleName'));
    }

    console.log(`\n=== ${pass} passed, ${fail} failed ===`);
    if (failures.length) {
        console.log('Failures:');
        failures.forEach(f => console.log('  - ' + f));
        process.exit(1);
    }
})();

# apostrophe-cms — one-page cheatsheet

First: discover the repo's conventions (route style, data handoff, i18n
location, SCSS placement, vendored client libs) and imitate them; official
patterns fill the gaps.

## Module skeleton (ESM, A3/A4)
```js
export default {
    extend: '@apostrophecms/widget-type',        // piece-type | piece-page-type | page-type | (none = service)
    options: { label: 'Thing', defer: true },    // NEVER `deferred:` (silent no-op); `alias:` is for service modules
    fields: {
        add: {
            title: { label: 'Title', type: 'string', required: true },
            _items: {                              // relationship = the join mechanism
                label: 'Items', type: 'relationship', withType: 'item', max: 3,
                builders: { project: { title: 1, _url: 1 } }   // project INSIDE builders or it's IGNORED
            }
        },
        group: { basics: { label: 'Basics', fields: [ 'title', '_items' ] } }
    },
    methods( self ) { return { /* async helpers */ }; }
};
```
**Register it** in the nearest `modules.js` (nestedModuleSubdirs) or `app.js` — or it silently doesn't exist.
Read joins off the loaded doc: `piece._items[0]` — ALWAYS an array (even `max: 1`); guard `| length` / `?.[0]`. Never re-fetch related docs via JS/AJAX.

## Templates (fragments, never macros)
```njk
{% import "/fragments/card.html" as cards %}     {# ABSOLUTE path — relative breaks theme resolution #}
{% render cards.card( item ) %}
{% area data.widget, 'content' %}
{{ __t('myKey') }}                               {# add the key to EVERY locale JSON #}
```

## Rich text
Project override `modules/@apostrophecms/rich-text-widget/index.js`:
`options.defaultOptions.{ toolbar, styles: [{ label, tag, class? }], insert }`.
Per-area: `'@apostrophecms/rich-text': {}` inherits; `{ toolbar: […] }` replaces.
`styles: { add: … }` CSS cascade (color/presets) needs a newer-4.x core (4.31+ yes, 4.22 no).

## Server → browser data
```njk
<div id="thing-{{ widget._id }}" data-playerdata="{{ widget.playerData | jsonAttribute }}">
{# or individual kebab attributes: #} <div data-product-id="{{ piece.aposDocId }}">
```
```js
// player (ui/src/<bundle-key>.js)
export default () => {
    apos.util.widgetPlayers.thing = {            // key = camelCase(module name minus '-widget')
        selector: '[id^="thing-"]',
        player( el ) { const data = JSON.parse( el.dataset.playerdata ); }
    };
};
```
Bundle: `build: { vite: { bundles: { 'thing': {} } } }` in index.js ⇔ file `ui/src/thing.js`. After AJAX HTML swap: `apos.util.runPlayers( el )`.

## AJAX endpoints
```js
apiRoutes( self ) { return { post: {
    '/getThing': async ( req ) => { /* leading slash = literal URL; return object (JSON) or string (raw HTML) */ },
    async adminThing( req ) {                     // named → /api/v1/<module>/adminThing
        if ( !self.apos.permission.can( req, 'admin' ) ) throw self.apos.error( 'forbidden' );
    }
} }; }
// browser: apos.http.post( '/api/v1/<module>/adminThing', { body } )  — CSRF handled
```
Launder ALL input: `self.apos.launder.string( req.body.x )`. Markup-swap endpoints return raw HTML, never JSON.

## Admin UI (ui/apos)
`ui/apos/components/<Name>.vue` registers globally by FILENAME (rebuild + restart + hard reload).
`apos.modal.add( 'x:manager', 'Name', { moduleName: self.__meta.name } )` + `apos.adminBar.add( 'x:manager', … )` — same item name = the click wiring. `self.name` does NOT exist. Errors: `( err.body && err.body.message )`.

## Interactivity order
1. **Alpine** if the repo has it (vendored `alpine*.js` / package.json) · 2. **vanilla** · 3. htmx/swap-lib only to match an existing pattern. Never jQuery/React. `window.*` only when markup forces it.

## Commands
⚠ Check the project's CLAUDE.md FIRST — some projects forbid running app tasks
(a stray task can be destructive against a live dev DB). Its rules win (rule 9).
```bash
node app.js                                   # run (check package.json scripts first)
node app.js @apostrophecms/user:add me admin  # admin user
node app.js <module>:<task>                   # CLI task
node ~/.claude/skills/apostrophe-cms/tools/lint-apos.js <repo>            # mechanical lint
node ~/.claude/skills/apostrophe-cms/tools/slice-map.js <repo> <module>   # vertical-slice map
node ~/.claude/skills/apostrophe-cms/tests/verify.js                      # skill self-test
```

Full rules + routing: `SKILL.md` · depth: `references/` · copy-paste cookbook: `references/examples.md`.

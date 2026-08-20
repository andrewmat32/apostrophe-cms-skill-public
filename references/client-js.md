# Client-side JS

> Bundle mechanics below assume the vite build (`build.vite.bundles`). Older
> Apostrophe 3 projects use `webpack: { bundles: ... }` with the same
> key-equals-filename rule — check which one the repo's existing widgets use
> and match it.

## Choosing the interactivity layer (decision order)

1. **Alpine.js — IF the repo already has it** (a vendored `alpine*.js` under the
   asset module's `ui/src`, or `alpinejs` in package.json). Match how the repo
   uses it (some use only `x-data` + `@click` with window-exposed functions —
   don't introduce stores/`x-model` to a repo that avoids them).
2. **Vanilla JS — the default.** Plain DOM APIs inside the widget player or the
   module's `ui/src/index.js`.
3. **htmx (or a repo's own declarative-swap directive) — last resort:** only
   when the repo already ships it AND the feature is a markup-triggered HTML
   swap matching existing precedent. The paired endpoint must return a raw HTML
   string. Never introduce a swap library to a repo without one.

Never add jQuery, React, Vue (outside `ui/apos` admin components), or any new
client library.

## Widget players (official mechanism)

```js
// ui/src/<bundle-key>.js
export default () =>
{
    apos.util.widgetPlayers.thing = {          // key = camelCase(module minus '-widget')
        selector: '[data-thing-widget]',
        player( el )
        {
            const data = el.dataset.playerdata ? JSON.parse( el.dataset.playerdata ) : null;
        }
    };
};
```

- Server→browser data: build ONE serializable object server-side (e.g.
  `widget.playerData` in `load()`), emit it with the core `jsonAttribute`
  filter — `data-playerdata="{{ data.widget.playerData | jsonAttribute }}"` —
  and parse it in the player. Attribute names are lowercased by the DOM
  (`data-playerdata` → `el.dataset.playerdata`). Simple values can ride as
  individual kebab `data-*` attributes instead of a JSON blob — imitate the
  repo's dominant idiom.
- Selector discipline: an `[id=...]` selector means ONE instance per page — use
  a class, a `data-*` attribute, or an id-prefix form (`'[id^="thing-"]'`) when
  the widget can repeat.
- No inline `<script>` in widget templates, ever.

## Vite bundles — three coexisting forms

1. **Named bundle**: `build: { vite: { bundles: { 'thing': {} } } }` — the key
   must equal the `ui/src/<key>.js` (or `.scss`) filename, NOT the module name.
   Page modules can scope a bundle to templates:
   `{ 'x-page': { templates: [ 'show' ] } }`.
2. **Cross-module bundle reference**: a bundle key naming ANOTHER module's
   bundle resolves against the global bundle registry at injection time — a
   legitimate way to pull one widget's assets onto another module's pages.
3. **No bundle at all**: `ui/src/index.js` is auto-added to the main site
   bundle — the simplest form, right for small per-module JS.

Module JS that is **not** a widget player should bind with
**`apos.util.onReady( fn )`** rather than `DOMContentLoaded`: core runs it on
initial load *and* again after content refreshes, so behavior survives editor
re-renders. For markup that appears later (AJAX swaps, editor inserts), pair it
with a `MutationObserver` on `document.body` keyed off the `data-*` attributes
your templates render, and make the init function idempotent.

⚠️ **`deferred: true` is not a real option** — core reads `defer: true` for
lazy widget loading. `deferred:` is a silent no-op (`lint-apos` E1 finds it).

## Shared browser helpers + the `Modules/` import alias

If the repo centralizes shared browser code under the asset module
(`modules/asset/ui/src/js/`), import it via the core vite alias:

```js
import { initializeSliders } from 'Modules/asset/js/sliders.js';   // = modules/asset/ui/src/js/sliders.js
```

Check the asset entry's existing exports before writing a new helper —
import ORDER in a hand-maintained asset entry can be load-bearing (vendored
libs before code that registers against them).

## Window exposure discipline

Put a function on `window` ONLY when markup forces it (an Alpine expression, a
declarative-swap callback attribute, a third-party callback). Everything else
stays in the player closure or a shared module export. Before adding a
`window.*` name, grep for it — colliding globals across widget bundles is a
real bug class.

## Re-binding after AJAX injection

1. Replace + re-scan: `el.innerHTML = html; apos.util.runPlayers( el );` plus
   re-running any non-player init the new markup needs.
2. Append + explicit re-bind of listeners.
3. Markup-declared callbacks (htmx `htmx:afterSwap` etc.) where the repo uses
   them.
Alpine re-initializes injected nodes automatically; only non-Alpine listeners
need manual re-binding.

## SCSS placement

### ⛔ Full-bleed + padding needs `box-sizing: border-box`

Apostrophe starters ship **normalize.css, which does NOT set
`box-sizing: border-box`**, and there is no global reset unless the project adds
one. The near-universal full-bleed idiom therefore overflows:

```scss
.band {
    width: 100vw;                        // or width: 100%
    margin-left: calc(50% - 50vw);
    padding: 4rem var(--bleed-pad);      // ← content-box ADDS this to the width
}
```

The element ends up `100vw + 2 × padding` wide, which widens the **document**,
not just the element. Two consequences that look unrelated to CSS:

- any `margin-left: auto` content (a header's right-hand group) pins to the
  phantom width and renders **off-screen at every viewport size**;
- `body { overflow-x: clip }` hides the scrollbar, so the symptom is invisible
  until you measure `document.scrollWidth` against `clientWidth`.

Field-proven: a header login button sat off-viewport at 390/768/1280 for exactly
this reason. Add `box-sizing: border-box` to every element that combines a width
with horizontal padding — the bands, the header, the footer, the content column
(the column matters because the bands' `calc(50% - 50vw)` math assumes its
content box is viewport-wide). Check with
`document.documentElement.scrollWidth === clientWidth` at several widths.


Many production projects centralize ALL site styles through the asset module —
one entry `modules/asset/ui/src/index.scss` with an import cascade — instead of
per-widget `ui/src` SCSS. In such a repo: a partial not added to `index.scss`
**never loads**; keep any admin-override partial LAST in the cascade; put new
partials in the section (components/pages/widgets) the repo's structure
dictates. In a repo without a central cascade, per-module `ui/src/*.scss`
bundles are fine. Either way: reuse the repo's existing variables/custom
properties rather than hard-coding new values.

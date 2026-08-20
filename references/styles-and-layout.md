# Editor-facing styles & layout (core 4.26+ / 4.30+)

Two core systems that let **editors** change design without a code change:
**global styles** (site-wide CSS controls), **widget styles** (per-instance
controls), and the **layout widgets** that use them. All are recent core
additions — Global Styles + Widget Styles landed in **4.26.0** (2026-01-26);
the `layoutGap` preset and per-widget `gap` field in **4.30.0**.

⚠ **VERSION-GATE EVERYTHING HERE.** Before using any of it, confirm the core in
`node_modules/apostrophe` has it: `modules/@apostrophecms/styles/` exists (4.26+),
and `modules/@apostrophecms/widget-type/index.js` has `styles` in its `cascades:`
array. A project on 4.22 has none of this.

---

## Global styles — `@apostrophecms/styles`

A core module you configure by **overriding it at project level**
(`modules/@apostrophecms/styles/index.js`). No `app.js` entry needed — core
modules are already registered; you are extending one.

It is a **piece-type singleton** (`singletonAuto`, `autopublish: true`) with
`editRole: 'editor'` / `publishRole: 'editor'` — contributors are deliberately
locked out of site-wide styles. Editors reach it from the admin bar, or the
command-menu taskbar shortcut `T,P`.

### Declaring controls

A `styles` **cascade at module top level** (next to `fields`, not inside it):

```js
// modules/@apostrophecms/styles/index.js
export default {
    styles: {
        add: {
            // BEST PATTERN: define a design token your SCSS already consumes
            brandColor: {
                type: 'color',
                label: 'Brand color',
                selector: ':root',
                property: '--brand',
                def: '#b23a1f'
            },
            bodyFont: {
                type: 'string',
                label: 'Body font family',
                selector: 'body',
                property: 'font-family',
                def: 'system-ui, sans-serif'
            },
            // responsive: same property, different breakpoint
            bodyFontSizeMobile: {
                type: 'range',
                selector: 'body',
                property: 'font-size',
                min: 14, max: 18, step: 1, def: 16,
                unit: 'px',
                mediaQuery: '(max-width: 767px)'
            },
            // preset + override: the bare `padding` preset ships a `property`
            // but NO `selector`, so at global level it needs a target of its own
            mainPadding: { preset: 'padding', selector: '.main' }
        }
    }
};
```

### The CSS metadata (what turns a schema field into CSS)

Any normal schema field type works (`color`, `range`, `select`, `string`,
`boolean`, `object`, `box`). These extra keys do the CSS work:

| Key | Effect |
|---|---|
| `selector` | Target selector; **string or array** of selectors |
| `property` | CSS property; string or array. Supports **`%key%`** interpolation for `box` fields (`border-%key%-width` → `border-top-width`, …) |
| `unit` | Appended to the value (`px`, `em`, `%`) |
| `mediaQuery` | Wrap the rule (`'(max-width: 767px)'`) — the only sane way to expose responsive typography to editors |
| `class: true` | Emit a **class** on the target instead of a property (how the `alignment` preset works) |
| `valueTemplate` | Compose a value from the field rather than using it raw |
| `def` | Default before an editor touches anything |

**A value that starts with `--` is emitted as `var(--x)`** — so a `select` of
token names can point one property at another token.

### Presets

Eight built-ins: `width`, `alignment`, `padding`, `margin`, `border`,
`boxShadow`, `background`, `layoutGap`.

```js
padding: 'padding',                                  // shorthand
margin:  { preset: 'margin', label: 'Outer space' }  // preset + overrides (merged over it)
```

An unknown preset name **throws at startup** — loud, not silent. Register your
own by extending the module's `setPreset( name, preset )` (must happen before
init completes; `getPreset`/`hasPreset` are the companions).

### How the CSS actually reaches the page

The module does `self.prependNodes( 'body', 'stylesheet' )` — the rules land at
the **start of `<body>`, i.e. after your head bundle**, and the delivery differs
by viewer:

- **Anonymous visitor** (cannot `view-draft`): a `<link rel="stylesheet">` to a
  **locale-qualified generated URL** — cacheable, one stylesheet per locale.
- **Logged-in editor**: an inline `<style id="apos-styles-stylesheet">` (with
  `</` escaped to `<\/` as an XSS guard) so live edits apply instantly.
- Global styles may additionally emit **classes applied to `<body>`**.

**⛔ The stylesheet is rendered on SAVE, not per request.** The styles module
renders the CSS in an `afterSave` handler and mirrors it onto the
`@apostrophecms/global` doc (`stylesStylesheet`, `stylesClasses`,
`aposLayoutGap`); serving just returns that stored string. **Editing the
`styles` cascade in code therefore changes nothing on the site until the styles
singleton is saved again** — no error, no warning, the old CSS keeps serving.
Field-proven: after rewriting a project's styles module, the stylesheet route
was still serving the previous config's CSS. Re-save the singleton in the admin
UI, or touch it programmatically (a seed task can), after any code change to the
cascade.

**⛔ On a widget, `styles` and `fields` share ONE flat namespace — and fields
win.** Core merges them as `{ ...stylesSchema, ...fields }`, so a styles preset
whose key collides with an existing field key **silently vanishes**. A widget
that already has a `background` area field gets nothing from a `background`
style preset. Rename one side.

**The specificity trap:** landing after your bundle only wins at *equal*
specificity. A `selector: 'body'` rule (0,0,1) still loses to `.card` (0,1,0).
Do not fight your own cascade — **point global styles at `:root` custom
properties your SCSS already consumes.** Expose three to six token knobs
(brand color, font, base spacing) and leave every SCSS rule untouched. This is
the highest-leverage use of the feature, and it is the difference between
"editors can theme the site" and "editors can break the site".

---

## Widget styles

Same cascade, declared on a **widget module**, giving per-instance controls in
the widget editor:

```js
// modules/hero-widget/index.js
export default {
    extend: '@apostrophecms/widget-type',
    options: { label: 'Hero' },
    fields: { add: { heading: { type: 'string' } } },
    styles: {                        // TOP LEVEL, next to fields
        add: {
            padding: 'padding',
            background: 'background'
        }
    }
};
```

Core scopes each instance's rules with a generated `styleId` and, by default
(`stylesWrapper: true`), wraps the widget and applies the generated `css`,
`classes` and `inline` automatically.

**⛔ The generated CSS lands on a WRAPPER, so a self-painting widget breaks.**
With `stylesWrapper: true` core wraps your widget in a div and puts the padding
/ shadow / classes there — **not** on your own root element. If the widget's own
template paints its own padding, or full-bleeds
(`width: 100vw; margin-left: calc(50% - 50vw)`), the editor's knobs misbehave in
three ways at once, silently:

- horizontal `padding` becomes a **no-op** (the inner element is `100vw` regardless);
- vertical `padding` **stacks on top of** the template's own padding instead of
  replacing it — so the same control means "replace" on one variant and "add" on
  another;
- `boxShadow` is drawn on the wrapper's content-column box and is **hidden
  behind** the opaque full-bleed band.

Field-proven on a full-bleed hero. Before adding a `styles` cascade, check what
the widget's template already paints. Either put the cascade on a widget whose
wrapper really is its visual box, or move the full-bleed/padding onto an inner
element so the wrapper becomes the real box. A widget that paints itself and
also offers padding knobs is a bug waiting for an editor to find it.

**To control the markup yourself**, set `options.stylesWrapper: false` and use
the helpers in the widget template:

```njk
{%- set styles = apos.styles.render( data.widget ) -%}
{{ apos.styles.elements( styles, data.scene ) }}
<article {{ apos.styles.attributes( styles, { class: 'fancy-article' } ) }}>
    {{ data.widget.heading }}
</article>
```

`apos.styles.render()` returns `{ css, classes, inline, styleId, widgetId }`;
`elements()` renders the `<style>` element (passing `data.scene` keeps the admin
breakpoint-preview working); `attributes()` merges the generated class/style/id
attributes with your own.

Related option: **`hideSingleTab`** suppresses the widget-editor tab bar when
only one tab of fields exists — settable per widget or globally on
`@apostrophecms/widget-type`. Without it, a widget that has both `fields` and
`styles` can surface a stray "Ungrouped" tab (a real core bug fixed in 4.x).

---

## Traps

- **Version gate** (repeat, because it is the one that bites): no
  `@apostrophecms/styles` before 4.26; `layoutGap`/widget `gap` need 4.30.
  Check `node_modules` before you write, and guard anything you ship as a
  package.
- **Specificity**, above — target tokens, not elements.
- **`layoutGapDefault: true`** may mark only ONE field; extras are ignored with
  a warning at boot.
- `serverRendered: false` is the default (faster editing UI); `true` renders CSS
  server-side during editing and is what allows a custom render function.
- **Expose few knobs.** Every control is a way for a client to make the site
  ugly, and there is no design review between them and production.

---

## Layout widgets (core 4.23+)

`@apostrophecms/layout-widget` (widget type name **`@apostrophecms/layout`**) is a
**CSS-Grid container widget**, shipped enabled by default with its companion
`@apostrophecms/layout-column-widget` (type **`@apostrophecms/layout-column`**).
No `app.js` entry needed — just list `'@apostrophecms/layout': {}` in an area's
`widgets`.

The nesting shape is fixed:

```
area → @apostrophecms/layout → columns[] → @apostrophecms/layout-column → content area → your widgets
```

The layout widget's schema is a single **area field named `columns`** that accepts
exactly one widget type (the column widget); each column has a `content` area
holding real content.

**Editor experience:** `initialModal: false` — dropping one opens no modal. The
pencil/edit operation is removed; a breadcrumb switch toggles **content** mode
(edit widgets normally) and **layout** mode (drag/resize grid manager, disabled
on small screens).

### Options — `@apostrophecms/layout-widget`

| Option | Default | Effect |
|---|---|---|
| `columns` | `12` | Grid track count → `--grid-columns`. **Must be ≥ 2 or boot throws** |
| `minSpan` | `2` | Minimum colspan on resize (≥1, ≤ `columns`) |
| `defaultSpan` | `6` | Colspan for new columns (≥ `minSpan`, ≤ `columns`) |
| `mobile.breakpoint` / `tablet.breakpoint` | `600` / `1024` | px values baked into the injected media queries |
| `gap` | `'1.5rem'` | Static fallback gap |
| `defaultCellHorizontalAlignment` / `…Vertical…` | `null` | Grid `justify-items` / `align-items` (fall back to `stretch`) |
| `className` | `''` | **Extra** classes appended to the grid container (**4.30+**) |
| `injectStyles` | `true` | Inline the grid CSS into `<head>` at boot |
| `minifyStyles` | `true` | cssnano the injected CSS; `false` to debug |

### Options — `@apostrophecms/layout-column-widget`

`contextualStyles` (4.26+), `operationsInBreadcrumb`, `showBreakpointsHelp`, and
`labelBreakpoints: { mobile, tablet }` — the last is **help text only**, it does
not change any real breakpoint (those live on the *layout* widget).

Column schema fields (hidden `utility` group): `colstart`, `colspan`, `rowstart`,
`rowspan`, `order`, `content`. Column *styles* fields: `showTablet`, `showMobile`,
`justify`, `align`.

### The gap system (4.30+)

Three levels, resolved server-side, highest first:

1. **Per-widget** — a styles field on the layout widget whose CSS `property` is
   `gap`. Detected **by property, not field name**.
   ```js
   styles: { add: { gap: { type: 'range', min: 0, max: 64, unit: 'px', property: 'gap' } } }
   ```
2. **Site-wide** — the `layoutGap` preset on `@apostrophecms/styles`
   (`styles: { add: { layoutGap: 'layoutGap' } }`), which writes
   `--apos-layout-gap` on `:root`. Detected by its `layoutGapDefault: true`
   marker, not by key name.
3. **Static** — the `gap` module option.

The public CSS resolves `gap: var(--grid-gap, var(--apos-layout-gap, <static>))`.
⚠ Using the `layoutGap` preset **on a widget is a boot error** — widgets must use
`property: 'gap'`. Two fields resolving to `gap` on one widget → warning, first
wins.

> The official docs say the keys must be named exactly `layoutGap` and `gap`
> "because live preview depends on it". Source in 4.32 shows marker/property
> detection with no name check (core's own test uses the key `siteGap`). **Use
> those names anyway** — costs nothing, matches the docs — but don't believe the
> code enforces it. Direct experiment: `fieldsWithProperty()` matched a field
> named `someOtherName` carrying `property: 'gap'` and **ignored** a field
> literally named `gap` carrying `property: 'column-gap'`.

### Markup and CSS contract

The **grid container is the area div itself** (`.apos-area.layout-widget`), and
columns are emitted by `views/column.html` installed as the area's
`widgetTemplate` so they are *direct grid children* with no wrapper.

Custom properties to style against — container: `--grid-columns`, `--grid-gap`,
`--apos-layout-gap`, `--grid-rows`, `--justify-items`, `--align-items`; item:
`--colstart`, `--colspan`, `--rowstart`, `--rowspan`, `--order`, `--justify`,
`--align`, plus `--tablet-*` / `--mobile-*` bands. Data attributes:
`[data-tablet-auto]`, `[data-mobile-auto]`, `[data-tablet-full]`,
`[data-visible-tablet]`, `[data-visible-mobile]`.

This CSS is **inlined into `<head>` at boot**, not part of the asset build.

### Extending: capping nesting depth

Core has **no nesting-depth guard**. Depth is purely a function of your widget
lists, and the practical pattern is a second, terminal pair:

```js
// modules/nested-layout-widget/index.js
export default {
    extend: '@apostrophecms/layout-widget',
    options: { label: 'Nested Layout', columns: 6, minSpan: 2, defaultSpan: 3 },
    fields: { add: { columns: { type: 'area', options: { widgets: { 'nested-column': {} } } } } }
};
// modules/nested-column-widget/index.js — allows NO layout inside, so nesting stops
export default {
    extend: '@apostrophecms/layout-column-widget',
    fields: { add: { content: { type: 'area', options: { widgets: {
        '@apostrophecms/rich-text': {}, '@apostrophecms/image': {}
    } } } } }
};
```

### Layout traps

- **The `columns` area must hold exactly one widget type**, and it must be the
  column widget or a subclass — anything else is a hard boot error.
- **Overriding `fields.add.columns` drops `editorComponent`/`widgetTemplate`** —
  core re-adds them if missing; don't set them to anything else.
- **`injectStyles` is only honored on the base module.** Setting it `false` there
  strips the grid CSS from every subclass too. Subclasses also still carry the
  literal `layout-widget` class — `className` only appends.
- **Boot-time validation throws** on `columns < 2`, `minSpan < 1`,
  `minSpan > columns`, `defaultSpan < minSpan`, `defaultSpan > columns`.
- **Breaking schema change in 4.29.0**: columns previously stored nested
  `desktop: { colstart, … }` / `tablet` / `mobile` objects; 4.29 flattened them
  and added a `<moduleName>:flatten-column-schema` migration (each subclass
  registers its own). Any code or template reading `widget.desktop.colspan`
  breaks on upgrade — and the migration must actually run.
- **Manual per-device positioning is dead code in 4.32**: the CSS supports
  `data-tablet-auto="false"` bands, but both the SSR template and the editor
  hardcode `"true"`. Tablet is auto 2-up, mobile single-column, unless you
  override the template yourself.
- Version gates: base widgets **4.23**, `contextualStyles` **4.26**,
  `labelBreakpoints` **4.27**, flat column schema **4.29**, `className` and the
  whole styles-based gap system **4.30**.

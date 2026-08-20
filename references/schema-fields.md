# Schema field types — the complete inventory (core 4.32 verified)

Core registers **26** field types. Twenty come from
`modules/@apostrophecms/schema/lib/addFieldTypes.js`; six are registered by
their own modules (`attachment`, `box`, `color`, `oembed`, `role`). Everything
below was read out of core source, not the docs.

`module-anatomy.md` covers module/schema *structure*; `relationships.md` covers
`relationship`/`relationshipReverse` in depth. This file is the field-type and
field-option reference.

## The 26 types

| Type | Stores | Notable options |
|---|---|---|
| `area` | `{ _id, metaType:'area', items:[] }` | `options.widgets` ⚠ nested under `options`, `options.groups`, `options.expanded`, `options.max` |
| `string` | string | `textarea`, `min`, `max` (truncates!), `pattern`, `placeholder`, `direction`, `searchable`, `weight`, `sortify` |
| `slug` | slugified string | `page: true` (leading-slash page slugs), `prefix`, `following` |
| `boolean` | `true`/`false` | `def`, `toggle` (toggle-switch UI) |
| `checkboxes` | array of values | `choices` (array **or** method-name string), `min`, `max`, `style: 'combo'` |
| `select` | single value | `choices` (array or method-name string), `def` |
| `radio` | single value | pure alias of `select` (`extend: 'select'`, no body) |
| `integer` / `float` | number or `null` | `min`, `max`, `def`, `required` |
| `email` / `url` | string | `required`, `pattern` (url), `direction` |
| `date` | `'YYYY-MM-DD'` or `null` | `min`/`max` — **must themselves be `YYYY-MM-DD`** |
| `time` | time string | (no option handling at all — one `launder.time` call) |
| `dateAndTime` | date or `null` | `direction` |
| `password` | string | `min`, `max`, `placeholder` |
| `group` | nothing | registration-only marker so `fields.group` validates |
| `range` | number or `null` | `min` **and** `max` are **required**, `step`, `unit`, `def` |
| `array` | `[{ _id, metaType:'arrayItem', … }]` | `fields.add`, `inline`, `style:'table'`, `titleField`, `itemLabel`, `min`, `max`, `limit`, `draggable`, `duplicate`, `arrayName` |
| `object` | `{ _id, metaType:'objectItem', … }` | `fields.add`, `objectName` |
| `relationship` / `relationshipReverse` | see relationships.md | `withType`, `builders`, `fields`, `max`, `ifOnlyOne`, `reverseOf` |
| `attachment` | attachment doc or `null` | `fileGroup`/`fileGroups`, `extension`/`extensions` |
| `oembed` | `{ url, title, thumbnail }` | `oembedType` (client-side only), `placeholder` |
| `color` | color string, `--var` reference, or `null` | `def`, `options: { format, disableAlpha, disableFields, disableSpectrum, presetColors }` |
| `box` | `{ top, right, bottom, left }` | `min`, `max`, `step`, `def` (**all four keys**) |
| `role` | `guest\|contributor\|editor\|admin` | `extend: 'select'`; only when extending the user schema |

## The ones worth a code block

```js
// box — four-sided numeric control (what the styles padding/margin presets use)
cardPadding: {
    type: 'box',
    min: 0, max: 120, step: 4,
    def: { top: 16, right: 16, bottom: 16, left: 16 }   // ALL FOUR keys or startup fails
},
// render it: apos.boxField.toCss( value, property, unit = 'px' )
//   {{ apos.boxField.toCss( data.widget.cardPadding, 'padding-%key%' ) }}
//   %key% → top/right/bottom/left; collapses to one `padding:` when all four match
//   ⛔ CORE BUG (4.32): the non-uniform branch joins with ' ' and never appends
//   ';', so any asymmetric box emits ONE malformed declaration that the browser
//   drops wholesale — the element gets no padding at all. Uniform values are
//   fine, so this is invisible until an editor sets one side differently.
//   Override the helper at project level (join with '; ') until core fixes it.
//   NOTE: the styles-cascade renderer is a different code path and is correct.

// color — value is a string; a '--token' reference is also valid
brandColor: {
    type: 'color',
    def: '#b23a1f',
    options: { format: 'hex8', presetColors: [ '#f9c80e', '#f86624' ] }
},

// attachment — a file, not a piece
brochure: {
    type: 'attachment',
    fileGroup: 'office',        // built-ins: 'images' (gif jpg png svg webp), 'office' (pdf doc xls …)
    extensions: [ 'pdf' ]       // narrows further within the group
},

// array — repeatable sub-schema
slides: {
    type: 'array',
    titleField: 'heading',      // which subfield labels the row (default 'title')
    itemLabel: 'Slide',
    inline: true,               // edit in place; `style: 'table'` only works when inline
    min: 1, max: 8,
    fields: { add: { heading: { type: 'string' }, body: { type: 'area', options: { widgets: {} } } } }
},

// select/checkboxes — choices may name a METHOD instead of listing values
topics: { type: 'checkboxes', style: 'combo', choices: 'getTopicChoices' }   // or 'moduleName:method'
```

## Cross-cutting options the skill previously never mentioned

| Option | What it does |
|---|---|
| `if` / `requiredIf` | Mongo-style conditions: `$or`, `$and`, dot paths, `.length`, `$eq $ne $exists $in $nin $gt $lt $gte $lte`. A key ending in `)` means an **external condition** — `'method()'` / `'module:method()'` — costing an HTTP round-trip per evaluation |
| `following` | Feed sibling field values into this input (slug ← title). A `'<fieldName'` prefix reaches **up** into the parent schema |
| `readOnly` | `convert()` **skips the field entirely** — the real "don't let the client write this" option |
| `hidden` | Client-side only: input not rendered, but `convert()` still processes it. **Not protection** |
| `help` / `htmlHelp` | Editor help text (i18n keys); `htmlHelp` renders as HTML. `help` wins if both set |
| `helpInterpolation` / `labelInterpolation` | i18n interpolation for those strings |
| `hideLabel`, `tag` | Visually hide the label; add a `{ value, type }` badge beside it |
| `placeholder` | Reaches the DOM for ~10 types — `string` plus everything else rendered by `AposInputString` (`integer`, `float`, `email`, `url`, `date`, `time`), and `slug`/`password`/`oembed` via their own components. It genuinely works on `integer`/`float`/`email`/`url`; on `date`/`time` the **browser** ignores it. `relationship` binds a hardcoded "Search &lt;Type&gt;" placeholder, so `field.placeholder` is ignored there |
| `editPermission` / `viewPermission` | `{ action, type }`. **Doc-type root fields only** — warns and does nothing on widget/nested fields |
| `sortify` | Maintains a `<name>Sortified` twin on save + auto-adds a one-time backfill migration |
| `unique` | ⚠ Only consumed by **array** duplicate detection. There is no doc-level `unique` — that's a Mongo index |
| `direction` | `'ltr'`/`'rtl'` on the text-ish types |
| `searchable` / `weight` | Exclude from the search index / weight it (default 15) |
| `moduleName` | Auto-set from the module; scopes external `if`/`choices` method lookups |

## Traps

1. **`required` is NOT enforced server-side for most types.** `convert()` has no
   generic required check — each type must throw, and only nine do: `string`,
   `integer`, `float`, `email`, `url`, `range`, `array`, `color`, `box`. It is a
   **UI-only affordance** for `select`, `radio`, `checkboxes`, `boolean`, `slug`,
   `date`, `time`, `dateAndTime`, `password`, `object`, `relationship`,
   `attachment`, `oembed`, `role`. A direct REST POST bypasses it — enforce in a
   `beforeSave` handler when it actually matters.
2. **`slug` loses `string`'s required check** — it extends `string` but supplies
   its own `convert`, so that throw never runs.
3. **`select` never falls back to `def` on an invalid value** — `convert` calls
   `launder.select` without the `def` argument, so an unrecognized value stores
   `undefined`. `def` applies at `newInstance()` time only.
4. **`integer`/`float` ignore `def` on convert** and force `null` for empty
   input — a non-required integer with `def: 5` becomes `null` when cleared.
5. **Conditional fields silently reset to `def` — but only when that field's
   `convert` actually throws.** Measured: a hidden `integer` with `def: 7`,
   `min: 100`, given `3`, stored **100** — `launder.integer` clamps to `min`
   without throwing, and a *visible* field produced the same 100. With a
   genuinely throwing hidden field (`string` with `min: 10`, or a `required`
   integer) core did write the `def`, **and the save was not blocked** —
   confirming the corollary that `required` + `if` never blocks a save while the
   field is hidden.
6. **`hidden` hides but does not protect** — use `readOnly` (skips `convert`) or
   `contextual` when the value must not be client-writable.
7. **`readOnly` on an area also blocks in-context editing.**
8. **`array.limit` ≠ `array.max`.** `limit` silently truncates before
   conversion; `max` throws. Setting only `limit` means silent data loss.
9. **`string.max` truncates rather than rejecting** (but `string.min` throws).
10. **`scopedArrayName`/`scopedObjectName` are persisted to the database** —
    renaming an `array`/`object` field, or adding `arrayName`/`objectName` after
    data exists, orphans stored items. Migration-class change.
11. **`box.def` must contain exactly the four keys** or startup fails, and
    omitting `min` makes core derive an implicit floor from the most negative
    `def` value. Also: core's server-side `box` min check compares the whole
    object rather than each side — **the server-side minimum is effectively not
    enforced** (client validation is correct, so it is API-bypassable). Treat as
    a core bug; don't rely on it.
12. **`oembedType` is client-side only** — the server accepts any oembed-able URL.
13. **Area `widgets` must be nested under `options`** — core only *warns*, so a
    misplaced `widgets` key looks fine and does nothing. It also warns if a
    widget key includes the `-widget` suffix.
14. **`$or`/`$and` must be arrays** or startup fails, an unrecognized `if`
    operator **throws**, and an empty condition object evaluates to `false`.
15. **`sortify` added to an existing field only fixes new saves** until the
    backfill migration actually runs.
16. **`relationship` supports `max` but not `min`.**
17. **An empty `time` field silently stores the CURRENT wall-clock time.**
    Converting `{}` against a `required` `time` field stored `"10:41"` — the
    actual time of the test run. It does not merely skip the required check, it
    fabricates data. Guard `time` values you did not explicitly set.
18. **`if` also accepts `min` and `max` as operator keys** (a back-compat form
    alongside `$gt`/`$lt`), which the operator list above does not imply.
19. **⛔ A colon in any editor-facing literal is silently truncated.** `label`,
    `help`, `htmlHelp`, `placeholder` and `itemLabel` are all passed through
    i18next, and Apostrophe never overrides the default `nsSeparator: ':'` — so
    i18next treats everything before the **first colon** as a namespace, fails to
    find it, and returns only the remainder. Verified:
    `'Drives --tb-brand: links, chips'` renders as `' links, chips'`, and a
    `placeholder` of `'https://vimeo.com/x'` renders as `'//vimeo.com/x'`. No
    warning. Use an em dash or comma instead, and never put a bare URL in a
    `placeholder`. (This applies to every `__t()` string, not just schema
    options — a real key like `'testbed:foo'` works precisely *because* the
    colon is a namespace separator.)
20. **`checkboxes` `min`/`max` ARE enforced server-side** (both throw), and
    unrecognized choices are silently filtered out — a rare case of a
    non-scalar type validating properly.

## Note when reading core

Core's `attachment`, `box-field`, `color-field` and `oembed-field` modules
assign `self.name` in `init` and register their field type from it. That does
**not** contradict the project-level rule that `self.name` doesn't exist on your
own modules (use `self.__meta.name`) — core is setting it deliberately. Don't
"fix" it when reading core source.

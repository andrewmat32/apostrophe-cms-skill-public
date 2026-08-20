# Relationships — the join mechanism

**Core principle: related docs are joined via relationship fields,
auto-populated at query time. Reads NEVER fetch related types via JS/AJAX or
manual re-queries** — templates and server code consume the populated `_field`
directly.

## Declaring

```js
_author: {
    label: 'Author',
    type: 'relationship',
    withType: 'author',
    max: 1,
    required: true,
    builders: {
        project: {
            title: 1, photo: 1, _url: 1     // minimum needed to render/link
        }
    }
}
```

- Name prefixed `_`; `withType` names the target module (a piece type,
  `@apostrophecms/page`, `@apostrophecms/image`, `@apostrophecms/file`).
- Add `builders.project` to any relationship whose docs are only partially
  rendered. Always include `_url` when linking. **`project:` must sit INSIDE
  `builders:` — at field top level it is silently ignored** (a real-world bug
  class: fields that join full docs, or nothing useful, because the projection
  never applied; `lint-apos` E2 catches it).
- Conditional pickers: sibling `select` discriminator + `if:`/`requiredIf:`
  (`linkType: 'page'` → show `_linkPage`).
- Relationships work inside `array` sub-schemas (menu items, hero slides).
- Reverse side: `type: 'relationshipReverse'` + `reverseOf: '_author'` —
  declared on the target type, never queried directly. It can also be pushed
  imperatively in an `'apostrophe:modulesRegistered'` handler via
  `self.schema.push(...)` when the declaring module shouldn't know about the
  reverse consumer.

## Consuming — ALWAYS an array, even with `max: 1`

Templates:

```njk
{% set author = blog._author[0] if blog._author | length else null %}
{% if data.widget._pieces and data.widget._pieces | length %}
    {% for piece in data.widget._pieces %} ... {% endfor %}
{% endif %}
<a href="{{ widget._linkPage[0]._url }}">          {# guard first — unguarded [0] can throw #}
{% set bgImage = apos.image.first( w._backgroundImage ) %}   {# image rels: apos.image.first takes the array #}
```

Server JS:

```js
const author = piece._author?.[0];
```

A piece page can render a whole related tree with zero queries — index/show
templates iterate `data.piece._children`-style joins directly, with
title/text/`_url` all coming from the relationship's projection.

## Nested (second-level) joins — extend the projection, never re-query

One level joins by default. To read a relationship OF a related doc, two
styles exist:
- Opt in via nested builders —
  `builders: { project: { ..., _images: 1 }, relationships: { _images: {} } }`.
- Whitelist the second-level `_field: 1` inside the first relationship's
  `builders.project` (e.g. `_relatedPosts` projects `_category: 1` → the page
  renders categories two joins deep, query-free).

**If `_a[0]._b` is undefined, the fix is the projection, not a `find()`.**

## Projection trap (silent failure)

A query-level `.project()` must name the relationship (`_things: 1`) or the
join silently doesn't run — `?.[0]` then hides the failure as an empty render
(a real-world bug class: an autocomplete projecting `title/_url` only, then
reading `_category?.[0]?.title` and always getting `''`).

Same trap, different field: **`aposDocId` is never auto-projected** (core adds
only `type`, `metaType` and relationship ids-storage to a projection). If
downstream code reads `doc.aposDocId` off query results — exclude-id lists,
`data-*` attributes — name `aposDocId: 1` explicitly, in query projections AND
relationship `builders.project` alike (field-proven: missing it yields
`excludeIds: [null, …]` and silent duplicate content).

## Querying BY relationship: use the ids storage, not the joined docs

Every relationship stores a `<name minus _>Ids` array (+ `...Fields`). Mongo
filters use those raw arrays:

```js
query = query.and( { categoryIds: { $in: widget.filterCategoriesIds } } );
if( widget?.piecesIds?.length ) { queryObj = { aposDocId: { $in: widget.piecesIds } }; }
```

## When a query IS legitimate (the hybrid pattern)

Editor-picked pieces = pure relationship, **no server code at all** (a
link/partner-style widget needs zero `methods()`). Add a query ONLY for a
dynamic mode, keeping the relationship path first and normalizing into one
template variable:

```js
// hybrid (in load() or an extendMethods output() override):
if( widget.filterType === 'specific' && widget._selectedBlogs?.length > 0 )
{
    widget._blogs = widget._selectedBlogs;                 // relationship IS the answer
}
else
{
    widget._blogs = await blogModule.find( req )/*...*/.toArray();   // dynamic listing
}
```

Never query unconditionally while ignoring an available relationship.

Manual relationship-storage building (`_field` + `fieldIds` + `fieldFields` +
find-by-title) belongs ONLY in one-time import/seed write paths — never copy it
into a read path.

---

## ⛔ Polymorphic relationships do NOT work in Apostrophe 4

`withType: [ 'article', 'product' ]` is **A2 leftover code**. It is the single
nastiest trap in this area because **the app boots clean** — validation lints
each type in the array without complaint — and then the first query that loads
the field throws:

```
Error: I cannot find the instance type article,product
```

The load path has an `Array.isArray( relationship.withType )` branch that does
the per-type work and then **falls through without `continue`** into
`getManager( relationship.withType )`, which is still the array. The save path is
broken two different ways too: a non-admin silently loses the field on save (the
permission check can't resolve a manager, so core "leaves the relationship
alone"), while an admin gets a thrown `relationship with type a,b unrecognized`.
The admin editor also can't render it — it indexes `apos.modules[field.withType]`
as a string key, so the doc-editor modal breaks.

An undocumented companion option `buildersByType: { article: {...} }` exists in
source but is unreachable dead code for the same reason. Upstream removed part of
this A2 residue in 3.63.2 (it was a DoS vector); the A3/A4 feature request is
still open.

**Model "one of several types" instead as:** N separate single-type
relationships plus a `select` discriminator, or one relationship to
`@apostrophecms/any-page-type`.

## Relationship options beyond the basics

| Option | What it does |
|---|---|
| `fields: { add: {...} }` | **Per-join subfields** — "this person's job title *in this department*". Stored in `<name>Fields`, read in templates as `doc._people[0]._fields.jobTitle` |
| module option `relationshipFields` | A *target type* supplies default join subfields to every relationship pointing at it — only when the field declares no `fields` of its own |
| `withRelationships: [ '_a', '_a._b' ]` | Whitelist which **nested** relationships to follow; dot notation supported |
| `builders: { areas: false }` | Core's own recommended cost control — skips widget `load()` on joined docs |
| `builders: { relationships: true \| [...] }` | Turns second-level joins on. ⚠ A **truthy non-array enables ALL** nested relationships; only an array filters |
| `ifOnlyOne: true` | Skip this relationship whenever **more than one doc** was fetched (show-page-only expensive joins) |
| `idsStorage` / `fieldsStorage` | Override the storage keys (default `nameIds` / `nameFields`) |
| `editPermission` / `viewPermission` | Per-field gates; failing them makes `convert` **silently skip** the field on save |
| `browse: false`, `suggestionFields`, `suggestionLimit`, `editorLabel`, … | Editor-UX knobs, each defaulting from the target module's `relationship*` options |

**Free query builders.** Every relationship generates `query._categories( ids )`
and `query._categoriesAnd( ids )` (`$all`), plus — when the field name starts
with `_` — slug-based `query.categories( slugs )` / `query.categoriesAnd( slugs )`.
The magic value `'none'` matches docs with no relation. They are laundered, so
`piecesFilters: [ { name: 'categories' } ]` on a piece-page gives you
`/articles?categories=news` with no code.

## Nested-join and projection traps

- **Nested relationships are OFF by default** inside a relationship's own load —
  `_a[0]._b` is `undefined` unless you set `withRelationships` or
  `builders.relationships`.
- **`required` and `min` are NOT enforced server-side on relationships** — core
  says so in a source comment (the related doc can vanish independently). Only
  `max` throws. The Vue input enforces both, so any REST/import write bypasses
  them. `required: true` on a relationship is a UI hint, not a data guarantee.
- **A user without `view` permission on the target type silently loses the
  relationship on save** — skipped, not rejected.
- **If `type` is missing from a projection, nested relationships silently don't
  load** ("there will be no manager if type was not part of the projection").
  `type`/`metaType` are auto-added only for **purely positive** projections —
  mixing a single `0` into a projection disables that, and can break `type`,
  `metaType`, joins and `_url` all at once.
- **Negative projections are never patched** — none of the auto-added
  dependencies (`_url` source fields, `type`/`metaType`, reverse-relationship
  `idsStorage`) happen.
- **Projecting an image relationship without `attachment` makes the image vanish
  silently** — see references/media.md, trap 1. Include `attachment: 1` (plus
  `alt: 1` if you render it).
- **`_url` availability is per-type**: a piece type with no piece-page simply
  never gets `_url`, with no warning.
- Joins are **batched**, not N+1 — one query per relationship per level across
  the whole result set. Cost is O(levels × relationships).
- Recursion overflow (depth 50) **warns and returns `undefined`**, silently
  truncating — the fix core suggests is `areas: false` / a projection.
- Forward relationships are always at least `[]` once the join ran. So
  `undefined` means *the join didn't run* (projection/`relationships(false)`),
  not *nothing was selected* — a useful diagnostic.

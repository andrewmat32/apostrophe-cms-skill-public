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

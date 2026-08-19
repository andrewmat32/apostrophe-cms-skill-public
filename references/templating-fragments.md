# Templating: fragments, macros, i18n

## Fragments — the rule and the real mechanics

New reusable chunks are **fragments** (`{% fragment %}` / `{% render %}`), never
new macros. Why: fragments run with request context and support async — macros
don't (`__t()`, `data.*`, async helpers all fail inside macros; the official
docs say the same).

```njk
{% fragment cardItem( images, title, description, url ) %}
    <span>{{ __t('discoverMore') }}</span>
{% endfragment %}
```

- Call with `{% render ns.name(args) %}`; same-file fragments render without a
  namespace. Fragments may be defined inline in a module template, and imports
  may appear inside a fragment body — both legal.
- A fragment may call a macro with `{{ }}`; a macro can never `{% render %}`.
- Helpers can be passed as arguments. `{% rendercall %}` (block-passing) is
  official but rarely seen in project code.

### Import form

Use the leading-slash absolute form:

```njk
{% import "/fragments/card.html" as cards %}
```

Relative forms resolve inconsistently, and repos with a theme system often key
template-override maps on the EXACT absolute string — a relative import there
silently opts out of theming (`lint-apos` E7 flags relative `fragments/`
imports). If the repo wraps imports in a resolver helper
(`{% import someHelper("/fragments/x.html") as x %}`), every themeable import
must go through it — imitate the surrounding files.

If the repo has legacy `views/macros/`: they may be load-bearing (imported from
many templates) — don't add new ones, don't casually delete or convert them
either; a macro→fragment conversion is a port, not a rename.

## Rendering areas in templates

```njk
{% area data.page, 'content' %}                                  {# page area #}
{% area data.widget, 'questions' %}                              {# widget area #}
{% area data.global, 'footerColumns' %}                          {# global-doc area #}
{% area data.widget, 'offer' with { destinationName: name } %}   {# extra context #}
```

The first argument is the DOC OBJECT holding the area field, the second the
field name. Schema side: see module-anatomy.md.

## Template locations & path conventions

| Location | Notes |
|---|---|
| `views/layout.html` | `{% extends data.outerLayout %}` (core mechanism). Common overridden blocks: `title`, `extraHead`, `beforeMain`/`main`/`afterMain` |
| `views/fragments/` | reusable chunks |
| `views/components/` | include partials reading ambient `data.*` and caller-`set` locals — Nunjucks has no `{% include with %}`; implicit locals are the only argument mechanism. If you need real parameters, that's the fragment signal |
| module `views/` | `widget.html` / `page.html` / `index.html`+`show.html`; AJAX render targets as module-local siblings |

Path quirks — intentional, don't "normalize":
- `{% extends "layout.html" %}` conventionally has NO leading slash;
  `{% import %}` does.
- Imports are one-directional: module templates → project `views/`, never the
  reverse.
- Cross-module syntax `module-name:path.html` exists
  (`@apostrophecms/pager:macros.html`) but is a rarity — don't build on it.

## i18n

- **Templates:** `{{ __t('key') }}`, with interpolation
  `__t('key', { count: n })`; core-namespace keys as `__t('apostrophe:key')`.
- **Server JS:** `req.t('key')`.
- **Where keys live:** the official mechanism is a module-level `i18n/` dir of
  `<locale>.json` files; many projects centralize ALL keys in one
  `modules/localization/i18n/<lang>.json` (the module can be registered bare,
  `localization: {}`, with no index.js). Follow the repo's existing location.
- **Every key goes into EVERY locale JSON** — mismatched key sets across
  locales are a silent-fallback bug (`lint-apos` E6 checks parity).
- Flat string keys are the safe default; follow the repo's existing key-naming
  grammar rather than inventing one.

## Filters & helpers commonly used

- Workhorse Nunjucks filters: `| safe`, `| length`, `| striptags | trim`
  (titles/meta derived from rich text), `int`, `replace`, `join`, `capitalize`,
  `date`, `round`, `urlencode`, `dump` (debug only).
- Core template helpers: `apos.attachment.url( attachment, { size } )`,
  `apos.image.first( areaOrArray )`, `apos.area.isEmpty` where available,
  and the `jsonAttribute` filter for data attributes.
- Keep data loading server-side — calling data-service helpers directly from
  Nunjucks couples templates to services and is a known anti-pattern.

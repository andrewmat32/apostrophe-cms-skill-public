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
- **Server JS:** `req.t('key')` — the key may be computed at runtime
  (`req.t( launderedValue )`). Don't translate through `self.apos.i18n.i18next`
  directly; it is internal plumbing and bypasses the request's locale.
- **Where keys live:** the official mechanism is a module-level `i18n/` dir of
  `<locale>.json` files; many projects centralize ALL keys in one
  `modules/localization/i18n/<lang>.json` (the module can be registered bare,
  `localization: {}`, with no index.js). Follow the repo's existing location.
- **Every key goes into EVERY locale JSON** — mismatched key sets across
  locales are a silent-fallback bug (`lint-apos` E6 checks parity).
- Flat string keys are the safe default; follow the repo's existing key-naming
  grammar rather than inventing one.

- ⛔ **A colon truncates any `__t()` string.** i18next's default
  `nsSeparator` is `':'` and core never overrides it, so everything before the
  first colon is read as a namespace and dropped. This bites hardest on
  *literal* strings passed to `__t`/`label`/`help`/`placeholder` (a bare URL
  becomes `//host/path`). Details: references/schema-fields.md trap 19.

### ⛔ More than one locale ⇒ the site MUST ship a visitor-facing language switcher

Translating content is only half the job. If `@apostrophecms/i18n` declares more
than one locale, a **visitor** must be able to reach their language from any
page — a prefix they have to type by hand is not a feature. Treat the switcher as
part of "done" for any multi-locale work, exactly like the translated keys are.

Core builds **`data.localizations`** on every page send. Each entry has
`locale`, `label`, `current`, `available`, `_url` (this document in that locale)
and `homePageUrl` (the fallback when this document isn't translated):

```njk
{% if data.localizations | length > 1 %}
    <nav class="locale-switcher" aria-label="{{ __t('site:languageLabel') }}">
        <ul>
            {% for l in data.localizations %}
                <li>
                    {% if l.current %}
                        <span aria-current="true">{{ l.locale | upper }}</span>
                    {% elif l.available and l._url %}
                        <a href="{{ l._url }}" aria-label="{{ l.label }}">{{ l.locale | upper }}</a>
                    {% else %}
                        <a href="{{ l.homePageUrl }}" aria-label="{{ l.label }}">{{ l.locale | upper }}</a>
                    {% endif %}
                </li>
            {% endfor %}
        </ul>
    </nav>
{% endif %}
```

- Put it in `views/layout.html` so it exists on **every** page, not just the home
  page.
- **404s are the gap.** Core does not populate `data.localizations` on a
  `notFound` render, so a switcher gated on it **disappears exactly where a
  visitor is most lost**. Give the `{% if %}` an `{% else %}` branch that links
  each configured locale's home page. Field-proven: a French visitor hitting a
  bad URL had no way back to French.
- On a piece show page `_url` is core's redirect route
  (`/api/v1/<type>/<id>/locale/<loc>`) — that redirect **is** the documented
  mechanism and it lands on the translated slug. Don't "fix" it into a literal
  URL.
- Distinguish "translated" from "not translated": `available && _url` goes to the
  same document, otherwise you are sending them to that locale's home page. Mark
  that case visually so it isn't a surprise.
- **Affordance is part of correctness.** A switcher rendered in faint
  low-contrast text reads as a disabled label, and users report "I can't change
  the language" about a switcher that works perfectly. Give it a real control
  treatment — a bordered/segmented group, an icon or a visible label, hover and
  `:focus-visible` states, and inactive locales in readable (not faint) ink.
  Verify it as a control, not just as markup that exists.

## ⚠ WSL: template edits need a restart

`@apostrophecms/template`'s view watcher **skips watch setup entirely on WSL**
(`lib/viewWatcher.js`: *"chokidar's recursive watching is not reliable on WSL;
preserve the historical behavior of skipping watch setup entirely there"*). The
Nunjucks loader cache is therefore never invalidated, so **a `.html` edit is
invisible until you restart the process** — no error, the old markup just keeps
rendering. Field-proven: an agent verified template changes against a running
server and saw stale output.

If you are verifying template work on WSL, either restart the instance or boot a
throwaway one on another port. This does not apply on native Linux/macOS, where
the watcher arms normally.

## Filters & helpers commonly used

- Workhorse Nunjucks filters: `| safe`, `| length`, `| striptags | trim`
  (titles/meta derived from rich text), `int`, `replace`, `join`, `capitalize`,
  `date`, `round`, `urlencode`, `dump` (debug only).
- Core template helpers: `apos.attachment.url( attachment, { size } )`,
  `apos.image.first( areaOrArray )`, `apos.area.isEmpty` where available,
  and the `jsonAttribute` filter for data attributes.
- Keep data loading server-side — calling data-service helpers directly from
  Nunjucks couples templates to services and is a known anti-pattern.

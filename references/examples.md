# Implementation examples — every CMS element type

A copy-paste cookbook: one coherent feature (**Testimonials**) implemented
element-by-element following the skill's rules. Each section notes the rules it
exercises. Assumed project: Apostrophe 4.x + Vite, ESM,
`nestedModuleSubdirs: true`. Match your repo's brace/spacing style.

---

## 1. Piece type (content model)

*Rules: ESM module shape, family folders, schema idioms, registration truth.*

```
modules/pieces/testimonial-module/
├── modules.js        ← children registration (THE registration mechanism)
├── testimonial/      ← the piece
└── testimonial-page/ ← the piece page (§2)
```

`modules/pieces/testimonial-module/modules.js`:

```js
export default {
    testimonial: {},
    'testimonial-page': {}
};
```

Registration truth: `nestedModuleSubdirs: true` globs **every** `modules.js`
under `modules/` — that file alone makes the modules exist. Registering the
family dir itself is optional readability; if you do, silence the no-code
warning with a stub `index.js`
(`export default { options: { ignoreNoCodeWarning: true } };`) or inline
(`'testimonial-module': { options: { ignoreNoCodeWarning: true } }`).

`modules/pieces/testimonial-module/testimonial/index.js`:

```js
export default {
    extend: '@apostrophecms/piece-type',
    options: {
        label: 'Testimonial',
        pluralLabel: 'Testimonials',
        sort: {
            updatedAt: -1
        }
        // opt-outs for content that has no public page of its own:
        // seoFields: false,
        // openGraph: false,
        // slugPrefix: 'ts-'
    },
    fields: {
        add: {
            title: {
                label: 'Customer Name',
                type: 'string',
                required: true
            },
            quote: {
                label: 'Quote',
                type: 'string',
                textarea: true,
                required: true
            },
            rating: {
                label: 'Rating',
                type: 'select',
                def: '5',
                choices: [
                    { label: '5 stars', value: '5' },
                    { label: '4 stars', value: '4' },
                    { label: '3 stars', value: '3' }
                ]
            },
            photo: {
                label: 'Photo',
                type: 'area',
                options: {
                    max: 1,
                    widgets: {
                        '@apostrophecms/image': {}
                    }
                }
            },
            _product: {
                label: 'Related Product Page',
                type: 'relationship',
                withType: '@apostrophecms/page',
                max: 1,
                builders: {
                    project: {           // MUST be inside builders — top-level project: is silently ignored
                        title: 1,
                        _url: 1
                    }
                }
            }
        },
        group: {
            basics: {
                label: 'Basics',
                fields: [ 'title', 'quote', 'rating' ]
            },
            media: {
                label: 'Media',
                fields: [ 'photo' ]
            },
            utility: {
                fields: [ '_product' ]
            }
        }
    }
};
```

Don't cargo-cult options (`publicApiProjection`, `autopublish`, `localized`,
`cache`) you can't see used in the repo or justify from the official docs.

---

## 2. Piece page (index + show)

*Rules: derived `pieceModuleName`, the three data-shaping mechanisms, park
mounting.*

`modules/pieces/testimonial-module/testimonial-page/index.js`:

```js
export default {
    extend: '@apostrophecms/piece-page-type',
    options: {
        label: 'Testimonials Page',
        perPage: 12
        // pieceModuleName derived automatically ('testimonial-page' → 'testimonial');
        // set it only when names differ (help-center-page → 'help-article')
    },
    methods( self )
    {
        return {
            async beforeShow( req )
            {
                req.data.breadcrumbs = [
                    { label: 'Testimonials', url: req.data.page._url },
                    { label: req.data.piece.title }
                ];
            }
        };
    }
};
```

Data-shaping alternatives:

```js
// 1. shape the index cursor (editor-configurable page size, publish gating):
extendMethods( self )
{
    return {
        indexQuery( _super, req )
        {
            const query = _super( req );
            if( req.data.page?.postsPerPage ) { query.perPage( req.data.page.postsPerPage ); }
            return query;
        }
    };
},
// 2. beforeSend with a type guard (fires for ALL pages + both routes — hence the guard):
handlers( self )
{
    return {
        '@apostrophecms/page:beforeSend': {
            async loadFeatured( req )
            {
                if( req.data.piece || req.data.page?.type !== 'testimonial-page' ) { return; }
                // req.data.featured = ...
            }
        }
    };
}
```

Extras when applicable: `piecesFilters: [ { name: '_product' } ]` for
query-string faceting; index-only pages = `beforeShow` sets
`req.notFound = true` + an EMPTY but present `views/show.html`; full 404 =
`req.notFound = true; req.res.statusCode = 404;
self.setTemplate( req, 'notFound' );`.

**Mounting:** piece-pages are typically mounted via `park:` in
`modules/@apostrophecms/page/index.js`:

```js
park: [
    {
        title: 'Testimonials',
        slug: '/testimonials',
        type: 'testimonial-page',
        parkedId: 'testimonial-page'
        // park entries may carry page-schema defaults of that type
    }
]
```

Templates: `views/index.html` + `views/show.html`, both
`{% extends "layout.html" %}` (no leading slash — the convention). Pagination
has no universal dialect — copy the nearest existing index page's approach.

---

## 3. Widget — pure relationship (no server code at all)

*Rules: relationships as the join mechanism; the editor's selection IS the
answer.*

`modules/widgets/testimonials-widget/index.js`:

```js
export default {
    extend: '@apostrophecms/widget-type',
    options: {
        label: 'Testimonials Widget',
        icon: 'format-quote-close-icon'      // vue-material-design-icons name, -icon suffix convention
    },
    fields: {
        add: {
            title: {
                label: 'Title',
                type: 'string'
            },
            _testimonials: {
                label: 'Testimonials',
                type: 'relationship',
                withType: 'testimonial',
                max: 4,
                builders: {
                    project: {
                        title: 1, quote: 1, rating: 1,
                        _product: 1        // second-level join populates ONLY if listed here
                    }
                }
            }
        },
        group: {
            basics: { label: 'Basics', fields: [ 'title', '_testimonials' ] }
        }
    }
};
```

Registered in a `modules.js` and offered in an area:

```js
content: {
    type: 'area',
    options: {
        widgets: {
            testimonials: {}          // widget name minus '-widget'
        }
        // large widget menus: expanded: true, groups: { content: { label, widgets, columns: 2 } }
    }
}
```

Template — Apostrophe populated `_testimonials` at query time; no load(), no JS:

```njk
{% import "/fragments/testimonial-card.html" as testimonialCardFragment %}

{% if data.widget._testimonials and data.widget._testimonials | length %}
    {% for testimonial in data.widget._testimonials %}
        {% render testimonialCardFragment.testimonialCard( testimonial ) %}
    {% endfor %}
{% endif %}
```

---

## 4. Widget — dynamic listing (query + data handoff)

*Rules: hybrid rule (query only for dynamic modes), one serializable data
object.*

Add to the widget above a `showMode` select (`selected`/`latest`) and:

```js
    build: {
        vite: {
            bundles: {
                'testimonials': {}     // key === ui/src/testimonials.js filename (NOT module name)
                // a second key may reference ANOTHER module's bundle (cross-module pull-in)
            }
        }
    },
    // ⚠️ defer: true is the real lazy option — `deferred: true` is a silent no-op
    // ⚠️ load() must EXTEND the base — core widget-type's load() is what joins
    // schema relationships (schema.relate). A methods()-level load() replaces it,
    // so widget._testimonials would NEVER populate and the "selected" branch
    // below would be silently dead. (A methods()-level load() is only viable
    // when the widget queries by its ids storage and never reads joined _fields.)
    extendMethods( self )
    {
        return {
            async load( _super, req, widgets )
            {
                await _super( req, widgets );
                for( const widget of widgets )
                {
                    if( widget.showMode === 'selected' && widget._testimonials?.length )
                    {
                        widget.items = widget._testimonials;      // relationship path FIRST
                    }
                    else
                    {
                        widget.items = await self.apos.modules['testimonial']
                            .find( req )
                            .archived( false )
                            .project( { title: 1, quote: 1, rating: 1, _product: 1 } )   // name _fields or they don't join
                            .limit( 4 )
                            .toArray();
                    }
                    widget.playerData = {          // ONE serialisable object for the player
                        total: widget.items.length
                    };
                }
            }
        };
    }
```

Template:

```njk
<div id="testimonials-widget" data-playerdata="{{ data.widget.playerData | jsonAttribute }}">
```

The same extend-don't-replace rule applies to `output()` overrides — a
`methods()`-style `output()` silently replaces whatever the project layered
into the render chain:

```js
extendMethods( self )
{
    return {
        async output( _super, req, widget, options, _with )
        {
            widget.items = widget._testimonials?.length ? widget._testimonials : await /* query */;
            return _super( req, widget, options, _with );
        }
    };
}
```

Simple values can ride as individual kebab `data-*` attributes instead of a
JSON blob — imitate the repo's dominant idiom.

---

## 5. Fragment (reusable chunk — NEVER a macro)

*Rules: fragments have request context; absolute imports.*

`views/fragments/testimonial-card.html`:

```njk
{% fragment testimonialCard( testimonial ) %}
    <article class="testimonial-card">
        <blockquote>{{ testimonial.quote | striptags | trim }}</blockquote>
        <span>{{ testimonial.title }}</span>
        <span>{{ testimonial.rating }} {{ __t('stars') }}</span>
        {% if testimonial._product and testimonial._product | length %}
            <a href="{{ testimonial._product[0]._url }}">{{ __t('viewProduct') }}</a>
        {% endif %}
    </article>
{% endfragment %}
```

Usage:

```njk
{% import "/fragments/testimonial-card.html" as testimonialCardFragment %}
{% render testimonialCardFragment.testimonialCard( piece ) %}
```

If the repo has a theme system that resolves template overrides, wrap EVERY
themeable import in its resolver helper with the exact absolute path, and keep
override files' fragment names identical to the base file's — the resolver
swaps the FILE, not the symbol. Inline fragments in a module template and
imports inside fragment bodies are legal. Never add macros.

---

## 6. AJAX endpoint

*Rules: route styles, response shape follows the consumer, laundering, gating.*

```js
apiRoutes( self )
{
    return {
        post: {
            // PUBLIC (visitor-facing): leading-slash = literal top-level URL.
            // (If your repo routes public endpoints under /api/v1 named routes
            // instead, do that — imitate the repo.)
            '/getMoreTestimonials': async ( req ) =>
            {
                const skip = self.apos.launder.integer( req.body.skip, 0, 0, 500 );  // launder EVERYTHING
                const testimonials = await self.apos.modules['testimonial']
                    .find( req ).archived( false ).skip( skip ).limit( 6 ).toArray();

                const html = await self.render( req, 'testimonialList.html', { testimonials } );
                // NOTE: bare and leading-slash template names resolve to the MODULE's
                // own views/ first — render the same template the page render used.
                return { html: html, count: testimonials.length };
            },
            // ADMIN (Vue-facing): NAMED route → /api/v1/<module>/reorder, admin-gated
            reorder: async ( req ) =>
            {
                if( !self.apos.permission.can( req, 'admin' ) )
                {
                    throw self.apos.error( 'forbidden' );
                }
                // ... the thrown error's message reaches the browser as err.body.message
            }
        }
    };
}
```

Markup-triggered swap variant (htmx-style): return the **raw HTML string**
itself — core sends a returned string verbatim, and the swap injects it.
`routes( self )` (`(req, res)` raw Express) exists for redirects/streaming;
`renderRoutes` is official — use it only where the repo already does.

---

## 7. Widget player + client JS

*Rules: interactivity order (Alpine if vendored → vanilla → swap-lib last),
window discipline, re-binding.*

`modules/widgets/testimonials-widget/ui/src/testimonials.js`:

```js
export default () =>
{
    apos.util.widgetPlayers.testimonials = {
        selector: '[id="testimonials-widget"]',      // ID selector = ONE instance/page; use [id^="x_"] for repeatable widgets
        player: function( el )
        {
            const playerData = el?.dataset?.playerdata ? JSON.parse( el.dataset.playerdata ) : null;
            if( !playerData ) { return; }

            el.querySelector( '.testimonials__more' )?.addEventListener( 'click', async () =>
            {
                const response = await apos.http.post( '/getMoreTestimonials', { body: { skip: playerData.total } } );
                if( response.html )
                {
                    el.querySelector( '.testimonials__list' ).insertAdjacentHTML( 'beforeend', response.html );
                    apos.util.runPlayers( el );        // re-run players on injected subtree
                }
            } );
        }
    };
};
```

Window discipline: expose on `window` ONLY when markup forces it (Alpine
`@click` expression, `x-data="factory()"`, third-party callback) —
`Object.assign( window, { toggleTestimonial } );` — and grep for the name
first; colliding globals across widget bundles is a real bug class. Pure
client-side toggle with Alpine vendored:
`<div x-data @click='$el.classList.toggle( "open" )'>`.

---

## 8. Custom page type

*Rules: page module + `views/page.html`; `types:` vs `park:` is a deliberate
choice.*

`modules/pages/testimonials-landing-page/index.js` —
`extend: '@apostrophecms/page-type'`, an area field offering
`testimonials: {}`, and `views/page.html` with
`{% extends "layout.html" %}` + `{% block main %}
{% area data.page, 'content' %} {% endblock %}`. Register it, then EITHER add
to the `types:` allowlist (only if editors should create it from the page
menu) OR mount via `park:`.

---

## 9. Service module

*Rules: alias, cross-module via alias never HTTP, external APIs via one
wrapper service.*

`modules/services/testimonial-service/index.js`:

```js
export default {
    extend: '@apostrophecms/module',
    options: {
        alias: 'testimonialService'
    },
    async init( self )
    {
        self.dbService = self.apos.dbService;     // alias-caching idiom (if the repo has one)
    },
    methods( self )
    {
        return {
            async getAverageRating( req )
            {
                const testimonials = await self.apos.modules['testimonial']
                    .find( req ).archived( false ).project( { rating: 1 } ).toArray();
                if( !testimonials.length ) { return null; }
                const total = testimonials.reduce( ( sum, t ) => sum + parseInt( t.rating ), 0 );
                return Math.round( ( total / testimonials.length ) * 10 ) / 10;
            }
        };
    }
};
```

Register it like any module (some repos enable services from `app.js` by path:
`'services/testimonial-service': {}`). Consumed as
`await self.apos.testimonialService.getAverageRating( req )`. External API
calls go through the repo's api-wrapper service — never mutate its responses
in place (shared cache references).

---

## 10. Site-wide config (pick the right layer)

*Rules: globals-config-and-scoping.*

- Editor-controlled toggle ("show testimonials sitewide") → **global doc
  field** in `modules/@apostrophecms/global/index.js`; read as
  `data.global.showTestimonials`.
- A site-wide UI block editors configure once → **area on the global doc**,
  rendered anywhere with `{% area data.global, 'testimonialsBar' %}`.
- Deploy-time constant → the repo's app.js settings option.
- Per-instance/env (API URL, devMode) → `data/local.js`.
- Derived cached data → a get-or-build process-memory Map, or `apos.cache`
  when it must survive restarts.

---

## 11. Event handler (denormalization) + CLI task

*Rules: mechanisms-and-ops.*

```js
// on the piece — own doc events unquoted; the denormalization pattern:
handlers( self )
{
    return {
        beforeSave: {
            async stampProductSlug( req, doc )
            {
                doc.productSlug = doc._product?.[0]?.slug ?? null;
            }
        }
    };
},
// CLI task (tool-module style):
tasks( self )
{
    return {
        reindex: {
            usage: 'node app.js testimonial:reindex - Recomputes testimonial ratings',
            async task( argv )
            {
                const req = self.apos.task.getReq();
                await self.reindexAll( req );
            }
        }
    };
}
```

---

## Registration checklist (the silent-failure traps)

| Element | Must be listed in |
|---|---|
| widget | a `modules.js`/app.js + some area's `options.widgets` |
| piece family | its own `modules.js` (parent registration optional) |
| page type | registration + (`types:` allowlist OR `park:`) |
| piece-page | registration + `park:` |
| service | `app.js` or a `modules.js` (path-qualified forms exist) |
| scss partial | the repo's central `index.scss` cascade, if it has one |
| vite bundle | `build.vite.bundles` key === `ui/src/<name>.js` filename |
| translations | EVERY locale JSON in the repo's i18n location |
| admin icon | the module's `icons:` map before use in adminBar |

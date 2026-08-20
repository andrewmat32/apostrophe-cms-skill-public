# Frontend ↔ backend data flow

Route style is where projects diverge most from the textbook. **Discover the
repo's own convention first** (grep for `apiRoutes`, `renderRoutes`, an existing
`apos.http.post` call site, the response shapes handlers return), then imitate
it. Where the repo shows no precedent, use the official patterns below.

## Route sections (all core-verified)

- **`apiRoutes( self )`** — the workhorse. Handlers get `( req )` and RETURN the
  response: a returned object is sent as JSON; a returned **string is sent
  verbatim as the response body** (that's how raw-HTML endpoints work).
  - **Named routes** (`async thing( req )`) mount under
    `/api/v1/<module-name>/<route>` (core: the module's `action` URL) — and
    core KEBAB-CASES the name in the URL (`getRouteUrl` → `cssName`):
    `loadMore` mounts at `/load-more`. A hand-built endpoint string using the
    camelCase name 404s (field-proven); derive URLs as
    `` `${ self.action }/kebab-name` `` or better, let `apos.http` callers
    take the URL from server-provided data you computed correctly once.
    - ⚠ **Page-type modules are the exception**: every `@apostrophecms/page-type`
      subclass shares the `@apostrophecms/page` action (core overrides
      `enableAction()` with `self.action = apos.modules['@apostrophecms/page'].action`
      in `page-type/index.js`), so a named route `submit` on a `contact-page`
      page-type mounts at `/api/v1/@apostrophecms/page/submit` — the "obvious"
      `/api/v1/contact-page/submit` 404s (field-proven). Fix: use a
      leading-slash name (`'/api/v1/contact-page/submit'`) so the route is
      site-relative, or host the route on a non-page module (e.g. the piece
      type it inserts). Piece and plain modules are unaffected.
  - **Leading-slash names** (`'/loadThings'`) are literal site-relative URLs —
    core treats a name starting with `/` as the exact URL. Some production
    codebases use this for public visitor endpoints and keep `/api/v1` named
    routes for admin surfaces; follow your repo.
- **`routes( self )`** — raw Express `( req, res )`, you send the response
  yourself. Use for redirects, special headers, streaming.
- **Binary/streaming endpoints** — `apiRoutes` can't stream and the body parser
  eats non-JSON bodies. The pattern: push raw routes onto `self._routes` from an
  `'@apostrophecms/express:compileRoutes'` handler, so they mount after session
  middleware (`req.user` exists) and can pipe streams both ways.
- **`renderRoutes( self )`** — official: returns a rendered template for the
  route. Fine when the repo uses it; many production codebases prefer
  `apiRoutes` + `self.render` for the same job.
- **`restApiRoutes`** — full REST semantics for custom URLs; rarely needed in
  server-rendered projects.

## The browser side

```js
// project ui/src code and admin Vue alike:
const result = await apos.http.post( '/api/v1/product/feature', { body: { id } } );
```

- `apos.http.get/post` handles CSRF and JSON encoding — prefer it over raw
  `fetch` (exception: binary blob downloads / octet-stream uploads, where you
  must use `fetch` and add headers yourself).
- Some codebases attach a custom header (an "this is AJAX" marker) that their
  own middleware consumes — if the repo's existing calls all send one, send it
  too; it usually short-circuits a site-wide middleware for AJAX URLs.

## Handler shape follows the CONSUMER

- JSON consumers (`apos.http` + JS logic): return an object. Pick ONE error
  envelope and reuse the repo's — either `throw self.apos.error( 'forbidden' |
  'invalid', msg )` (surfaces as proper HTTP status; the message lands in
  `err.body.message` browser-side) or the repo's hand-built
  `{ status, code, message }` shape. Don't introduce a second convention.
- Markup-swap consumers (htmx-style declarative swaps, or JS doing
  `el.innerHTML = html`): return a **raw HTML string** from
  `await self.render( req, 'template.html', data )`. Returning JSON to a
  markup-swap consumer injects serialized JSON as visible text.

## `self.render` path semantics (trap)

Bare AND leading-slash template names resolve to the module's own `views/`
first — a leading slash does NOT mean "project views". Project-level `views/`
subdirectories are reachable only because they fall through module resolution.
Render the same markup source the page render used, so initial and AJAX HTML
stay identical — and note the CONTEXT difference: data passed to
`self.render( req, 'x.html', { items } )` is exposed to the template as
`data.items`, not bare `items`. The robust shared-markup shape is a fragment
both templates import; the AJAX target is then a thin wrapper looping
`data.items` and rendering the fragment.

## Security floor for every handler

- **Mind where your middleware is mounted.** A rate limiter (or auth/logging
  middleware) mounted at a URL prefix such as `/api/v1` never runs for
  leading-slash routes, which mount at the **site root** — exactly where public
  visitor endpoints usually live. If you add a public form or search route and
  want it limited, either register it as a named `/api/v1` route or extend the
  limiter's mount to cover the bare paths.

- Launder ALL input: `self.apos.launder.string( req.body.x )`,
  `.integer`, `.boolean`, `.id` — every `req.body`/`req.query` read.
- Admin gating is `self.apos.permission.can( req, 'admin' )` (or
  `permission.isAdmin( req )`) — **`if( req.user )` is NOT an admin check**
  (any logged-in user passes); it's a common latent bug in older code.
- Never trust client-supplied prices/ids/flags — re-derive server-side.

## Anti-patterns

| Instinct | Reality |
|---|---|
| inventing a second response envelope | reuse the repo's ONE convention (thrown `apos.error` OR its status-object) |
| returning JSON to a markup-swap endpoint | raw HTML string — the swap injects the body verbatim |
| `if( req.user )` as an admin gate | `permission.can( req, 'admin' )` |
| unlaundered `req.body` reads | `self.apos.launder.*` on every field |
| fetching related docs from an endpoint the template could have joined | relationships auto-join — see relationships.md |

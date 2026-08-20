# Media — images, attachments, files, video

Verified against core 4.32. `relationships.md` covers projections generally;
**trap 1 below is the media-specific projection trap and is the single most
common way images silently disappear.**

## Three ways to hold an image

| Approach | Reuse | Crop / focal point | Use when |
|---|---|---|---|
| `@apostrophecms/image` piece + `relationship` | library-wide | **yes** | The normal choice |
| `area` with `@apostrophecms/image` widget | library-wide | yes | Editor places it in flowing content |
| bare `type: 'attachment'` field | single use | **no** | A one-off file, not a library asset |

Any relationship with `withType: '@apostrophecms/image'` **silently inherits**
crop/focal-point subfields and the image chooser, because the image module
declares `relationshipFields` — but **only when your field declares no `fields`
of its own**. Adding your own `fields` to an image relationship therefore kills
cropping and focal point (trap 8).

## Built-in image sizes

| Name | Box |
|---|---|
| `max` | 1600 × 1600 |
| `full` | 1140 × 1140 (**the default for `url()`**) |
| `two-thirds` | 760 × 760 |
| `one-half` | 570 × 700 |
| `one-third` | 380 × 700 |
| `one-sixth` | 190 × 350 |

Plus the pseudo-size `original`. Scaling is *fit inside the box, aspect
preserved, never upscaled*. `imageSizes` is a **cascade** on
`@apostrophecms/attachment`:

```js
// modules/@apostrophecms/attachment/index.js
export default {
    imageSizes: { add: { hero: { width: 2000, height: 1200 } } }
};
```

After adding a size, existing attachments have no file for it — run
`node app @apostrophecms/attachment:rescale`, or those URLs 404.

## The template idioms

```njk
{# area that may be empty #}
{% if not apos.area.isEmpty( data.page, 'main' ) %}{% area data.page, 'main' %}{% endif %}

{# image relationship — bind first, then guard #}
{% set img = apos.image.first( data.piece._hero ) %}
{% if img %}
    <img src="{{ apos.attachment.url( img, { size: 'one-half' } ) }}"
         srcset="{{ apos.image.srcset( img ) }}"
         sizes="(max-width: 800px) 100vw, 50vw"
         alt="{{ img._alt or '' }}"
         {% if apos.attachment.hasFocalPoint( img ) %}
             style="object-position: {{ apos.attachment.focalPointToObjectPosition( img ) }}"
         {% endif %}>
{% endif %}

{# file download #}
{% set file = data.piece._brochure[0] %}
{% if file %}<a href="{{ file._url }}" download>{{ file.title }}</a>{% endif %}
```

`apos.image.first`/`all` are `apos.attachment.first`/`all` forced to the `images`
group. **They return the attachment, not the piece** — and while walking they
hoist `_alt`, `_credit`, `_creditUrl`, `_crop` and `_focalPoint` onto it, which
is exactly why `apos.attachment.url( apos.image.first( rel ) )` yields the
*cropped* URL with no extra arguments. Pass the narrowest object you can; the
walk is exhaustive.

`apos.attachment.url()` options: `size`, `crop: false` (ignore stored crop),
`uploadfsPath: true`.

## Crop vs focal point

- **Crop** is server-side and produces real files (route + `crops[]` on the
  attachment; croppable extensions are `gif/jpg/png/webp` — **not SVG**).
  `url()` applies `options.crop || attachment._crop || attachment.crop`
  automatically.
- **Focal point** is CSS-only: `x`/`y` percentages surfaced through
  `focalPointToObjectPosition()`. **`url()` never encodes it** — and it only does
  anything if your CSS actually crops the box (`object-fit: cover` + fixed size).
- `apos.attachment.getWidth/getHeight` return the **crop's** dimensions when a
  crop is in play.

## Files and video

`@apostrophecms/file-widget` is one `_file` relationship rendering
`<a href="{{ file._url }}" download>`. Accepted extensions come from the
attachment module's `fileGroups`: **images** (`gif jpg png svg webp`) and
**office** (`txt rtf pdf xls ppt doc pptx … docx`). Extend with `addFileGroups`
(replacing `fileGroups` wipes the defaults). `prettyUrls`/`prettyUrlDir` on
`@apostrophecms/file` (4.28+) serve downloads through a proxy route.

**Video is entirely client-side.** The widget server-renders an empty div
carrying the URL; a player fetches
`/api/v1/@apostrophecms/oembed/query?url=…`, injects `result.html`, strips
`width`/`height` and sets `aspect-ratio` (so no CSS ratio hack is needed). With
JS off, or a failed bundle, you get an **empty div — there is no SSR fallback**.

The oembed proxy caches for `cacheLifetime` (3600s) and is allowlist-gated.
**The allowlist is an XSS boundary, not a convenience** — provider HTML is
injected via `innerHTML`, so adding a host trusts it with script execution on
your origin. `minimumAllowlist`/`minimumEndpoints` (4.30+) are the only way to
*prune* the base list. Expect a strict CSP (`frame-src`) to break embeds, and
note there is no `youtube-nocookie` switch in core.

`image-tag`/`file-tag` exist to organize the media library in admin; front-end
use is rare — give your own piece type an image relationship instead.

## uploadfs (the useful 20%)

Config lives on **`@apostrophecms/uploadfs`**, not attachment (`imageSizes` stays
on attachment). Defaults to the `local` backend under `public/uploads`; backends
are `local`, `s3`, `azure`, `gcs`. Setting `APOS_S3_BUCKET` alone flips to S3 and
merges `_KEY`/`_SECRET`/`_REGION`/`_ENDPOINT`. Image processor is `sharp` by
default; `postprocessors` is where imagemin goes; `cdn: { url, enabled }` exists.

**Archive lifecycle (surprising):** attachments track referencing docs. When the
last live doc referencing one is archived, core **disables every size and crop in
uploadfs** except `sizeAvailableInArchive` (default `one-sixth`, kept for the
library thumbnail). When the last archived reference goes, the attachment is
deleted outright. A URL you cached, hard-coded or exported can therefore go dead
because an editor archived a doc.

## Traps

1. **A relationship projection that omits `attachment` makes images vanish
   silently.** The projection finalizer auto-adds `type`, `metaType`, `_url`
   source fields and relationship storage — **never `attachment`, never `alt`**:
   ```js
   _hero: { type: 'relationship', withType: '@apostrophecms/image',
            builders: { project: { title: 1, slug: 1 } } }   // ← image now invisible
   ```
   `apos.image.first()` returns `undefined`, `url()` returns the missing-icon
   SVG, and the only signal is a server-console warning. Core patches this into
   its own chooser projection for the same reason.

   **Scope it precisely** (verified by experiment — an earlier version of this
   note over-generalized): the rule applies when the **projected relationship is
   itself `withType: '@apostrophecms/image'`**. It does **not** apply to an image
   held in an *area* on the related doc — e.g. projecting an `author` with
   `portrait: 1` (an area) works fine without `attachment: 1`, because the
   relationship sub-query is an ordinary `find()`, so the area's widget loaders
   run and the image widget's own `_image` relationship is joined with **core's**
   projection, which already includes `attachment`. Adding `attachment: 1` there
   would be a no-op — `author` has no `attachment` field of its own. So: project
   the area field itself for area-held images; add `attachment: 1` (+ `alt: 1`)
   only for direct image relationships.
2. **`apos.attachment.url()` never throws and never validates.** `null` → the
   missing-icon URL + a console warning. Passing an image **piece** instead of
   its attachment → a garbage URL with **no warning at all**. Since 4.27 these
   helpers deliberately never throw, which turns a template crash into a silently
   wrong page.
3. **A missing image size is a 404, not a fallback** — add a size, run `:rescale`.
4. **`alt` lives on the image piece** and only reaches you as `_alt` via
   `first()`/`all()`. Bypass those helpers and you must read `piece._image[0].alt`.
   `alt` is **not required** on the image piece, so always `or ''`.
5. **`srcset` width descriptors are wrong for portrait images** — descriptors use
   the size's configured *width*, but several sizes are height-constrained
   (`one-half` is 570×**700**), so a tall image's file is narrower than
   advertised and the browser may pick too small a file. Use squarer custom sizes
   if it matters. `srcset` also returns `''` for SVG.
6. **`sizes` can't be set from area widget options** — the core image widget
   reads it from the area tag's `with` object:
   `{% area data.page, 'main' with { sizes: '...' } %}`.
7. **Widget option scope differs per option**: `size`/`loadingType`/`className`
   work at area **or** module level; `aspectRatio`/`minSize` are **area-level
   only**; `linkWithType` is **module-level only** (the public docs example is
   misleading).
8. **Declaring your own `fields` on an image relationship silently kills crop and
   focal point** (see above).
9. **`maxSize` on the attachment module enforces nothing** — it only renders a
   hint in the uploader; the upload route sets no multer limit. Enforce upload
   size at the reverse proxy.
10. **Uploading requires `contributor`/`editor`** — anonymous front-end upload
    features must run through your own trusted server code calling
    `apos.attachment.insert( req, file, { permissions: false } )`.
11. **SVG uploads are DOMPurify-sanitized in place** (external `xlink:href` is
    stripped), so an SVG can render differently after upload than it did locally.
12. **`download` is ignored cross-origin** — once uploadfs points at S3/a CDN,
    the core file widget's `download` attribute silently becomes a no-op.
13. **The image widget has no working default placeholder in 4.32** — set
    `placeholderImage` or `placeholderUrl` yourself if you want one.

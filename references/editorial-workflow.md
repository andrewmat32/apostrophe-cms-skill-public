# Editorial workflow, notifications & admin feedback

Draft/publish, roles, the contributor review flow, `apos.notify`, keyboard
commands, and the archive. Everything here is verified against core 4.32.

## Roles and who can publish

One `role` field on the user doc: `guest | contributor | editor | admin`, ranked
`0/1/2/3`. The decisive rules:

- **contributor** — may edit **drafts only**; `canPublish()` returns true only
  for `editor`. A contributor can never publish.
- **editor** — edits and publishes.
- **admin** — short-circuits to `true` before any manager lookup.

Per-type overrides are `editRole` (default `'contributor'`), `publishRole`
(default `'editor'`), `viewRole` (default `false`).

### `autopublish: true` — what it does and does NOT do

An autopublish type publishes on every draft save, and core performs that
publish with an **edit-level** permission flag rather than a publish-level one.
That reads like a privilege hole, and an earlier version of this reference
claimed it was one. **Measured on 4.32.1, it is not** — a contributor on an
autopublish type with the default `editRole: 'contributor'` gets `forbidden` on
**both** insert and update of an existing published doc.

The reason is worth knowing, because it is not obvious from the autopublish code
path: `publish()` looks the existing published doc up with `findOneForEditing`
using **the caller's own req**, and a contributor cannot see published docs. So
`published` comes back falsy, core takes the first-time branch, and
`insertPublishedOf` demands real `publish` permission. Both paths land there.

Still pair `autopublish` with an explicit `editRole` when the content warrants
it — every core autopublish type (`image`, `file`, `image-tag`, `file-tag`,
`styles`) sets `editRole: 'editor'`, and doing the same is good practice for
anything carrying PII or appearing unreviewed on the public site:

```js
options: { autopublish: true, editRole: 'editor', publishRole: 'editor' }
```

Just don't justify it with a privilege escalation that does not exist. What
autopublish genuinely removes is the **review step**: there is no draft for an
editor to approve, so whoever *can* edit sees their change go live immediately.

### `localized: false`

Force-clears `autopublish`; the doc gets no `aposLocale`, no `aposMode`, no
draft counterpart. `publish()` throws a raw `Error` (a 500). Two traps: `submit()`
has **no** localized guard, so you can strand a non-localized doc in the
Submitted Drafts list forever; and because `can()` keys off `req.mode`,
non-localized content is contributor-editable only from draft-mode requests.

## The submitted-draft review flow

The entire persistence model is **one subdocument on the draft**:
`submitted: { by, byId, at }`. No separate collection, no state machine.

| Operation | Server | REST |
|---|---|---|
| Submit | `manager.submit( req, draft )` — needs `edit` | `POST {action}/:_id/submit` |
| Withdraw | `manager.dismissSubmission( req, draft )` — needs `publish`, **or** `edit` + being the submitter | `POST {action}/:_id/dismiss-submission` |

Cleared automatically on publish and on revert-to-published.

`@apostrophecms/submitted-draft` is a **virtual piece type** owning no documents:
its `find` is `type(null).and({ submitted: { $exists: 1 } })`, narrowed to
`'submitted.byId': req.user._id` for anyone lacking `publish`. So **editors see
all submissions, contributors only their own** — enforced by narrowing the query,
never by an error. It appears as an admin tray icon (`T,D`).

To email an editor on submission, `extendMethods` the `submit` method, or listen
for `afterPublish` on the way back.

## Notifications — `apos.notify`

```js
// server: req may be a request OR a user _id string
await self.apos.notify( req, 'myNs:configSaved', {
    type: 'success',        // danger|error|warning|success|info|progress
    icon: 'list-status-icon',
    dismiss: true,          // true = 5 SECONDS; a number = that many seconds
    interpolate: { name: doc.title }
} );

// browser (admin only): no req — always the current user
await apos.notify( 'myNs:saved', { type: 'success', dismiss: 3 } );
```

Signature: `trigger( req, message, options = {}, interpolate = {} )`, aliased as
`apos.notify`. Returns `{ noteId }`. `message` is an **i18n key localized in the
browser at display time**, so its namespace must be `browser: true` or the user
sees the raw key.

Other options: `buttons` (`{ type: 'event', name, label, data }` — emits on the
apos bus), `classes` (`apos-notification--hidden` renders nothing and just
carries the event), `event: { name, data }`, `job`, `localize: false`.
⚠ Every key you pass is persisted and shipped to the browser — no secrets.

`apos.notification.dismiss( req, noteId, delayMs )` dismisses a sticky one later
— note **milliseconds** there, versus **seconds** for `options.dismiss`.

### Notification traps

- **From a CLI task, `apos.task.getReq()` notifications reach nobody.** That req
  has `user: { title: 'System Task', role: 'admin' }` with **no `_id`**, so the
  notification is stored with `userId: undefined` and is never found. Pass a real
  user `_id` **string** as the first argument instead.
- `apos.notify( req, … )` on an anonymous request **throws `forbidden`** — it will
  break a public route.
- **`apos.notify` is undefined on the public site** (the app mounts only for
  logged-in users) — widget players cannot use it.
- For long server work use `@apostrophecms/job` (`apos.job.run` / `runBatch`)
  rather than hand-rolling progress; it wires the progress notification for you.

## Busy state

The `@apostrophecms/busy` module is inert; the real API is a ref-counted bus
event, and you almost never emit it yourself. Just pass **`busy: true`** to
`apos.http.*` in admin Vue code and core emits both edges for you. If you ever do
emit manually, the matching `active: false` must be in a `finally` — the counter
never unwinds otherwise and the overlay traps the UI.

## Keyboard commands

Every piece type already gets commands for free, with a manager shortcut
defaulting to **`G,<first letter of the type's label>`** — so two types whose
labels share a first letter collide. The fix is one option:

```js
options: { label: 'Article', shortcut: 'G,R' }
```

Conflicts are reported only as a **dev-only console warning**, easy to miss.

Declaring your own (module `commands(self)` section): keys must be namespaced
`module:command`, `type` must be `'item'`, and `action.type` is simply a bus
event name — `apos.bus.$emit( action.type, action.payload )`. Use
`action: { type: '@apostrophecms/command-menu:open-modal', payload: { name, props } }`
to open your admin modal.

Shortcut syntax: **space separates alternatives** (`'Ctrl+F Meta+F'`), **comma
separates a chord** (`'T,P'` = T then P within 1 second). Only `Alt`, `Ctrl`,
`Meta`, `Shift` are real modifier tokens and **order matters** — `'Shift+Ctrl+A'`
never matches, and `Cmd`/`Option` (which the official docs list) are not tokens
the matcher produces. Shortcuts never fire inside inputs/textareas/contenteditable.

Traps: the command validator's assertion chain short-circuits, so **`action.type`
and `action.payload` are effectively never validated** — a typo'd event name is a
silent no-op. One invalid command anywhere is caught-and-logged and **wipes every
command site-wide**. `remove` is a global operation. Use `modal:`, not `group:`
(the client only reads modals).

## The archive — and `.archived()`

**Archive is not delete, and delete does not require archiving first.**
`DELETE /api/v1/my-piece/:id` permanently removes a live piece.

- **Pieces** archive by flag flip (`piece.archived = true` + update).
- **Pages** archive by **moving in the tree** under the parked `/archive` page;
  `archived` is *derived from the parent* and cascaded to descendants. Pages
  remove `archived` from their schema entirely.
- Events `afterArchive` / `afterRescue` fire once per transition, on any update
  that flips the flag.

The `.archived()` query builder is tri-state with **no default**:

| Call | Result |
|---|---|
| never called, `.archived(false)`, `.archived(undefined)` | non-archived only |
| `.archived(true)` | archived only |
| `.archived(null)` | **everything** |

The check is strict `=== null`, so passing a variable that happens to be
`undefined` when you meant "both" silently gives you "non-archived only".

### Archive traps

- **Slugs get mangled on archive.** A unique index on `{ slug, aposLocale }`
  forces deduplication: pieces get a `deduplicate-<id>-` **prefix**, pages a
  `-deduplicate-<id>` **suffix** (a prefix would break the leading `/`). Users
  also get `username`/`email` deduped, freeing the login.
- **Restore can silently leave the slug mangled** — if something else claimed the
  clean slug meanwhile, that field is dropped from the update with no error.
- **A restored page does not return to its old parent** (never recorded) — it
  lands under a selected ancestor or first-child-of-home.
- **Archiving a draft unpublishes it** — the `:published` doc is hard-deleted;
  what survives is the draft. Autopublish types skip this.
- **`archived` is easy to project away**, and `_url` assignment checks
  `!result.archived` — a custom projection omitting it hands archived docs a
  live-looking `_url`.
- `orphan` ("hide in navigation") is a different thing from `archived`.

## Plumbing you should recognize but rarely configure

`@apostrophecms/submitted-draft` and `@apostrophecms/recently-edited` (4.29+;
`recentDays`, `excludeTypes`, and an `addFilterChoice()` extension point) are
virtual piece types surfacing as tray icons. `@apostrophecms/archive-page` is a
five-line parked page you never touch. `@apostrophecms/busy` is inert.

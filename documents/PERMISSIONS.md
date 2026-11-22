# Permissions

**Scope:** The permission contract: how a tool call asks the person before an agent acts, who answers, how remembered answers are kept and revoked, and what fails closed; and what the file grants that give a module a file the person picked, dropped or pasted do and don't guard.
The calls that raise requests are in [TOOLS.md](TOOLS.md).

## Roles

- A **request** asks whether one call of a tool may take one action on one subject.
- The module that handles the call raises the request and waits for the decision; it decides when to ask, from its own rules and the action's risk.
- The **answerer** decides: the person, through a card the window shows, or a policy the app sets.
- Noldova Desktop carries the request, keeps remembered answers, and applies the expiry and the fail-closed rules; it never decides an action itself.

## Raising a request

- A handler raises a request through its call, `call.requestPermissionAsync(request)`, so the session and the scope come from the call and can't be named by the module or the agent.
- A request holds:

| Field | Holds |
|---|---|
| `action` | The action's name, `<id>.<name>` in camelCase, such as `notes.deleteItem`; the module lists its actions in its document. |
| `subject` | Optional: an opaque string, at most 1,024 characters, naming what the action is on, such as an item or an origin; remembered answers match it exactly, and a module refuses an action whose subject would be longer. |
| `title` | One line that tells the person what the agent wants to do. |
| `details` | Labeled items, each `text`, `code`, `secret` or `agentText`; the window shows a `secret` item hidden, and an `agentText` item as words the agent wrote. An item may set `isBare` to `true`: a permissions module then shows its value without its label, as a commit message or a diff reads on its own, and the label still names the item to assistive technology. Absent means `false`; any other value refuses the request. |
| `risk` | `low`, `medium` or `high`, within the tool's `risk.maximum`. |
| `isAsking` | Optional: `false` when the module would let the app's policy answer without asking the person; `true` when absent. |
| `options` | The answers the person may give, a non-empty subset of `allowOnce`, `allowAlways`, `deny`, `denyAlways` and `takeOver`; a `high` request that gives `labels` with at least one entry or offers `takeOver` offers neither `allowAlways` nor `denyAlways`, and a remembered `allowedAlways` never decides it, while a remembered `deniedAlways` still does. |
| `labels` | Optional: the module's own words for an offered `allowAlways` or `takeOver`, such as "Allow for this chat", "Allow this site for the project" or "I'll type it myself"; `takeOver` must have one, the answerer gets them exactly as given, and an empty `labels` counts as none. |
| `isRememberedOnly` | Optional: when `true`, only a remembered answer decides, and without one the request is `denied` without asking anyone. |

- A call of a tool whose `hints.isReadOnly` is `true` and whose `risk.maximum` is `low` raises no request: the grant the person gave the app's agents covers it.
- A call may raise several requests, one at a time, and each counts on its own.
- Aborting the call's signal withdraws its waiting request and removes its card.
- A request for an action whose exact input the module can't show in its details is refused before it is raised: the module fails the call as `Refused`.

## The decision

- Each request gets an `id`, unique in the runtime, which its question and its decision carry.
- The request resolves with one decision, and `isRemembered` when a remembered answer gave it:

| Decision | Means |
|---|---|
| `allowedOnce` | This call may act. |
| `allowedAlways` | This call may act, and the answer is kept for later calls. |
| `denied` | This call may not act. |
| `deniedAlways` | This call may not act, and the answer is kept for later calls. |
| `expired` | Nobody answered in time. |
| `withdrawn` | The call was aborted before an answer, for any of the reasons in [TOOLS.md](TOOLS.md#how-an-aborted-call-ends). |
| `takenOver` | This call may not act, and the person takes the action over; nothing is kept. |

- On `takenOver` the module hands the action to the person, such as by focusing the field they will type into, and fails the call as `Denied`.
- The module fails the call on `denied` and `deniedAlways` as `Denied`, on `expired` as `Expired`, and on `withdrawn` as `Withdrawn`, except after the point of no return of a tool that isn't resumable, where each is `OutcomeUncertain`, as [TOOLS.md](TOOLS.md#how-an-aborted-call-ends) says.
- If what the person allowed changed before the module acts, such as the subject moving, the module doesn't act and fails the call as `Stale`.
- The module never acts before the decision, and never acts on any decision other than the two that allow.

## A call's requests

- The result or failure a call returns lists the requests the call raised, as `requests`, in the order they were raised, whatever the module gave; it is empty when the call raised none, and leaves out a request still waiting when the call returns.
- Each entry has the request's `id`, its `risk`, the `decision`, and `isRemembered`; a request whose risk can't be read or isn't a risk counts as `High`.
- The list covers what the answerer never sees: a remembered answer, a request refused as malformed or while another waits, and one withdrawn before it was asked.
- So an agent app can tell a call that ran without asking from one the person allowed, and tie each request to the approval it showed by the `id`, even for parallel calls in one session.

## Answering

- The app names its permissions module, one of its modules, in `desktop.product.permissionsModule`, as [BUILD.md](BUILD.md#an-apps-inputs) says, and the build refuses a name that isn't one of `desktop.modules`.
- The app's permissions module registers one answerer, `context.permissions.registerAnswerer(answerer)`, which receives each request with its id, module, session and scope and returns the decision; a second registration is refused, and so is one from any other module; one made after the module's context is disposed registers nothing, so the next activation registers its answerer again.
- The answerer's signal aborts when its answer is no longer wanted, at the request's expiry or withdrawal, so it removes its card; an answer that comes after counts for nothing.
- Disposing the answerer's registration denies the requests waiting for it, and the requesting module's log says why.
- Without one, the request is `denied`, and the requesting module's log says why; Noldova Desktop's own card is still to come, as [Open points](#open-points) says.
- The answerer gets the request only when no remembered answer matches it.

## Remembered answers

- `allowedAlways` and `deniedAlways` are kept in Noldova Desktop's database, by module, action, subject and scope.
- A request matches a remembered answer with the same four exactly; a request without a subject matches only an answer without one.
- A remembered `allowedAlways` doesn't decide a `high` request that gives `labels` or offers `takeOver`: the answerer is asked, so a remembered allow for a lower-risk action never stands in for one the person must take over; a remembered `deniedAlways` still decides it.
- A remembered answer outlives the session and the runtime, and lasts until it is revoked.
- `context.permissions.listRemembered()` lists the remembered answers, and `context.permissions.revoke(id)` removes one; only the app's permissions module and Noldova Desktop's own settings reach them, and Noldova Desktop's settings show them so the person can revoke each one.
- An `allowedAlways` or `deniedAlways` that can't be kept holds for its call only, as `allowedOnce` or `denied`, and the module's log says why.
- Revoking an answer affects the next request, and a call that already has its decision keeps it.
- Any other module learns of a remembered answer only through a decision's `isRemembered`, and the app through a call's `requests`.

## Events

- `revoked(action, subject, scope)` reaches the runtime part of the module whose remembered answer was revoked, through `context.permissions.onRevoked(listener)`, so it can bring what it shows up to date; the next request already follows the revocation without it.
- A session's end or stop withdraws its waiting requests, also one whose call has already returned, as [TOOLS.md](TOOLS.md#events) says.

## Limits

| What | Limit |
|---|---|
| A request's wait | 5 minutes, then `expired`; the call's deadline doesn't run while it waits, as [TOOLS.md](TOOLS.md#calls) says. |
| A request's details | At most 80 KiB as JSON, as [TOOLS.md](TOOLS.md#limits) measures it, so any arguments the registry accepts fit with their labels, and at most 64 items. |
| A request's title | At most 200 characters. |
| A request's label | One line that isn't blank, at most 40 characters, for an offered `allowAlways` or `takeOver` only. |
| A call's waiting requests | One at a time; another one is `denied`. |
| A call's requests in all | No limit: each one stops the deadline for up to its wait, and the call keeps its resource's turn meanwhile, so how many a call raises is the module's to limit. |

## What fails closed

- A request that is invalid, over a limit, or names an option the call can't take is `denied`, and the log says why; so is a `high` request that gives `labels` or offers `takeOver` and also offers `allowAlways` or `denyAlways`, while one without them is checked as before.
- An answerer that throws, returns something unknown or doesn't answer within the wait gives `denied` or `expired`, never an allow.
- A request raised after its call ended, or outside a call, is refused.
- A remembered answer that can't be read, or doesn't match exactly, doesn't decide; the request goes to the answerer.
- When the app has no answerer, a request that no remembered answer decides is `denied`, and the log says why; the wait for a closed window comes with Noldova Desktop's own card, as [Open points](#open-points) says.
- Stopping all agent control withdraws every waiting request; Noldova Desktop withdraws them all at once through `PermissionCenter.withdrawAll()`.
- A remembered answer never makes a module act on what it refuses even with permission.

## What stays product-neutral

- The module owns its actions, their risk, a request's details, the options it offers and their labels.
- The app owns the answerer: its policy for each risk and whether it asks the person at all.
- Noldova Desktop names no action, subject or app, and treats subjects and scopes as opaque strings.

## File grants

A module's runtime part reads a file the person gives its window only through a one-use grant for its module, connection, window and page, as [RUNTIME.md](RUNTIME.md#file-grants) says; the window part never learns the file's path.
A runtime part shares one of its own files with its window's page only through a grant for its connection, window and page, which the main process serves on its own scheme, as [RUNTIME.md](RUNTIME.md#file-grants) and [WINDOW.md](WINDOW.md#the-main-process) say.
Three risks stay, and neither grants nor shares cover them:

- **Any module's runtime part can redeem a grant a compromised page asks for.**
  Every window part runs in the window's one page, so a compromised page can ask for grants for any module and send them to that module's runtime part, which can't tell them from its own window part's.
  A grant shows that the page asked for the file, not which part did.
- **A compromised renderer can send any path through the drop channel.**
  The main process can't tell a path the preload read from a real drop from one a compromised renderer made up, so it grants any regular file the app's account can read.
  The checks for a regular file, the real path, the identity, the limits and the page still hold.
  On Windows only a path on a drive is granted: one that names another computer or a device, such as `\\host\share\file`, `//host/share/file`, or one starting with `\\?\`, `\\.\` or `\??\`, is refused before the main process touches it, a link that leads off the drive before it is followed, and a file whose real path is off the drive, such as one on a mapped network drive, before it is granted, so a made-up path can't send the account's Windows credentials to another computer.

- **A shared file's grant is the capability across the app's windows.**
  The main process's scheme handler can't tell which window asks, so any page of the app that learns a live share's grant, another window's page included, can load the file until the share ends; within the window, a compromised page can load a file any of its runtime parts shared, since every window part runs in its one page.
  The share still ends with its page, its window, its discard and its lifetime, and the main process serves only the file it was shared as, unchanged, on the windows' session and never a web view's.
  Binding each load to its window needs a session for each window or a check the scheme doesn't have yet.

## Open points

- Noldova Desktop's own card, its wait while the window is closed, and the remembered answers in its Settings aren't built yet; until they are, a request that no remembered answer decides and no answerer takes, as in an app without a permissions module, is `denied`, and the requesting module's log says why.
- The look of Noldova Desktop's own card and of the remembered answers in Settings is for Noldova to decide.

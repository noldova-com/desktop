# Web views

**Scope:** The embedded web view: how a module shows web content in a pane, the window bridge its window part places and drives the view with, the controls and the relay its runtime part uses on its own views, their limits, and what fails closed.
The window's own boundary is in [WINDOW.md](WINDOW.md#the-boundary); a module's declaration is in [MODULES.md](MODULES.md#declaration).

## Roles

- A **web view** shows web content inside one of a module's views or documents, its **pane**, in a page of its own, apart from the window's page.
- The main process creates, holds and ends every web view; a module never holds one, and its content never reaches the preload bridge, the runtime or another view.
- The module's window part opens a view for a pane and mounts it in its own element; its runtime part navigates it, reads its events and sends it the debugging calls the module declares.
- A **profile** holds a view's cookies, storage and cache, and outlives the view and the runtime; the module names it by an opaque key, and the host keeps each module's profiles apart from every other module's and from the window's.

## The window bridge

The window part reaches its views through `context.webViews`.

| Call | Does |
|---|---|
| `openAsync(pane, profileKey)` | Opens a view for the pane on the module's profile with that key, and returns its handle; a pane holds up to 32 views, such as a browser's tabs. |
| `handle.mount(host)` | Puts the view in the part's element, which it fills, so that element is positioned, such as with `position: relative`; views mounted in one element lie over each other, and mounting a view in another element moves it there. |
| `handle.show()`, `handle.hide()` | Shows or hides the view; showing it hides the pane's other views, and the host also hides it while its pane is hidden. |
| `handle.openLayerAsync(load)` | Shows the part's component over the live view, in the view's [layer](#layers-over-a-view); returns `{ componentRef, closed, close() }`. |
| `handle.navigateAsync(url)` | Loads an address, after the origin check; returns `Started` or `Refused` with the origin. |
| `handle.goBackAsync()`, `handle.goForwardAsync()`, `handle.reloadAsync()`, `handle.stopAsync()` | Move through the view's history, reload or stop it; returns `Started`, `Refused` with the origin, or `NoHistory`. |
| `handle.getZoomAsync()`, `handle.setZoomAsync(factor)` | Read or set the view's zoom as a factor, 1 for 100%, held between 0.25 and 5; returns the zoom the view took. |
| `handle.zoomInAsync()`, `handle.zoomOutAsync()` | Step the zoom to the next or previous of 25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400 and 500%; returns the zoom. |
| `handle.findAsync(text, { matchCase })` | Searches the page for the text, ending any running search, and marks the first match; returns `{ matches, active, isTimedOut, isEnded }`, `active` 1-based and 0 when nothing matches. |
| `handle.findNextAsync()`, `handle.findPreviousAsync()` | Move the running search to its next or previous match, wrapping at the ends; without one they return `{ matches: 0, active: 0, isTimedOut: false, isEnded: false }`. |
| `handle.endFind()` | Ends the running search and clears its highlights. |
| `handle.subscribe(listener)` | Reports the view's events, below, and returns a release. |
| `handle.close()` | Ends the view and its pending calls. |

- Closing the pane, or deactivating the window part, closes its views.
- A pane is `{ name, instance }`: the name of one of the module's own views or documents, `<id>.<name>`, and the document's instance when it has one, as the window part's context names them; the host refuses a pane the module doesn't own or that isn't open.
- The window draws each view in a `<webview>` element of its own page, in the view's profile, which the window part mounts in its pane's element; the element fills that element and follows its size, as the page lays it out.
  The page loads once the element is first mounted: the window then asks the main process to bind the element's page to the view, and the main process loads the address the module last asked for.
  Until then, `navigateAsync` waits for the page, a zoom is kept and applied to it, and `actAsync` and finding do nothing; a view never mounted stays open until it is closed.
  A switch to another tab of the view's group leaves the element in the page, so its page stays; a move to another group, a dock or a dialog, or a dock that collapses, mounts the element again, and when it gets a new page, that page is bound to the same view.
  Before a tab moves to another group or a dock, or out of a dialog or its slot, the window asks the main process to keep its views' history, and just before the tab's content enters its new place, to expect those views, in their order there; the next `<webview>` of each expected view's profile in that window is that view's new page, which restores the history instead of loading its address: the page loads again at the same entry, with its back and forward entries, the values of its form fields and its scroll position.
  Both calls wait for the main process's answer: taking the content out of the window ends the `<webview>`'s page at once, so its history is read before, and the new `<webview>` asks to attach as soon as the content enters, so the expectation has to be there first.
  It loses everything else, such as its script's state, its selection and focus, and what the page changed without a form field; and the history holds what the page last committed, which a page sends about a second after a change, five while hidden, so text typed just before a move may be lost.
  A dock that collapses keeps nothing, and the view loads the address it last showed; so does a view whose page navigated after the history was kept, whose page showed another address than it committed, or whose kept address it may no longer show, and a view whose restore fails before its page committed anything; a view the module navigated, or moved in its history, after it was claimed keeps that navigation, and neither restores nor loads its address.
  The main process refuses any `<webview>` whose profile isn't one of the views it opened for that window, and starts every other one at `about:blank`, or with no page when it restores a kept view, whatever address the element carries, such as its page's own once it moves; it removes any preload, turns Node off and sandboxes the page, and a page can't open a `<webview>` of its own.
  The element allows its page's new windows, so each request reaches the host, which [judges it](#new-windows) and opens none itself.
- Since the view is an element of the window's page, the module's own menus, and Noldova Desktop's own menus, dialogs, cards and notifications, lie over it like over any other element, and the page under them stays live.
- A view behind another tab of its group keeps its place, its page and its size, takes no clicks or focus, and still takes `navigateAsync`, `actAsync` and finding; it is hidden by `visibility` and `opacity`, never removed, so a tab switch shows the next view with no blank frame, and its page keeps running.
- While the person drags a tab or a toolbar item, the views take no pointer, so the drag passes over them.

### Layers over a view

A **layer** draws the part's component over the live page: an element of the window's page laid over the view's element.

- The component is the part's own window markup: it is created with the part's `WindowPartTokens`, in the window's own JavaScript, so it takes the window's style sheets, theme, mode and forced colours.
  Nothing goes into the page, and the page can't read, style or reach the layer, which is outside it.
- The layer takes no pointer, so the page under it keeps every click, key and scroll; the component's own elements may take it back.
- The component's host fills the view's element, and its coordinates are CSS pixels from the view's top-left corner; a box read from the page through the relay is multiplied by the view's zoom.
  The layer clips at the view's edges, and shows and hides with the view.
- A view has one layer at a time: opening another closes the first.
  The layer closes with `close()`, the view, its pane, the part's deactivation and a reload of the window, and `closed` resolves then.
- `openLayerAsync` rejects with what `load` rejects with, with what the component throws as it is created, or with the closed error when the view closes while the component loads, and leaves no layer open.

### Zoom and find

- Each view keeps its own zoom: it holds across the view's navigations, to another site or after a crash too, since the view puts it back whenever a new page comes without it; two views of the same site keep theirs apart, every view starts at 1, and nothing of it is kept once the view closes.
- The person zooms a focused view as in a browser: Ctrl, or Cmd on macOS, with `=`, `+` or the numpad's plus steps in, with `-` or the numpad's minus steps out, and with `0` or the numpad's 0 resets; turning the mouse wheel to zoom, as the engine reports it, steps too.
  These keys are judged after the app's shortcuts and the keys the module declares, below, so a person's binding or a module's own key wins, and a held key keeps zooming.
- Every change of zoom, by a call, a key or the wheel, raises a `Zoom` event with the `factor`, and every finished search a `Found` event with `matches` and `active`; both reach the window part alone, through `handle.subscribe`.
- `findAsync("")` ends the running search and returns `{ matches: 0, active: 0, isTimedOut: false, isEnded: false }`, since the engine searches no empty text; a navigation of the page, a crash or a newer search ends the search too, and a search ended before the engine finished it returns `{ matches: 0, active: 0, isTimedOut: false, isEnded: true }` and raises no `Found` event, so the module tells the person the search stopped rather than that nothing matched.
  A search the engine hasn't finished within 10 seconds returns `{ matches: 0, active: 0, isTimedOut: true, isEnded: false }` and raises no `Found` event, so the module tells the person the search timed out rather than that nothing matched.
- A crashed view keeps its zoom and doesn't change it, and its searches, `findAsync("")` too, return `{ matches: 0, active: 0, isTimedOut: false, isEnded: true }`, since its page can't be searched, until it is navigated again.
- The calls fail as `navigateAsync` does: they reject with the closed error once the view is closed, and a search still pending when it closes rejects so; a crashed view and a cleared profile don't fail them, as they fail neither `navigateAsync` nor the handle's other calls.
  The handle keeps the view through both, and a navigation brings a crashed page back, so the window part learns of them from the `Crashed` and `ProfileCleared` events rather than from a rejected call; only the runtime's `sendAsync`, which talks to the page itself, fails on them.

### Keys from a view

While a view has focus, the person's presses go to its page, except the app's shortcuts and the keys the module declares for its pane, such as a browser's reload and new tab.

- The host sees each press in a view before the page, and judges it in this order:
  1. One of the app's shortcuts, as the window holds them at that moment, the person's bindings included, but a default key a focused page keeps, `Mod+Slash`: the page doesn't get it, and the window runs its command as if the press were in the window.
  2. One of the keys the module declares in [`keys`](#webviewsjson): the page doesn't get it, and the window part gets a `Key` event of that view with the key's name.
  3. Any other key reaches the page.
- A held key that repeats stays from the page, and only its first press runs the command or sends the event.
- The `Key` event reaches the window part alone, through `handle.subscribe`, since a press belongs to the pane on screen; the runtime's `onViewEvent` never reports one.
- Only the person's presses are judged: a key the runtime part sends through the relay goes on to the view's page as sent, even when the module declares it, and never raises `Key`, or is refused when it is one of the app's shortcuts, as [the relay](#the-relay) says.
## The runtime's controls

The runtime part reaches the module's views through `context.webViews`, by the view's id, and never another module's.

| Call | Does |
|---|---|
| `list()` | Lists the module's open views, each with its id, pane and profile key. |
| `navigateAsync(id, url)`, `actAsync(id, action)` | Load an address, or go back, go forward, reload or stop, with the same answers as the bridge. |
| `setAllowedOriginsAsync(id, origins)` | Sets the origins the view may load; the module sets them from the person's answers and the app's settings, never from a tool's arguments alone. |
| `clearProfileAsync(profileKey)` | Clears the profile's cookies, storage and cache, and ends the pending calls of its views. |
| `onViewEvent(listener)` | Reports every event of the module's views but the relay's, with the view's id, and returns a release. |

- The list follows the main process's `Opened` and `Closed` events, and the runtime asks the main process for it again whenever one connects, so a runtime that restarts finds the views the window kept.
- While no main process is connected, every call fails as `Unavailable`; when its connection ends, the calls in flight fail so, and each listed view closes with a `Closed` event.

### Events

| Event | Holds |
|---|---|
| `Opened`, `Closed` | The view, with its pane and profile key. |
| `Key` | The name of a key the module declares, which the person pressed in the view; only the window part gets it. |
| `Zoom` | The view's new zoom `factor`; only the window part gets it. |
| `Found` | A finished search's `matches` and its 1-based `active` match, 0 when none; only the window part gets it. |
| `State` | The address, the title, whether it is loading, and `canGoBack` and `canGoForward`; sent whenever any of them changes. |
| `LoadFailed` | The address, the engine's code and its description. |
| `NavigationRefused` | The address, its origin, and whether a redirect led there. |
| `Crashed` | That the view's page stopped; the view stays closed until it is navigated again, and sends no `State` until then, even when a load the crash cut short ends after it. |
| `ProfileCleared` | The profile key. |
| `Dropped` | How many of the view's events the host dropped while the runtime was away. |
| `RequestRefused` | What the host refused without asking, `download`, `newWindow`, `permission`, `fileChooser`, `authentication`, `certificate` or `nestedView`, and the origin that asked. |
| `NewWindowRequested` | A new-window request the module takes, as [New windows](#new-windows) says: the address, `hadRecentInput` and `origin`. |

### New windows

A link with `target="_blank"`, a form or a script's `window.open` in a view asks for a new window; the host never opens one.

- A module whose `webViews.json` says `"newWindows": true` gets each request as a `NewWindowRequested` event of that view, through the window bridge's `subscribe` and the runtime's `onViewEvent`; any other module's requests stay refused, each with a `RequestRefused` event of `newWindow`.
- The event holds the `address` the page asked for, resolved against the page; `hadRecentInput`; and `origin`, the origin of the referrer the engine would send, or `null` when it sends none, such as for `noreferrer`, never a guess.
- `hadRecentInput` is the host's own judgement, not the engine's user activation: it is true when the person's own key, mouse button or touch reached that view in the last 5 seconds, and input the runtime part relayed to the view never counts.
  While an `Input.*` call the runtime part relayed is unanswered, the person's input to that view doesn't count either, so a call the engine never answers, even once the relay has timed it out, keeps `hadRecentInput` false for that view.
- The module answers by opening the address in a view of its own, such as a new view in the same pane, with `openAsync` and `navigateAsync`, where the origin check runs as on every navigation.
- The new page never gets the opener's `window.opener` or any reference back to it, since the host opens no window for it.
- Each view takes up to 5 requests a second; the host refuses the rest with `RequestRefused`, and so it does an address longer than [the limit](#limits).

## The relay

The runtime part sends its views calls of the window's web engine's debugging protocol, such as taking a screenshot, through `context.webViews.relay`.

| Call | Does |
|---|---|
| `sendAsync(id, method, params, timeout)` | Sends one call the module declares to one of its views, and resolves with the reply. |
| `onProtocolEvent(id, listener)` | Reports the declared events of that view, each with its method, its parameters and `isCut`, and returns a release. |

- A module declares its methods and events in `webViews.json`, with bounds on any parameter a method needs held, such as an image's size; the build checks the file, and the host enforces it without running module code, as [webViews.json](#webviewsjson) says.
- The host refuses a call that names a child target's session, and a key input whose keys are one of the app's shortcuts.
- A key or text the relay sends, `Input.dispatchKeyEvent` or `Input.insertText`, goes straight to that view's page, whichever page has the person's focus, and the focus stays where it is: the page's focused field takes it and keeps its focus, so it gets no `blur`, and the person's own keys still go where the person's focus is; nothing switches the page's focus state on or off, and a key event that names no key or a type a page doesn't take, or text that is no string, fails as `Protocol`.
- Any other call the relay sends reaches the page as sent, and the person's focus stays theirs.
  Before each such call, the host turns on `Emulation.setFocusEmulationEnabled` for the page, once until it is released, so the page keeps its focus state: it sees no `blur` when the focus leaves it, or between an agent's click and the typing after it, and its field keeps its focus.
  The page reads `document.hasFocus()` as true while the emulation is on.
  The host tells the window when the call starts; once the engine answers, the host makes a round trip to the page's renderer, in a world the page's scripts can't reach, and only then tells the window the call has ended.
  A call that times out is answered as `TimedOut` at its deadline, but the window hears that it ended only once the call and the round trip settle, so a focus change that lands late still finds the call open.
- A mouse press, `DOM.focus` or a script can focus one of the page's elements, which makes the view the window's focused element.
  The window gives the focus back to the element that held the focus when the call started, or takes it out of the view when nothing held it.
  For `DOM.focus` or a script, it does so at once, in the view's own `focusin`, while the call is open.
  A press moves the window's focus to the view with no `focusin`, and the engine finishes moving the keyboard's focus after the window's `blur`, so for a press the window gives the focus back when the call ends.
  When the person's focus was in the view when the call started, or the person presses in the page while it runs, the window leaves the focus there and releases the emulation once the call ends.
  The host tells the person's press from the relay's own by counting the presses the relay sends, one for a mouse `mousePressed` and one for each point of a touch `touchStart` that the previous touch event didn't list by its `id`, since the engine raises an event only for a new point, so a press that lands while the relay sends input still counts as the person's for this notice, though not for `hadRecentInput`; during another `Input` call that can press, such as `Input.synthesizeTapGesture`, a press counts as the relay's.
  The window also releases the emulation when the person's own focus enters the view with no call open; the page then really has the focus, so it sees no `blur` then either.
  A new page starts with no emulation, and when a view binds a new page, such as a moved tab's view, the host detaches from the old page, which ends its emulation.
- A stated limit: a key the person presses can reach the page between the view taking the focus and the window giving it back: one task of the window's renderer for `DOM.focus` or a script, and for a press, one round trip to the page's renderer and one message to the window.
  The host doesn't hold back keys to replay them afterwards: a replayed key loses an input method's composition and a dead key's accent.
- A stated limit: the window counts a call as open from its start notice to its end notice, which the host sends after the round trip to the page's renderer; a `focusin` that reached the window after the call's end notice would count as the person's, and the focus would stay in the view.
- The host owns focus emulation, so it refuses a module's own `Emulation.setFocusEmulationEnabled`, declared or not, as `NotAllowed` with a message naming that rule, and sends nothing, so a module can't end the host's hold.
  The runtime's `FakeWebViewRelay` refuses it the same way, whatever answer a test gives it.
- The engine drops key input, the person's and the relay's alike, that a newly loaded page gets before it has drawn its first content, so a module that sends keys right after a navigation first waits for the page to show something, such as its first contentful paint.
- A relay failure has one kind: `NotOwned`, `NotAllowed`, `ShortcutRefused`, `TimedOut`, `TooLarge`, `ViewClosed`, `Crashed`, `ProfileCleared`, `Unavailable`, or `Protocol` with the engine's code and message; a refusal may carry the host's message naming its rule, never a code; the module maps it onto the shared failures in [TOOLS.md](TOOLS.md#failures).
- The runtime's calls reach the main process over its authenticated connection; while that connection is down, they fail as `Unavailable`.

### webViews.json

The file is an object with four optional fields: `methods`, each `{ "name": "<Domain>.<method>", "parameters": { ... } }`; `events`, each `"<Domain>.<event>"`, every name once; `keys`, each `{ "name": "<name>", "keys": [...], "macKeys": [...] }`, the keys the pane takes from its views; and `newWindows`, `true` when the module takes its views' [new-window requests](#new-windows), `false` by default.

```json
{
  "keys": [
    { "name": "reload", "keys": ["Mod+R", "F5"], "macKeys": ["Mod+R"] },
    { "name": "newTab", "keys": ["Mod+T"] }
  ],
  "methods": [
    { "name": "Page.enable" },
    { "name": "Page.captureScreenshot", "parameters": {
      "format": { "values": ["png", "jpeg"] },
      "quality": { "minimum": 0, "maximum": 100 },
      "clip": { "fields": { "x": {}, "y": {}, "width": { "required": true, "maximum": 4096 }, "height": { "required": true, "maximum": 4096 }, "scale": { "maximum": 1 } } }
    } },
    { "name": "Page.handleJavaScriptDialog", "parameters": { "accept": { "required": true, "values": [false] } } }
  ],
  "events": ["Page.loadEventFired"]
}
```

- A call gives only the parameters its method names, and every one marked `"required": true`; a method without `parameters` takes none.
- A parameter's rule holds at most one of: `values`, the texts, numbers or booleans it may be; `minimum` and `maximum`, either or both, for a number; `maxLength`, for a text, in UTF-16 code units; or `fields`, for an object, whose fields follow the same rules.
  A rule with none of them, `{}`, takes any value.
- The build refuses an unknown field, and these methods and domains, which the host keeps from every module:

| Refused | Why |
|---|---|
| `Page.navigate`, `Page.navigateToHistoryEntry`, `Page.reload`, `Page.setDocumentContent`, `Page.resetNavigationHistory` | They load, replace or rewrite a document; navigation goes through the bridge and the controls, where the origin check runs. |
| `Page.setInterceptFileChooserDialog`, `Page.disable` | The host refuses file choosers through the page domain, which stays on. |
| `Page.setDownloadBehavior` | The host refuses downloads. |
| `Page.close`, `Page.crash` | The host owns the view's lifetime. |
| `Network.setRequestInterception`, `Network.continueInterceptedRequest` | They rewrite requests past the origin check. |
| `Target`, `Browser`, `Fetch` and `Security` | Target reaches other pages and sessions; Browser controls the whole engine, its downloads and its permissions; Fetch rewrites and answers requests past the origin check; Security accepts certificate errors. |

- A declared key's `name` is a lowercase letter followed by letters and digits, once in the file; it is what the `Key` event holds.
- `keys` lists its keys on Windows and Linux, and `macKeys` on macOS where they differ, such as `Mod+BracketLeft` for a key that is `Alt+ArrowLeft` elsewhere; without `macKeys`, `keys` hold on macOS too.
  Each is in Noldova Desktop's key format, as [MODULES.md](MODULES.md#commands-and-keys) writes it, and appears once among a platform's keys.
- A declared key follows a default key's rule, so typing and editing never leave the page: it needs `Mod`, `Ctrl` or `Alt`, or is a function key, and it is never a key that editing or the operating system owns.
- The app's shortcuts go first, so the build refuses a declared key that is one of Noldova Desktop's default keys on that platform, and the stop key's default, `Mod+Shift+Period`, which is never declarable:

| Platform | Refused as Noldova Desktop's keys |
|---|---|
| Every platform | `Mod+Shift+P`, `Mod+Comma`, `Mod+W`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Mod+B`, `Mod+J`, `Mod+Alt+B`, `Mod+Shift+Period` |
| Windows and Linux | `Alt+ArrowLeft`, `Alt+ArrowRight`, `Ctrl+PageDown`, `Ctrl+PageUp` |
| macOS | `Mod+BracketLeft`, `Mod+BracketRight`, `Mod+Alt+ArrowRight`, `Mod+Alt+ArrowLeft` |

- `Mod+Slash`, Show keyboard shortcuts, is a default key a focused page keeps: a pane may declare it, a page gets it while it has the focus, and the shell takes it everywhere else, unless the person binds it to a command.
- So a pane declares keys of its own, such as reload and new tab, and never Back, Forward or the tab keys, which stay Noldova Desktop's.
  A pane's pages reach Back and Forward as places the view adds to them, and the tab keys move between the tabs in Noldova Desktop's own tab row, where a browser's pages are tabs.
  Pages keep `Escape`, a typing key.
- A declared key the person later binds to a command, or a module's default key, is that command's while it holds the key: the app's shortcuts go first in the view too.
- The build refuses `webViews.json` in a module without a window part, which opens its views; the hosts read the file again from the declarations and refuse the same methods and keys.

## The host's defaults

- Every view is sandboxed and context-isolated, without a preload, Node.js or the window's protocols, credentials or messages.
- Only a module that declares `webViews.json` beside `module.json`, even with no methods, opens web views.
- A profile is persistent, its cookies encrypted, and never the default session or another module's.
- The host refuses, without asking: device and media access, notifications, downloads, new windows unless the module [takes their requests](#new-windows), file choosers, authentication prompts, certificate errors and nested web views; and it keeps real-time media to proxied routes.
  So a page in a view can't download a file, upload one, use the camera, microphone, location or notifications, or sign in through a browser prompt: each such request raises `RequestRefused`, and the module tells the person and offers to open the page in their own browser.
- The origin check runs on every navigation, whoever starts it, history and redirects included, and on every request of the profile, of every kind.
  An address passes only when its origin is one of the view's allowed origins.
  An address on the machine itself or its local network passes only when the allowed origins name it exactly, and the module takes such origins only from the app's settings.
- The app's shortcuts reach the window when the person presses them in a view, and the keys the module declares reach its window part, as [Keys from a view](#keys-from-a-view) says.

## Limits

| What | Limit |
|---|---|
| Views | Up to 32 per pane, one of them shown. |
| Layers | One per view. |
| A profile key | `^[a-z0-9][a-z0-9-]{0,63}$`. |
| An address | At most 32,768 characters. |
| A relay call's timeout | At most 10 seconds. |
| A relay reply | At most 4 MiB as JSON. |
| A relay event | At most 64 KiB as JSON; the host cuts the longest string values from their ends until the event fits, and sets `isCut`. |
| A view's event backlog | At most 256 events; an overflow drops the oldest and marks the drop. |
| Declared keys | Up to 32 names, each with up to 4 keys on each platform. |
| New-window requests | Up to 5 a second per view; the host refuses the rest. |
| Recent input | The person's input in the last 5 seconds, for `hadRecentInput`. |

## What fails closed

- An address the check can't judge is refused.
- A view the host can't open, for a module without `webViews.json`, a pane it doesn't own or a full pane, isn't opened, and `openAsync` fails; the pane shows that no view is available.
- A `<webview>` the main process didn't open, in another profile or with another address, never gets a page; a bind for a page of another window or profile is refused, and the window then closes that view, since a refused bind never ends a view by itself.
- A page whose debugging connection can't be made, when it is bound or after it drops, ends its view; a page that is closing, such as when its window closes, only leaves its view waiting for its next page.
- A call on a closed or unknown view, or on another module's, fails without reaching any view.
- A crash, a cleared profile or a closed view ends every pending call with its kind.
- A reply or an event that doesn't have the expected shape is a failure, never a guess.
- A method, an event or a parameter outside `webViews.json` is refused, and so is a view for a module without the file.

## What stays product-neutral

- The host names no site, app or module: profile keys and origins are data, and the host reads no meaning into a key.
- The relay knows nothing of the module's tools; the app's shortcuts reach it as data from the host.
- Any module with views of its own uses the same bridge, controls and relay, under its own `webViews.json`.

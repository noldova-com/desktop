# Changelog

**Scope:** What each published version of this repository's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version, as the [README](README.md#releases) says; other pull requests don't edit this file.

## 0.0.17

Modules and apps must act on two points:
- A class of a module's or app's own that implements `IWindowPartContext`, such as a recording test fake, adds `provideUndo`, or it no longer compiles; a module that uses `FakeWindowPartContext` needs nothing.
- `@noldova/desktop.window` needs `@noldova/ui.components.angular` 0.0.32 or later, below 0.1.0.

A web view declaration that lists one of the five methods newly refused below no longer builds; none of the modules lists them.
Two changes to the electron package's API are not additive, and neither has a caller or implementer outside Noldova Desktop, since an app starts the package's `main.js`: `MainProcess.startAsync` takes a required `readUpdateFeed`, and its `createUpdater` takes the feed in place of `isPackaged`; and `ITrayHost` gains `createMenuIcon`.
Nothing else needs a module or app to act: every other change to the packages' API is additive.

- A window part may run `desktop.openSettings` with its context's `runCommandAsync`, beside `desktop.search`, so a module's link can open Settings on one of its pages; every other Noldova Desktop command is still refused.
- An app lists its tray menu's items in `desktop.product.tray`: the built-in rows in its order, separators, and rows that run a module's command, each with an optional icon and a dark one, and labels of its own for the built-in rows; the build refuses an invalid entry, naming its field, and an app without a list keeps today's menu.
- An app can show its name and an icon at the start of the window row, with `desktop.product.titleBarName` and `desktop.product.titleBarIcon`, a PNG or SVG file from the app's tree or a `data:` URL.
- A window part can give the window its own undo with `context.provideUndo({ canUndo, undoAsync })`, so Edit → Undo and Mod+Z reach it while nothing editable has the focus; one provider at a time takes Undo in a window, and a second is refused with `UndoProviderTakenException`.
- A document or a view declares a preferred width in rem, `preferredWidth`, and while it is the active tab of the active document group the side docks give way to it, shrinking to their minimum and then closing to their strips, the right one first; a dock the person opened or hid stays as they left it.
- A package whose licence calls for its complete source to go with the app, such as a GPL program it ships, names that source's pages and files in `noldovaDesktop.sourcePages` and `noldovaDesktop.sources`; the licence notice lists each file's address and SHA-256, and the release notes link the pages.
- Every web view keeps the same-origin policy on and refuses insecure content in a secure page, whatever its element asks.
- A web view declaration can no longer list `DOM.setFileInputFiles`, `Input.dispatchDragEvent`, `Input.setInterceptDrags`, `DOM.getFileInfo` or `Input.setIgnoreInputEvents`, which could hand a page the person's files, read their paths, or lock the person out of the page.
- Keys typed while a forwarded shortcut's answer is pending, and a shortcut the window didn't run, reach the guest the view is bound to once its page is ready, so a move in that wait no longer loses them.
- A relay event over its 64 KiB limit is cut in one pass, so the work no longer grows with the number of texts times the event's size.
- A build that isn't packaged checks for updates only from a feed on this machine, so a development build never asks the production feed.
- The settings' mode choice offers Light, Dark, System, in that order, with System still the default.
- A build or the runtime keeps a folder that exists when Windows answers `EPERM` for creating it, as it can on a Dev Drive.
- The Windows package smoke names what stays in an install folder after the uninstall, and expects a shared install folder that another app still uses to stay.
- Test and check changes with no effect on the packages: the test fixtures throw named exceptions and use named classes in place of tuples, the packaging files' tuples are named classes, the title bar's zoom test zooms from an emulated viewport, the foreground group reader's tests give the unreadable leader an id of its own, the Angular tests print memory state on a Windows socket failure, and the serial run's stepping fixtures hold past their step, so a slow runner no longer fails their timing checks.
- The workflows are pinned to .github v2.50.0, and the ui-components packages to 0.0.32.

## 0.0.16

- A window part's `IWindowPartContext.returnView(name, instance)` gives a group's front back to the tab that was in front before the part's last `openView` of the instance that brought its tab forward, such as a detail view the part showed for a document the person leaves, without moving the focus or the group the tab commands act on.
  It does nothing when no open brought the tab forward, or since then the person chose a tab in that group, moved, closed or added a tab there, or another open changed the group; the testing fake records it as it records `openView`.
- Closing the active tab makes the tab that was active before it, still open in its group, the active one, and only a group with no such tab makes the neighbour active as before; the saved layout keeps each group's order.
- On a workspace shorter than the default 1280×800 window's 46.5 rem, the bottom dock's default height gives way in proportion, down to the dock's minimum, so a 905×616 window's bottom dock is 10 rem; a height the person chose stays as it is.
- The Windows package smoke gives the app's start as another user 120 s, since signing a new account in can take tens of seconds, and writes when the account got access to the app's folder and when it was signed in.

## 0.0.15

- A view or document can show its own toolbar band: a `toolbar` place in `menus.json` may name a `band`, one of the module's own views or documents, and its page shows that band with `<nol-view-toolbar-band />`, with the window band's look, dragging, new rows and Toolbars menu.
  Each band keeps its own arrangement, a toolbar never moves between bands, and the window's band behaves as before.
- A runtime part's `IModuleSettings` says through `isDeviceKnown` whether a device setting it reads already holds its device's value, and `onDeviceKnown` tells the part the moment the runtime learns its device, whether or not a value is stored.
- A web view's `NavigationRefused` carries `fromPress`, `true` only when the person's own click on a link started the refused navigation, so a module can let it through, and `NewWindowRequested` carries `fromLink`, `true` only when the person's own press on a link asked for the window, whether or not a handler's `window.open` took the press first.
- Back, forward and reload check the page again after their address check, so a tab moved during the check acts on its moved page and a closed one does nothing, and a command that fails gets its answer instead of none.
- The domains a module turned on with a view's debugger, such as `Runtime`, are turned on again on the view's new page after a move to another group, a dock or a dialog.
- An open of a web view for a window that closed or reloaded while the modules' web view declarations were read is refused, and so is one the old page sends during a reload, so no view stays that no window owns.
- Clearing a view's profile ends the calls still waiting for its page to attach, as closing the view does.
- A keep of the web views' history before a tab moves is answered even when one view can't keep its history, which logs a line and no longer blocks the window's page.
- A main process that loses its runtime checks the launch barrier again after a check that failed without a connection, so it quits when another main process closes the installation.
- Close all moves the focus afterwards, as Close, Close others and Close to the right do, so the focus no longer falls to the page when the group goes away.
- The Windows installer and uninstaller find the running app without PowerShell or WMI.
- `@noldova/desktop.window` needs `@noldova/ui.components.angular` 0.0.28 or later, below 0.1.0.

## 0.0.14

- A permission request's detail, `IPermissionDetail`, takes an optional `isBare`: when `true`, a permissions module shows the value without its label, which still names the item to assistive technology; absent, it counts as `false`.
  Any other value refuses the request as invalid details, and the details' 80 KiB limit counts the field.

## 0.0.13

- A tool call that ends with no permission request waiting gives up its resource's turn before its answer reaches the caller, so another session's call sent on that answer is no longer refused as held by another agent session, a regression in 0.0.12; a call that ends while its request waits still keeps the turn until the request is answered.

## 0.0.12

- A module that reads a device setting without naming a device, through `IModuleSettings.read` or `onChanged`, reads the device this runtime serves; the runtime asks the main process for it once settings are registered, a device setting reads as its default until then, and `onChanged` then reports each setting stored for that device.
  Modules never see the device's id.
  The `desktop.updateChecks` setting's description now covers the version checks modules make on the person's behalf.
- Once a runtime part's context is disposed, work of the part that still runs registers nothing: `register`, `onSessionEnded`, `onSessionStopped`, `onStopped`, `onResumed`, `registerAnswerer`, `onRevoked`, `registerMethod`, `registerCommand`, `publishService`, `onClientClosed`, `onDependencyChanged`, the settings', app windows' and shortcuts' `onChanged`, `onViewEvent` and the relay's `onProtocolEvent` add nothing and return a registration or stop function that releases nothing, after the checks a live context makes.
  `declareEvent` returns a channel whose `publish` and `publishTo` throw `EventWithdrawnException`, `postNotification` returns a handle that posts nothing, `beginWork` returns an already cancelled work item, and `openSession`, `startProcessAsync`, `startPseudoTerminalAsync`, the web views' `navigateAsync`, `actAsync`, `setAllowedOriginsAsync`, `setControlledAsync` and `clearProfileAsync`, and the relay's `sendAsync` throw or reject with the new exported `ModuleDeactivatedException`, so the part's next activation no longer fails on what its late work registered.
- An app's tools keep one context registration for all their tool sessions and drop each session as it ends, so ended sessions no longer stay in memory until deactivation.
- A tool call that returns while a permission request it raised still waits keeps its resource's turn until the request is answered; a session's end or stop, or the tool's `unregister`, withdraws that request with `SwitchedOff`.
- A module gets a page call's answer once the engine answered and either the renderer round trip ended or the main frame's navigation that the call started has reached the module, so a call that starts a navigation no longer waits for the next document's answer, or forever when the server never answers; the window's `End` notice still waits for the round trip.
- A moved web view whose restore the engine reports as failed while the page still loads is scrolled back once the page shows the kept address and stops loading, and a keep that comes while the restored page waits for its scroll-back keeps the position it is to be scrolled to; each case writes a line to the main process log.
- When a window's renderer goes away, the main process ends that page's file grants and shares, as a window's close does, instead of leaving them until they expire.
- A layout change made less than 500 ms before a reload is kept: the page sends a pending layout when it hides, and the main process answers the reloaded page's read only once every earlier write has landed, or with the layout kept before a write that failed, with a line in its log.
  A layout write has 5 seconds to answer, through a new optional `timeout` argument of `RuntimeCaller.callAsync`.
- The window's saved bounds survive a read the runtime refuses, which no longer lets the next save write the default bounds over them, a window saved below 640 by 480, whose size is clamped to the minimum, and a window that closes before its restore; restored bounds of which fewer than 160 pixels of the top row lie on any display's work area move into the work area of the display that shows most of them.
- On macOS, the standard menu bar comes back when the window whose menu it shows closes.
- A tab row, in a document group as in a dock, shows only whole tabs and no longer scrolls; the tabs that don't fit are hidden, the active tab always shows in place of the last tabs before it, and "Show all tabs" lists every tab.
  The arrow keys, Home and End still reach every tab, and the tab they reach shows in the row.
- The focus no longer drops to the page when a focused control goes away: Reset in Settings hands it to the row's control, opening a settings page to the page's first control, a notification's Dismiss to the next or previous row's Dismiss or the popover, and a keyboard press that opens a dock with no rail to the view's tab.
  When the window's parts finish loading, the workspace gives the focus back to the active tab only while it is still lost, so it stays where the person moved it.
- When the person answers Wait again, or Wait then Stop work, while the first Wait attaches, the main process attaches once; a connection that replaces the current one closes it, and only the connection accepted last reconnects on its end.
- `@noldova/desktop.runtime` exports `StaleFileRemoval`, which lets only one process remove a file judged stale and only while it still holds the judged text, and `RemovalUnclaimedException`; `Installation.removeAsync` takes over a stale launch barrier through it, so racing processes end with one holder, and the update check lock is taken over and released the same way.
- A main process without a runtime connection quits when another main process's update has handed off a version other than its own build's (`HandedOff`), not only when the barrier is `Closing`.
- Linux updates are signed: a signed Linux build signs the AppImage and the Debian package with Ed25519 using `LINUX_UPDATE_SIGNING_KEY`, ships the public keys from `LINUX_UPDATE_PUBLIC_KEYS` in the product file as `linuxUpdateKeys`, and `release-assets` writes each file's `signature` into `latest-linux-<arch>.yml`.
  The app installs an AppImage or Debian update only with a valid signature by a key it ships, checked at download and again at the handoff, which otherwise rejects with `UpdateUnsignedAtHandoffException`; copies installed before the first signed Linux release take that release on its SHA-512 alone.
  `linux` may be listed in `desktop.signedPlatforms`, and a release to the app's update feed is refused without it; `feed-check` requires each Linux file's signature by a key in `LINUX_UPDATE_PUBLIC_KEYS` and refuses a Linux target when it is empty.
  `package-app.yml` and `release-app.yml` pass the keys, so an app adds the secret, the variable and `linux` before its next release, as `BUILD.md`'s Signing says.
- A Debian update installs through `resources/linux-update-install`, a script the package installs under `/opt` with a polkit action of its own, which copies the file, checks the copy's size and SHA-512 and installs that copy with `dpkg`; the handoff refuses with `DebianUpdateInstallerMissingException` when the script isn't owned and writable by root alone, and the script's refusals reach the app as `DebianUpdateArgumentsRefusedException`, `UpdateChangedBeforeHandoffException` or `DebianPackageNotInstalledException`.
  `package-smoke --deb` checks the installed script and polkit action.
- An AppImage whose folder the app can't write is refused before anything downloads or stops, with the reason, through `AppImageReplacement.refusal` and `AppImageHandoff`'s new optional `folderRefusal`.
- A build command that reaches its time limit has its whole process tree ended, and the run settles once that tree is gone, within a bound, even while a grandchild holds its output; a tree that can't be ended rejects with a `BuildException` naming the command.
- `install --shard` and `build --shard`, which the root `build` script passes from `SHARD`, build only what a part of a split test run checks.
- The release's lists sort by Unicode code point rather than by the runner's locale; `@noldova/desktop.build` takes `@noldova/context.collections` as a new peer.
- `package-app.yml` and `module-range.yml` restore the Angular tests' browser from the cache instead of downloading it on every run.
  `module-range.yml`'s install keeps every package the caller's lockfile holds at its locked version, and fails when a folder holds another version.
- Every package's `@noldova/context.*` peers are `>=0.0.12 <0.1.0`, and the context packages are pinned at 0.0.12; `@noldova/ui.components.angular` is pinned at 0.0.25, and the window package's peer on it is `>=0.0.25 <0.1.0`.
  The workflows are pinned at `.github`'s v2.41.4, and `actions/create-github-app-token` at 3.3.0.
- Tests: the build package's fixtures create a folder only when it is missing; the volume test hands a busy eject to the run's end; the serial test runner prints each thrown error's stack and fields and names the step a test was in at its time limit; `test:ui:ci` starts, ends and waits for its own session bus; the silent-main-process test expects the window's timed-out layout write; `npm test -- scripts` runs only the script tests; the README describes the flake proof's display, and `WEB-VIEWS.md` states that a page gets no key before its first contentful paint.
  The packages are unchanged by this.

## 0.0.11

- When the origin check refuses a frame's navigation, or a frame's load or redirect, the view raises `FrameNavigationRefused` with the address, its origin, `isRedirect` and the frame's `frameId`, and the host shows its own refused page in that frame, in the window's colours; `NavigationRefused` stays the main frame's alone, and a module built before this event ignores it.
  The page says "`<name>` doesn't open `<origin>`", with the name a window part gives `context.webViews.openAsync` in its new optional `{ name }`, or "This view" without one; it names the origin only when the frame itself started the navigation, and says "this address" otherwise, so a page can't read where another origin's redirect or its parent sent the frame.
  The origin check lets that page through once, only in that frame and only at its exact address; every other `data:` address stays refused.
- A moved web view's restored page reads its scroll without a time limit, so a busy machine no longer loses the scroll there; a keep or a scroll-back that gives up writes a line to the main process log naming the view and why.
- A right-click in a tab's rename field opens the field menu (Cut, Copy, Paste) again, and the rename goes on once that menu closes; `@noldova/ui.components.angular` is pinned at 0.0.20, and the window package's peer on it is `>=0.0.20 <0.1.0`.
- The build retries a browser's or Electron's install only after a network failure that another try can fix, such as `ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN` or a 5xx, 408 or 429 answer, and fails at once naming any other failure; an Electron install that leaves no binary fails at once.
  `npm ci`'s retry after a dropped read or download waits 5 seconds before its second run.
- A Windows installer that packaging stops at its time limit is reported with what it left: the install folder's files, each `ns*.tmp` folder the installer made under the temporary folder with its files and sizes, and which of its processes still run.
- Tests: the docking test that resizes a dock waits for the dropped tab's focus first.
  The packages are unchanged by this.

## 0.0.10

- A `NewWindowRequested` event carries `fromPress`, following a browser's popup rule: each press of the person's own mouse button, key or touch in a view, but Escape or a modifier alone, gives the view one activation for 5 seconds, and the first new-window request after it uses it up and gets `true`; every other request, including the second one from the same press, gets `false`.
  An event without `fromPress` is accepted until 0.1.0, and `WEB-VIEWS.md` now describes `disposition` as the engine gives it.
- A window part's `context.runCommandAsync` rejects with `CommandNotEnabledException`, without running the command, when the command is not enabled for its arguments, as the published API says; after the runtime starts again, a runtime command a part runs from `reconnectAsync` is judged on the new runtime's states.
- A window whose update hold is set after the update ended releases the hold and saves what is unsaved, so its later moves and sizes are saved again.
- `IFeedResponse` has an optional `body`, the response's stream, and the feed provider cancels it when it refuses an answer without reading it; `feed-check`, third-party package downloads and the signing package download cancel a refused answer's body too, so a server that keeps the body open no longer holds the command until its timeout.
- The search palette gives its quick input the query its items answer, so Enter waits for a new query's results, and then opens the selected row, such as the Best match, even while a late source is still answering.
- `feed-check` waits for a file the update information lists that the feed doesn't serve yet, trying again every 15 seconds until `FEED_WAIT_SECONDS`, as it does for the update information.
- `release-publish` checks again, before it makes the release's draft and before it tags and publishes it, that its version is newer than every published release, so a version another run overtook after this run's check isn't published.
- `release-publish` replaces a file of a draft an earlier run left that differs from this run's build, saying so in the log, and publishes the draft with this run's notes; a file that differs after this run's own upload still fails.
- The release notes name the targets whose packages the run built but never installed or started, such as ARM64 packages built on an x64 runner; a package report has a fourth field, `started`, which `package:smoke` sets after a passing run, and a report without it no longer reads.
- `release-app.yml` keeps `desktop.build` and its `@noldova` peers 35 days, so `publish` and `feed` find them however long the approvals wait, and `publish` fails naming the targets whose release files expired after 14 days.
- `desktop.product.name` refuses `#`, which `gh release upload` reads as a label, `%`, `!`, `$`, a backquote, `/ ? < > : * |`, `[ ] { }`, control characters, a dot or space at its end and the names Windows reserves; `desktop.product.publisher` refuses `%`, `!`, `$` and a backquote too, which the generated command scripts would read.
- Packaging leaves out every other target's `native/<platform>-<arch>/` and `prebuilds/<platform>-<arch>/` folder, whatever platform and processor it names, such as `prebuilds/win32-ia32/` or `prebuilds/darwin-x64+arm64/`.
- `package:smoke` refuses to install where the machine already holds the app, and a Debian or macOS install that fails removes what it placed.
- `package:smoke` finds an AppImage's mount under a folder whose path holds a space, a tab, a line break or a backslash.
- Signed macOS packaging shares one 70-minute limit across electron-builder, which notarizes the app, the disk image's notarization and stapling, and the checks after them, and fails naming the process the limit stopped; the disk image's notarization waits 45 minutes instead of an hour, and `package-app.yml`'s "Make the package" step gets 85 minutes for signed macOS.
- A release holds a lock, the ref `refs/locks/release`, from its publish through its feed check, so two releases close together publish one after the other; a lock whose run has ended is taken over, and a new `unlock` job lets go of it however the run ends.
  `release-app.yml`'s `publish` job needs `actions: read` and waits up to 90 minutes for the lock, the `unlock` job needs `contents: write`, and the `check` job refuses a `desktop.build` without the `release-lock` command, so an app moves its `release-app.yml` pin and `desktop.build` together.
- Packaging tries a third-party tarball's download again, up to 4 attempts 15 seconds apart, after a network error or an HTTP 408, 429 or 5xx answer, and says each retry in the step's output.
- An addon build that needs Node.js's headers, every Windows addon and a POSIX addon on a Node without them, downloads them first with `node-gyp install`, tried again 15 seconds later after node-gyp's "Completion callback never invoked!" stall, up to 3 tries; any other failure, or a third stall, fails the build naming the download.
- `package-app.yml`'s install step runs `npm ci` once more after a download a reset connection cut short, which npm logs as `ECONNRESET` and `network aborted`, as it already did after a stalled read.
- On Windows, the runtime's forced end gives what it killed the whole end time, `ProcessSettings`' time for killed programs to end, from when it has listed the processes rather than from before it lists them, so a slow listing no longer uses that time up.
- `@noldova/desktop.build` and `@noldova/desktop.runtime` need `@noldova/context.text` 0.0.9 or later, below 0.1.0; `@noldova/context.core`, `context.exceptions` and `context.json` are pinned at 0.0.9, `@noldova/ui.components.angular` at 0.0.19, and the workflows at `.github`'s v2.41.0.
- Tests and CI: the macOS x64 Build and test job runs in two parts; the window tests are served from 127.0.0.1 and print each request still open after 10 s; process tests give real programs three times the measured stop times as their limits, and a stalled install's stop waits for the exit itself; the volume test names the step that outruns its limit and records what holds the disk; the web-views test waits for its allow-mark command.
  The packages are unchanged by these.

## 0.0.9

- When the runtime ends a client's session, it cancels that session's running requests and closes the connection itself if the client hasn't closed it within the close grace period.
- A request's or a handshake's id is at most 256 characters, and `RuntimeClient.connectAsync` refuses a client name longer than 239 characters, so each of its request ids fits.
  Every answer the runtime sends goes through one path: an answer that can't be sent falls back to a failure with the same id, then to one with no id, and then the connection closes.
- On a CI runner, packaging keeps its signing folder in the runner's temporary folder, which the runner empties after each job; elsewhere it stays under the app's `_build/package`.
- A setting's title, description and choice titles in `settings.json` can name a key with a token such as `{key:Mod+Enter}`, which Settings shows in the platform's own form: `Ctrl+Enter` on Windows and Linux, and in words, such as `Cmd+Enter` and `Option+Enter`, on macOS.
  A token that names no key shows as written.
- `PseudoTerminal.readForegroundProcessAsync()` reads the terminal's foreground process group with its leader's program and command line and the terminal program's own, as the new exported `ForegroundProcess`, so a module can tell whether a command has started its program or is still the shell's copy that forked it.
- On macOS, the installer package installs only into `/Applications/<folder>` on the startup disk, and `package:smoke --pkg` checks that; an app running from `/Applications/<folder>` moves a copy of itself in `~/Applications/<folder>` with the same bundle id, at the same version or older, to the Trash.
- On Linux, the app's command answers the command line instead of opening the window: the Debian package links `/usr/bin/<slug>` to the command script in `resources/bin/<slug>`, and `<App>.AppImage --command-line <args>` runs the command line; `package:smoke` checks both with `status --json`.
- The main process starts or attaches to the runtime as soon as the installation's launch barrier passes, without waiting for Electron, the window or the saved placement; the barrier's message boxes still wait for Electron to be ready.
- The main process closes its log, `main.log`, before it exits, so its data folder can be removed right after.
- A main process that loses the runtime while a barrier check is running checks the barrier again, so it quits when another main process closed the installation, even once the runtime is back.
- Closing the window that asks about running work before a restart to update answers Cancel, so the restart is cancelled and a Quit held meanwhile goes on.
- A page call to a web view whose guest a move destroys during the call ends, so the module gets its `End` input and later presses on that view count again.
- A tool failure whose text item isn't a string is answered as a malformed result instead of leaving the call unanswered, and `ToolContent.fromText` refuses a value that isn't a string.
- A page whose component fails to load shows its module's failure card, "Its page could not be loaded.", naming the module, and reports the error once; a shell page that fails to load reports its error and stays empty.
- A dropped tab has the keyboard focus, as after a move with the keyboard or a menu.
- `release-publish`'s release text no longer names the supported targets; it names only the targets a CI run alone accepted.
- `@noldova/ui.components.angular` is pinned at 0.0.17, and the workflows at `.github`'s v2.40.0 (#308).
- Tests and the CI smoke: a timed-out command's record names what it last wrote, and the Linux smoke waits for apt's lock; the build tests keep npm's compile cache out of their temporary folders; the main-process log, silence-report, teardown and ownership-ignored volume tests wait on what they check; and the runtime client tests use the product's default limits except where a test checks one.
  The packages are unchanged by these.

## 0.0.8

- Web Bluetooth is off in every window: the main process adds `WebBluetooth` to `--disable-blink-features` before ready, so a page has no `navigator.bluetooth`, and every web contents cancels a Bluetooth device choice with an empty device id.
  A `<webview>` loses its own Blink and experimental feature settings when it attaches, so a view keeps the window's.
  `@noldova/desktop.electron` exports `IDeviceChooserContents`, and the application host's `on` takes `"web-contents-created"`.
- A release can set its version itself: `release-app.yml` takes `set-version`, false by default; when it is true, each build runs the app's own `npm run set-version -- <version>` before `npm ci` and fails unless the app's `package.json` then holds the version, and `release-check` compares the version only with the earlier releases.
  An app uses it once it locks a `@noldova/desktop.build` that holds this version.
- On macOS and Linux, `build` compiles the POSIX addon against the headers of the Node.js running it, with `--nodedir`, when that Node's folder holds `include/node/common.gypi`, so node-gyp downloads nothing; Windows, and a Node without headers, still download them into `_build/node-gyp`.
- The window actions test answers the window's close request, so a run of it alone leaves no timer open; the packages are unchanged.

## 0.0.7

- `build` installs the packages it builds from their archives together with the versions `package-lock.json` holds at the top of `node_modules` for each peer the lockfile names, each peer the built packages declare, and each installed optional package that names no peers of its own, so a newer release of Angular or of `@noldova/ui.components.angular` no longer stops the install with `ERESOLVE`.
  After each such install it compares `node_modules/.package-lock.json` with `package-lock.json` and fails, naming the package, when the install put a package the lockfile doesn't list or at a version it doesn't hold, or, when the install left no `node_modules/.package-lock.json`, naming that file.
- On macOS, Restart to update installs the update and restarts into it, also for a copy the person can't write, such as one a `.pkg` installed in `/Applications/<folder>`: the handoff finds ShipIt in the system launchd domain, where Squirrel.Mac starts it as root, through `launchctl print system/<bundle id>.ShipIt`, and the update's barrier holds while it runs.
  A failure to read that job other than its absence fails the handoff as unreadable.
  `@noldova/desktop.runtime`'s process table on macOS lists other users' processes, root's included, with their start times.
- Every Debian package holds `resources/package-type` naming its type, so a copy installed from a `.deb` updates through the Debian updater rather than taking the AppImage's; `package:smoke --deb` checks the file.
- A view can name its default group on its side and its place in that group's tab row, `defaultGroup` and `defaultOrder` in `IViewOptions`; a new layout and Reset the layout split a side into those groups, order their tabs across modules and show each group's first tab.
  A saved layout keeps its groups until Reset the layout, and views that name neither open as before.
- `@noldova/desktop.window` takes `@angular/cdk`, `@angular/common`, `@angular/core` and `@angular/platform-browser` at exactly 22.3.0, `@noldova/ui.components.angular` from 0.0.15, and `@noldova/context.core`, `context.exceptions` and `context.json` from 0.0.8, so an app moves its Angular pins to 22.3.0 and its kit to 0.0.15 or later with this version.

## 0.0.6

- `package`'s check that every built file is the target's architecture accepts, on a Windows target, a bundled program of any machine Windows 11 runs there: x64 and x86 on x64; arm64, x64 and x86 on arm64.
  The app's own files, those at the unpacked folder's root and every `.node` module, stay the target's architecture alone, as every file of a macOS or Linux package does.
  On a Windows target the verified line names the machines Windows runs there and how many files of each the package holds.
- A window shown before its page painted is reported painted, `isPainted` in `status --json`, once its page paints, and the main log records that paint with how long after the window opened.
  `@noldova/desktop.electron`'s `OpenWindow` gains `whenPagePaintedAsync`, which resolves only when the page paints, or `false` once the window closes.

## 0.0.5

- An app can name an install folder, `desktop.product.installFolder` in its `package.json`, such as its publisher's name, and installs inside it beside the other apps that name it; an app that names none installs as before.
  On macOS such an app ships a `.pkg` in place of the disk image, which installs `/Applications/<folder>/<app name>.app`, and a signed one is signed with a Developer ID Installer certificate from the new `MAC_INSTALLER_CERTIFICATE` and `MAC_INSTALLER_CERTIFICATE_PASSWORD` secrets of `package-app.yml` and `release-app.yml`, without which a signed build stops.
  A copy running from `/Applications/<app name>.app` moves itself into the folder once as it starts, and moves the old copy to the Trash.
  On Windows it installs in `%LOCALAPPDATA%\Programs\<folder>\<app name>`, with its Start menu entry in a `<folder>` folder; an update moves an install from the old default, `Programs\<slug>`, and its shortcuts and Path entry with it, while an install placed with `/D` stays.
  The Debian package installs into `/opt/<folder>/<app name>`; the AppImage is unchanged.
- `@noldova/desktop.electron`'s `IMainProcessEnvironment.files` is an `IMainProcessFiles`, `IShownPathFiles` plus `rename` and `readdir`, and `IMainProcessEnvironment` gains `probeProcess`: an app or test double that implements the environment itself adds all three.
- `package-app.yml` takes an optional `artifact-suffix` input, appended to its artifacts' names, so one run can call it twice; left empty, the names are unchanged.
- A call to a web view whose page is still binding waits for the page within its own timeout, rather than failing at once as `Unavailable`, and calls that waited go out in the order they came.
  A navigation that reaches a web view while its page binds is the only one that loads, so the page no longer loads twice.
- `package-app.yml`'s Linux smoke keeps the virtual display's own output in a file, and uploads it as `virtual-display-log-<platform>-<architecture>-<attempt>` when the smoke fails.
- `package-app.yml`'s AppImage smoke on a self-hosted runner requires Chromium's sandbox; on a GitHub-hosted runner it decides as before.
- `@noldova/desktop.window.app` takes `@noldova/ui.components.angular` 0.0.12.
- The workflows call the organization's shared workflows at v2.39.0.

## 0.0.4

- An app's ARM64 package built on an x64 runner, as a release builds Linux and Windows ARM64 by default, ships its company packages bound to ARM64, which `npm ci` leaves out on the runner.
  `package-app.yml`'s "Build the app" step, after the app's `prepare` command, packs each company package of the app's lockfile that the install left out and whose `os`, `cpu` and, on Linux, `libc` fit the target into the runner's temporary folder, and packaging takes it from there only when its SHA-512 matches `package-lock.json`.
  The stage installs for the target's `--os`, `--cpu` and, on Linux, `--libc`, lists each shipped package bound to a platform as an optional dependency, and fails naming any package it left out.
  A target's failed package job no longer cancels the others, and electron-builder's tool cache is kept per runner architecture.
- `package-app.yml` and the build's first install run `npm ci` once more when a download stalls after its response started, which npm doesn't retry.
- `package-app.yml`'s Debian smoke runs `apt-get update` only when the package needs a dependency that isn't installed; on a self-hosted runner, which has no root, it skips the Debian package's smoke and installs or removes nothing.
- A shortcut pressed in a web view whose command is disabled reaches the page.
- A document tab no longer carries the accent underline: `IDocumentOptions.underline` and `IDocumentUpdate.underline` are ignored and deprecated, and go at the next minor version.
- `package-app.yml` and `release-app.yml` call the organization's shared workflows at v2.37.0.

## 0.0.3

- An app's release files are named `<Product>-<version>-<platform>-<arch>.<ext>`, such as `Sample App-1.2.3-windows-x64.exe`, so releases' files kept side by side never share a name; the update information, `latest-<platform>-<arch>.yml`, keeps its name.
  A link to a release's file by a fixed name, such as `releases/latest/download/<Product>-windows-x64.exe`, no longer finds it: link to the release page, or to a redirect that reads the version from the update information.
  A copy installed before this version looks for its package under the fixed name, so it can't update to a release made with this version: it needs one reinstall from a download, and updates by itself after that.
  An update whose information names a version that isn't semver is refused as invalid information.
- `@noldova/desktop.electron`'s `FeedSource` constructor takes an optional sixth argument, `formatReleasedFile`, which names the package of a version, and `packageFile` is the package's name without a version; `FeedSource.create` keeps its signature and names the versioned package.
  `IUpdater` and `FeedUpdater` drop `packagePath` for `formatPackagePath(version)`, and `downloadAsync(version, onProgress)` takes the version the last check found.
- A release builds Linux and Windows ARM64 by default, on the x64 runners, and doesn't start them; a caller that empties an ARM64 input leaves that target out.
  `package` checks that every Mach-O, PE and ELF file it built is the target's architecture alone, and fails naming the first that isn't.
  The build refuses to compile addons for a processor other than the machine's; such a target takes them from `RELEASE_ADDONS`, and the build reads its target architecture from `NOLDOVA_DESKTOP_ARCHITECTURE` when set.
  A GitHub-hosted macOS x64 release job runs the package's start check; a self-hosted one still skips it.
- `release-app.yml` can build an app from another repository's public source and publish it into a third repository under its own tag prefix, through the new inputs `source-repository`, `signing-environment`, `publish-environment`, `release-repository` and `release-tag-prefix`; left at their defaults, they keep the earlier behaviour.
- Packaging ships an app's own `@noldova/*` or `@noldova-com/*` package locked as a `file:` archive directly in the `_packages` folder of the app's folder or of a folder above it, inside the same repository and under the name `npm pack` gives it, checking its SHA-512 when the lockfile holds an `integrity`.
  It refuses an archive outside the repository or reached through a link, and any other locked `file:` entry or linked folder, with a message that names it.
- Packaging accepts an app whose top-level overrides name a package it ships, which npm refused before as `EOVERRIDE`.
- A view can add the places it shows to Back and Forward with `IWindowPartContext.recordPlace`, hear Back or Forward reach one with `onPlaceShown`, and take one out with `forgetPlace`; `FakeWindowPartContext` stands in for them and adds `raisePlaceShown`.
- A view or document shown in a view dialog closes that dialog with `IWindowPartContext.closeDialog(name, instance?)`; the call does nothing while it shows in a tab, and `FakeWindowPartContext` records it.
  An app or test double that implements `IWindowPartContext` itself adds `recordPlace`, `forgetPlace`, `onPlaceShown` and `closeDialog`.
- `IDocumentOptions.activate` set to false opens a document without making it active or moving the focus.
- `WindowPartTokens.activeDocument` is a signal for whether a window part's page is the window's active document.
- `@noldova/desktop.window` exports and declares `RuntimeRequestException`, whose `code` and `details` say why a request failed, `FileNotOpenedException`, which `openFileAsync` rejects with, and `FileNotShownException`, which `showInFolderAsync` rejects with.
- A search answer can say its count is capped, with `SearchAnswer`'s third argument `isCapped`, and the search palette shows that count with a "+", as in "1000+".
- A module declares its commands' and documents' former names in `contributes.formerNames`, so a key binding or a saved tab under a former name carries over to the renamed command or document.
- A pane's declared key wins in its own views over the app's shortcuts; `webViews.json` gains `loadingKeys`, keys that reach the pane only while the view's page loads; and F6 and Shift+F6 move the focus through the window's regions.
- A web view raises a `Favicon` event to the window part with the page's icon as a PNG data URL of at most 64 by 64 pixels, or null.
  `@noldova/desktop.electron`'s `IWebViewSession` gains a required `readIconAsync(url, byteLimit, signal)`: an app that implements `IWebViewSession` itself adds it.
- A `NewWindowRequested` web view event holds `disposition`: `background-tab`, `foreground-tab` or `new-window`, as the engine gives the request.
  Within 0.0.x the protocol also accepts an event without it, and `IWindowOpenDetails` gains an optional `disposition`.
- Web views refuse the app's own endpoint ports on a loopback address, even when an allowed origin names them; the protocol adds `desktop.webViewBlockedPorts`, `desktop.readWebViewBlockedPorts` and `desktop.webViewPortsBlocked`.
- A web view's page that navigates its own top frame elsewhere than its view allows, including to `about:srcdoc`, raises `NavigationRefused`, which a misread of the engine's event had dropped.
  `@noldova/desktop.electron`'s `IWebViewContents` now gives a `will-frame-navigate` listener one `IFrameNavigation`, in place of `(event, url, isMainFrame)`, and gains `on` overloads for `did-start-navigation`, with an `IWindowNavigation`, and `page-favicon-updated`, with the icons' addresses: an app that implements `IWebViewContents` itself changes its `will-frame-navigate` listener and adds the two overloads.
- A runtime part marks the span an agent controls a web view with `IRuntimeWebViews.setControlledAsync(id, isControlled)`, and a controlled view behind another tab keeps painting, under the shown tab, so the agent's clicks and keys reach the pages it loads there; the protocol adds `WebViewAction.SetControlled` and the window's `Controlled` event.
  An app that implements `IRuntimeWebViews` itself adds `setControlledAsync`.
- A web view moved to another group restores its kept page in its new place even when its old page is still being torn down.
- On Linux only the app's own main process, running the app's program on its own `app.asar`, connects as `ShellClients.mainProcess`, as on macOS and Windows; `IMainProcessCheck` has an optional `accept(socket)`.
- On macOS a private folder on a volume mounted with ownership ignored is refused with a `FolderNotPrivateException` naming the volume.
  `@noldova/desktop.runtime`'s `MacFolderProtector` takes the POSIX addon, a `NativeAddon<IPosixProcessAddon>`, as its required second argument, before the optional user: an app that constructs `MacFolderProtector` itself passes it.
- The runtime's and the main process's log lines no longer block their process on the disk.
  `@noldova/desktop.electron`'s `IMainProcessLog` gains a required `flush()`, which writes the waiting lines at once before the process quits: an app that implements `IMainProcessLog` itself adds it.
- The runtime answers a client's handshake that arrived within the handshake time even when the runtime was busy past it, instead of closing the connection.
- A choice row shows the checked row's own icon when it has one.
- A document a running part opens while the window reconnects to the runtime opens in front.
- An update that folded its check into an ended update's check learns at once that the barrier is gone.
- `package:smoke` also checks for the start log's removal every half second, instead of waiting until its launch limit when the watch misses it.
- The module-range check refuses a module whose `noldovaDesktop` range starts at a version other than the exact Noldova Desktop version its root `package.json` pins; when it can't download a package it names npm's reason, and a failing run names the `@noldova` packages it tested off the lock.

## 0.0.2

- A window part reads which dock holds one of its view's tabs with `IWindowPartContext.viewDockOf(name, instance?)`, a signal of `DockSide.Bottom`, `DockSide.Left`, `DockSide.Right`, or `null` outside a dock or while the tab isn't open.
  It follows the tab as it moves, opens and closes, and a hidden dock keeps its side.
  The testing package's fake context answers it like `keyOf`.
- `@noldova/desktop.window`'s peer on `@noldova/desktop.protocol` is a range up to the next minor, `>=0.0.2 <0.1.0` for this version, instead of the exact version, so an app may install any protocol of the same minor beside the window.
- A tab's content stays in the page, hidden and inert, while another tab of its group shows, so a module's web view behind another tab keeps its page and the runtime part's calls on it reach it.
- A tab moved to another group, a dock or a dialog binds its web view's page again, so the runtime part's calls on it answer as before the move, and the page keeps its form values and scroll position, since the new page restores the old one's history instead of loading its address.
- `@noldova/desktop.electron` adds what that move uses: `WebViewHistory`, `IWebViewContents.readHistory`, `restoreHistoryAsync` and `executeJavaScriptInIsolatedWorld`, the optional `claim` and `attached` arguments of `IWebViewEngine.watchAttach`, and `IIpcEvent.returnValue`.
  An app that implements `IWebViewContents` itself adds the three members.
- A call a module sends through a web view's relay that focuses an element of the page, such as a press, `DOM.focus` or `Runtime.evaluate`, still reaches the page, and the person keeps their focus.
  The host owns focus emulation, so the relay refuses `Emulation.setFocusEmulationEnabled` with a `WebViewFailureException` of kind `NotAllowed`, and the testing package's fake does the same.
  A `WebViewFailure` of a kind other than `Protocol` may now carry the host's message naming the rule the call broke, never a code.
- An open command search lists the commands that arrive or become enabled while it is open, such as at the end of the window's start, without the person typing again.
- The runtime launcher's wait for the runtime's discovery file also wakes when the folder's entries change and its watch didn't report it, instead of waiting until its limit.
- `@noldova/desktop.build`'s package smoke waits for the launcher's start log as an event on the file itself, not by polling or through a watch on its folder, which can miss a removal on macOS.
- `@noldova/desktop.build`'s package command builds a macOS target once more when dmgbuild can't detach its disk image, instead of failing the package.
- `@noldova/desktop.build`'s module catalog accepts a range for a module's peer on any of the organization's packages, `@noldova/` or `@noldova-com/`, when the installed version is inside it.
  On a package other than Noldova Desktop's, context's and the kit's, the range must end at the first version refused after its lowest one: the next minor below 1.0.0, the next major from 1.0.0.
- The declarations of `@noldova/desktop.build`, `@noldova/desktop.cli`, `@noldova/desktop.electron` and `@noldova/desktop.runtime` reference Node.js's types, so a project compiles against them without naming `@types/node` in its `types`.
  Each package names `@types/node` `>=26.6.6 <27.0.0` as an optional peer.
- Noldova Desktop builds and tests on Node.js 26.13.1 with npm 11.20.0.
  What an app's program runs still runs on the Node.js that Electron embeds, 24.22.0 in Electron 44.9.1, and calls only what that Node.js has.
- The packages are published through npm's trusted publishing, with provenance, so the release stores no token.

## 0.0.1

- The first published version of Noldova Desktop's packages, `@noldova/desktop.protocol`, `@noldova/desktop.runtime`, `@noldova/desktop.electron`, `@noldova/desktop.window`, `@noldova/desktop.cli` and `@noldova/desktop.build`, which together host an app's modules in a runtime, a main process, a window and a command line, as [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) says.

### Moving from the earlier packages

Apps and modules built on the earlier `@noldova-com/desktop-*` packages change these when they move to 0.0.1:

- Import from `@noldova/desktop.window`, `@noldova/desktop.electron` and the other `@noldova/desktop.*` names in place of `@noldova-com/desktop-*`.
- Rename the app's `tsconfig.base.json` to `tsconfig-base.json`, which the build now reads.
- A web view is now a `<webview>` element of the window's page ([documents/WEB-VIEWS.md](documents/WEB-VIEWS.md#the-window-bridge)):
  - `IWebViewHandle.setBounds(bounds)` is gone: call `handle.mount(host)` once with the pane's element, which the view then fills, give that element a position such as `position: relative`, and drop the code that measured it.
  - `IWebViewHandle.cover()` is gone with the still images: a module's menus and Noldova Desktop's own lie over the live view, so drop the cover and its release.
  - `IWebViewBounds` is gone with `setBounds`.
  - `openLayerAsync` now always returns a layer, on Linux under Wayland too, and rejects with the closed error when the view closes while the component loads: drop the `null` branch and any in-page mark used in its place.
- `IWebViewFound` has `isTimedOut`: a search the engine doesn't finish within 10 seconds returns it as `true`, with no matches; tell the person the search timed out rather than that nothing matched.
  It also has `isEnded`: a search that a navigation, a crash or a newer search ended before the engine finished returns it as `true`, with no matches; tell the person the search stopped.

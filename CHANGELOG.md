# Changelog

**Scope:** What each published version of this repository's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version, as the [README](README.md#releases) says; other pull requests don't edit this file.

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
- A `NewWindowRequested` web view event holds `disposition`: `background-tab`, `foreground-tab` or `new-window`, as the engine gives the request.
  Within 0.0.x the protocol also accepts an event without it, and `IWindowOpenDetails` gains an optional `disposition`.
- Web views refuse the app's own endpoint ports on a loopback address, even when an allowed origin names them; the protocol adds `desktop.webViewBlockedPorts`, `desktop.readWebViewBlockedPorts` and `desktop.webViewPortsBlocked`.
- A web view's page that navigates its own top frame elsewhere than its view allows, including to `about:srcdoc`, raises `NavigationRefused`, which a misread of the engine's event had dropped.
- A web view moved to another group restores its kept page in its new place even when its old page is still being torn down.
- On Linux only the app's own main process, running the app's program on its own `app.asar`, connects as `ShellClients.mainProcess`, as on macOS and Windows; `IMainProcessCheck` has an optional `accept(socket)`.
- On macOS a private folder on a volume mounted with ownership ignored is refused with a `FolderNotPrivateException` naming the volume.
- The runtime's and the main process's log lines no longer block their process on the disk.
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

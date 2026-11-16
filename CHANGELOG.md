# Changelog

**Scope:** What each published version of this repository's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version, as the [README](README.md#releases) says; other pull requests don't edit this file.

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

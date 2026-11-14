# Changelog

**Scope:** What each published version of this repository's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version, as the [README](README.md#releases) says; other pull requests don't edit this file.

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

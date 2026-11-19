# Electron

**Scope:** The `@noldova/desktop.electron` package, `src/noldova.desktop.electron`, which is Noldova Desktop's Electron main process, the window's preload and the web views' press script, under the [window rules](../../documents/WINDOW.md#the-main-process).

## 1. Purpose

The main process starts the runtime that owns the app's data directory, or connects to the one that runs, and opens the window on the window package's build.
It owns what the operating system shows outside the window: the tray, notifications from the operating system, the menu bar on macOS, the taskbar's identity on Windows, the stop key, shutdown and updates, as [WINDOW.md](../../documents/WINDOW.md#the-main-process) says.
The window reaches it only through the preload bridge, and the main process takes each request only from the window's own page.

## 2. Use in an app

An app doesn't import the package: `@noldova/desktop.build` names its `main.js` as the app's Electron entry, in the `package.json` of the development app it starts and of every package it builds, as [BUILD.md](../../documents/BUILD.md#the-build-package) says.
The app installs the package at the exact version its Noldova Desktop version pins, with Electron at the version the package peers on and context's `core`, `exceptions`, `json` and `text` packages.

## 3. Entry points

| File | What it is |
|---|---|
| `main.js` | The main process: it composes `MainProcess` from Electron's own modules and starts it. |
| `preload.cjs` | The window's preload, which runs sandboxed and exposes the bridge the window calls. |
| `press-watch.cjs` | The press script, every web view's only preload, which runs sandboxed in an isolated world of each frame, exposes nothing to the page and reports the person's presses over the frame's IPC channel, as [WEB-VIEWS.md](../../documents/WEB-VIEWS.md#new-windows) says. |
| `utility-entry.js` | The Electron utility process that starts a detached program on Windows. |
| `api/index.js` | The package's exports, which `api/index.d.ts` documents member by member: the main process's classes, the interfaces they take, and the exceptions the package throws, all extending `ElectronException`. |

## 4. The preload's settings

A sandboxed preload can load no file of its own beside Electron's modules, so it can't import the package's `Resources`.
The main process hands it everything it shares with the window instead: one `--desktop-preload=` argument of the window's renderer, the JSON of `PreloadSettings`, holds the bridge's name, the limit on pasted bytes in one call, the window's last appearance and the name of each IPC channel, all from `Resources`.
`Resources` owns each name once, and the preload names a channel only by its key in `IPreloadChannels`, which the compiler checks against the main process's table.
The preload refuses to start without valid settings, and refuses an answer other than `true` or `false` to a question the window asks as yes or no.

## 5. Failures

Every exception the package throws extends `ElectronException`, so a caller catches any of them in one place, except the two the utility-process starter throws.
`RuntimeStarterFailedException` and `RuntimeStarterEndedException` extend the runtime's `LaunchException` instead, so they are caught with the runtime's other start failures.

| Exception | When |
|---|---|
| `DeviceIdentityException` | This device's identity file cannot be read or holds no valid identity. |
| `PathCommandException` | The command cannot be linked on the macOS `PATH`. |
| `ProgramException` | A program cannot start, ends with an error or runs too long. |
| `UnusableFolderException` | The main process cannot use the data folder it was given; the message is what the start-failure box shows. |
| `UpdateException` | An update's check or download fails; its message is the reason the window shows. Abstract: each condition is its own subclass, such as `UpdateFeedRefusedException`. |
| `UpdateHandoffException`, `StaleUpdateException` | An update's handoff cannot install it, or a ready update is no longer the one to install. Abstract: each condition is its own subclass, such as `InstallerNotStartedException` or `UpdateNoLongerOfferedException`. |
| `UpdateStopException` | An update cannot stop the installation. Abstract: each condition is its own subclass, such as `UpdateRefusedException`. |
| `WindowStateException`, `WindowStateUnavailableException` | A window's state cannot be read or kept through the runtime, or the runtime cannot be reached. Abstract: `WindowStateRefusedException`, `WindowStateNotConnectedException` and `WindowStateRuntimeUnreachableException` name the conditions. |

## 6. Tests

The package's tests mirror its sources under `tests/`, and run with the repository's `npm test`, as the [repository's checks](../../README.md#checks) say.
Six files are left out of coverage, each with its reason in `package.json`'s `noldova.coverageExclusions`, since they load only inside Electron: `main.ts`, `services/electron-web-view-engine.ts`, `services/electron-web-view-contents.ts`, `services/electron-web-view-session.ts`, `services/product-app-adapter.ts` and `utility-entry.ts`.
The end-to-end workflows under `tests/e2e/` start the test build in Electron through Playwright, with `npm run test:ui`, and in CI with `npm run test:ui:ci`, which on Linux runs them under `dbus-run-session` and `xvfb-run`, so they have a session bus and a display of their own.

- **One worker:** the workflows run one at a time, since they share what a machine has one of: the system clipboard, foreground focus and the pointer, and Windows' notification history, which the tray workflow counts.
- **Tray host:** the two tray-quit workflows that close the last window into the tray need a tray, which a Linux session has only with a StatusNotifier host; each skips itself, with its reason, when the session bus has none, as the CI session bus on Linux has none.
  The tray workflow that runs everywhere checks that the main process reports a tray exactly where the session bus has a host.

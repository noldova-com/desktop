# Runtime

**Scope:** The `@noldova/desktop.runtime` package, `src/noldova.desktop.runtime`, which owns a data directory, hosts modules' runtime parts and keeps their state, and the client side that finds, starts and connects to it, under the [runtime rules](../../documents/RUNTIME.md).

## 1. Purpose

One runtime owns each data directory: it authenticates local clients, hosts the runtime part of each module, routes their requests and events, keeps state and runs migrations, as [RUNTIME.md](../../documents/RUNTIME.md#ownership) says.
The main process and the command line reach it through the package's client side, which finds the runtime that owns a data directory, starts one when none runs, and connects to it over the [local protocol](../../documents/RUNTIME.md#messages) of `@noldova/desktop.protocol`.
A module's runtime part builds against the package's interfaces, and its tests against the package's fakes.

## 2. Use in a module

A module's runtime part installs the package as a peer dependency, at the version or in the range [Noldova Desktop versions](../../documents/MODULES.md#noldova-desktop-versions) allows, with context's `core`, `exceptions`, `json` and `text` packages, which the package takes as peers too.
Its package exports the part at `<package name>/runtime`, as [MODULES.md](../../documents/MODULES.md#modules-from-packages) says: a class that implements `IRuntimePart`, which the runtime activates once with the module's `IRuntimePartContext`.

```ts
import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";

export class RuntimePart implements IRuntimePart {
  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    context.registerMethod("notes.list", { handleAsync: async () => [] });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
```

The context hands the part its database, settings, log, secrets, tools, permissions, web views, files, the app's windows and shortcuts, and lets it start programs and pseudo-terminals, register methods and commands, declare events, post notifications, and publish and find services.

## 3. Entry points

| Entry point | What it holds |
|---|---|
| `@noldova/desktop.runtime` | The interfaces a runtime part implements and uses, the models and enums they take and return, the exceptions the package throws, all extending `RuntimeException`, and the client side, such as `RuntimeClient` and `RuntimeLauncher`, that the main process and the command line use. |
| `@noldova/desktop.runtime/testing` | `FakeRuntimePartContext` and the fakes of everything it hands a runtime part, from `FakeModuleDatabase` to `FakeAppShortcuts`, for a module's own tests, as [Testing a module](../../documents/MODULES.md#testing-a-module) says. |

The declaration file of each entry point, `api/index.d.ts` and `api/testing.d.ts`, documents every member with its contract and examples.

The runtime's standard error carries only what its start writes there, such as a usage failure.
A stream that can no longer be written, such as a pipe the launching process has already closed, is dropped rather than ending the runtime, since that process is the only reader and nothing else could report the failure; any other error on it is thrown.

A module's test answers what its part reads and checks what it called:

```ts
import type { IRuntimePart } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";

export async function activatesNotesAsync(part: IRuntimePart): Promise<number> {
  const context = new FakeRuntimePartContext();
  context.answer("moduleId", "notes");
  await part.activateAsync(context);
  return context.callsOf("registerMethod").length;
}
```

## 4. Native addons

The package ships two Node-API addons, which the runtime loads for the platform and processor it runs on: `windows-process` on Windows and `posix-process` on macOS and Linux, from `native/<platform>-<arch>/`.
Their C sources are in `src/native/`, and the build compiles them as [BUILD.md](../../documents/BUILD.md) says.
A platform and processor the package has no build for fails with `AddonLoadException`, naming them.
`src/native/` sits beside the TypeScript concept folders because it holds the addons' source, not a TypeScript concept.
They have no tests of their own: the tests of the classes that call them, such as `tests/services/process/posix-process-api.test.ts`, `tests/services/process/posix-peer-process-api.test.ts` and `tests/services/native/native-addon.test.ts`, and the process supervisor's tests through `tests/fixtures/process-supervisor.fixture.ts`, load the built addon and run its calls on every target CI builds.

## 5. Synchronous file calls

The runtime serves every client from one event loop, so its file calls are asynchronous.
These stay synchronous, each for its reason:
- `LogFile` (`services/diagnostics/log-file.ts`) writes each log line at once, so a line written just before the process exits, such as an uncaught failure's, is on disk when it ends.
- `AppImageCopyCleanup.removeExtraction` removes an extracted AppImage folder with `process.noAsar` set, which is process-wide, so no other work may run until it is put back.
- `NativeAddon` checks that the addon file exists right before Node loads it, and that load is synchronous.
- `OwnershipLock` and `MigratedDatabase`'s flush belong to the `node:sqlite` `DatabaseSync` connections they open, which are synchronous themselves.
- `ProductInfo.current` and `ProcessClock.create` read one small file once, as the runtime starts and before it serves anyone.
- `AppImageKeepalive` reads `/proc` entries, which the Linux kernel answers from memory without the disk.
- `FolderWatch` (`services/files/folder-watch.ts`) finds the nearest folder that exists with `existsSync` as it opens and inside its watch's change handler, so it moves its watch down before a later change in the new folder can pass unseen; the launcher uses it while it waits for a runtime, and it serves no client.

## 6. Private members it reads

Three things the runtime needs have no public API, so it reads private members, each checked where it is read:
- `PosixPeerProcessApi` reads a socket's `_handle.fd` to ask the system which process is on the other end, and fails with a `RuntimeException` naming the member when it is missing.
- `PseudoTerminalConsole` stops node-pty's output worker on Windows through its agent's private members, so the terminal's process can end, and fails the same way when one is missing.
- `WatchedPseudoTerminalHandle` closes node-pty's output socket when the terminal ends, and goes on without it when the member is missing.
Each is a stand-in until node-pty and Node.js offer a public way.

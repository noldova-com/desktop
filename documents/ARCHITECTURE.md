# Architecture

**Scope:** What Noldova Desktop is and what it leaves to apps and modules, its packages and the direction of the dependencies between them, where modules keep their secrets, its names, and the code rules only this repository has.
Each subject has its own document beside this one: [MODULES.md](MODULES.md), [RUNTIME.md](RUNTIME.md), [WINDOW.md](WINDOW.md) and [BUILD.md](BUILD.md).

## The boundary

- Noldova Desktop provides what every Noldova desktop app shares: the window and its workspace, the runtime that hosts modules, the command line, and the tooling that builds, packages and updates an app.
- Everything a person does in an app comes from a module.
  Noldova Desktop knows no feature and names no app and no module.
- An app and each module live in repositories of their own and install published versions of Noldova Desktop's packages.
  An app gives its identity and the list of modules it includes, as [BUILD.md](BUILD.md#an-apps-inputs) says; a module may also ship as an app of its own.
- An app works with any set of modules, including none, which shows an empty workspace.
- An app's window, its main process and its command line on one device share one runtime and one data directory.
  Local work needs no cloud account and no synchronization service.
- Noldova Desktop offers no installing or removing of modules, no modules by other authors, no remote runtimes and no synchronization.
  Each needs a reviewed contract before any code: a module directory needs rules for dependent modules, saved layouts and kept data; other authors' code needs a trust model, isolation and a promise about Noldova Desktop's APIs; a remote runtime needs to say where the work and the files live and how the transport is authenticated.
  Until then the app's list decides which modules run, and every module is built again with each version of Noldova Desktop.

## The packages

| Package | Folder | What it is |
|---|---|---|
| `@noldova/desktop.protocol` | `src/noldova.desktop.protocol` | The local protocol: its envelope (the handshake, requests, answers, events, cancels and failures, and their framing); the payload models of Noldova Desktop's own methods and events, for stopping, quitting and updating a runtime, window state, running work, modules, settings, commands, programs, notifications and secrets; the keys that name a value, such as a setting's or a window's state key, a qualified method or event name and a key chord; Noldova Desktop's own method, event, client and notification names; and the enums they use, such as failure codes, module states and setting kinds. Each model reads and writes its JSON form and refuses one that breaks its rules. |
| `@noldova/desktop.runtime` | `src/noldova.desktop.runtime` | The runtime: it owns a data directory, authenticates local clients, hosts modules' runtime parts, routes their requests and events, keeps state and runs migrations; and the client side that finds, starts and connects to a runtime. |
| `@noldova/desktop.electron` | `src/noldova.desktop.electron` | The main process and its preload: it starts and connects to the runtime, opens the window, and owns the tray, notifications from the operating system, the menu bar on macOS, shutdown and updates. |
| `@noldova/desktop.window` | `src/noldova.desktop.window` | The window's interface in Angular: the workspace, the mechanisms modules contribute to, and the window parts of modules. |
| `@noldova/desktop.cli` | `src/noldova.desktop.cli` | The command line: Noldova Desktop's own commands and those modules add. |
| `@noldova/desktop.build` | `src/noldova.desktop.build` | The app build: the `noldova-desktop-build` command line, which builds an app from its `desktop` section and module list, starts its development app, packages and signs it for each target, and releases it, as [BUILD.md](BUILD.md) says. |

The packages, Protocol, Runtime, Electron, Window and Cli, came over from earlier work together in one copy, after Runtime's native addons; Build came from the repository's own scripts.

## Dependencies

```text
Window ──── preload bridge ────▶ Electron main process ──┐
                                                          ├── local protocol ──▶ Runtime ──▶ runtime parts ──▶ their database and files
                                Command line ────────────┘                                                └──▶ programs they start
```

The arrows are calls at run time, not imports.
The imports go one way:

- Protocol imports only context's packages.
- Runtime imports Protocol.
- Electron and Cli import Protocol and the client side of Runtime; no client embeds a runtime of its own.
- Build imports none of Noldova Desktop's packages: it runs at build time, never in an app, and reads the other packages' files, not their code.
  It keeps its own copy of the names no module may take, the command line's own commands and options and the Windows device names, which the Reserved names check keeps equal to Cli's and Runtime's.
  It keeps the same kind of copy of the protocol's web view method names and refused methods, for `webViews.json`, which the Web view names check keeps equal to Protocol's.
- Window imports Protocol, `@noldova/ui.components.angular` and the browser-safe packages of context, and never runtime or main-process code.
  It reaches privileged operations only through the preload bridge, and a window part reaches the person's files only through a choice the person makes in the system's own dialog, such as the folder chooser and the save dialog that [WINDOW.md](WINDOW.md#the-boundary) describes; it writes text and images to the clipboard only through the bridge, the Edit menu's Copy of a part's own selection included, whose image write the window encodes as PNG and the main process checks and decodes.
- A module imports its own packages, context's packages, Noldova Desktop's published APIs and the published APIs of the modules it declares as dependencies, as [MODULES.md](MODULES.md#cooperation) says.
- No package of Noldova Desktop imports an app or a module, and none contains a name, text or special case that belongs to one.
  Tests and their fixtures are not production code.

Context's packages, `@noldova/context.*`, come from the context repository, and the interface kit, `@noldova/ui.components.angular`, from the ui-components repository, each installed as a published version; nothing here copies them.
The JSON helpers Protocol needs, the JSON value types and a reader that checks what it reads, are one of context's packages, `@noldova/context.json`.

## Secrets

- A module keeps the tokens, keys and passwords it needs in this machine's secret store, never in a setting, a file or its database.
  Settings hold references only: a setting that needs a secret holds its name, `<module>.<member>`, never its value.
- The store is one interface, the runtime's `ISecretBackend`, and this machine's store is its only backend.
  The runtime keeps each value in Noldova Desktop's database, keyed by the device, the module and the name, as a ciphertext the main process made with Electron's `safeStorage`, which uses the system's keyring; a value saved on one device can't be read on another.
- The main process refuses to encrypt or decrypt when the system has no keyring, or on Linux when `safeStorage` would fall back to its own text key, so a value is never written unprotected.
- Only the main process decrypts a value: it answers the runtime with `desktop.secretAnswered` over the runtime's connection to the main process, and the runtime hands the value, in its own process, only to the owning module's runtime part.
  Windows, the command line and other modules save, replace, remove and check a module's values, but never read one back.
- A value never appears in a log, an error, a notification or a settings file.
- [RUNTIME.md](RUNTIME.md#secrets) says how the runtime and the main process keep them, and [MODULES.md](MODULES.md#secrets) what a module's parts may do and when they are refused.

## Names

| Word | Meaning |
|---|---|
| Module | A unit of an app's functionality, with its own identity and declared dependencies, built and delivered with the app. |
| Host | A process that runs modules' parts: the runtime, the window or the command line. |
| Part | A module's code for one host: a runtime part, a window part or a CLI part. |
| Contribution | An entry a module adds to one of Noldova Desktop's mechanisms, such as a view, a command or a protocol method. |
| View | A module's content for a panel, in a dock or in the middle, or for a dialog. |
| Document | A module's content for a tab in the middle of the window, or for a dialog. |
| Setting scope | A level at which a setting can hold its own value: the app, or one object a module owns. |
| Published API | What a module offers to the modules that depend on it. |
| External tool | A program or service outside the app that a module drives. |
| Tool | An action a module offers an app's agents, as [TOOLS.md](TOOLS.md) says. |
| Agent session | One agent's use of the app's tools, which the app opens and ends. |
| Web view | Web content a module shows in one of its views or documents, in a page of its own, as [WEB-VIEWS.md](WEB-VIEWS.md) says. |

- A module's id is its identity: lowercase kebab-case, without dots, unique in the app, and never reused for another module.
  Display names are not identity.
- `desktop` is reserved for Noldova Desktop: no module has it as its id, and Noldova Desktop's own names are `desktop.<name>`.
- Every name a module registers is `<id>.<name>`, with a camelCase name: protocol methods and events, commands, menus, settings, setting scopes, views, documents, status bar items, top bar actions, notifications, themes and command-line commands.
  An id holds no dot, so two owners can't form the same name.
- A tool's name is the one exception, since agents read it: snake_case, starting with the module's id in snake_case or the id's first word, then an underscore, as [TOOLS.md](TOOLS.md#declaring-and-registering) says.
- A module's selectors and style tokens start with its id and hold no dot.
  A prefix alone doesn't make a name unique, so a check refuses a complete name that two owners use.
- A module's folder in the data directory is `modules/<id>`, which keeps its id apart from Noldova Desktop's own folders.

## Code

The code rules only this repository has; the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md`, hold the rest.

- **Package folders:** each package has its own folder directly under `src/`, named `noldova.desktop.<name>`, and is published as `@noldova/desktop.<name>`.
- **Fixture modules:** modules that exist only for tests live with the tests that use them and enter only a test build.
- **Build scripts:** a package's own `scripts/build.ts` runs in Node.js at build time and is no part of the window.
- **Node's API:** the parts an app's program runs, the main process, the runtime and the command line with the protocol they load, run on the Node.js that Electron embeds, 24.22.0 in Electron 44.9.1, so they call only what that Node has.
  The repository builds and tests on Node 26, and the root `package.json`'s `overrides` gives Electron the same `@types/node` 26 in place of the 24 it asks for, so one Node type set covers every package; the type check and the unit tests, which run on Node 26, don't catch a call that only Node 26 has, so a review checks it against Electron's Node, and a change of Electron's version updates this line.
- **Process tables:** the runtime and its clients read the process table without starting a program: from `/proc` on Linux, and through Runtime's own addons on macOS and Windows.
  What a platform doesn't show is that platform's limit, never a reason to start one: a terminal's job that has left the terminal's session, as `setsid` makes it, and whose parent has exited, can't be found on macOS or Linux; a `/proc` mounted with `hidepid` hides other users' processes, which the runtime then skips; and on Windows a process a program started in the moment before the runtime put the program in its job, and whose parent has exited, can't be found.
- **Chromium's sandbox on Linux:** Noldova Desktop never turns the sandbox off, and every renderer and web view asks for it, but on Linux it needs unprivileged user namespaces or a `chrome-sandbox` helper owned by root with the setuid bit.
  An AppImage can't carry a setuid helper, since it runs from a mount or an extraction that the person owns, so its launcher starts the app with `--no-sandbox` when `unshare -Ur true` fails, as on a host that refuses user namespaces, which Ubuntu 24.04 and later do by default through AppArmor, in a container that refuses them, or where `unshare` is missing.
  There the app's renderers run without Chromium's sandbox, though a renderer may still show a seccomp filter, and only the renderer and web view settings, context isolation and the content security policy stand between a page and the system; where the probe succeeds, they run sandboxed.
  The Debian package keeps the sandbox on everywhere: its after-install script, run as root, makes `chrome-sandbox` setuid root where root can't create user namespaces and installs an AppArmor profile that allows the program user namespaces where AppArmor takes it, as [BUILD.md](BUILD.md) says, so the person changes no kernel setting.
- **Responsibility on macOS:** a detached start through Runtime's POSIX addon, such as the runtime's own start from the main process or the command line, disclaims responsibility, so the program is its own responsible process and macOS asks for privacy permissions in its name, the app's when it runs the app's executable, never in the name of a terminal that started the app.
  The addon starts the program with `posix_spawn` and `POSIX_SPAWN_SETEXEC` in place of `execve`, marked by `responsibility_spawnattrs_setdisclaim`, and reads a process's responsible process through `responsibility_get_pid_responsible_for_pid`.
  Both are macOS's private functions, which Chromium uses the same way to launch its helpers.
  The addon looks each one up with `dlsym` when it is called and never links them, so on a macOS without them the program starts with `execve` as before, and the runtime logs once that it is not its own responsible process.
  When the disclaimed `posix_spawn` fails, the program starts with `execve` too, and the start fails only when that fails as well, naming both.
  What the main process starts itself without the addon, such as a program it runs and waits for, keeps whatever started the app as its responsible process.
  Two such starts remain on macOS: the administrator prompt that installs the command-line link, which runs `osascript` from `main.ts`, and the update's ShipIt step, which `ship-it-process.ts` runs through `launchctl`.
- **Jobs on Windows:** the runtime puts each program it starts in a job object that holds what the program starts and ends all of it when the job closes, so nothing a program starts outlives it there, a crash of the runtime included.
  A pseudo-terminal's program is the exception: its job holds only the program, and what the program starts leaves the job at once.
  At the terminal's stop the runtime ends what it finds through the program's running descendants, and closing the pseudo console ends the console programs attached to it, as a hangup ends them on macOS and Linux; an app whose launcher has exited, such as an editor that `code .` opens, is found through neither, so it outlives the terminal and the runtime's stop, as it does on macOS and Linux and from Windows' own terminals.
  After a crash the system closes the program's own job, which ends the program, and the closing pseudo console ends the console programs attached to it; nothing else ends: what a terminal's program started without that console, a windowed or detached app or a program given a hidden console of its own, keeps running, so an agent's terminal can leave such programs running after the runtime has crashed.
- **The person's environment:** the runtime starts with the environment the app started with, which the system's launcher gives an app on macOS and Linux and which on Windows misses what was saved after the person signed in, so a part asks the runtime for the person's current environment with `context.readEnvironmentAsync` and gives it to the programs it starts as the request's environment.
  On Windows the runtime lays the machine's and then the person's saved variables over its own, as Windows does for a new process, through one Windows PowerShell it keeps running, and reads them again for each call; a PowerShell that doesn't answer within 60 seconds, or that ends, is replaced.
  On macOS and Linux it runs the person's login shell, the one the system's user database names, else `SHELL`, else `/bin/sh`, as an interactive login shell in a process group of its own and without input, that runs the app's own program in Node mode to print its environment, waits for it 10 seconds at most, and then ends the whole group, so nothing a profile started outlives the read; a group the system refuses to end is logged, and the shell itself still ends.
  It keeps what it read until a shell profile file, such as `.zprofile`, `.bashrc` or `.profile`, changes in the home folder, in the `ZDOTDIR` folder the last read named, or where a profile that is a link points; a change to a profile looks again at where each link points, so a profile linked or re-pointed later is followed.
  Since the system can drop a file event and say so only in a notice Node never passes on, as macOS does when its event stream falls behind, each request also compares the profile files' identity, size and times with those taken when the kept read began, and reads again when they differ.
  This comparison is only a fallback for a lost event: the times have the filesystem's resolution, a kernel tick on Linux, so a write within the same tick that keeps the size shows only through its event.
  The watch never starts again, since a change made just before a watch closes reaches neither it nor the watch that replaces it: each read's end and each profile change open only the folders newly needed, such as another `ZDOTDIR` folder, and close only those no longer needed.
  On macOS opening or closing any folder restarts the system's one stream of file events, which can lose a change made just before, so when a read's end opens or closes a folder, one more read follows.
  A folder whose watch fails, or that is removed or replaced, is opened again at the next read's end, and a folder replaced starts a read itself; a failing folder starts a read when it fails and when it is opened again, and no more until a read's end finds its watch still open.
  A folder that doesn't exist, such as a `ZDOTDIR` folder not made yet, is waited for by watching its nearest existing parent, and when it appears it is opened and a read follows.
  Since its event can be lost, the folder is looked for again once that parent's watch is open and at each read's end, and an event for the parent itself, removed or made again, starts a new wait.
  Calls during a read share it, and a change during a read starts one more read after it.
  The variables the shell sets for itself, `PWD`, `OLDPWD`, `SHLVL` and `_`, are left out there, also from the runtime's own environment when no read has succeeded.
  The first call starts the first read, so a runtime whose parts never ask starts no shell; a read that fails or runs out of time gives the last environment read, or the runtime's own, and the log says why, never a value.
  Noldova Desktop's own variables, `ELECTRON_RUN_AS_NODE` and `ELECTRON_NO_ATTACH_CONSOLE`, and names a request refuses, such as Windows' `=C:`, are left out; the reading ends when the runtime stops its programs.
  The read on macOS and Linux depends on the app's program running in Node mode, the `runAsNode` fuse that a later change is to turn off.
- **Angular packages:** Window is an Angular package, published like the others in partial compilation mode, and an app's entry starts it with what the app's build generates, and may add root providers of its own, such as a web worker only the app's code can make; it builds and runs its specs through the Angular project in `src/`, whose `package.json` pins the same Angular, Vitest and Playwright versions as the ui-components repository, and its code lives under `src/app/` as the organization's Angular standard, `https://github.com/noldova-com/.github/blob/main/standards/stacks/ANGULAR.md`, says.
  Its files reach one another through relative imports that name each file with `.js`, so Node.js and TypeScript's NodeNext resolution load the published package without a bundler, and an Angular package's build fails when a compiled file imports one of the package's own files without its extension, or one the package doesn't hold.
  The Angular compiler writes some imports of its own, such as one for each host directive in another file, as `import * as i1 from "./<file>"`, and the build adds `.js` to them before that check.
  The Angular project takes context's packages and Noldova Desktop's own packages from the root install rather than holding copies of its own, so the window, the runtime and the end-to-end tests load one copy of each.

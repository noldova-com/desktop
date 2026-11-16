# Noldova Desktop

[![Build and test](https://github.com/noldova-com/desktop/actions/workflows/build-and-test.yml/badge.svg?branch=main)](https://github.com/noldova-com/desktop/actions/workflows/build-and-test.yml)
[![npm](https://badgen.net/npm/v/@noldova/desktop.runtime)](https://www.npmjs.com/package/@noldova/desktop.runtime)
[![License: MIT](https://badgen.net/static/license/MIT/blue)](LICENSE)

Noldova Desktop is the shell that Noldova's desktop apps are built on, on top of Electron.
It provides the window and the workspace, the runtime that hosts modules, the command line, and the tooling that builds, tests, packages and releases an app.
Everything a person does in an app comes from a module, and Noldova Desktop names no module.
[documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) says how it is built and what it leaves to apps and modules.

It targets Windows, macOS and Linux on x64 and ARM64.
Every package is at `0.0.x` for now, and its API may change from one version to the next.
To report a bug or ask for a change, open an issue in this repository, as the organization's [contributing guide](https://github.com/noldova-com/.github/blob/main/CONTRIBUTING.md) says.
Report a security problem privately, as its [security policy](https://github.com/noldova-com/.github/blob/main/SECURITY.md) says.

## Getting started

An app is a folder with a `desktop` section in its `package.json`, its window app in a folder under `src/` whose name ends in `.window.app`, and its modules.
It installs the build as a dev dependency, and Electron at the version the package names as its peer:

```bash
npm install --save-dev --save-exact @noldova/desktop.build
```

The package's bin, `noldova-desktop-build`, then builds the app, starts it in development and packages it.
[documents/BUILD.md](documents/BUILD.md) says what an app declares, and [documents/MODULES.md](documents/MODULES.md) what a module declares and what it can contribute.

| Package | What it is |
|---|---|
| [`desktop.protocol`](src/noldova.desktop.protocol) | The local protocol between the parts. |
| [`desktop.runtime`](src/noldova.desktop.runtime) | The runtime, which hosts modules' runtime parts and keeps state. |
| [`desktop.electron`](src/noldova.desktop.electron) | The main process and its preload. |
| [`desktop.window`](src/noldova.desktop.window) | The window's interface in Angular. |
| [`desktop.cli`](src/noldova.desktop.cli) | The command line. |
| [`desktop.build`](src/noldova.desktop.build) | The app build. |

## Building from source

```bash
npm ci
npm run build
npm test
```

`npm ci` installs the exact versions the lockfile records, `npm run build` builds every package, and `npm test` runs every check.
Context's packages, `@noldova/context.*`, and the interface kit, `@noldova/ui.components.angular`, come from the public npm registry.

## Starting an app in development

From a clean checkout, these three commands show the app:

```bash
npm ci
npm run build -- --test
npm start
```

`npm run build -- --test` builds the test build: every package, and the fixture modules in `src/noldova.desktop.electron/tests/e2e/fixtures/modules`, so the window has modules to show, with the modules from packages in its `packages` folder; `--without <module id>` leaves a module out.
After `npm run build`, `npm start` runs the app from your build.
It prepares a copy of Electron's program that carries the app's name, version and icon, taken from the root `package.json`, in `_build/development-app`, and starts it on `_build/development-package`, whose `package.json` gives Electron the app's name and version and names the built `@noldova/desktop.electron` main script, passing on the arguments that follow `npm start --`.
It prepares the copy again when Electron, the version, the product identity or the icons change, and installs Electron's binary first when it is missing, retrying a failed download.

Some Linux systems restrict unprivileged user namespaces, as Ubuntu does since 23.10.
There, Chromium's sandbox needs its helper owned by root with the setuid bit, and `npm start` stops and prints the commands instead of starting.
Run them once, and again after the copy is prepared again:

```bash
sudo chown root:root _build/development-app/chrome-sandbox && sudo chmod 4755 _build/development-app/chrome-sandbox
```

## Releases

The packages, `@noldova/desktop.protocol`, `.runtime`, `.electron`, `.cli`, `.window` and `.build`, are published to the public npm registry by the "Release npm packages" workflow, `.github/workflows/release-npm.yml`.
A member starts it by hand with the version, which the root `version.json` holds, and the full hash of the commit on `main` to release; the version changes in a pull request before its release, in `version.json` and the root `package.json` together, and that pull request writes the version's section in [CHANGELOG.md](CHANGELOG.md) from the pull requests merged since the previous version, since the build stamps the root `package.json`'s version on every package, and the Version file check fails while they differ.
It calls the organization's shared npm release workflow, v2.34.0, whose README says what each job does, with the environment `release`, and it never deletes a published version.
It publishes through npm's trusted publishing, which names this repository, the workflow and the environment, so no npm token is stored.
It tags the commit first, so a workflow change merged while the release waits for its approval can't leave the version untagged; a version whose build or publish then fails keeps its tag, and a release of the same version at the same commit can still publish it.
Its build job runs `npm ci` and `npm run build`, which writes one archive per package under `src/` to `_packages/`, each holding `LICENSE`, the package's `license`, the version and the commit as its `gitHead`, and the organization's `pipelines` tool checks those archives against the list of copies `npm run build --silent -- --list-copies` prints, and publishes them.
After the release, its dependents job calls the organization's shared `update-dependents.yml`, v2.34.0, with the version and the commit, in the `version-updates` environment, which holds the version-updates App's key and deploys from `main` only.
Each repository the App's installation includes that pins Noldova Desktop's packages exactly at an older version, a module or an app, gets a pull request that moves the pins and refreshes its lock files; the shared workflow's README says how.

Noldova Desktop ships no installers of its own: an app releases its installers by calling `.github/workflows/release-app.yml`, as [documents/BUILD.md](documents/BUILD.md) says, and CI packages Noldova Desktop's own app unsigned through `.github/workflows/package-app.yml`.
A release builds each ARM64 target whose runner input is not empty; by default that is macOS arm64 when the organization's `versions.yml` names a runner for it.
A failed release runs again whole, as a new run, which builds and checks the archives again.

## Checks

Every pull request into `main` must pass both checks before it merges.

| Check | What it verifies |
|---|---|
| Check / Linked issue | The organization's shared check, which `.github/workflows/require-linked-issue.yml` calls from its `check` job, named "Check": the PR description has a standalone `Issue: #N`, `Issue #N` or closing reference, such as `Closes #N`, that names an issue in this repository. |
| All targets | Every target's job and the package job passed, and for a pull request that changes more than documents and the callers of shared workflows, the end-to-end specs on Linux x64, as [End-to-end specs](#end-to-end-specs) says. |

The targets' jobs are the organization's shared build-and-test workflow, v2.34.0, which the `build-and-test` job calls for Linux x64, Windows x64, macOS x64 and macOS arm64, on the runners the shared workflow names; its README says what each step does.

A pull request runs every target whether it is a draft or ready, so a run that starts late never replaces another with a smaller one, and every run but one started by hand reports the required "All targets".
To run every target on a branch without a pull request, start Build and test by hand on it, from the repository's Actions tab or with `gh workflow run build-and-test.yml -R noldova-com/desktop --ref <branch>`; that run tests the branch as it is, not merged into `main`, and its summary job reports "All targets (by hand)", so it never stands in for the required check.
Linux and Windows on ARM64 have no CI job for now.

A target's job checks the toolchain against the Node.js and npm versions the root `package.json` pins in `engines` and `packageManager`, and the line endings of every tracked text file.
It then builds the packages with `npm run build` alone, as ui-components and context do: on a checkout without `node_modules` the build first installs the dependencies with `npm ci --ignore-scripts`, so no dependency's install script runs and node-pty loads from its prebuilds, and it installs Electron's binary and the headless Chromium of the Angular tests itself; it then runs every check with `npm test -- --skip-test-details --skip-coverage-details`, which leaves passed tests and fully covered files out of the log.
Since the call sets `publishes: true`, it then checks the archives in `_packages/` against the list of copies `npm run build --silent -- --list-copies` prints, builds again and checks that the second build's archives are identical, and checks that the build left every tracked file unchanged.
No workflow changes the kernel's setting for unprivileged user namespaces, which `ubuntu-24.04` restricts through AppArmor, as a default Ubuntu does.
On Linux the check that starts Electron from a test with Chromium's sandbox does so where the host allows user namespaces, and elsewhere checks that Electron refuses to start without them or `--no-sandbox` and starts with `--no-sandbox`, the AppImage's fallback.
The end-to-end workflow gives the development copy's `chrome-sandbox` to root with the setuid bit, the commands above, where the runner refuses user namespaces, so the specs run with the sandbox; that needs `sudo` without a password, which GitHub-hosted runners have.
The end-to-end workflows install the dependencies with `npm ci`, and the range job of `end-to-end.yml` with `npm install` after it moves the versions; they then run the build's own install, `npm run build:install`, which records the install the build checks for and installs the headless Chromium, and download Electron's binary in a step of their own; the build then runs with Electron's and Playwright's download addresses set to an unreachable host, so it downloads nothing again.
The packaging workflow proves the sandbox on the installed Debian package, as [BUILD.md](documents/BUILD.md#publication) says.
The end-to-end workflow sets `kernel.core_pattern` to `core` so a crashed process ends at once, but only on GitHub-hosted runners, since the setting stays changed on the host; a self-hosted Linux runner should write a crashed process's core as a plain file rather than through systemd-coredump, or the specs that crash a web view's page may wait for the core to be collected.
A test class in the `Packaging` category packages with electron-builder for real and runs in the whole run of `npm test`, in its own suite with its own limit, as the package tests' limits below say; such a test ends electron-builder's whole process tree when the run ends with the test still running.
Beside the targets, the `package` job calls `.github/workflows/package-app.yml` to package Noldova Desktop's own app unsigned on each target, on every target a release lists, then installs, starts and quits it on each but macOS x64, whose start the maintainer checks before a release ([BUILD.md](documents/BUILD.md#publication)); CI never signs, passes no secret and keeps no release files, only the package report.

`npm run build` runs the `install` and `build` commands of `@noldova/desktop.build` from the package's source, the build an app runs through the package's bin, as [BUILD.md](documents/BUILD.md#the-build-package) says.
`npm run build --silent -- --list-copies` runs `build --list-copies` alone, which builds nothing and lists each file the build copies unchanged into a package that the package's archive keeps, as the shared release workflow's archive check asks.
It compiles each package under `src/` with `tsc`, or runs the package's own `scripts/build.ts` when it has one, after the packages it depends on, into `_build/packages/<folder name>`, with the files of the package's `src/assets/` under `assets/`, packs it with `npm pack` into `_packages/` and installs it from there with `npm install --no-save`; then it compiles each package's tests into `_build/tests/<folder name>`.
It then reads the modules the root `package.json` lists in `desktop.modules` from `src/modules/`, writes their declarations to `_build/modules/declarations.json` and generates the window parts' source in `_build/generated/`, with the product's name, About's details and the gallery.
The window app, `src/noldova.desktop.window.app`, starts the window from its `src/main.ts` with the installed `@noldova/desktop.window/build` and what the build generated, so the Window package holds nothing the build generates for an app.
A test imports what the package exports by the package's name, and the package's internal files by their path under `src/`; in the compiled tests that path leads to the installed package, so a test and the package share one copy of each file.
An Angular package, one whose `package.json` names `@angular/core` among its peer dependencies, such as Window, builds with the Angular compiler instead, from the one install at the root, which holds the window app's dependencies as a workspace of the root `package.json`.
`npm run build` first installs the root's dependencies with `npm ci --ignore-scripts` when `node_modules` is missing, since the build package's own command line needs them to start, and again when the root lockfile changed since its last install, and the headless Chromium the window's specs run in.
After the other packages, it compiles each Angular package with the Angular compiler in partial compilation mode, carries the documentation of each `src/api/<entry>.d.ts` onto the compiled declarations with `scripts/carry-docs.ts`, packs it into `_packages/`, and installs it into the root `node_modules`.
A test build also builds the Angular packages of the fixture modules, such as the beacon module's window part, after the Window they build against, which it installs into the root `node_modules` first.
The Angular packages build before the build reads the modules, since a package that depends on one, such as the beacon module's package, builds and installs at the root after them; a regular build leaves such a fixture to the test build instead of type-checking it.
It installs the Angular packages and the package of each module with a window part into the same `node_modules`, as [MODULES.md](documents/MODULES.md) says, so the Noldova Desktop packages they depend on resolve from there.
So an Angular package lists Noldova Desktop's own packages and context's packages only among its peer dependencies, never among its dependencies.
The install holds one copy of each: the window, the kit and the window parts take `@noldova/desktop.protocol` and context's packages from the copies the runtime and the end-to-end tests load, so each loads once.
npm checks every peer range: the kit's peer dependencies on context's packages are met by the root's own, so they are never installed twice.
It rebuilds only what changed since the last build and says which packages it built and which it reused.
A package's `scripts/` folder is among its inputs, so a change to a package's own build script rebuilds that package.
The repository's own tooling lives in the root `scripts/`, as in context, and imports the build package's source by relative path, since it uses the package's internals, which aren't part of its public API.
`npm test` runs the same build as its Packages check, which reuses what is current, and its Package tests and coverage check runs every package's tests through `@noldova/context.testing`.
Those tests run as four processes side by side, each in its own temporary folder, one for each of the runners' four cores: Runtime's `services/process` and `services/client` tests with every other Runtime test that patches Node.js's `fs` module or a `process` global, Runtime's other tests with Electron's, Cli's, and the other packages'.
Each process runs two suites, each with one limit per test that only bounds a hang, and no test sets a limit of its own: every test but the `Packaging` category's has 40 s, and then the `Packaging` category's tests have 90 s. The runtime's log file and runtime log tests give a line written at once 60 s to wait for a write under way, above that 40 s, so a wait that would never end fails its test at the limit rather than passing late; the two values must stay in that order.
Each limit is at least three times the slowest test of its suite in this change's runs on the four targets, whose highest were 12.2 s for the other tests and 26.3 s for the `Packaging` category's, both on macOS x64; the runner prints each suite's ten slowest tests after its summary, so a later run shows how close a suite comes to its limit.
`NOLDOVA_TEST_TIMEOUT_MILLISECONDS` and `NOLDOVA_TEST_PACKAGING_TIMEOUT_MILLISECONDS` set the two limits for the runner's own specs only.
So a patch that a timed-out test leaves in force can reach only the tests that patch too, never a test that relies on the real module.
A package split between two processes runs each of its test files in exactly one of them, chosen by folder or by file; `scripts/checks/package-test-check.ts` holds the split, and a test that starts patching a global joins its list.
A run without filters fails, naming the part, when a part's folders hold no test file, such as after a folder is renamed.
Each line a process prints appears as it comes, starting with the process's number, such as `[2] `, so a job cancelled at its time limit still shows each process's output so far; each process's whole log stays in `_build/package-tests-<n>.log`.
In the job summary, each process's table names its number and its packages.
Its Angular tests check runs the Angular packages' specs with `ng test`, through Vitest in headless Chromium, with their coverage.
`npm test` runs the checks that only read the repository's files first, from Documents to Package layout.
When one of them fails, it stops there, before the checks that build, compile or run tests, and names the ones it didn't run; the later checks run past each other's failures.
Declared dependencies checks that each package's production code imports only the packages its `package.json` declares in `dependencies`, `peerDependencies` or `optionalDependencies`.
Package layout checks that each package has `src/tsconfig.json`, `src/resources.ts` and `tests/tsconfig.json` beside its `package.json`.
Angular files checks the names and folders of the window's components and services, and fails on each `@Component` under `src/`, tests and fixtures included, that sets `changeDetection: ChangeDetectionStrategy.OnPush`, which Angular 22 makes the default.
It finds the decorator through its `@angular/core` import, renamed or through a namespace too, takes the key bare, quoted or shorthand, and takes `OnPush` as a member, an element, a bare name or its value `0`; it doesn't follow options passed in a variable.
Reserved names checks that the build's copy of the names no module may take, in its Resources, `src/noldova.desktop.build/src/resources.ts`, matches the command line's own commands and options and the runtime's Windows device names.
Web view names checks that the build's copy of the web view method and member patterns and its refused methods and domains, in its Resources, matches the protocol's.
Both read their owners' Resources with the TypeScript parser, never by importing another package's source.
Preload argument checks that the electron package's sandboxed preload, `src/noldova.desktop.electron/src/preload.cts`, which can import no file of its own, finds its settings by the same `--desktop-preload=` argument as the package's Resources.
Version file checks that the root `version.json`, which the release reads, holds the root `package.json`'s version, which the build stamps on every package, and fails, naming the file, when either is missing, isn't JSON or holds no version string.
Version file cases runs the Version file check on small roots in a temporary folder, one per case: the same version, versions that differ, no `version.json`, a `version.json` that isn't JSON, one without a version and one whose version isn't a string, and expects its result and line for each.
Release entry checks that desktop.build's release entry, `src/noldova.desktop.build/src/services/release-command-line.ts`, which an app's release runs from the package's archive without `npm ci`, and every file it imports, import only `node:` modules, the `@noldova` peers desktop.build's `package.json` declares, which the release and module-range jobs read from the archive and unpack beside it, and relative files.
Signing output runs the Authenticode check of signed Windows packages with a scripted PowerShell, and the package's publisher check on small archives, one per case.
It checks that the Authenticode script is exactly the copy it pins, so any change to that script fails until it is read and pinned again, that no failure or line prints the publisher or a signer's subject, and that each failure names `WINDOWS_PUBLISHER`.
Update test runs checks that `release-app.yml`'s publish job never runs with `update-feed` set, and that its publish step still passes `RELEASE_UPDATE_FEED`, that its build jobs pass `keep-release-files: true`, and that `package-app.yml` always writes a run's release files against its feed and keeps every package and its update information whenever its caller asks.
Script tests runs the specs in `scripts/angular/tests/`, `scripts/checks/tests/` and `src/noldova.desktop.window/scripts/angular/tests/` with Node.js's own test runner, `node --test`: they cover what no passing run shows, the logging and retry variable of the scripts' own Angular test runner, `scripts/angular/angular-test-project.ts`, how the package tests' runner, `scripts/checks/serial-test-run.ts`, names a test that reaches its time limit, runs the `Packaging` category after the other tests, under its own limit, and prints each suite's ten slowest tests under its limit after the summary, the window tests' font log and their hang guard, and the Dependency pins check's refusal of a peer between two of Noldova Desktop's packages in any form but the range the build stamps, which the repository's own valid peers never show.
The font log, `src/noldova.desktop.window/scripts/angular/font-response-log.ts`, is a Vite plugin of the window tests' config: it warns, in the window test job's log, of each font request the test server answers with a failure, or that closes before the server finishes its answer, with its path, status and time, so a font that fails to load in a setup file shows what the server did.
A font request the server never received, such as one sent after it stopped or refused the connection, logs nothing.
When the run closes, the log writes "The font log watched N font requests to the test server": a run that loads the kit's fonts and shows 0 has the log detached from the server that serves them, so a missing warning then says nothing.
The hang guard, `src/noldova.desktop.window/scripts/angular/test-hang-guard.ts`, is a plugin of the same config that adds itself to Vitest's reporters, which run in Node.js outside the browser.
It watches each spec file from the time Vitest queues it until it ends, through its loading and collection, each test and each hook, and the whole run from its start until the last of its files ends, including the time between files; the coverage report that follows reports nothing to watch, so it runs unwatched.
When a file reports nothing for 60 s, it names that file and the test or hook it was in, or the last test it finished, while another file's reports never reset its watch.
When the run reports nothing for 60 s, it names every file that started and hasn't ended, or says the run stopped between files.
Either way, it ends the run with exit code 1.
This covers a hang that Vitest's own limits miss, such as a browser that stops answering, since Vitest's per-test limit runs in the browser and the default reporter prints a file only once it ends.
Every test start and result and every hook start and end resets the watch, so each silent stretch is at most one hook or one test body, within Vitest's 30 s browser hook limit and its 15 s browser test limit.
The guard's 60 s is twice the longer of those, so it fires only once Vitest's own limits should have, and over fifty times the slowest window test, which took 1.1 s on Windows x64 in three recent runs.
Each spec has 10 seconds, `--test-timeout=10000`: the slowest took 0.74 seconds, on macOS arm64, and a spec that hangs, such as one waiting on a run of the package tests' runner that never ends, fails by name within that limit instead of holding the job until its own limit ends it.
API declarations runs after the build and checks that each entry under a package's `src/api/` exports the same members, with the same types, as the `api/*.d.ts` declarations installed with the package.
The checks that read syntax trees, such as Concept files, parse each file with TypeScript 6.0.3's compiler API, and API declarations reads the types through a program of the same API, `scripts/api/api-program.ts`.
Window in Node.js runs last: it loads both entries of the Window package installed in the root `node_modules` in Node.js without a bundler, after `@angular/compiler`, which partially compiled components need when they load unbuilt, and type-checks them with NodeNext resolution and `skipLibCheck` off, from `src/noldova.desktop.window/scripts/node-load/`, so an app or a module's tests can load the published package as it is.

"All targets" also runs on every push to `main`.

`npm test -- documents` runs only the document checks, and `npm run format:documents` puts each sentence of the Markdown documents on its own line.
`npm test -- --filter <text>` runs the package tests that `@noldova/context.testing` selects by the text, `--repeat <count>` runs the selection that many times and stops at the first failure, and `--rerun-failed` runs failed tests once more and records those that pass in `_build/flaky-tests.json`, those of every package test process together once they have all ended.
`--skip-test-details` leaves passed tests out of the package tests' output, and `--skip-coverage-details` is accepted for the shared workflow, since the coverage report already leaves fully covered files out.

### End-to-end specs

`npm run test:ui -- [<Playwright argument>...]` builds the test build and its variants when they changed, then runs the end-to-end specs in `src/noldova.desktop.electron/tests/e2e` through Playwright; on Linux without a display, run it under `xvfb-run`.
`npm run test:ui:ci -- [<Playwright argument>...]` runs them as the workflows do: on Linux, under `xvfb-run` on a 2560×1440 screen and `dbus-run-session`, so the specs have a session bus of their own; that bus has no tray host, so the two tray-quit specs skip themselves there, as the [Electron package's README](src/noldova.desktop.electron/README.md) says.
`npm test` doesn't run them.
They run one at a time, with one Playwright worker, since every spec shares the machine's clipboard, focus, pointer and, on Windows, its notification history, which two specs at once would take from each other.
Each run keeps its test folders in a temporary folder of its own, a `ui-run-*` folder that holds the run's id, so the specs of two runs on one machine at the same time never see each other's folders.
On Linux and macOS that folder is in `/tmp`, since the runtime refuses a socket path over 103 bytes and the system's temporary folder can be long, such as macOS's `/var/folders/…/T/`; on Windows, where the runtime listens on TCP, it is in the system's temporary folder.
A child run that a spec starts keeps its folder inside its parent run's folder.
The set-up stops the run before its tests when the longest socket path one of its tests would get is over the limit, and names that path and its length.
A run removes that folder when it ends, and the next run's set-up stops what an ended run left there and removes its folder.
`.github/workflows/end-to-end-specs.yml` runs them on the targets its caller passes, and two workflows call it.
On each target it splits them into 3 shards by spec file, a job each, which runs `npm run test:ui:ci -- --shard=<n>/3`, or, when its caller's `shards` is 1, in a single job, and it refuses any other number; a run passes only when every shard passes.
"Build and test" runs them on Linux x64 for every pull request that changes more than documents, since the test build they run builds every package; its "Code changes" job compares the pull request merged into `main` with `main`, and a pull request whose every changed file, with both the old and the new path of a renamed one, is under `documents/`, is Markdown, or is one of the callers of shared workflows, `require-linked-issue.yml`, `flake-proof.yml`, `release-npm.yml` and `board.yml` under `.github/workflows/`, skips the specs.
A change to any other workflow, `build-and-test.yml` and `end-to-end-specs.yml` among them, runs them; before it decides, the job checks its rule against each of those cases and fails when one gives the wrong answer.
`assets/` counts as code, since the app loads its fonts, icons and dictionaries from there.
The "End-to-end specs" workflow, `.github/workflows/end-to-end.yml`, runs them on `main` every night at 02:30 UTC on the runners the organization's `versions.yml` names: Linux x64 and Windows x64 in 3 shards each.
Pull requests run them on Linux x64 alone.
On Linux the job first sets the kernel's core pattern to a plain `core` file, since Ubuntu pipes each crashed process's core to systemd-coredump, which holds a crashed renderer in its exit for longer than the specs that crash a web view's page wait for it to end.
A member starts a run on `main` with `gh workflow run end-to-end.yml --ref main`.
A failed run keeps each failed shard's report and results as artifacts for 14 days, named by target and shard, and opens an issue titled "The end-to-end specs fail on main", or comments on the open one, with the run's link and each failed shard's failed specs.
The same workflow's range job builds Noldova Desktop on Linux x64 and runs its tests with the newest published context and kit inside the window package's peer ranges, as [documents/MODULES.md](documents/MODULES.md#context-and-kit-versions) says; on a nightly run a failure opens an issue titled "Noldova Desktop fails on the newest context or kit in its window package's ranges", or comments on the open one, with the run's link and the versions it chose.
The app runs with `ELECTRON_ENABLE_STACK_DUMPING=1`, so a process that crashes prints Chromium's stack.
When the main process ends by a signal the test didn't send, the harness reports the signal, the step (while it started, during the test or while it quit) and that stack, and attaches the report as `main-process-signal.txt`.
The report fails the test wherever the specs run.
A spec that raises a signal in the main process on purpose accepts that one end with `acceptFailures`, by the process, the signal and the step, so any other end still fails it.
A stack printed with no such end, such as a renderer's, is a `crash-output` annotation.
Before it closes the app, the harness records every process the app started, from the system's process list, besides those Electron lists; the runtime, and what the runtime runs, are recorded and stopped apart.
A test fails when one of those processes still runs 30 s after the app closed; a process that the system gave the same id since, with another start time, is not counted.
On Windows Node ends its own non-detached children when it exits, so there the spec of a process that outlives the app starts its own detached, and such a process ends by itself once its test is over, even one that failed or timed out, when the test's afterEach writes the release file it watches.
The app's close ends when its main process exits, even while such a process, holding descriptors it inherited from the main process, keeps Playwright's own close from ending.
When listing those processes fails, the test only notes it.
When the harness kills the app, because its main process stopped answering or its quit stopped at a question, it kills each of those processes that still has the start time it was recorded with: a process whose parent is killed keeps running, and Electron's own processes on Linux can outlive their main process.
On macOS the harness starts the app with `-ApplePersistenceIgnoreState YES`: after the app ends by a signal twice in a row, macOS otherwise asks whether to reopen its windows, and the question holds the next launch until someone answers it.
Before a workflow, the harness moves the window off the real cursor, a shift that keeps it wholly on a display first.
On Linux, while a window manager runs, which the harness reads from `XDG_CURRENT_DESKTOP` being set, it tries only such shifts and fails at once when none clears the cursor, since KWin on X11 moves a window back onto the display after its bounds answer; under Xvfb, with no window manager, it also takes a spot past the display's edge.
After a workflow, the harness fails it when the real cursor is back inside the window.
The failure gives the system's idle time from Electron's `powerMonitor`.
When the system's last input came after the cursor was last outside, it says the input came from outside the test, since the tests send the system no input; otherwise it says the window or a display moved under the still cursor.
A night can pass with no run and no issue: a newer run in the workflow's concurrency group replaces one still waiting, so the Actions tab is where a missing night shows.
A spec that clicks a tab and then uses that tab's content finds it inside the content with `TabContentFixture.openAsync`, which returns the tab's `[data-tab-content]` element.
The window keeps other tabs' content in the page, and two notes hold the same fields, so a locator over the whole window can resolve to the tab shown before the click, which the window then hides.

### Checking a module against its range

A module accepts a range of Noldova Desktop versions, its `noldovaDesktop` in `module.json`, as [MODULES.md](documents/MODULES.md#noldova-desktop-versions) says, but builds and tests against one exact version.
The reusable "Module range" workflow, `.github/workflows/module-range.yml`, checks the module against the newest published Noldova Desktop version inside that range, so a release that breaks it shows the night it ships, before an app moves to it.

- It refuses a module with no `noldovaDesktop`, one not of the one form, and one whose range doesn't end below the next version that may break modules after its lowest: the next minor below 1.0, such as `>=0.0.71 <0.1.0`, and the next major from 1.0, such as `>=1.2.0 <2.0.0`.
  Desktop Build owns that rule, in its release entry's `module-range` command, which the workflow runs from desktop.build's archive at the Noldova Desktop version the module's root `package.json` pins, with the `@noldova` peers that archive's `package.json` declares unpacked beside it at the versions the module's lockfile holds, after checking each archive against the SHA-512 the registry gives for it and failing on a mismatch; its `noldova-desktop-range <version>` prints the range a module at that lowest version writes, for the tools that move modules to a new Noldova Desktop.
  So the module needs that pin to be a Noldova Desktop version whose desktop.build has these commands.
- It installs the module with `npm ci`, then, in each installed folder whose `package.json` names a Noldova Desktop package, installs every Noldova Desktop package that folder names at the chosen version, and the kit and context's packages it names at the versions Noldova Desktop's packages pin at that version, without saving, the root first; it reads those pins only from desktop.build, the Noldova Desktop packages the module names and their Noldova Desktop dependencies, so it moves only what the module uses; it fails when a folder doesn't hold the version it asked for.
- It then runs the module's build, which type-checks it, and its tests: `npm run build` and `npm test`, unless the caller names other commands.
- On a nightly run, the caller's `schedule` event, a failure opens an issue titled "The module fails on the newest Noldova Desktop in its range" in the module's repository, or comments on the open one, with the run's link, the range and the version.

A module calls it on its pull requests and every night, with its `module.json` folder, and a runner when it needs one other than the organization's Linux x64 runner, and grants the issue permission the report needs:

```yaml
name: Module range

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 4 * * *'
  workflow_dispatch:

permissions: {}

jobs:
  module-range:
    uses: noldova-com/desktop/.github/workflows/module-range.yml@<commit> # <tag>
    permissions:
      contents: read
      issues: write
    with:
      module: src/modules/notes
```

### Flake proof

The "Flake proof" workflow, `.github/workflows/flake-proof.yml`, calls the organization's shared flake proof, which the `.github` repository's README describes under "Proving flakes", pinned to a full commit SHA; it runs `npm test`, or another npm script such as `test:ui:ci`, many times on GitHub's runners, to show that a fix holds a flaky test steady.
A fix is proven by 10 runs of the failing test, or of its file when its tests depend on each other, with no whole-suite runs.
A member starts it by hand, and each job builds once and then runs the tests in a loop:

```bash
gh workflow run flake-proof.yml --ref <branch> -f "filter=--filter <text>" -f runs=10 -f jobs=2 -f "targets=linux-x64 windows-x64"
```

An end-to-end spec runs through `test:ui:ci`, which starts the same screen as the end-to-end job, and no session bus, so the proof keeps `display` off; its filter is the spec's file and line as Playwright takes it:

```bash
gh workflow run flake-proof.yml --ref <branch> -f script=test:ui:ci -f "filter=<file>.spec.ts:<line>" -f runs=10 -f "targets=linux-x64 windows-x64 macos-arm64"
```

| Input | What it takes | Default |
|---|---|---|
| `ref` | The branch, tag or commit to test. | The branch the run starts on. |
| `filter` | The arguments the script takes, separated by spaces, such as `--filter <text>` for `npm test`; empty runs the whole suite. | Empty. |
| `script` | The npm script each run runs, such as `test:ui:ci` for the end-to-end specs. | `test` |
| `prepare` | npm scripts each job runs once, after `npm run build` and before the runs, separated by spaces. `test:ui:ci` builds the test build itself, so it needs none. | Empty. |
| `display` | On Linux, runs each run under `xvfb-run` on a 1920×1080 screen and `dbus-run-session`, for a script that opens windows and starts no display of its own. An end-to-end proof keeps it off: `test:ui:ci` starts its own, as the end-to-end job does, and with `display` on it would run inside a second `xvfb-run` and `dbus-run-session`, nested in the ones `test:ui:ci` starts. Windows and macOS runners have a display of their own. | `false` |
| `runs` | The runs per target, 1 to 200, shared among the jobs, each of which stops after 120 minutes. | 10 |
| `jobs` | The parallel jobs per target, 1 to 4, so that CI keeps runners free. | 2 |
| `targets` | The targets, separated by spaces, from `linux-x64`, `linux-arm64`, `windows-x64`, `windows-arm64`, `macos-x64` and `macos-arm64`. | `linux-x64 windows-x64` |

Each job's summary gives its runs, passes and failures, its log shows the last 60 lines of each failed run, and the failed runs' logs are kept as the job's artifact for the days the shared settings name.

The flake-proof job's concurrency group is named by `ref` and the first 16 hex digits of the SHA-256 of `script`, `prepare`, `display` and `filter`, which a first job, "Concurrency group", works out, since GitHub refuses a run whose group is over 400 characters before it starts, as a filter that names several tests in full makes it.
Runs that differ in any of those go side by side, such as the whole `npm test` suite and the whole `test:ui:ci` suite on one `ref`; a second run of the same `ref` and the same four shows its first job done and waits at its flake-proof job until the first run ends.

### Coverage

`npm test` measures the coverage of every package, and fails below these requirements.

| Scope | Requirement |
|---|---|
| Every package under src/ but Window | 100% of executable production code but the files a package's `coverageExclusions` names, measured by the package tests through the coverage analyzer of `@noldova/context.testing`. Only Electron names any: `main.ts`, `services/electron-web-view-engine.ts`, `services/electron-web-view-contents.ts`, `services/electron-web-view-session.ts`, `services/product-app-adapter.ts` and `utility-entry.ts`, which load only inside Electron, each with its reason in the package's `package.json`. |
| `src/noldova.desktop.window` | 100% of executable production code, measured by the specs through the Angular unit-test builder, without the enum files and class-metadata calls that the Angular standard leaves out; the coverage plugin in the package's `scripts/angular/` marks those calls and reports how many it skipped. |

No package excludes any other file from coverage.

### Test files over 1 second

These runtime test files, under `src/noldova.desktop.runtime`, take over a second on Linux and macOS, each for the reason given, and the maintainers accept them.
The time is the higher of the latest Linux and macOS runs, the sum of the file's tests; the pauses some of them hold on purpose are in the Fixed pauses table below.

| File | Time | Why |
|---|---|---|
| `tests/services/client/runtime-launcher.test.ts` | 24.2 s | 43 tests, nearly each starting a real runtime process and stopping it, some two of them for a takeover or a handover. |
| `tests/services/process/posix-process-ender.test.ts` | 23.5 s | 34 tests start and end real programs; one waits out a 1 s grace before the kill. |
| `tests/services/process/process-supervisor.test.ts` | 20.7 s | 46 tests start and end real programs and real pseudo-terminals. |
| `tests/services/process/windows-process-ender.test.ts` | 13.6 s | 19 tests start and end real programs; one waits out the whole stop limit, a 300 ms grace and three 600 ms end waits, to test that a stop keeps within it. |
| `tests/services/runtime-entry.test.ts` | 6.1 s | One test waits out the runtime's 5 s takeover time while another holder owns the data directory without publishing discovery. |
| `tests/services/environment/login-shell-environment.test.ts` | 4.2 s | Real login shells read profiles under a real file-system watch; one waits out a 1.5 s limit for a shell that never answers. |
| `tests/services/ownership/ownership-lock.test.ts` | 3.3 s | Real processes race for the data directory's lock, and one owner is killed so the lock passes on. |
| `tests/services/modules/module-host.test.ts` | 3.2 s | 34 tests activate modules, most on a fresh SQLite database; one ends real programs that ignore the first signal, after the grace. |
| `tests/services/lifetime/runtime-host.test.ts` | 3.1 s | 23 tests start a real runtime host with its database, lock and local socket, and wait for another holder to let go of the data directory. |
| `tests/services/environment/line-process.test.ts` | 2.7 s | Real programs in their own process groups, started and ended. |
| `tests/services/endpoint/runtime-server.test.ts` | 2.6 s | 34 tests over real local sockets; one waits out the server's real 2 s close grace for a connection that does not end. |
| `tests/fixtures/rename-retry.fixture.test.ts` | 2.3 s | One test retries a held rename 40 times, 50 ms apart, as the runtime does. |
| `tests/fixtures/started-programs.fixture.test.ts` | 2.3 s | Real programs started, written to and ended. |
| `tests/services/discovery/discovery.reader.test.ts` | 2.2 s | One test retries a held read 40 times, 50 ms apart, as the runtime does; others start the reader as a real program. |
| `tests/services/endpoint/main-process-check.test.ts` | 2.2 s | Copies the Node executable and checks real child processes that connect over a local socket. |
| `tests/services/files/file-renamer.test.ts` | 2.1 s | One test retries a held rename 40 times, 50 ms apart, as the runtime does. |
| `tests/services/tools/tool-registry.test.ts` | 2.1 s | 73 tests, many waiting out a real 50 ms end grace or a call's deadline. |
| `tests/services/discovery/discovery-publisher.test.ts` | 2.1 s | One test retries a failing rename 40 times, 50 ms apart, as the runtime does. |
| `tests/models/process-ending.test.ts` | 1.9 s | Real programs whose group outlasts them, ended by a signal and, past the grace, a kill. |
| `tests/services/modules/module-context.test.ts` | 1.6 s | 25 tests on a fresh SQLite database each, and real programs and pseudo-terminals started in a module's name. |
| `tests/models/watched-pseudo-terminal-handle.test.ts` | 1.3 s | Each test waits out a real 200 ms report window. |
| `tests/services/process/child-process-starter.test.ts` | 1.3 s | Real programs started through the native addon. |
| `tests/services/process/process-record-store.test.ts` | 1.3 s | Real programs run until the store has renewed when it last saw each. |
| `tests/services/permissions/permission-center.test.ts` | 1.2 s | 18 tests on a fresh SQLite database each. |
| `tests/services/lifetime/update-preparation.test.ts` | 1.1 s | Each test starts a real runtime host and local socket, some a real program that holds the update. |
| `tests/models/runtime-build.test.ts` | 1.1 s | Copies the runtime package and imports it in a new Node process. |
| `tests/services/client/app-image-copy-launch.test.ts` | 1.1 s | Real programs stand in for the mounter and the runtime, started and ended. |

### Fixed pauses

Package tests and the window's end-to-end tests poll through a `WaitFixture` in their own `fixtures` folder, which checks a condition every 25 ms, or at the interval a test gives, until the test's limit; context's testing package has no wait of its own.
Angular specs poll with Vitest's `vi.waitFor`.
The Test waits check refuses a fixed pause in any test file this table doesn't list, and a listed file that no longer pauses.

| Test file | Why it pauses |
|---|---|
| `src/noldova.desktop.build/tests/fixtures/wait.fixture.ts` | Between checks of a polled condition, until the test's limit. |
| `src/noldova.desktop.cli/tests/fixtures/wait.fixture.ts` | Between checks of a polled condition, until the test's limit. |
| `src/noldova.desktop.electron/tests/e2e/fixtures/wait.fixture.ts` | Between checks of a polled condition, until the test's limit. |
| `src/noldova.desktop.electron/tests/e2e/teardown.spec.ts` | Three workflows block the main process on purpose. Two test the harness's handling of a main process that stops answering. The third makes it fail first, so a request's failure is tested to carry the main-process failure the main process log holds. A fourth leaves work running, so a quit that stops at the question about it is reported as that question, with its window and text, and not as a silent main process. |
| `src/noldova.desktop.electron/tests/e2e/fixtures/modules/clock/runtime/src/runtime-part.ts` | Between bounded attempts to rename the fixture module's stopped marker into place while Windows still holds the target open. |
| `src/noldova.desktop.electron/tests/fixtures/wait.fixture.ts` | Between checks of a polled condition, until the test's limit. |
| `src/noldova.desktop.runtime/tests/fixtures/rename-retry.fixture.ts` | Between bounded attempts to rename a test's file into place while Windows still holds the target open, as the runtime's FileRenamer retries. |
| `src/noldova.desktop.runtime/tests/fixtures/wait.fixture.ts` | Between checks of a polled condition, until the test's limit. |
| `src/noldova.desktop.runtime/tests/services/client/runtime-launcher.test.ts` | A runtime publishes itself 600 ms after the launcher starts, so the launcher's wait past its own timeout is tested; an older runtime releases its data directory 3 s after it is asked to stop, past a 2 s launch timeout, so the launcher's longer wait for it is tested; and a started runtime exits 400 ms after it starts, after the 200 ms launch timeout, so the launcher is tested to report the exit and not only the timeout. |
| `src/noldova.desktop.runtime/tests/services/lifetime/runtime-host.test.ts` | Another holder releases the data directory, or publishes discovery, 200 ms after the runtime starts, so the runtime's wait for either is tested. |

The check reads only a file's own code, so a pause inside the source a test writes for another process is outside it: the cli's `tests/fixtures/probe-build.fixture.ts` writes a probe module whose runtime part and window part poll their marker files every 20 ms, and retry a rename every 50 ms while Windows holds the target, each until a limit.

The check treats these as fixed pauses, outside strings:

- importing `setTimeout`, `scheduler` or the whole module from `timers/promises`;
- `scheduler.wait(`, `Atomics.wait(`, `Atomics.waitAsync(` and `waitForTimeout(`;
- `setTimeout(` with a named callback or a number as its delay, and a `new Promise` whose executor starts with `setTimeout(`.

### Casts the tests keep

Tests type their fakes like any other code; these casts and Object calls stay because no typed form compiles.
A patch of an overloaded function needs a cast because TypeScript checks a plain function against every overload, and a fake returns one type for all of them.

- `src/noldova.desktop.cli/tests/fixtures/watch-limit.fixture.ts:18`: `fs.watch` is overloaded, and its second argument is options in some overloads and a listener in another.
- `src/noldova.desktop.cli/tests/fixtures/watch-patch.fixture.ts:33`: `fs.watch` is overloaded, and its second argument is options in some overloads and a listener in another.
- `src/noldova.desktop.runtime/tests/fixtures/archive-switch.fixture.ts:17`: `Object.defineProperty` puts a setter on `process.noAsar`, the only way to see when the runtime sets it, and Node's types don't declare the property.
- `src/noldova.desktop.runtime/tests/fixtures/archive-switch.fixture.ts:27`: `Reflect.deleteProperty` removes that setter, since `delete` refuses a property the types don't declare.
- `src/noldova.desktop.runtime/tests/fixtures/descriptor-folder-patch.fixture.ts:36`: `fs.readdirSync` is overloaded, and the fake's string names don't match the overloads that return buffers or entries.
- `src/noldova.desktop.runtime/tests/fixtures/descriptor-folder-patch.fixture.ts:44`: `fs.readlinkSync` is overloaded, and the fake's string link doesn't match the overload that returns a buffer.
- `src/noldova.desktop.runtime/tests/fixtures/file-reads.fixture.ts:24`: `fs.promises.readFile` is overloaded, and the fake passes on the original's text or buffer.
- `src/noldova.desktop.runtime/tests/fixtures/file-system-patch.fixture.ts:40`: `fs.promises.readFile` is overloaded, and the fake returns text or the original's buffer.
- `src/noldova.desktop.runtime/tests/fixtures/folder-watch.fixture.ts:24`: `fs.watch` is overloaded, and its second argument is options in some overloads and a listener in another.
- `src/noldova.desktop.runtime/tests/fixtures/held-read.fixture.ts:36`: `fs.promises.readFile` is overloaded, and the fake passes on the original's text or buffer.
- `src/noldova.desktop.runtime/tests/fixtures/unreadable-file.fixture.ts:25`: `fs.promises.readFile` is overloaded, and the fake passes on the original's text or buffer.
- `src/noldova.desktop.runtime/tests/fixtures/watch-patch.fixture.ts:33`: `fs.watch` is overloaded, and its second argument is options in some overloads and a listener in another.
- `src/noldova.desktop.runtime/tests/models/tool-descriptor.test.ts:113`: the test passes risks outside the `ToolRisk` enum, as a JavaScript module can, and an enum type admits no other value.
- `src/noldova.desktop.window/tests/app/models/live-view.spec.ts:34`: `LiveView` takes the `ComponentRef` of a tab's content component, which renders a part through the window part host; the spec gives a ref whose instance holds only the element `LiveView` reads, so it measures scrolling and focus on an element it builds.
- `src/noldova.desktop.electron/tests/e2e/module-menus.spec.ts:32`: `Object.defineProperty` puts an accessor on the page's timer functions, so the fake clock's replacements still clear the native timers; only an accessor sees that assignment.
- `src/noldova.desktop.electron/tests/fixtures/folder-watch.fixture.ts:28`: `fs.watch` is overloaded, and its second argument is options in some overloads and a listener in another.
- `src/noldova.desktop.electron/tests/fixtures/linux-launch.fixture.ts:22`: `fs.promises.readdir` is overloaded, and the fake passes on the original's names, buffers or entries.
- `src/noldova.desktop.electron/tests/fixtures/spawn-patch.fixture.ts:25`: `child_process.spawn` is overloaded, its second argument is options in some overloads, and the fake child process has no typed streams for the overloads that promise them.

### nativeElement assertions

A component fixture's `nativeElement` is typed `any`, so a spec reads its host through `DomFixture.host(fixture)`, in `src/noldova.desktop.window/tests/fixtures/dom.fixture.ts`, which narrows it with `instanceof HTMLElement` and throws when the host is anything else.
The nativeElement assertions check, `scripts/checks/native-element-assertion-check.ts`, reads every test file under `src/` and fails on each line that takes `nativeElement` as a type unchecked, naming the file and line.
It refuses an assertion, `… .nativeElement as HTMLElement` or `<HTMLElement>….nativeElement`, and an expression that ends in `.nativeElement`, through members, calls and indexes such as `fixture.debugElement.query(By.css("button")).nativeElement` or `children[0].nativeElement`, when it is read into a declaration, a parameter's default or a typed arrow that names a type other than `unknown`, union types included, returned, or assigned to a variable or property declared before.
It also refuses a declaration that names a type and reads through a member of `nativeElement`, such as `const button: HTMLButtonElement | null = fixture.nativeElement.querySelector("button");`.
It refuses as well an assertion of a query's result on any root, `….querySelector(…) as HTMLElement` or, spread, `[...root.querySelectorAll(…)] as HTMLElement[]` and its tuple form, and a query under `nativeElement`, such as `fixture.nativeElement.querySelector(…)` or `[...fixture.nativeElement.querySelectorAll(…)]`, returned or read into a typed arrow, and an angle-bracket assertion of a query on any root, `(<HTMLElement>row.querySelector(…))`.
The typed generic, `querySelector<HTMLElement>(…)`, stays allowed.
A spec reads such an element through the same fixture instead: `DomFixture.one(root, selector)` and `DomFixture.oneOf(root, selector, HTMLInputElement)` return the first match checked with `instanceof` and throw when nothing matches or the match is of another class, `DomFixture.maybe` returns `null` where nothing matches for a spec that expects the element absent, `DomFixture.all` and `allOf` check every match, `DomFixture.closest` finds an ancestor and checks it, and `DomFixture.present` checks that an element a spec found in a list is there.
Code that runs in the page, inside a Playwright `evaluate`, can't reach the fixture, so it reads with the typed generic, `document.querySelector<HTMLElement>(…)`, and throws an error that names the selector when the result is `null`.
It reads one line at a time: it refuses an assertion that a line break splits from its expression, a line that starts with `as HTMLElement` or a code line that ends in `as`, but a read that a line break splits after its `=` passes, as does an untyped `nativeElement` passed to a typed parameter.

## License

Noldova Desktop is licensed under the [MIT License](LICENSE).

It includes third-party material under its own licenses:

| What | Where | License | Obligations |
|---|---|---|---|
| Noldova Sans, derived from Inter by The Inter Project Authors | `assets/fonts/noldova-sans*.woff2` | SIL Open Font License 1.1, in `src/noldova.desktop.build/src/assets/licenses/fonts/INTER-OFL.txt` | Every copy carries the copyright notice and the license, a modified version is released only under the same license, the font is never sold by itself, and the authors' names are never used to promote a derived work. |
| Noldova Mono, derived from Inconsolata by The Inconsolata Project Authors | `assets/fonts/noldova-mono*.woff2` | SIL Open Font License 1.1, in `src/noldova.desktop.build/src/assets/licenses/fonts/INCONSOLATA-OFL.txt` | The same as Noldova Sans. |
| The en-US spelling dictionary, from SCOWL | `assets/dictionaries/` | The SCOWL license, in `assets/dictionaries/en-US-SCOWL.txt`, and the dictionaries' terms in `assets/dictionaries/HUNSPELL-DICTIONARIES-COPYING.txt` | Every copy keeps the copyright notices and the license text. |

## Trademarks

The code is under the MIT License, while the name "Noldova" and its logo are not: the MIT License grants no right to them.
The logo is the app icon in `assets/icons/`.
A build from this code that is published by anyone but Noldova uses another name and its own logo.

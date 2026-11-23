# Modules

**Scope:** The contract between Noldova Desktop and a module: a module's parts and declaration, its versions, modules that come from installed packages, its lifecycle, how modules cooperate and what they are trusted with, the secrets they keep, what they learn of the app's own windows and keys, and the contributions a module adds to Noldova Desktop's mechanisms.
The names a module registers are in [ARCHITECTURE.md](ARCHITECTURE.md#names); how the runtime hosts the parts is in [RUNTIME.md](RUNTIME.md), and how the window shows their contributions is in [WINDOW.md](WINDOW.md).

## Parts

- A module has only the parts it needs, in any combination: a runtime part for data, programs and privileged work; a window part for views and documents; a CLI part for commands.
- Each part is a package of its own, and parts that exchange messages keep their models in the module's protocol package.
- Everything that belongs to a module lives in its folder: its parts and their tests, styles, assets, migrations and its document.
- A module's document, its `README.md`, holds these sections, leaving out those that don't apply: purpose; parts and dependencies; published API; contributions; data, meaning its database, its files and what it keeps per device; behaviour; and open points.

### Testing a module

A module's tests use Noldova Desktop's fakes of the interfaces Noldova Desktop hands the module's window and runtime parts, never fakes of their own, so a member Noldova Desktop adds to such an interface breaks no module's tests:
- `@noldova/desktop.window/testing` has `FakeWindowPartContext`, with the fakes of its web views and secrets;
- `@noldova/desktop.runtime/testing` has `FakeRuntimePartContext`, with the fakes of its database, settings, log, secrets, tools, permissions, web views and their relay, files, app windows and shortcuts;
- `@noldova/desktop.protocol/testing` has their base, `Fake`, for a module that fakes an interface of its own the same way.

Noldova Desktop ships no fake of what those fakes answer with, such as the `IWebViewHandle` that `openAsync` of `FakeWindowWebViews` returns or the `IWindowPalette` that `openBelowWindowRowAsync` of `FakeWindowPartContext` returns: a module's test gives the fake that answer itself, built on `Fake` when it records calls; Noldova Desktop's own fakes of them stay in the Window package's `tests/fixtures`.

Each fake records every call in order, which a test reads with `calls`, `callsOf` and, for a registration or a listener still in place, `activeCallsOf`.
A test answers a member that returns a value, or a property, with `answer`, typed as the interface declares the member; such a member that has no answer fails with `UnansweredCallException`, naming the member, rather than make up a value: an `Async` member rejects the promise it returns, as the real member fails, and any other throws.
A member that returns nothing records the call and calls its answer, if the test gave one; a registration or a listener records the call and returns a disposer, or a `Registration`, that ends it.
A test that calls a fake's `beStrict` makes it strict, with each fake it holds, such as `FakeRuntimePartContext`'s settings and log: a call to a member that returns nothing, a registration or a listener that the test neither answered nor named with `allow` then fails with `UnansweredCallException`, so a module's tests notice a member the module starts to call.
The tools fake's `register` and its four listener members take an answer too, such as a `ToolRegistry`'s own, so a module's tests can serve its tools through Noldova Desktop's registry and permission center: the call still records, an answered listener goes to the answer rather than the raiser, and disposing the fake's `Registration` disposes the answer's.
The fake's raisers, such as `raiseEvent` or `raiseSettingChanged`, call the listeners the module added as that member's own dispatch in Noldova Desktop does, and each raiser's documentation says how: whether a listener an earlier one removes during the call is still called, and whether one that throws stops the rest, its error coming out of the raiser, or stops no other.
A caught error goes where Noldova Desktop reports it when a test can read that place, such as the module's log for the runtime's `onDependencyChanged`, `tools` and `permissions` listeners, and otherwise to the fake's `errors`.
Answers that only one module needs, such as its own settings' values, stay in that module's tests.
Noldova Desktop's own tests fail to compile when one of these interfaces gains a member its fake lacks.

## Declaration

A module declares itself in `module.json` at its folder's root, with exactly these fields:

| Field | Holds |
|---|---|
| `id` | The module's id, which is its folder's name in the app's tree: lowercase kebab-case, not `desktop` or one of the command line's own commands, and none of the names that are devices on Windows, `con`, `prn`, `aux`, `nul`, `com0` to `com9` and `lpt0` to `lpt9`, on every platform. |
| `version` | The module's own version, `<major>.<minor>.<patch>`: three whole numbers of up to nine digits, without leading zeros. |
| `displayName` | The name people see. |
| `description` | A sentence that tells people what the module does. |
| `parts` | Its parts, each once: `runtime`, `window` or `cli`, each with a folder of that name in the app's tree, or an export of that name in a package. |
| `dependencies` | The modules it depends on, as an object from each one's id to the one exact version of it the module needs, as [Versions](#versions) says; its package's peer on another module's package, which is another of the organization's packages, may instead be a range, as that section says. |
| `optionalDependencies` | Optional: the modules it uses when the app includes them and works without, in the same form as `dependencies`; a module it names in `dependencies` it doesn't name here. |
| `switchSetting` | Optional: the name of one of its own `Boolean` settings with the locality `Shared` and no scopes, so one value holds for the whole app, which turns the module on and off; without it, the module is always on. |
| `noldovaDesktop` | Optional for now: the Noldova Desktop versions it accepts, `>=<lowest version> <first version refused>`, such as `>=0.0.70 <0.1.0`, as [Noldova Desktop versions](#noldova-desktop-versions) says. |
| `platforms` | Optional: the platforms it runs on, at least one, each once: `windows`, `macos` or `linux`; without it, the module runs on every platform. |
| `pseudoTerminals` | Optional: `true` when its runtime part starts programs in pseudo-terminals, as [RUNTIME.md](RUNTIME.md#programs-modules-start) says; only a module with a runtime part declares it, and the runtime refuses a pseudo-terminal to a module that doesn't. |
| `contributes` | The names it registers, by kind: `methods`, `events`, `commands`, `notifications`, `views`, `documents`, `placeholders`, `statusBarItems`, `topBarActions`, `menus`, `themes`, `settings`, `settingScopes`, `settingsPages`, `cliCommands` and `tools`, and `formerNames`, the names its commands and documents had before, as [Former names](#former-names) says. |

- A module that contributes settings defines them in `settings.json`, menus in `menus.json`, and command-line commands in `cli.json`, each beside `module.json`.
  A module that opens web views declares them, and the debugging calls its runtime part sends them, in `webViews.json` beside `module.json`, as [WEB-VIEWS.md](WEB-VIEWS.md#the-relay) says.
- `tools` lists the names of its agent tools, as [TOOLS.md](TOOLS.md#declaring-and-registering) says.
- `placeholders` lists at most one name, from a module with a window part, and a build refuses a second module that declares one, since the window shows one placeholder.
- An id is never one of the words the command line keeps for its own commands.
- Dependencies form no cycle, and a build refuses a module whose dependency it doesn't include, or includes at another version.
- An optional dependency that the build includes counts as a dependency in the build: the build refuses it at another version, orders the module after it and refuses a cycle through it.
  One that the build leaves out, because `desktop.modules` doesn't list it or a test build's `--without` names it, is no fault, and its version isn't checked; the build says which module runs without which, so a mistyped id shows, and the declarations the build writes keep it with the version the module needs.
- The build checks every declaration, orders the modules after their dependencies and writes what the runtime and the command line read of them, as [BUILD.md](BUILD.md#an-apps-inputs) says.
  A host reads the declarations before it runs any module code.
- A module's version changes only by hand, and every module starts at `0.0.1`.
  The runtime reports each module's version, and the Modules document and the runtime's log name it.

## Versions

- Every version a module names is exact, but for its [Noldova Desktop versions](#noldova-desktop-versions), its window part's [Angular versions](#angular-versions) and its packages' peers on the organization's other packages, below: a dependency or an optional dependency in `module.json`, and a peer dependency of a module's package, names one version, `<major>.<minor>.<patch>`, such as `1.2.3`.
- A range is refused, whether caret, tilde, bounds or `*`, and so is any other form, such as one with a prerelease, `||` or `x`, except `noldovaDesktop` and the peers on the organization's packages, those under `@noldova/` and `@noldova-com/`, such as Noldova Desktop's, context's, the kit's and another module's, in the one form below, and a window part's peers on Angular in that form up to the next Angular major.
- Noldova Desktop's own packages name their peers on context's packages and the kit in that one form too, as [Context and kit versions](#context-and-kit-versions) says.
- A peer of a module's package or its window part's package on another of the organization's packages, such as another module's package or its window part, takes one exact version or `>=<lowest> <first refused>`, where the first refused is the next minor below 1.0.0 and the next major from it, such as `>=0.0.5 <0.1.0` or `>=1.2.0 <2.0.0`, as the organization's TypeScript standard writes a published package's peer on another of its packages.
  The build refuses such a range that ends anywhere else, naming the peer, its range and the form, and one that doesn't hold the version the app's install has, as it does an exact peer at another version.
- The build refuses a module whose dependency is at another version, and names the dependency, the version the module needs and the version the build includes.
- The runtime checks each dependency's version again against the versions it hosts, before it runs any module code; a module whose dependency is at another version is blocked, and the Modules document and the runtime's log show the dependency, the version the module needs and the version the app has.
- Noldova Desktop's APIs speak only of exact versions between modules: Runtime's `ModuleDeclaration` maps each dependency to the one version it needs, in `dependencyVersions`, and Protocol has no range type.
  The one range is a module's `noldovaDesktop`, below.

### Noldova Desktop versions

A module accepts a range of Noldova Desktop versions, so an app moves to a new Noldova Desktop release without every module releasing again first.

- **Its range:** `noldovaDesktop` in `module.json`, `>=<lowest version> <first version refused>`, both exact versions with the lowest below the first refused.
  No other form is taken: no caret, tilde, `*`, `x`, `||` or prerelease.
- **Its peers:** its package's peer on each of Noldova Desktop's packages, and its window part package's, names that same range.
  Its peers on context's packages and the kit may also be ranges of that form, which the app's installed version must be within.
  The build refuses a Noldova Desktop peer at another range, or at an exact version, in a module that names `noldovaDesktop`, and a ranged Noldova Desktop peer in one that doesn't.
- **What a release writes:** the lowest version is the module's exact development pin, the one Noldova Desktop version its root `package.json` pins its Noldova Desktop packages to and it builds and tests against; the first refused is the next version that may break modules, the next minor while Noldova Desktop is below 1.0, such as `<0.1.0` for any 0.0.x, and the next major from 1.0.
  So the lowest version moves with the pin: a module that moves its pin to a newer Noldova Desktop raises its lowest version to it in the same change, and the `module-range` command refuses a range whose lowest version isn't the pin.
- **CI tests both ends:** the module's own CI builds and tests it at its pin, the range's lowest version, and the reusable "Module range" workflow builds and tests it at the newest published version inside the range.
- **The build** refuses a module whose range doesn't include the app's Noldova Desktop, the version of `@noldova/desktop.runtime` it builds with, naming the module, its range and that version, and writes that version to `declarations.json` as `noldovaDesktop`.
- **The runtime** checks again before it runs any of the module's code: a module whose range doesn't include the app's Noldova Desktop fails, with a cause that names both, which the Modules document and the runtime's log show, and the modules that depend on it are blocked.
- **For now,** a module that names no `noldovaDesktop` keeps one exact version for each Noldova Desktop peer, as before; the release after the modules have moved refuses a module without it.

### When Noldova Desktop's version changes

Before 1.0, a Noldova Desktop release that may break a module raises the minor version, such as 0.0.70 to 0.1.0, and every other release raises the patch; from 1.0, such a release raises the major.
A release may break a module when it:
- removes or renames anything Noldova Desktop's packages export, or changes the shape of a function, a class's members or a type that a module uses;
- adds a required member to an interface a module implements;
- changes what `module.json` and the files beside it take, or a message between a module and Noldova Desktop, so that a module written for the earlier version is refused or misread;
- changes what a module relies on at runtime, such as an order of calls or a default, in a way the release notes must warn of.
- moves Angular to a new major version, such as 22 to 23, since a window part's Angular peers end at the next major, as [Angular versions](#angular-versions) says.

Moving Angular within a major, by a patch or a minor, raises only Noldova Desktop's patch.
A required member added to an interface Noldova Desktop implements and a module only calls, such as one of `IWindowPartContext`, doesn't break a module, so it raises only the patch: the module's own code doesn't change, and its tests use the fakes from Noldova Desktop's [testing entries](#testing-a-module), which gain the member in the same release.

### Angular versions

A module's window part builds against the app's one copy of Angular, which Noldova Desktop's window package pins exactly, so a module's window part takes Angular as a range rather than the one version it was built with.

- **Its range:** each of the window part package's peers on an Angular package, such as `@angular/core`, is `>=<the Angular it builds with> <the next Angular major>`, such as `>=22.2.5 <23.0.0`, the form [Noldova Desktop versions](#noldova-desktop-versions) gives; `noldova-desktop-range 22.2.5` prints it.
  The app's Angular, Noldova Desktop's pin, must be within it.
- **Why a patch or a minor doesn't break it:** Angular follows semantic versioning, so a patch or minor release removes nothing a module's code uses, and the window's build links a window part's partially compiled code with the Angular it holds, which takes code compiled by an earlier version of the same major.
  A new major may remove or change what a module uses, and its compiler may refuse code an earlier major compiled, so it ends the range.
- **The build** refuses an Angular peer in a range that doesn't end at the next major after its lowest version, naming the form, and one whose range doesn't hold the app's Angular, naming both.
- **For now,** a window part may still name one exact Angular version, the app's; the release that refuses a module without `noldovaDesktop` refuses that too.

### Context and kit versions

Noldova Desktop's packages take context's packages and the kit as ranges, as modules take Noldova Desktop, so a context or kit release reaches an app without a Noldova Desktop release first.

- **Its range:** the window package's peers on `@noldova/context.core`, `@noldova/context.exceptions`, `@noldova/context.json` and `@noldova/ui.components.angular`, the command line's and the protocol's peers on context's three, Electron's and the runtime's on those three and `@noldova/context.text`, and the build's on `@noldova/context.collections`, `@noldova/context.core`, `@noldova/context.exceptions`, `@noldova/context.json` and `@noldova/context.text`, take the form [Noldova Desktop versions](#noldova-desktop-versions) gives, such as `>=0.0.7 <0.1.0`.
  The lowest is a version Noldova Desktop has been built and tested with, at or below the one it installs, its exact pin in the root `package.json` for context and in the window app's `package.json` for the kit, which the range must hold; the first refused is the next version that may break it.
- **Why peers:** each of these packages loads context into a process that also loads the app's or a module's own context: the window and the protocol into the window, the runtime into the runtime with the modules' runtime parts, the command line into the command line with their command-line parts, the build into the app's build, beside the app's own scripts, and Electron into the main process, where the app's own code takes its API, whose exceptions and JSON values are context's; none bundles context.
  The build's release entry alone runs without an install: a release job unpacks the build's `@noldova` peers, at the versions the app's lockfile holds, beside the build's archive, as [BUILD.md](BUILD.md) says.
  Context's core package can't load twice, so an exact dependency would give an app at another context version a second copy it can't load.
- **The app installs them:** an app pins context's packages in its root `package.json`'s `dependencies`, which its packaging ships, and the kit in its window app, each at one exact version inside these ranges.
- **What stays exact:** Noldova Desktop's own pins, its packages' other dependencies, and the versions between modules.
- **Between its own packages:** a dependency of one of Noldova Desktop's packages on another is written `__VERSION__`, which the build stamps as the version, and a peer, such as the window package's on the protocol, `>=__VERSION__ <__NEXT_MINOR__`, which the build stamps as the version up to its next minor, such as `>=0.0.21 <0.1.0`, the form the release's archive step requires of a peer on a package of the same release.
  The build and the Dependency pins check refuse either in another form, naming the package; a fixture module's peer on Noldova Desktop's packages stays `__VERSION__`.
- **The Dependency pins check** refuses such a peer at an exact version or in another form, or in a range that doesn't hold Noldova Desktop's pin, naming the peer, its range and the pin.
- **Node's types:** the build's, the command line's, Electron's and the runtime's declarations use Node's types and reference them themselves, so an app or a module whose TypeScript names no `types` compiles against them.
  Each of these packages names `@types/node` as an optional peer, `>=26.6.6 <27.0.0`, the version Noldova Desktop builds with up to the next major, as the organization's TypeScript standard lets a package that plugs into a framework name that framework's packages: these packages plug into Node, and `@types/node` is its types.
  It is optional, since only a project that compiles against the declarations needs it, and a range, since one exact version would clash with any app at another; the Dependency pins check takes that one form for `@types/node` alone, and the range must hold the root `package.json`'s pin.
- **The nightly range check** builds Noldova Desktop and runs its tests with the newest published context and kit inside these ranges, so every package loads the one copy an app would install, and opens or updates an issue when it fails, as a module's range check does.

## Modules from packages

- An app's `desktop.modules` lists each module either by its id, for a module in the app's tree at `src/modules/<id>`, or as `{ "id": "<id>", "package": "<package name>" }`, for a module in an installed package.
- A module in the app's tree builds as a package named from the app's `desktop.modulePackagePrefix`, then the module's id and its part: `@example/app.clock.runtime` for the prefix `@example/app.`, joined with `-` when the prefix ends in `-`.
  The prefix is a scope and a slash, then optionally a name ending in `-` or `.`; without one, it is `@noldova/desktop.`.
- The app's `package.json` pins each module's package to an exact version.
- A module's package holds `module.json` and the files beside it, `settings.json`, `menus.json`, `cli.json` and `webViews.json`, at its root, and its `version` is the package's version.
- The package exports each of its parts at `<package name>/<part>`, such as `<package name>/runtime`; that export may come from a package of the part's own, which the module's package pins exactly.
- A module's package takes Noldova Desktop's packages, context's packages and the interface kit only as peer dependencies, each at one exact version or in the range [Noldova Desktop versions](#noldova-desktop-versions) allows, never as dependencies, so an app holds one copy of each.
- A module's own repository installs those packages without Noldova Desktop's build, so its project has no build product file: importing the packages reads no file of the project, and only what asks for the product or the build's identity, such as starting the runtime, needs `_build/product.json` at the project's root, as [BUILD.md](BUILD.md#an-apps-inputs) says.
- A root that installs Noldova Desktop's window package, such as a module's own repository for its window part, also names each Angular package the window package peers on, `@angular/cdk`, `@angular/common`, `@angular/core` and `@angular/platform-browser`, at the one version the window package names, as an app's window app does ([BUILD.md](BUILD.md#the-build-package)).
  The CDK takes the others as a range, so once a newer Angular patch is out, npm takes a newer `@angular/common` for a root that pins only `@angular/core`, and a fresh install stops with `ERESOLVE`; a lockfile hides this until the next fresh install.
- The build reads a module from a package before it runs any of its code, checks it exactly as it checks a module in the tree, and writes it into the same declarations; the hosts then read it as they read a module in the tree.
- An app has one install tree: its root `node_modules`, which its `npm ci` fills from its one lockfile, with the window app among its workspaces, and to which the build adds the packages it builds itself; a module's package and its window part's package are installed there once, beside the app's one copy of Angular, the kit and Noldova Desktop's window package, and the window's Angular build takes them from there.
- The build reads the file at the module package's `./window` export, follows its relative imports, and checks what those files import by name, before it builds the window: a window part's files import by name only packages their module package lists in `dependencies`, `optionalDependencies` or `peerDependencies`, reach their own files through relative imports that name each file with its extension, and import another module's package only through its `./window` entry.
  An import outside those rules stops the build, naming the module's package, the import and the rule; so does a module package with a window part but no file at its `./window` export.
- A window part from a package of its own is an Angular package named after the module's package with `.window` added, such as `@example/notes.window` for `@example/notes`, which the module's package lists among its dependencies at the exact version.
  It is the only Angular package the module's package may list there, and the only way to Angular from the module's package: no other package it depends on, directly or through others, may depend on an Angular package.
  It names Angular, Noldova Desktop's window package and the kit as optional peer dependencies, so an install that takes only a module's runtime part, such as the module's own repository for its runtime tests, gets no Angular; an app's window app names them, so they are met at the app's root.
  Each peer names one exact version or the range [Noldova Desktop versions](#noldova-desktop-versions), [Angular versions](#angular-versions) or, for another of the organization's packages, [Versions](#versions) gives, which the build checks as it checks the module package's peers, against the version the app's install holds for any but a Noldova Desktop package the build itself builds.
- The module's package itself never names Noldova Desktop's window package as a peer, not even an optional one; its window part's package does.
  GitHub's registry serves no `peerDependenciesMeta`, and npm resolves an install from the registry's metadata, so it takes every peer as required and installs the window package at the app's root, where its exact Angular peers clash with the newer Angular that another package's range, such as the CDK's, lets npm pick.
- A window part's package ships its code compiled by the Angular compiler in partial compilation mode, since the window's build compiles no TypeScript from installed packages.
- No event, call or limit is particular to a module from a package.

### Files other programs read

- A packaged app keeps a module's code inside its archive, `app.asar`, which only Electron's own file access reads, so a file the module hands another program by its path, such as a script it runs with `osascript`, must be kept outside it.
- The package that holds such a file names it in its `package.json`, under `noldovaDesktop.unpacked`, as a list of exact paths from the package's folder with `/` between folders, such as `"noldovaDesktop": { "unpacked": ["jxa/mac-desktop.js"] }`.
  Any package the app ships may name its own files this way, whether the module's package or a package of one of its parts.
- Packaging copies each named file into `app.asar.unpacked`, beside the native files, as [BUILD.md](BUILD.md#packaging) says.
  It refuses, naming the package and the path, a path that holds a character a file pattern reads as a wildcard, including `\` and `!`; an absolute path; a path with an empty, `.` or `..` segment; a path into `node_modules`, since a package names only its own files; a path whose folders or name differ in case from the package's; a path a symbolic link takes outside the package's own files; a file named twice; a path at which the package holds no file; and a file electron-builder ships on no target, such as the package's top-level `README.md`, a file under its top-level `test` or `examples` folder, a `.d.ts`, `.cc` or `.pdb` file, or a file whose name starts with `._`, naming the rule.
  A named `.exe` or `.dll` is kept outside `app.asar` on Windows only and left out of macOS and Linux packages, which electron-builder ships without a package's `.exe` and `.dll` files, so the module's code asks for it only on Windows.
  A file named under the package's top-level `native/<platform>-<arch>/` or `prebuilds/<platform>-<arch>/` folder of another target is passed over, since the stage leaves that folder out, so a package names each target's helper and the module's code asks only for its own target's.
  The installed package's smoke check then finds each named file in `app.asar.unpacked`, marked unpacked and readable.
- The module's code gives the other program the file's unpacked copy, with Runtime's `PackagedPath.unpacked(file)`, which turns the path's first `app.asar` segment into `app.asar.unpacked` and leaves a checkout's path as it is.
  Electron's own file access reads either path.

### What fails closed

The build refuses:
- a listed package that isn't installed, or holds no `module.json` at its root;
- an id in `module.json` other than the listed one, or an id two entries list;
- a package that isn't pinned exactly, whose installed version isn't its pin, or whose `name` isn't the listed one, or whose version isn't its `module.json`'s;
- a part that `module.json` names and the package doesn't export, or an export of a part `module.json` doesn't name;
- a peer dependency that isn't one exact version or, on the organization's packages, a range in the form [Noldova Desktop versions](#noldova-desktop-versions) gives, ending, on another of the organization's packages than Noldova Desktop's, context's and the kit's, at the first version refused [Versions](#versions) names, or, on Angular's packages in a window part, the range [Angular versions](#angular-versions) gives, or whose range on Noldova Desktop's packages isn't the module's `noldovaDesktop`; one that is outside its range, or, written as one version, differs from the version the build gives the package, for one of Noldova Desktop's own packages that the build builds, or from the installed version, for any other, such as the Noldova Desktop packages an app installs, naming both; the build reads the peers from the installed package's own `package.json` in `node_modules`, `peerDependencies` and `peerDependenciesMeta`, which come from the package's archive, never from the registry's metadata, which can leave `peerDependenciesMeta` out; as npm does, it skips one that `peerDependenciesMeta` marks `optional` when the app has no version of it, but refuses an optional one the app has at another version or outside its range, and one written in any other range form even when the app has none;
- a module whose `noldovaDesktop` doesn't include the app's Noldova Desktop version;
- a module's package that names Noldova Desktop's window package as a peer, even an optional one, giving the registry's reason that [Modules from packages](#modules-from-packages) gives;
- a contributed name that two modules of the build, or two kinds of one module, declare;
- a second copy of one of the packages Noldova Desktop publishes, of context's or of the kit's, which the build knows by the `name` in each installed package's own `package.json`, so one that comes in under an npm alias or through a `file:` link counts, and a module's package named in the `desktop-` scope doesn't: one that the package, or a package it depends on, lists among its dependencies, other than its own window part's package, or one installed inside the package;
- a dependency at another version, or missing;
- an Angular package that the package reaches through its dependencies other than through its window part's own package, naming the package that lists it, and a window part's package that isn't pinned exactly, isn't an Angular package, doesn't mark its peers on Angular, Noldova Desktop's window package and the kit optional, or has a peer that isn't, or whose range doesn't hold, the version the build gives it, for one of Noldova Desktop's own packages that the build builds, or the version the app's install holds, for any other;
- a window part's import outside the rules of [Modules from packages](#modules-from-packages).

After it installs the packages it builds, the build also refuses, for the whole app:
- a second copy of an Angular package or of one of the packages Noldova Desktop publishes, of context's or of the kit's anywhere in the app's install, in its root `node_modules` or in the window app's folder, other than the one at the top of the root `node_modules`, known by the `name` in the installed package's `package.json`, so one under an npm alias or through a link counts, naming the package and where the copy is;
- an Angular package that Noldova Desktop's runtime, Electron, command line, protocol or build package reaches through its dependencies, optional dependencies or peers, naming the chain of packages that reaches it, since Angular belongs to the window alone.

### What stays product-neutral

- A module names no app: the app configures it through its published API and the bindings of [TOOLS.md](TOOLS.md#calls).
- Adding a module changes the app's `desktop.modules` and its dependencies, and no source of Noldova Desktop or of the module.

## Lifecycle

The runtime decides which modules are active, and the window and the command line follow it.

1. The runtime reads the declarations and orders the modules after their dependencies and the optional dependencies the app includes.
2. Each runtime part activates once, registering its contributions and its published services.
   It receives only Noldova Desktop's services and the published services of the modules it declares, an optional dependency's only as [Optional dependencies](#optional-dependencies) says.
   Before a part with migrations activates, the runtime opens the module's database and applies the pending migrations; a migration that fails, or a schema the migrations don't know, leaves the module failed.
3. A module is active when its runtime part, if it has one, and all its dependencies have activated.
   Otherwise the runtime records why it failed, or which dependency blocks it, absent, inactive or at another version, and Noldova Desktop and the other modules carry on.
   A runtime part that can tell the person why it can't run, such as a missing system feature, throws a `ModuleActivationException` from its activation with one sentence for the person, which the module's status then shows as its cause; it names no path, secret or error text, and the error behind it goes in the exception's `cause`, which only the log shows.
   Any other error shows "Its runtime part failed to activate." and reaches only the log, as does an exception of the same name from another copy of `@noldova/desktop.runtime`.
   An optional dependency never blocks it: one the app doesn't include, that isn't active or that is at another version leaves the module to run without it, and the runtime's log says which and why.
4. The window and the command line ask the runtime which modules are active, and activate only those modules' parts, in dependency order.
   The command line activates only the part of the module whose command it runs, with the parts of that module's dependencies, never those of its optional dependencies.
5. When the runtime starts again, the window asks each window part it keeps whether it continues; a part that doesn't, or fails to, is built again, with every part that depends on it, as [WINDOW.md](WINDOW.md#when-the-runtime-starts-again) says.
6. A part that fails to activate in the window or the command line affects that host alone: its contributions are withdrawn there and its dependents don't activate there.
7. Hosts deactivate parts in reverse order, releasing their contributions, subscriptions, timers, files and programs.
   In the runtime, a deactivated or failed part's context likewise registers nothing: it still refuses a name a live context refuses, but registers no method, command, service, tool or permissions answerer, declares no event, whose channel then refuses to publish as a withdrawn one does, calls no listener for closures, settings, the app's windows and shortcuts, dependencies, tool sessions, revocations, or its web views' events and protocol events, and the functions it returns do nothing; it posts no notification, whose handle then changes nothing, and reports no work, whose item comes already cancelled; a late `tools.openSession`, `startProcessAsync` or `startPseudoTerminalAsync`, or a late call that drives its web views, `navigateAsync`, `actAsync`, `setAllowedOriginsAsync`, `setControlledAsync`, `clearProfileAsync` or the relay's `sendAsync`, throws `ModuleDeactivatedException` and sends nothing, after any refusal a live context makes, so the part's next activation registers the same names again.
   In the window, a deactivated or failed part's context then ignores what would register, mark or post something, or change the window's tabs, such as a call from a load that finishes late: it still refuses a name or value a live context refuses, but registers nothing, opens, changes, closes or shows no document or view, shows none in a view dialog, shows no badge, working tab or notification, and the functions it returns do nothing; a document or view the part asked to open, change or close during an activation that failed is never opened, changed or closed.
   The calls that reach the system do nothing either: the folder chooser answers no folder and the save dialog answers cancelled without showing, opening a link, a file or a file's folder opens and shows nothing, a link's menu doesn't show, and the part doesn't become the in-app browser.
   Their refusals live in the main process, so these five calls answer without checking their values.
8. A module whose `switchSetting` is `false` is off: no host activates it, it shows as off with no cause, and each module that depends on it shows as blocked by it.
   When that setting changes while the app runs, the runtime turns the module off or on at once, and the window and the command line follow it.
   Turning it off deactivates its dependents, then the module, in every host, as in step 7; a method call in flight to one of them sees its signal abort.
   The runtime takes one change at a time, in the order they come, and each reads the setting when it runs, so changes in a row settle on the value the setting ends with.
   It hears changes from before the first module starts, and applies one made while the modules start once they have all started.
   Turning it on activates the module, then each dependent that it alone blocked, in dependency order, as in steps 2 to 4; no other module restarts.
   Noldova Desktop shows the setting while the module is off, so the person can turn it on.
9. A module whose `platforms` don't name the platform the app runs on is unavailable there: no host activates it, it shows as unavailable with the cause "It doesn't run on Linux.", naming the platform, or "this platform" on one without a name, and each module that depends on it shows as blocked by it, with that platform in its cause.
   An optional dependent runs without it, as [Optional dependencies](#optional-dependencies) says.
   The runtime offers none of its settings, its switch setting included, so Settings doesn't show them and reading or writing one fails as an unknown setting; their stored values stay as they are, for the platforms it runs on.

- Activation stays light: a part loads heavy code when its first view opens or its first request arrives.
- A runtime part's constructor only sets fields, since the runtime builds the part before it migrates the database.
- Its migrations are a fixed list it declares, never computed from data.
- A part reaches its database only through its context.
- A part's method handler gets the request's connection, the window it came from and whether the app or the command line sent it, with a signal that aborts when its time runs out or it is cancelled: by its caller, by the page that sent it going or being replaced by the next page, or by its window or its connection closing, as [RUNTIME.md](RUNTIME.md#messages) says.
  A part that keeps something for a window, such as a terminal, keys it by connection and window, sends that window its events alone, and ends it when its context reports the window or the connection closed, as [RUNTIME.md](RUNTIME.md#messages) says; it stops hearing closures when it deactivates.
  Database calls are synchronous and every client shares one runtime, so queries stay short and long work happens outside them.

## Optional dependencies

A module uses an optional dependency when the app includes it and it is active, and works without it otherwise.

- The module takes only types from an optional dependency's packages, with `import type`, since they are missing from an app that leaves that module out.
  The exact version the module names is what makes a service the shape it compiled against.
- A runtime part finds an optional dependency's service with `findService(name, guard)`, which answers `null` while that module isn't active at the version the module names, while nothing is published under the name, or when the guard refuses what is; the module's log says a refusal once.
  `getService` refuses an optional dependency's service, as it does any module's the part doesn't depend on.
- A window or command-line part reaches an optional dependency's methods, events, commands and settings by name like a required one's; they fail while that module isn't active.
- A runtime or window part hears an optional dependency turn on or off with `onDependencyChanged`, which calls its listener with the module's id and whether it is now active.
  In the runtime, active means active at the version the module names; in the window, it means active in the runtime and, when the module has a window part, with that part activated in the window.
  A module's state is settled before the modules that use it activate, so the listener hears only later changes: in the window, those it finds when the runtime starts again and a part continues.
  A window part reads the state with `isDependencyActive(moduleId)`, at activation and at any time after: it answers what the listener was last told, or the state at activation before any change, and false for a module that isn't one of the part's optional dependencies and once the part deactivated; so a part shows something only while an optional dependency is on by reading the state once and following `onDependencyChanged`.
  In the runtime, the listener hears a module that its switch setting turns off or on, as step 8 of the [lifecycle](#lifecycle) says, and each module that turns off or on with it.
  The host reports a listener that fails and tells the others, and calls none that stopped, even during the same change, nor one added once the part deactivated.
- The Modules document lists a module's optional dependencies in their own row, apart from those it needs, and the runtime's status of each module carries them.

## Cooperation

- A module imports its own packages, context's packages, Noldova Desktop's published APIs and the published APIs of the modules it declares as dependencies, and only types from those it declares as optional dependencies.
- Modules cooperate through published APIs, including contracts that other modules implement and register.
- Noldova Desktop's own contracts for every module are in their documents: agent tools in [TOOLS.md](TOOLS.md), permissions in [PERMISSIONS.md](PERMISSIONS.md), web views in [WEB-VIEWS.md](WEB-VIEWS.md), the files the person gives a window and those a runtime part shares with it in [RUNTIME.md](RUNTIME.md#file-grants), and secrets in [Secrets](#secrets); a part reaches them through its context.
- A module never reaches another module's database, files, settings or internals, directly or through Noldova Desktop.
- A module keeps references to another module's records as that module's stable identities, and handles a record that no longer exists.

## Trust

- Every module of an app is Noldova's, and has the app's privileges; a declaration is no sandbox.
- Every part follows the organization's security standard, `https://github.com/noldova-com/.github/blob/main/standards/SECURITY.md`: it checks the data and the authority of each request it receives.
- A runtime part reads a file the person picked, dropped or pasted in its window only by redeeming its window part's grant, at once, and copies it into its own store to keep it, as [RUNTIME.md](RUNTIME.md#file-grants) says.
- A runtime part lets its window load one of its own files only by sharing it, with a grant its window part turns into an address, never by sending the bytes as text in a message, as [RUNTIME.md](RUNTIME.md#file-grants) says.
- A module starts a program only through its context, as [RUNTIME.md](RUNTIME.md#programs-modules-start) says.
  A program's output never grants permissions.
- A module keeps a token, key or password only in this machine's secret store, as [Secrets](#secrets) says.

## Secrets

A module keeps its tokens, keys and passwords in this machine's secret store, by names of its own, `<id>.<member>`, as [ARCHITECTURE.md](ARCHITECTURE.md#secrets) says; a setting that needs one holds its name, never its value.

- A runtime part saves, reads, replaces, removes and checks its module's values with its context's `secrets`: `saveAsync(name, value)`, `readAsync(name)`, which answers `null` when none is saved on this machine, `removeAsync(name)` and `isSetAsync(name)`.
- A window part and a command-line part save, replace, remove and check them with their contexts' `secrets`, and never read one back: only the module's runtime part reads a value, which the main process decrypts and sends to the runtime over the runtime's connection to the main process, as `desktop.secretAnswered`, and the runtime hands to that part alone, in its own process.
- A value is 1 to 16,384 characters with no lone surrogate, so a read gives back the value saved, and is kept for this machine alone.
- Saving and removing one name take effect in the order they were asked, so a removal asked while a save waits for the main process is never undone by it.
- Each part refuses a name that is another module's, Noldova Desktop's or not a qualified name, and a value it can't keep, before it asks.
  The runtime enforces a runtime part's refusal, but the runtime's methods take any module's name from a window or the command line, so a window part's and a command-line part's refusal is the part's own: with the app's privileges, a window part could claim another module's name, save over its value or remove it, though it can't read one.
- A call fails as `Unavailable`, with a message for the person and, in the failure's `details`, its reason, as [RUNTIME.md](RUNTIME.md#secrets) says.
  A runtime part or the command line reads the reason with `SecretFailures.reasonOf(error.failure)`, a `SecretFailureReason` from `@noldova/desktop.protocol`, and never from the message:
  - `NotConnected`: every call, while no main process has connected to the runtime since it started, such as when only the command line runs, saying to open the app;
    and a save or a read, once the main process has gone and until it connects again; removing and checking still work when an earlier call, while the main process was connected, gave the runtime the device's identity;
  - `NoDevice`: every call, when the main process has no device identity;
  - `Unprotected`: a save, when the system has no keyring that protects the value, and nothing is saved, and a read then too, naming the secret it didn't read;
  - `Undecryptable`: a read, when the keyring can't decrypt the value, which the module then saves again.

## The app's own windows and keys

- A runtime part's context lists the app's own windows, each with its platform identity, a window handle on Windows or a window number on macOS, and its process id, and reports their changes, so a module that acts on the screen can leave them alone.
  On Linux the identity is the window's X11 window, and under Wayland, which gives a window no identity other programs can see, it is `null`.
  Any window of a listed window's process is the app's, its dialogs, menus and tooltips among them, so a module goes by the process id where the identity is `null`.
- A runtime part's context gives the app's shortcuts as key chords and reports their changes, so a module that sends keys can refuse them.
  The list holds the window's keys as the person bound them, the stop key, marked global since it works while agents act in another app, and on macOS the app and window menus' keys, Quit, Hide, Hide Others, Minimize and Close Window, with no command, since they quit, hide or close the app while its window is focused.
  The edit menu's keys, such as copy, paste, undo and select all, are not on it, so agents can use them freely.
- `appWindows.list()` and `shortcuts.list()` are empty while the app's main process isn't connected; `onChanged` is called when a list changes and each time the main process connects or goes, even with no window open, but not when the same main process reports the same list again, and the runtime withdraws its listeners when the part deactivates.

## Contributions

Noldova Desktop owns registration, collisions, the person's overrides, persistence and removal when a part deactivates; each module owns its entries.
Noldova Desktop registers its own entries, such as the default theme, through the same mechanisms, and keeps no list of a feature's entries.

| Mechanism | A module contributes | Noldova Desktop |
|---|---|---|
| Views | Content for a panel, in a dock or in the middle, with its title and icon, a badge, a mark that it is working and a mark that it waits for the person; a view with instances, such as a terminal, opens a tab for each instance, titles them, may give each a breadcrumb it changes while the instance is open, and hears when the person closes one, with buttons from one of its menu places in their tab row; the module shows a view without instances, hides the dock that holds one of its view tabs, and reads which dock holds one, the bottom, a side or none; a view adds the places it shows, such as a list's items or a pane's pages, to Back and Forward with `recordPlace`, hears through `onPlaceShown` when Back or Forward reaches one, and takes out one it no longer has with `forgetPlace`. | Docks, splits, hides and restores it, as [WINDOW.md](WINDOW.md#workspace) says, and shows an instance's title and breadcrumb in the window row while its tab is the document area's active tab; keeps a view's places in Back and Forward with the documents, shows the view before telling it which place to show, and drops its places when its part deactivates, as [WINDOW.md](WINDOW.md#keys-and-menus) says. |
| Documents | Content for a tab in the middle, with a title and a breadcrumb, with a glyph before it if the module gives one, that it may change while the document is open, and on its tab an image, such as a favicon, with a glyph in its place, a status glyph, a marker with its tooltip, a mark that it is working, which shows the spinner before the title, and a mark that it waits for the person; the module opens one right after another of its open instances, such as a page opened from another page, hears when the person closes one of its document tabs, lists the open ones, and forgets a document whose subject is gone. | Opens, arranges and restores its tabs, shows a document's title and breadcrumb in the window row while its tab is the document area's active tab, and steps back and forward through the documents shown, opening a closed one again until its module forgets it. |
| Placeholder | Content the middle shows while no document is open, such as a start page. | Shows it in the document group while no document is open, as [WINDOW.md](WINDOW.md#workspace) says, and refuses a second one. |
| Commands | Named actions with a title, an optional icon and an optional default key, from its window or runtime part. | Runs them by name with optional JSON arguments, from keys, menus, toolbars, the top bar, the status bar and command search. |
| Top bar and status bar | Actions and items with an icon or text, a tooltip and a command, which it may update or hide; a status bar item may take the muted tone, and while hidden needs no text. | Shows them in module order, then in declared order, with its own at the ends; a muted status bar item is drawn in the design's muted text colour, a hidden one takes no space, a status bar item whose command isn't registered is disabled, and a top bar action whose command can't run stays focusable and runs nothing, its title naming why. |
| Menus and toolbars | Groups of items in its own places and in the places of Noldova Desktop and its dependencies, from `menus.json`. | Builds the main menu, context menus, the window's toolbar band and each view's band from them. |
| Settings | Settings with their defaults, pages and scopes, from `settings.json`, setting scopes for the objects it owns, and pages of its own whose component its window part supplies. | Keeps the values per scope, resolves the value in effect, shows the pages and reports changes. |
| Notifications | Notifications of the kinds it declares. | Holds them while the runtime runs, and shows them in the window and through the operating system. |
| Themes | Themes, each with colours for the light and dark modes. | Offers them in Settings and applies the person's choice before the window paints. |
| Protocol | Methods and events. | Authenticates, routes and delivers them. |
| Storage | Its database's tables and migrations, and its files. | Creates, migrates, backs up and closes its database. |
| Command line | Commands under its id, from `cli.json`. | Reads the command line against them, prints their help and runs them. |

- A saved layout keeps the place of a view or document whose module is absent, and shows it again when the module returns.
- A window part places a palette just under the window row through its context, never by reaching into Noldova Desktop's elements, as [WINDOW.md](WINDOW.md#keys-and-menus) says.
- The data format of a theme is decided when a second theme is built.

### Commands and keys

- A part registers each command its declaration names, with its title, icon, default key and handler, and a name the declaration lacks is refused.
- A window part's command runs in the window, and a runtime part's in the runtime.
- A runtime command has one state for all arguments, enabled or not, and checked or not when it was created with a checked state; a command that isn't enabled is refused.
  A command whose state depends on its arguments is a window command.
- A key is any of `Mod`, `Ctrl`, `Alt` and `Shift` joined by `+` to one key, such as `Mod+Shift+K`; `Mod` is Ctrl on Windows and Linux and Cmd on macOS.
- A default key needs `Mod`, `Ctrl` or `Alt`, or is a function key, so typing is never taken.
  It is never a key that editing or the operating system owns on any platform: `Mod+A`, `C`, `V`, `X`, `Z` and `Y`, and `Mod+Shift+Z`; on macOS `Mod+Q`, `W`, `H`, `M`, `Comma`, `Tab` and `Space`, and `Mod+Alt+Escape`; on Windows and Linux `Alt+F4`, `Alt+Tab` and `Mod+Escape`.
- A module's command has at most one default key, the same on every platform.
- Keys go to commands in this order: the person's bindings, Noldova Desktop's default keys, then the modules' default keys in module order, a module's runtime commands before its window commands.
  The first keeps the key, and Settings shows every refused command as a collision.
- In one of a module's web views, the keys the module declares for the pane in `webViews.json` go first, and the app's shortcuts come after them, as [WEB-VIEWS.md](WEB-VIEWS.md#keys-from-a-view) says.
- A window part marks an element that keeps the Ctrl keys, such as a terminal, with `nolKeepsCtrlKeys`, and asks its context's `findWindowCommand` which command the window would run for a key; what the window does with such keys is in [WINDOW.md](WINDOW.md#keys-and-menus).
- A window part reads the key that runs a command with its context's `keyOf`, a signal of the key's platform label, such as `⌥⌘N` on macOS and `Ctrl+Alt+N` elsewhere, and its `aria-keyshortcuts` form, such as `Alt+Meta+N` and `Control+Alt+N`, or of `null` while the command has none; it follows the person's bindings as they change.
- The person's bindings are the shared setting `desktop.keyBindings`, from a command's name to its key or to `null`; a binding for an absent command is kept until it returns, and one for a renamed command's former name moves to it, as [Former names](#former-names) says.

### Former names

- A module that renames a command or a document lists, in `contributes.formerNames`, the names it had before, by its name now:

  ```json
  "contributes": {
    "commands": ["notes.create"],
    "documents": ["notes.page"],
    "formerNames": { "notes.create": ["notes.add"], "notes.page": ["notes.sheet"] }
  }
  ```

- A former name is any qualified name but the shell's or another reserved id's, so a command or document that moved from another module keeps what the person kept for it; it names only one of the module's own commands and documents, and never the name itself.
- When the runtime starts, a binding in `desktop.keyBindings` for a command's former name moves to the command and the former name's entry goes, in one write; a binding the person already set for the command wins, and the former one goes.
  A binding whose key the command can't hold, such as a key the shell keeps for itself, stays under the former name.
  A binding for a former name that no module in the build declares stays as it is.
- A tab the saved layout holds under a document's former name reopens as that document, with its instance, title and place, and the layout saves it under the new name; when the layout already holds that document's tab, the former one stays as it is.
- A module keeps a former name as long as it wants old bindings and tabs carried over, since a person may return from any earlier version.
- The build refuses a former name that two modules or two of a module's names claim, or that is a name a module contributes in the build.

### Menus and toolbars

- A menu is a named place: Noldova Desktop's `desktop.file`, `desktop.edit`, `desktop.view`, `desktop.window` and `desktop.help` in the main menu, its tab menu `desktop.tab`, its text field menu `desktop.field`, its web link menu `desktop.link` and the window row's layout menu `desktop.layoutMenu`, and the places a module declares.
- A module describes its places and groups in `menus.json`, which the build checks:
  - `places`: each place the module declares, with its `title` and what it `shows`: `menu`, the default, for a submenu or a tab row; `menuBar` for a menu of its own in the main menu; or `toolbar`.
    A toolbar may say whether it is `shown`, which toolbar it stands `after` or `before`, whether it starts a `newRow`, and the `band` it stands in: one of the module's own views or documents, `<module id>.<name>`, which the build checks.
    A toolbar without a band stands in the window's band and View > Toolbars; one with a band stands only in that view's or document's band, which its page shows with `<nol-view-toolbar-band />`, and only that band's Toolbars menu and the context menu of its view's or document's tabs list it, so a band whose toolbars are all hidden can show them again.
    A band's rows get `view` or `document`, the page's name, and `instance`, its tab's instance when it has one, as arguments; every tab of the view or document shares one arrangement, and a toolbar never moves between bands.
  - `groups`: each with its name, the `place` it adds to, whether it is `exclusive`, and either its `items` or `dynamic`, for rows its window part supplies with `provideMenuGroup`, each a command with optional arguments, label and icon.
    An item runs a `command` with optional JSON `arguments` and an optional `label`, or opens one of the module's own places as a `submenu` or a `choice`; no place contains itself.
- A module adds groups to its own places, Noldova Desktop's and those of its dependencies, and its items run its own commands and its dependencies'.
  It never adds items to another owner's group.
- A place shows Noldova Desktop's groups first, then each module's in module order, each group's items in declared order, with separators between groups; an empty place or group is left out.
- A row whose command doesn't apply to its arguments is left out; a row whose command isn't registered shows disabled.
- A view with instances, or a document, may show one of the module's plain menu places in the tab row of each group that holds its tabs, with `{ "tabGroup": "<group id>" }` merged into each item's arguments, submenus included, and, for a document's place, `"document"` and `"instance"` while the group's active tab is one of the module's own documents; the place is never a toolbar, so it stays out of the toolbar band and the Toolbars list.
- A view may name its group on its default side and its place in that group's tab row in a new layout (`defaultGroup` and `defaultOrder`), as [WINDOW.md](WINDOW.md#workspace) says; orders are compared across modules, so modules space them, such as 10, 20 and 30.
- A view with instances, or a document, may declare its tabs renamable in place (`isRenamable`); the window part hears each kept title through `onTabRenamed`, an empty one meaning its automatic title, and owns the name it applies.
- A view or document of the module, with instances or without, closes the view dialog it shows in through its window part's `closeDialog`, with its name and, to close only one instance's, the instance, such as after an action that leads elsewhere; the focus returns as when the person closes the dialog, or goes to the tab of a document the module opened or activated since the dialog showed.
  The call does nothing while the view shows in a tab, or the dialog shows something else or nothing, so a view never needs to know where it shows.

### Settings and their scopes

A module adds settings only through `settings.json`, whose field `settings` lists them, each with exactly these fields:

| Field | Holds |
|---|---|
| `name` | The setting's name, `<id>.<name>`. |
| `title`, `description` | What Settings shows for it. |
| `type` | Its `kind` and that kind's limits: `Boolean`; `Choice` with either `options`, each a `value`, empty or not blank, and a `title`, or `"dynamic": true`, whose options its window part supplies; `Number` with `minimum`, `maximum` and `step`; `Text` with `maxLength`, and `"checked": true` when its window part checks a value before Settings saves it; `Modules`, a list of distinct module ids; or `Action` with one of the module's own commands and the label of the button that runs it, which holds no value. |
| `default` | A value its type accepts, `null` for an action. |
| `locality` | `Shared`, one value for every device that shares the data directory, or `Device`, a value for each device. |
| `scopes` | The setting scopes that may override it, its module's own or a dependency's; a device setting has none. |
| `page`, `group` | Where Settings shows it; General takes a module's settings after Noldova Desktop's own, while Keyboard shortcuts and About take none. |

- The build refuses a file whose settings differ from those `module.json` declares, and an action whose command the module doesn't declare.
- A setting's `title` and `description`, and a `Choice` option's `title`, may name a key by a token, `{key:<key>}`, with the key written as [Commands and keys](#commands-and-keys) says, such as `Send with {key:Mod+Enter}`.
  Settings shows each token in words, on Windows and Linux as menus show the key, and on macOS with `Control`, `Option`, `Shift` and `Cmd` in that order, joined by `+` to the key, where menus show symbols: `{key:Mod+Enter}` shows as `Ctrl+Enter` on Windows and Linux and `Cmd+Enter` on macOS, and `{key:Alt+Enter}` as `Alt+Enter` and `Option+Enter`.
  On macOS only the modifiers take the system's names, and the key keeps its own, so `{key:Mod+Backspace}` shows as `Cmd+Backspace` and `{key:Shift+Escape}` as `Shift+Esc`.
  A token that names no key, and braces that don't form a token, show as written, so `{key:{key:Mod+K}}` shows as `{key:Cmd+K}` on macOS.
- A module that needs a richer screen, such as a table with actions, declares a page of its own in `settings.json`'s optional `pages`, each with exactly a `name`, `<id>.<name>`, which `contributes.settingsPages` lists, and a `title`; the build refuses a page title that is already a page's, a module's settings' or Noldova Desktop's own, and a page without a window part.
  A module that depends on the page's module may name that page's title as its settings' `page`, such as a switch for one option of the screen that page shows, and those settings show on that page; the page's own module, or any other module, may not.
  Its window part registers each page's component with `registerSettingsPage(new SettingsPageContribution(name, load))`, and Settings shows it as [WINDOW.md](WINDOW.md#settings-and-modules) says; a module may instead open a document of its own, which an action's button may open.
- A dynamic choice's window part supplies its options with `provideSettingOptions`, which Settings asks again whenever one of the module's settings changes and whenever the part calls `refreshSettingOptions`, so options can follow the module's other settings and data it loads.
  Settings calls the provider synchronously while it renders, outside any reactive context, so the provider may read and write signals, and only the module's settings and `refreshSettingOptions` make Settings ask again.
  Noldova Desktop never has those options, so writing the setting accepts any string and reading it returns the stored value or the default.
  Settings keeps a value that isn't among the supplied options, marked unavailable and still selectable, and shows the value in a disabled field until the part supplies options, and while its provider returns `null` because its data is still loading.
- A checked text's window part supplies its check through `provideSettingCheck`.
  Settings asks it when the person commits a value: a message refuses the value, which isn't saved, and the field keeps the refused text with the message under it until the person's next commit, even when an earlier save lands meanwhile.
  Settings shows the message for a stored value the check refuses too, without changing it, until the person commits a value the check accepts.
  With no check supplied, the value is saved.
  A check that throws accepts the value, and the part's log names the setting and the error's name, or the type of what was thrown, never the value.
- A part reads the settings of its module, its dependencies and Noldova Desktop, and changes only its own module's.
  A runtime part that reads a device setting with no device gets the value for the device its runtime serves, which the runtime asks the app for once the app's main process connects, and the default until it knows; `onChanged` with no device passes only that device's changes to a device setting, and once the runtime learns the device it passes that device's stored value as a change; the device's id stays inside the runtime.
- Noldova Desktop's `desktop.timeFormat` and `desktop.dateTimeFormat` are the patterns every time a module shows follows, and a part formats a date in one with `DatePattern.format` from `@noldova/desktop.protocol`, and the kit's messages and permission cards follow them without it; a change reaches its readers as any setting's does.
  A pattern's letters that are no token, such as `Q` or a third `y`, show as text, as quoted text does.
- Setting a value equal to the default where the setting would otherwise take its default removes the stored value.
- A stored value that the setting's type no longer accepts is kept but ignored, and logged once.
- A module that owns a kind of object, such as a project, contributes a setting scope for it and says which object encloses each one; an object with none falls under the app.
  A value comes from the most specific scope that sets it, then each enclosing scope, then the app, then the default.
  When an object is deleted, its scope's owner asks Noldova Desktop to remove the values stored for it.

### Notifications

- A module declares its notification kinds, and decides when something deserves a notification; muting one object's notifications is a setting at that object's scope, which the module applies.
- A part posts a notification of one of its kinds through its context and gets a handle that dismisses it; a runtime part's handle also updates it.
  A notification has a title, optional text, a severity, an optional command that opening it runs, up to two actions and optional progress; its commands are its module's own or a dependency's.
- Posting the same kind and key again replaces the earlier notification, which returns to the top unread; an update through a runtime part's handle keeps its place, its time and whether it was read.
- When a module's runtime part deactivates, its notifications are dismissed, and so are those a window part posted when it is withdrawn.
- Noldova Desktop's own kinds belong to no module, and turning modules' notifications off never mutes them.

### Command-line commands

A module's CLI part registers the commands its declaration names, and each runs under the module's id: `notes.addNote` is `<app command> notes add-note`.
A module defines them in `cli.json`, whose only field, `commands`, lists them, each with exactly these fields:

| Field | Holds |
|---|---|
| `name` | The command's name, `<id>.<name>`. |
| `summary` | One line for the list of commands in the help. |
| `description` | Optional text for the command's own help. |
| `arguments` | Its positional arguments in order, each with a camelCase `name`, a `description`, `required`, true by default, and `variadic`, false by default, for a last argument that takes the rest of the line. |
| `options` | Its options, each with a camelCase `name`, a `description` and a `type`: `Text`, `Number` or `Boolean`; a `Text` or `Number` option may be `required` or `repeated`, or have a `default`, but not both. |
| `examples` | Optional examples, each with its `arguments` and a `description`. |

- The build refuses a file whose commands differ from those `module.json` declares, a name used twice in one command, a required argument after an optional one, a variadic argument that isn't last, and an option that clashes with the command line's own.
- The command line reads the call against the declaration before it reaches a runtime, so a call that doesn't match starts none, and the help comes from the declarations alone.
- The handler gets the arguments and options as one read-only object, a signal that aborts when the command is cancelled, times out or loses the runtime, and the command's console, and returns a JSON result and the text for people.
  The command line owns the output: a part writes to it only through the console, never to the process's own streams.
  A command that answers with one result leaves the console alone, as before, and a handler that takes only the values, or the values and the signal, works unchanged.
- The console, `ICliCommandConsole`, lets a command write and read while it runs, such as a chat that prints each reply as it streams:
  - `writeLine(text)` writes a line for people at once: to standard output, or with `--json` to standard error, so that standard output holds only the JSON result.
  - `askAsync(prompt)` writes the prompt, except with `--json`, and resolves with the next line of standard input, without its line end; it resolves with `null` at the end of the input and once the signal aborts.
    Lines that arrive before the command asks wait for it, in order.
    It reads lines the same way whether standard input is a terminal, a pipe or a file, and with `--json` too; standard input that is closed or empty gives `null`.
  - `onEvent(name, listener)` hears each event the runtime sends on the command line's connection under that full name, such as `notes.replyChanged`, until the returned disposable is disposed or the command ends.
    A module's runtime part sends one to the command that asked with its event channel's `publishTo(context.connection, null, payload)`; a command may instead poll with requests.
    A listener that throws fails the command as its handler would.
- A command ends when its handler returns: the command line then prints the result after the lines the command wrote, and exits with 0.
- Ctrl+C, or `--timeout`, aborts the signal: a waiting `askAsync` resolves with `null` and requests made with the signal are cancelled.
  The command then has a grace of 5 seconds for its cleanup, in which requests made with another signal still reach the runtime; it ends with exit code 6, `Stopped`, when its handler settles or the grace passes, whichever comes first, and the command line then closes its connection, which cuts off any request still waiting.
  A second Ctrl+C ends the command at once, without the rest of the grace.
- When the runtime goes away while a command runs, even one that only waits for input or events, the signal aborts too, and the command fails with exit code 1 and the runtime's loss, as a request does when its connection closes.
- A command reaches its module's runtime part only through requests on the command line's connection, and hears from it only through events the runtime sends on that connection.

# Build

**Scope:** The `noldova-desktop-build` command line, `src/noldova.desktop.build`, which builds, starts, packages and releases an app, under the [build rules](../../documents/BUILD.md).

## 1. Purpose

An app on Noldova Desktop installs `@noldova/desktop.build` as a dev dependency and runs its bin, `noldova-desktop-build`, in the app's own folder.
It reads the app's identity, version and module list from the `desktop` section of the app's root `package.json`, as [BUILD.md](../../documents/BUILD.md#an-apps-inputs) says, and needs nothing else from the app's repository.
Noldova Desktop builds itself with the same package, run from its source.

## 2. Use in an app

An app installs the package and Electron at the exact versions its Noldova Desktop version pins, and names the commands in its own scripts:

```json
{
  "scripts": {
    "install:app": "noldova-desktop-build install",
    "build": "noldova-desktop-build build",
    "start": "noldova-desktop-build start",
    "package": "noldova-desktop-build package",
    "package:smoke": "noldova-desktop-build package-smoke",
    "release:check": "noldova-desktop-build release-check",
    "release:assets": "noldova-desktop-build release-assets",
    "release:publish": "noldova-desktop-build release-publish"
  }
}
```

An app's `src/` holds only package folders, and one of them is its window app, the folder whose name ends in `.window.app`, with its `angular.json`, its `package.json`, its TypeScript configuration and its `src/`.
The app's root `package.json` names the window app among its `workspaces`, so the app has one lockfile and one `node_modules`, at its root.
The window app's `package.json` names `@noldova/desktop.window` and `@noldova/ui.components.angular` at those versions and each Angular package the window package peers on, at the exact version it names, and Playwright only when an `angular.json` has a test target, as [BUILD.md](../../documents/BUILD.md#the-build-package) says.
The whole app, its build included, uses one TypeScript, the version the package pins, which Angular's compiler also takes.

## 3. Commands

| Command | What it does |
|---|---|
| `install` | Installs the app from its root lockfile with `npm ci`, when the lockfile changed since its last install, and the browser for the Angular tests when an `angular.json` has a test target. It is the only command that needs the registry's token. |
| `build [--test [--without <module id>]... \| --packaged] [--output <folder> [--update-feed <URL>]]` | Builds the app's packages and modules, writes `_build/product.json` and the generated window sources, and builds the window. `--test` adds the fixture modules and `--packaged` builds what a package ships; either may write to its own `--output` folder, with a test update feed. |
| `build --list-copies` | Builds nothing and prints each file the build copies unchanged into a package that its `files` keep in the archive, one line for each: its source's path from the app's folder, the package's name and its path inside the package, separated by tabs, then `end of copies`, also when it copies nothing. |
| `start [<argument>...]` | Starts the development app on the build, passing the arguments to its main process. |
| `desktop-tools <command> [<option>...]` | Runs the app's command line on the development app. |
| `package [--signed] [--update-feed <URL>]` | Packages the app for the machine's own platform and processor; `--signed` signs it with the credentials in the environment. |
| `package-smoke [--remove-leftover \| --running-app \| --require-sandbox \| --no-sandbox \| --pkg]` | On Windows first removes what an earlier run left installed, its install folder and its command's entry on the user's Path, then installs the package just made, checks that its cookie encryption is on exactly when a module declares web views and that its product file's Windows publisher is `WINDOWS_PUBLISHER`, or none when that is not set, starts it on data and device folders of its own, and checks its build, its version, its command and that it quits. With `--remove-leftover` it only removes such a leftover, for a step that runs after a failed or cancelled smoke. With `--running-app`, on Windows alone, it installs, starts the app and another program in its folder, and checks that installing again ends them and succeeds; when `NOLDOVA_SMOKE_OTHER_USER` names a local account, whose password is in `NOLDOVA_SMOKE_OTHER_PASSWORD`, it then starts the app's program as that account and checks the outcome the smoke's rights call for: with `SeDebugPrivilege` enabled, the installer ends it and installs; without it, it refuses and leaves it running. On Linux it also checks Chromium's sandbox in the started app's processes: on, with every renderer under a seccomp filter, where the AppImage launcher's probe `unshare -Ur true` succeeds, and off, with `--no-sandbox`, where it fails; `--require-sandbox` skips the probe and requires the sandbox on in the started app's processes, and `--no-sandbox` starts the app without the sandbox and requires it off. On macOS, for an app that names an install folder, `--pkg` instead checks that the installer package installs into `/Applications/<folder>`, installs it beside a placeholder app with `sudo`, smokes the installed app, checks the placeholder is untouched, and removes both and the package's receipt. |
| `list-targets [<app folder>]` | Prints the release's targets and the runners each builds on, from the organization's variables; with the app's folder, only the x64 targets it builds, Linux and Windows x64 and those its `desktop.supportedTargets` lists, or every x64 target when it has no such field. |
| `release-check` | Checks that a release may start: its version is the root manifest's and newer than every release, and its revision is on `main` with a passing Build and test run; it says which platforms the release signs. With `RELEASE_SETS_VERSION=true`, for a release that sets its version itself, the version may differ from the root manifest's. With `RELEASE_SOURCE_REPOSITORY` naming another repository than `RELEASE_REPOSITORY`, it reads the revision there and the releases under `RELEASE_TAG_PREFIX` alone. With `RELEASE_BUILD_REPOSITORY` naming the repository running the release, another than the source, it first requires the source to be public. |
| `release-assets [--update-feed <URL>]` | Collects a target's packages, checksums and update information for the release; with `--update-feed`, an HTTPS URL or a loopback HTTP URL ending in `/`, for packages that check that feed, in a test of updating or for the internal update feed. |
| `release-publish` | Publishes the release with the files its run built and checked; with `RELEASE_UPDATE_FEED` set, for a test of updating, it publishes nothing, and with `RELEASE_INTERNAL_VERSION` set, for the internal update feed, it checks the files for that version and publishes nothing. |

`build` refuses an app that `install` hasn't installed for its current lockfile, and says to run `install`.
After it installs the packages it builds into the app's `node_modules`, it refuses a second copy of an Angular, Noldova Desktop, context or kit package anywhere in the app's install, an Angular package that a package of the runtime, Electron, the command line, the protocol or the build reaches, and a module's window part that imports by name a package its module's package doesn't list, as [MODULES.md](../../documents/MODULES.md#what-fails-closed) says.
The script that runs `install` takes another name than `install`, such as `install:app`, since npm runs a script named `install` on every `npm install`.

An unknown or missing command prints the usage and exits with code 2.

The package's second bin, `noldova-desktop-release`, runs `list-targets`, `release-check` and `release-publish`, and `choose-feed`, `release-lock`, `release-unlock`, `feed-check`, `module-range` and `noldova-desktop-range`, which only it runs.
`release-lock` takes the release lock of `RELEASE_BUILD_REPOSITORY`, the ref `refs/locks/release`, for the run `RELEASE_LOCK_RUN`, with a commit on `RELEASE_LOCK_REVISION` named `Release lock for run <run id>`; while another run holds it, it tries again every 15 seconds, and takes it over once that run has ended, or at once when the holder is its own run or a commit that names no run.
`release-unlock` removes the ref when it names `RELEASE_LOCK_RUN`, and leaves it otherwise; both need `GH_TOKEN`, with `actions: read` and `contents: write` for `release-lock`.
`choose-feed` takes a release's `INTERNAL_FEED`, `INTERNAL_FEED_URL`, `UPDATE_FEED`, `PACKAGE_VERSION`, `RELEASE_VERSION`, `RUN_NUMBER`, `RUN_ATTEMPT` and `SIGNING`, the platforms `release-check` says it signs, and writes the update feed and the packages' version as the step's `update-feed` and `package-version` outputs, or refuses a release that breaks the internal update feed's rules in [BUILD.md](../../documents/BUILD.md); without `GITHUB_OUTPUT` it refuses to choose.
`feed-check` reads an update feed anonymously, `FEED_URL` or the latest release of `RELEASE_REPOSITORY`, and checks that each target `RELEASE_TARGETS` lists has update information naming `FEED_VERSION`, and that every file it lists is there with its SHA-512 and size; it tries again for up to `FEED_WAIT_SECONDS`, 600 by default, while a target's update information is missing or names another version, or a file it lists is missing, refuses a `FEED_URL` with user info, a query or a fragment without showing it, follows a redirect only within the feed's origin or to GitHub's release asset host, and refuses a file that leads to a web page, such as a sign-in page; it checks nothing when `SKIP_FEED_CHECK` is `true`.
`module-range <module folder>` reads the folder's `module.json`, refuses a `noldovaDesktop` that is missing, of another form than `>=<lowest> <first refused>`, or that doesn't end below the next version that may break modules after its lowest, the next minor below 1.0 and the next major from 1.0, and writes the range and the newest version of `PUBLISHED_VERSIONS`, the JSON `npm view` gives, inside it as the step's `range` and `version` outputs; without `GITHUB_OUTPUT` it refuses to choose.
`noldova-desktop-range <version>` prints the range a module whose lowest Noldova Desktop version is that version writes, such as `>=0.0.72 <0.1.0`.
It loads only Node.js's own modules and the context packages desktop.build takes as peers, core, exceptions, json and text, with collections, which text needs, so a release job runs it as `node package/services/release-command-line.js <command>` from the package's archive, with those unpacked into `node_modules` beside it, each checked against the app's lockfile, without an install; any other command prints its usage and exits with code 2.

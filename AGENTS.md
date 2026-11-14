# Agent instructions

Noldova owns this repository and makes the final decisions.

## Documents

Read the owner before you work on its subject, and change a rule there.

| When you… | Read |
|---|---|
| explain what Noldova Desktop is or who uses it | [README.md](README.md) |
| change the packages or their boundaries, or write code in this repository | [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) |
| change what a module declares, how it is hosted, or what it contributes | [documents/MODULES.md](documents/MODULES.md) |
| offer agent tools from a module, or call them from an app | [documents/TOOLS.md](documents/TOOLS.md) |
| ask the person before an agent acts, or keep or revoke remembered answers | [documents/PERMISSIONS.md](documents/PERMISSIONS.md) |
| show web content in a module's pane, or drive it from its runtime part | [documents/WEB-VIEWS.md](documents/WEB-VIEWS.md) |
| work on the runtime, the local protocol, stored state or the command line | [documents/RUNTIME.md](documents/RUNTIME.md) |
| work on the window, the main process or the tray | [documents/WINDOW.md](documents/WINDOW.md), then the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md` |
| work on an app's build, packaging, publication or updates | [documents/BUILD.md](documents/BUILD.md) |
| write tests or change what the checks cover | [README.md, Checks](README.md#checks) |
| write code, tests, styles, documents or commits | the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md` |
| prepare or run a release | [README.md, Releases](README.md#releases) |

## Work

- Every pull request names the issue it resolves in this repository, such as `Closes #N`, and passes the checks [README.md](README.md#checks) lists.

## Noldova Desktop

- Noldova Desktop names no app and no module; apps and modules live in their own repositories and build on a published version of it ([ARCHITECTURE.md](documents/ARCHITECTURE.md#the-boundary)).
- Noldova Desktop's interface comes from `@noldova/ui.components.angular`, and its foundation packages from the ui-components and context repositories, installed as published versions; never copy, fork or override the kit's files, tokens or styles, and ask for a change through an issue in the ui-components repository.
- Noldova Desktop's public API is everything its packages export, and the module contract in [MODULES.md](documents/MODULES.md) is part of it.
  A change that breaks it gets a new major version, release notes and a migration path for every app and module that uses it.

## Checks

- A PR's CI is its check: "Check / Linked issue" and "All targets" must pass before it merges.
  [README.md, Checks](README.md#checks) says what they cover.

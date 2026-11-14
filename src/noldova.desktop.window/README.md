# Window

**Scope:** The `@noldova/desktop.window` package, `src/noldova.desktop.window`: Noldova Desktop's window, the Angular app that shows the modules' window parts, and what a module's window part builds against, under the [window's rules](../../documents/WINDOW.md).

## 1. Purpose

The package is the window's interface in Angular: the workspace, the mechanisms modules contribute to, such as views, documents, commands, menus, settings and notifications, and the host of the modules' window parts.
It runs in the app's sandboxed renderer and reaches the runtime only through the main process's preload bridge.
It takes its parts from `@noldova/ui.components.angular` and its foundation from context's core, exceptions and JSON packages.

## 2. Install

The package ships its code compiled by the Angular compiler, and takes Angular, context, the kit and `@noldova/desktop.protocol` as peers, so an app holds one copy of each.
Whatever installs it also names each Angular package it peers on, `@angular/cdk`, `@angular/common`, `@angular/core` and `@angular/platform-browser`, at the exact version it names, as [MODULES.md](../../documents/MODULES.md#modules-from-packages) says.

- **An app** names it in its window app's `package.json`, the folder under `src/` whose name ends in `.window.app`, at the version of its other Noldova Desktop packages, with the kit at one exact version inside the package's peer range, as [BUILD.md](../../documents/BUILD.md#the-build-package) says.
- **A module's window part** names it, with Angular and the kit, as an optional peer of the window part's own package, as [MODULES.md](../../documents/MODULES.md#modules-from-packages) says.

## 3. Entries

| Entry | What it holds | Who imports it |
|---|---|---|
| `@noldova/desktop.window` | The window-part contract: `IWindowPart`, `IWindowPartContext` and what a part registers through it, such as `ViewContribution`, `DocumentContribution`, `CommandContribution` and `SettingsRow`. | A module's window part. |
| `@noldova/desktop.window/build` | `WindowApplication`, which starts the window, and `IWindowInputs` and `WindowPartSource`, the inputs the app's build generates for it. | The window app's entry, through the source the build generates. |
| `@noldova/desktop.window/testing` | `FakeWindowPartContext`, with `FakeWindowWebViews` and `FakeWindowSecrets`, the fakes of what the window hands a window part. | A module's window-part tests. |

The testing entry is the only way to the fakes, so an app's bundle never takes them.

## 4. Use in an app

The window app's entry, its `src/main.ts`, starts the window once with what the app's build generates:

```ts
import { WindowApplication } from "@noldova/desktop.window/build";

import { gallery } from "../../../_build/generated/gallery";
import { productAbout, productName } from "../../../_build/generated/product";
import { moduleMenus, windowPartSources } from "../../../_build/generated/window-parts";

await WindowApplication.startAsync({ productName, about: productAbout, windowParts: windowPartSources, menus: moduleMenus, gallery });
```

`startAsync` rejects an empty or blank product name before it names the page.

## 5. Use in a window part

A module's package exports its window part at `<package name>/window` as `windowPart`, an `IWindowPart`, which the window activates with the module's `IWindowPartContext`:

```ts
import { DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";

import { NotesPanelComponent } from "./notes-panel.component.js";

class NotesWindowPart implements IWindowPart {
  public readonly moduleId: string = "notes";

  public activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("notes.panel", "Notes", "note", DockSide.Left, true, () => Promise.resolve(NotesPanelComponent)));
    return Promise.resolve();
  }

  public reconnectAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public deactivateAsync(): Promise<void> {
    return Promise.resolve();
  }
}

export const windowPart: IWindowPart = new NotesWindowPart();
```

A window part's tests take `FakeWindowPartContext` from `@noldova/desktop.window/testing`, as [MODULES.md](../../documents/MODULES.md#testing-a-module) says.

## 6. Documents

- [WINDOW.md](../../documents/WINDOW.md): the window, its boundary with the main process, the workspace, keys, menus, search, Settings, notifications and closing.
- [MODULES.md](../../documents/MODULES.md): what a module declares and contributes, and the versions its window part names.
- [WEB-VIEWS.md](../../documents/WEB-VIEWS.md): web content in a module's pane.
- [BUILD.md](../../documents/BUILD.md): the window app, and how an app's build starts the window.

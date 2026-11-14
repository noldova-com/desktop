/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ApplicationRef, EnvironmentProviders, Type } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import type { IWindowPart } from "@noldova/desktop.window";

/**
 * What an app tells about itself in About, each value null when the app
 * gives none.
 */
export interface IProductAbout {
  /**
   * One line that says what the app is, shown under its name, or null.
   */
  readonly description: string | null;

  /**
   * The app's website, an https address that About links to by its host, or
   * null.
   */
  readonly website: string | null;

  /**
   * Where the app's releases are, an https address that About links to as
   * Releases, or null.
   */
  readonly releases: string | null;

  /**
   * What About says under Licenses, with its line breaks kept, or null.
   */
  readonly licenses: string | null;

  /**
   * The app's icons that About shows left of its name, which the build puts
   * beside the window's files, or null for an app without its
   * `icon-dark-512.png`.
   */
  readonly logo: IProductLogo | null;
}

/**
 * Where About finds the app's icon for each mode, relative to the window's
 * page.
 */
export interface IProductLogo {
  /**
   * The icon drawn dark, shown in light mode: the icons folder's
   * `icon-light-512.png`, or its `icon-dark-512.png` without it.
   */
  readonly light: string;

  /**
   * The icon drawn light, shown in dark mode: the icons folder's
   * `icon-dark-512.png`.
   */
  readonly dark: string;
}

/**
 * What an app's build gives the window when it starts it: what the build
 * generates from the app and its modules, which the window package itself
 * doesn't hold.
 */
export interface IWindowInputs {
  /**
   * The product's name, which the page's title, the app menu and the
   * window's messages show.
   */
  readonly productName: string;

  /**
   * What About shows of the app beside its name, from the app's
   * `desktop.product.about`, which the build writes as `productAbout`; About
   * shows none of it when it is left out.
   */
  readonly about?: IProductAbout;

  /**
   * Where each module with a window part loads it from, in the order the
   * build lists the modules.
   */
  readonly windowParts: readonly WindowPartSource[];

  /**
   * Each module's `menus.json`, by module id, for the modules that declare
   * menus.
   */
  readonly menus: Readonly<Record<string, JsonValue>>;

  /**
   * The component the Settings document shows as the kit's gallery, or null
   * in a build that leaves it out.
   */
  readonly gallery: Type<unknown> | null;

  /**
   * Providers the app's entry adds to the window's root injector, after the
   * window's own, so one of them replaces a window provider of the same
   * token; the window starts with only its own when it is left out. The
   * window gives the kit's `provideTimeFormats` the person's time and date
   * and time formats, so an entry's own replaces them.
   *
   * It is for what only the app's own compiled code can make, such as a web
   * worker, which the application build bundles only from the app's code,
   * never from a package in `node_modules`, and for what a service provided
   * in the root injector reads from it. In the example, the app's
   * `src/code-highlighting.worker.ts`, beside its entry, is the worker.
   *
   * @example
   * ```ts
   * import { WindowApplication } from "@noldova/desktop.window/build";
   * import { provideCodeHighlightingWorker } from "@noldova/ui.components.angular/code-highlighting";
   *
   * await WindowApplication.startAsync({
   *   productName,
   *   windowParts: windowPartSources,
   *   menus: moduleMenus,
   *   gallery,
   *   providers: [provideCodeHighlightingWorker(() => new Worker(new URL("./code-highlighting.worker", import.meta.url), { type: "module" }))]
   * });
   * ```
   */
  readonly providers?: readonly EnvironmentProviders[];
}

/**
 * Starts the window, which an app's entry calls once with its build's inputs.
 */
export declare class WindowApplication {
  /**
   * Names the page after the product and starts the window in the page's
   * `nol-window` element.
   *
   * @param inputs What the app's build generates for the window.
   * @returns The started application; it rejects, before it names the page,
   * when `inputs.productName` is empty or blank.
   * @example
   * ```ts
   * import { type IWindowInputs, WindowApplication } from "@noldova/desktop.window/build";
   *
   * export function startAsync(inputs: IWindowInputs): Promise<unknown> {
   *   return WindowApplication.startAsync(inputs);
   * }
   * ```
   */
  public static startAsync(inputs: IWindowInputs): Promise<ApplicationRef>;
}

/**
 * A Settings page a module declares in its `settings.json`, whose
 * component its window part registers.
 */
export interface ISettingsPageDeclaration {
  /**
   * The page's name, `<id>.<name>`, which `contributes.settingsPages` lists.
   */
  readonly name: string;

  /**
   * The page's title, which the page list, the page select and the page's
   * heading show and searching settings matches.
   */
  readonly title: string;
}

/**
 * Where a module's window part loads from, with the names the module
 * declares for it, which the build generates from the module's
 * `module.json`.
 */
export declare class WindowPartSource {
  /**
   * The module's id.
   */
  public readonly moduleId: string;

  /**
   * The ids of the modules it depends on.
   */
  public readonly dependencies: readonly string[];

  /**
   * The views it declares.
   */
  public readonly viewNames: readonly string[];

  /**
   * The documents it declares.
   */
  public readonly documentNames: readonly string[];

  /**
   * The commands it declares.
   */
  public readonly commandNames: readonly string[];

  /**
   * The status bar items it declares.
   */
  public readonly statusBarItemNames: readonly string[];

  /**
   * The top bar actions it declares.
   */
  public readonly topBarActionNames: readonly string[];

  /**
   * The notification kinds it declares.
   */
  public readonly notificationKinds: readonly string[];

  /**
   * Loads the module's window part.
   */
  public readonly load: () => Promise<IWindowPart>;

  /**
   * The placeholders it declares, at most one.
   */
  public readonly placeholderNames: readonly string[];

  /**
   * The ids of the modules it optionally depends on, which it runs without.
   */
  public readonly optionalDependencies: readonly string[];

  /**
   * The Settings pages it declares, in its `settings.json`'s order.
   */
  public readonly settingsPages: readonly ISettingsPageDeclaration[];

  /**
   * Creates the source of a module's window part.
   *
   * @param moduleId The module's id, lowercase kebab-case.
   * @param dependencies The ids of the modules it depends on.
   * @param viewNames The views it declares.
   * @param documentNames The documents it declares.
   * @param commandNames The commands it declares.
   * @param statusBarItemNames The status bar items it declares.
   * @param topBarActionNames The top bar actions it declares.
   * @param notificationKinds The notification kinds it declares.
   * @param load Loads the module's window part, which the window calls when
   * the module is active.
   * @param placeholderNames The placeholders it declares, at most one; left
   * out, none.
   * @param optionalDependencies The ids of the modules it optionally depends
   * on; left out, none.
   * @param settingsPages The Settings pages it declares; left out, none.
   * @throws ArgumentException synchronously when the id is not lowercase
   * kebab-case.
   * @example
   * ```ts
   * import type { IWindowPart } from "@noldova/desktop.window";
   * import { WindowPartSource } from "@noldova/desktop.window/build";
   *
   * declare const part: IWindowPart;
   *
   * export const clock: WindowPartSource = new WindowPartSource("clock", [], ["clock.face"], [], [], [], [], [], () => Promise.resolve(part));
   * ```
   */
  public constructor(
    moduleId: string,
    dependencies: readonly string[],
    viewNames: readonly string[],
    documentNames: readonly string[],
    commandNames: readonly string[],
    statusBarItemNames: readonly string[],
    topBarActionNames: readonly string[],
    notificationKinds: readonly string[],
    load: () => Promise<IWindowPart>,
    placeholderNames?: readonly string[],
    optionalDependencies?: readonly string[],
    settingsPages?: readonly ISettingsPageDeclaration[]);
}

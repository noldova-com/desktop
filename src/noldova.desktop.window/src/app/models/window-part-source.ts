/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import type { ISettingsPageDeclaration } from "../interfaces/i-settings-page-declaration.js";
import type { IWindowPart } from "../interfaces/i-window-part.js";
import { Resources } from "../../resources.js";

export class WindowPartSource {
  public readonly moduleId: string;
  public readonly dependencies: readonly string[];
  public readonly viewNames: readonly string[];
  public readonly documentNames: readonly string[];
  public readonly commandNames: readonly string[];
  public readonly statusBarItemNames: readonly string[];
  public readonly topBarActionNames: readonly string[];
  public readonly notificationKinds: readonly string[];
  public readonly load: () => Promise<IWindowPart>;
  public readonly placeholderNames: readonly string[];
  public readonly optionalDependencies: readonly string[];
  public readonly settingsPages: readonly ISettingsPageDeclaration[];

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
    placeholderNames: readonly string[] = [],
    optionalDependencies: readonly string[] = [],
    settingsPages: readonly ISettingsPageDeclaration[] = []) {
    if (!Resources.moduleIdPattern.test(moduleId))
      throw new ArgumentException(Resources.invalidModuleId, Resources.moduleIdParameterName);

    this.moduleId = moduleId;
    this.dependencies = [...dependencies];
    this.viewNames = [...viewNames];
    this.documentNames = [...documentNames];
    this.commandNames = [...commandNames];
    this.statusBarItemNames = [...statusBarItemNames];
    this.topBarActionNames = [...topBarActionNames];
    this.notificationKinds = [...notificationKinds];
    this.load = load;
    this.placeholderNames = [...placeholderNames];
    this.optionalDependencies = [...optionalDependencies];
    this.settingsPages = settingsPages.map(t => ({ name: t.name, title: t.title }));
  }
}

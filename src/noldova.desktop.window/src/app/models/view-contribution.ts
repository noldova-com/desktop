/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import { ArgumentException } from "@noldova/context.exceptions";

import type { ContentPadding } from "../enums/content-padding.js";
import type { DockSide } from "../enums/dock-side.js";
import type { IViewOptions } from "../interfaces/i-view-options.js";
import { Resources } from "../../resources.js";

export class ViewContribution {
  public readonly name: string;
  public readonly title: string;
  public readonly icon: string;
  public readonly defaultSide: DockSide;
  public readonly isShownByDefault: boolean;
  public readonly loadComponent: () => Promise<Type<unknown>>;
  public readonly padding: ContentPadding | null;
  public readonly hasInstances: boolean;
  public readonly tabRowPlace: string | null;
  public readonly isRenamable: boolean;

  public constructor(name: string, title: string, icon: string, defaultSide: DockSide, isShownByDefault: boolean, loadComponent: () => Promise<Type<unknown>>,
    padding?: ContentPadding, options: IViewOptions = {}) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, Resources.nameParameterName);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameterName);
    ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameterName);
    if (!Object.isUndefined(options.tabRowPlace) && !Resources.contributionNamePattern.test(options.tabRowPlace))
      throw new ArgumentException(Resources.invalidContributionName, Resources.optionsParameterName);
    if (options.isRenamable === true && options.hasInstances !== true)
      throw new ArgumentException(Resources.renamableViewWithoutInstances, Resources.optionsParameterName);

    this.name = name;
    this.title = title;
    this.icon = icon;
    this.defaultSide = defaultSide;
    this.isShownByDefault = isShownByDefault;
    this.loadComponent = loadComponent;
    this.padding = padding ?? null;
    this.hasInstances = options.hasInstances === true;
    this.tabRowPlace = options.tabRowPlace ?? null;
    this.isRenamable = options.isRenamable === true;
  }
}

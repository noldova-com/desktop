/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../../resources.js";
import type { DockSide } from "../../enums/dock-side.js";

export class ViewType {
  public readonly name: string;
  public readonly defaultSide: DockSide;
  public readonly isShownByDefault: boolean;
  public readonly hasInstances: boolean;
  public readonly tabRowPlace: string | null;
  public readonly isRenamable: boolean;

  public constructor(name: string, defaultSide: DockSide, isShownByDefault: boolean, hasInstances: boolean = false, tabRowPlace: string | null = null,
    isRenamable: boolean = false) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, Resources.nameParameterName);

    this.name = name;
    this.defaultSide = defaultSide;
    this.isShownByDefault = isShownByDefault && !hasInstances;
    this.hasInstances = hasInstances;
    this.tabRowPlace = tabRowPlace;
    this.isRenamable = isRenamable && hasInstances;
  }
}

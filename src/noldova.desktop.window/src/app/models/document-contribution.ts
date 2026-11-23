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
import type { IDocumentContributionOptions } from "../interfaces/i-document-contribution-options.js";
import { Resources } from "../../resources.js";

export class DocumentContribution {
  public readonly name: string;
  public readonly loadComponent: () => Promise<Type<unknown>>;
  public readonly padding: ContentPadding | null;
  public readonly tabRowPlace: string | null;
  public readonly isRenamable: boolean;
  public readonly preferredWidth: number | null;

  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>, padding?: ContentPadding, options: IDocumentContributionOptions = {}) {
    if (!Resources.contributionNamePattern.test(name))
      throw new ArgumentException(Resources.invalidContributionName, Resources.nameParameterName);
    if (!Object.isUndefined(options.tabRowPlace) && !Resources.contributionNamePattern.test(options.tabRowPlace))
      throw new ArgumentException(Resources.invalidContributionName, Resources.optionsParameterName);
    if (!Object.isUndefined(options.preferredWidth) && !(Number.isFinite(options.preferredWidth) && options.preferredWidth > 0))
      throw new ArgumentException(Resources.invalidPreferredWidth, Resources.optionsParameterName);

    this.name = name;
    this.loadComponent = loadComponent;
    this.padding = padding ?? null;
    this.tabRowPlace = options.tabRowPlace ?? null;
    this.isRenamable = options.isRenamable === true;
    this.preferredWidth = options.preferredWidth ?? null;
  }
}

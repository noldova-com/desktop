/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../../resources.js";

export class SettingsRow {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string | null;

  public constructor(id: string, title: string, description: string | null = null) {
    if (!Resources.contributionNamePattern.test(id))
      throw new ArgumentException(Resources.invalidContributionName, Resources.idParameter);
    if (String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.settingsRowTitleInvalid, Resources.titleParameter);

    this.id = id;
    this.title = title;
    this.description = description;
  }
}

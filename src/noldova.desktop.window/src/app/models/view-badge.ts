/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";

export class ViewBadge {
  public readonly count: number | null;
  public readonly description: string;

  public constructor(count: number | null, description: string) {
    if (!Object.isNull(count) && (!Number.isSafeInteger(count) || count < 1))
      throw new ArgumentException(Resources.badgeCountInvalid, Resources.countParameter);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionParameter);

    this.count = count;
    this.description = description;
  }
}

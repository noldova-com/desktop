/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { IconName } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";

export class TabLabel {
  public readonly title: string;
  public readonly icon: IconName;

  public constructor(title: string, icon: IconName) {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameterName);

    this.title = title;
    this.icon = icon;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Resources } from "../../../resources.js";

export class TabLabel {
  public readonly title: string;
  public readonly icon: string;

  public constructor(title: string, icon: string) {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameterName);
    ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameterName);

    this.title = title;
    this.icon = icon;
  }
}

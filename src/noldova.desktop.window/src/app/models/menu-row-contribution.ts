/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";

export class MenuRowContribution {
  public readonly command: string;
  public readonly commandArguments: JsonObject;
  public readonly label: string | null;
  public readonly icon: string | null;

  public constructor(command: string, commandArguments: JsonObject = {}, label: string | null = null, icon: string | null = null) {
    if (!Object.isNull(label))
      ArgumentException.throwIfNullOrWhitespace(label, Resources.labelParameter);
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);

    this.command = QualifiedName.parse(command, Resources.commandParameter).text;
    this.commandArguments = { ...commandArguments };
    this.label = label;
    this.icon = icon;
  }
}

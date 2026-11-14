/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { QualifiedName } from "@noldova/desktop.protocol";

import type { ITopBarActionOptions } from "../interfaces/i-top-bar-action-options.js";
import { Resources } from "../../resources.js";

export class TopBarActionState {
  public readonly icon: string;
  public readonly title: string;
  public readonly command: string;
  public readonly commandArguments: JsonValue;
  public readonly isHidden: boolean;

  public constructor(icon: string, title: string, command: string, options: ITopBarActionOptions = {}) {
    ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);

    this.icon = icon;
    this.title = title;
    this.command = QualifiedName.parse(command, Resources.commandParameter).text;
    this.commandArguments = options.commandArguments ?? null;
    this.isHidden = options.isHidden ?? false;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class PlaceholderShownException extends WindowPartAccessException {
  public override readonly name: string = "PlaceholderShownException";
  public readonly placeholder: string;
  public readonly registered: string;

  public constructor(moduleId: string, placeholder: string, registered: string) {
    super(Resources.formatPlaceholderRegistered(placeholder, registered), moduleId);

    this.placeholder = placeholder;
    this.registered = registered;
  }
}

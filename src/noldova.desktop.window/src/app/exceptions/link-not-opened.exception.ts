/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowException } from "./window.exception.js";

export class LinkNotOpenedException extends WindowException {
  public override readonly name: string = "LinkNotOpenedException";

  public constructor(productName: string) {
    super(Resources.formatLinkNotOpened(productName));
  }
}

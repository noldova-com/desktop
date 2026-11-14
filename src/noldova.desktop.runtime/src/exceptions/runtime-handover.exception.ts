/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RuntimeHandover } from "@noldova/desktop.protocol";

import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class RuntimeHandoverException extends RuntimeException {
  public readonly handover: RuntimeHandover;

  public constructor(handover: RuntimeHandover) {
    super(Resources.formatHandover(ProductInfo.current.name, handover.identity.productVersion, handover.executablePath));

    this.handover = handover;
  }
}

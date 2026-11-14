/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PreShellData } from "@noldova/desktop.protocol";

import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class PreShellDataFoundException extends RuntimeException {
  public readonly data: PreShellData;

  public constructor(data: PreShellData) {
    super(Resources.formatPreShellFound(ProductInfo.current.name, data.location));

    this.data = data;
  }
}

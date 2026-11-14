/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class DataDirectoryOwnedException extends RuntimeException {
  public readonly root: string;

  public constructor(root: string, options?: ExceptionOptions) {
    super(Resources.formatOwned(ProductInfo.current.name, root), options);

    this.root = root;
  }
}

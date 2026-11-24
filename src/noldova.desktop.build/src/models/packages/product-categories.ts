/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class ProductCategories {
  public static readonly DEFAULT: ProductCategories = new ProductCategories(Resources.productDefaultMacCategory, Resources.productDefaultLinuxCategory);

  public readonly macos: string;
  public readonly linux: string;

  public constructor(macos: string, linux: string) {
    this.macos = macos;
    this.linux = linux;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProductTitleBar {
  public static readonly NONE: ProductTitleBar = new ProductTitleBar(null, null);

  public readonly name: string | null;
  public readonly icon: string | null;

  public constructor(name: string | null, icon: string | null) {
    this.name = name;
    this.icon = icon;
  }
}

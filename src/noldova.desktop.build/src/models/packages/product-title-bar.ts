/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProductTitleBar {
  public static readonly NONE: ProductTitleBar = new ProductTitleBar(null, null, false);

  public readonly name: string | null;
  public readonly icon: string | null;
  public readonly isDocumentTabs: boolean;

  public constructor(name: string | null, icon: string | null, isDocumentTabs: boolean) {
    this.name = name;
    this.icon = icon;
    this.isDocumentTabs = isDocumentTabs;
  }
}

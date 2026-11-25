/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProductTrayItem {
  public static readonly SEPARATOR: ProductTrayItem = new ProductTrayItem(null, true, null, null, null, null, null);

  public readonly item: string | null;
  public readonly isSeparator: boolean;
  public readonly text: string | null;
  public readonly toggledText: string | null;
  public readonly command: string | null;
  public readonly icon: string | null;
  public readonly iconDark: string | null;

  public constructor(item: string | null, isSeparator: boolean, text: string | null, toggledText: string | null, command: string | null, icon: string | null, iconDark: string | null) {
    this.item = item;
    this.isSeparator = isSeparator;
    this.text = text;
    this.toggledText = toggledText;
    this.command = command;
    this.icon = icon;
    this.iconDark = iconDark;
  }
}

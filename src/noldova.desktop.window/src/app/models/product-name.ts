/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ProductName {
  private static value: string = String.empty;

  public static get current(): string {
    return ProductName.value;
  }

  public static use(name: string): void {
    ProductName.value = name;
  }
}

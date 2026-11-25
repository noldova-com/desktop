/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LockedPackage } from "./locked-package.ts";

export class CollectedClosure {
  public readonly shipped: readonly LockedPackage[];
  public readonly leftOut: ReadonlyMap<string, readonly string[]>;

  public constructor(shipped: readonly LockedPackage[], leftOut: ReadonlyMap<string, readonly string[]>) {
    this.shipped = shipped;
    this.leftOut = leftOut;
  }
}

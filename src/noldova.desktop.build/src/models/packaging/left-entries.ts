/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LeftEntries {
  public readonly names: readonly string[];
  public readonly holders: string | null;

  public constructor(names: readonly string[], holders: string | null) {
    this.names = names;
    this.holders = holders;
  }
}

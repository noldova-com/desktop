/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DeclaredPackages {
  public readonly section: string;
  public readonly ids: readonly string[];

  public constructor(section: string, ids: readonly string[]) {
    this.section = section;
    this.ids = ids;
  }
}

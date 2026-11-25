/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ModuleSourceFixture {
  public readonly id: string;
  public readonly source: string | null;

  public constructor(id: string, source: string | null) {
    this.id = id;
    this.source = source;
  }
}

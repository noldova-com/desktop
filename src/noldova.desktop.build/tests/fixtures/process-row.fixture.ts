/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessRowFixture {
  public readonly id: number;
  public readonly parent: number;
  public readonly line: string;

  public constructor(id: number, parent: number, line: string) {
    this.id = id;
    this.parent = parent;
    this.line = line;
  }
}

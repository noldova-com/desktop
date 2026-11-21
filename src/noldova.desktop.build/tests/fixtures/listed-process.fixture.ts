/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ListedProcessFixture {
  public readonly id: number;
  public readonly parent: number;
  public readonly time: number;

  public constructor(id: number, parent: number, time: number) {
    this.id = id;
    this.parent = parent;
    this.time = time;
  }
}

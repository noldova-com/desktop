/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OpenedHandleFixture {
  public readonly processId: number;
  public readonly access: number;

  public constructor(processId: number, access: number) {
    this.processId = processId;
    this.access = access;
  }
}

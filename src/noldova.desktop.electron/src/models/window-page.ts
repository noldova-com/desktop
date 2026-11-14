/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WindowPage {
  private readonly controller: AbortController = new AbortController();

  public readonly id: string | null;
  public readonly serial: number;

  public constructor(id: string | null, serial: number) {
    this.id = id;
    this.serial = serial;
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public end(): void {
    this.controller.abort();
  }
}

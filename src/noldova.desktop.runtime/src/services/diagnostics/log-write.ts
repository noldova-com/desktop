/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LogWrite {
  public readonly text: Buffer;
  public readonly from: number;

  public constructor(text: Buffer, from: number) {
    this.text = text;
    this.from = from;
  }
}

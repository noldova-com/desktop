/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TarFile {
  public readonly name: string;
  public readonly type: string;
  public readonly content: Buffer;
  public readonly mode: number;

  public constructor(name: string, type: string, content: Buffer, mode: number) {
    this.name = name;
    this.type = type;
    this.content = content;
    this.mode = mode;
  }
}

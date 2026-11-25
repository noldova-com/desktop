/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FetchedArchive {
  public readonly file: string;
  public readonly data: Buffer;

  public constructor(file: string, data: Buffer) {
    this.file = file;
    this.data = data;
  }
}

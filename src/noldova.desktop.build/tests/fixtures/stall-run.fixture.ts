/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StallRunFixture {
  public readonly folder: string;
  public readonly lines: readonly string[];

  public constructor(folder: string, lines: readonly string[]) {
    this.folder = folder;
    this.lines = lines;
  }
}

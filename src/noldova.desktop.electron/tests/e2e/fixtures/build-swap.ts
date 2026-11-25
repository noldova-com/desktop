/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BuildSwap {
  public readonly built: string;
  public readonly kept: string;
  public readonly source: string;

  public constructor(built: string, kept: string, source: string) {
    this.built = built;
    this.kept = kept;
    this.source = source;
  }
}

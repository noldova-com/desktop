/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IssuedFileGrant } from "./issued-file-grant.js";

export class IssuedFileGrants {
  public static readonly none: IssuedFileGrants = new IssuedFileGrants([], []);

  public readonly files: readonly IssuedFileGrant[];
  public readonly refused: readonly string[];

  public constructor(files: readonly IssuedFileGrant[], refused: readonly string[]) {
    this.files = files;
    this.refused = refused;
  }
}

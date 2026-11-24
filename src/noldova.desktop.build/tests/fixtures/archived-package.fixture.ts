/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ArchivedPackageFixture {
  public readonly name: string;
  public readonly version: string;

  public constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }
}

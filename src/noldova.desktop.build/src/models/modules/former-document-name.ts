/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FormerDocumentName {
  public readonly former: string;
  public readonly name: string;

  public constructor(former: string, name: string) {
    this.former = former;
    this.name = name;
  }

  public toJson(): readonly string[] {
    return [this.former, this.name];
  }
}

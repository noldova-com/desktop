/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class FixtureFolderOwnedException extends RuntimeException {
  public readonly dataRoot: string;
  public readonly keptFolder: string;

  public constructor(dataRoot: string, keptFolder: string) {
    super(`A process the fixture did not start owns ${dataRoot}, so ${keptFolder} was kept.`);

    this.dataRoot = dataRoot;
    this.keptFolder = keptFolder;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

export class ModuleLogFixture implements IModuleLog {
  public readonly lines: string[] = [];

  public write(message: string): void {
    this.lines.push(message);
  }
}

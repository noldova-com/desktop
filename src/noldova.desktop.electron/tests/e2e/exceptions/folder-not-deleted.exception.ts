/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { ElectronException } from "@noldova/desktop.electron";

export class FolderNotDeletedException extends ElectronException {
  public readonly folder: string;

  public constructor(folder: string, cause: unknown) {
    super(`Deleting ${folder} failed, so the next UI run's set-up tries again: ${cause instanceof Error ? cause.message : String(cause)}`, new ExceptionOptions(cause));

    this.folder = folder;
  }
}

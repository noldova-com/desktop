/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class AppImageFolderUnwritableException extends UpdateHandoffException {
  public readonly folder: string;

  public constructor(folder: string, cause: unknown) {
    super(Resources.formatAppImageFolderUnwritable(folder, String(cause)), new ExceptionOptions(cause));

    this.folder = folder;
  }
}

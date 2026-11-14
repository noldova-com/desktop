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

export class DebianPackageNotInstalledException extends UpdateHandoffException {
  public readonly file: string;

  public constructor(file: string, cause: unknown) {
    super(Resources.formatDebianPackageNotInstalled(file, String(cause)), new ExceptionOptions(cause));

    this.file = file;
  }
}

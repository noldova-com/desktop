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

export class InstallerNotStartedException extends UpdateHandoffException {
  public readonly installer: string;

  public constructor(installer: string, cause: unknown) {
    super(Resources.formatInstallerNotStarted(installer, String(cause)), new ExceptionOptions(cause));

    this.installer = installer;
  }
}

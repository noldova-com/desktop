/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class InstallerUnsignedException extends UpdateHandoffException {
  public readonly installer: string;
  public readonly problem: string;

  public constructor(installer: string, problem: string) {
    super(Resources.formatInstallerUnsigned(installer, problem));

    this.installer = installer;
    this.problem = problem;
  }
}

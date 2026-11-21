/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class DebianUpdateArgumentsRefusedException extends UpdateHandoffException {
  public readonly file: string;

  public constructor(file: string) {
    super(Resources.formatDebianUpdateArgumentsRefused(file));

    this.file = file;
  }
}

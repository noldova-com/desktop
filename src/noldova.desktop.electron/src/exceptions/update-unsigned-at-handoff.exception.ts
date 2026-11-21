/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class UpdateUnsignedAtHandoffException extends UpdateHandoffException {
  public readonly file: string;
  public readonly problem: string;

  public constructor(file: string, problem: string) {
    super(Resources.formatUpdateUnsignedAtHandoff(file, problem));

    this.file = file;
    this.problem = problem;
  }
}

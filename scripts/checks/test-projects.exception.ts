/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ScriptException } from "../script.exception.ts";

export class TestProjectsException extends ScriptException {
  public readonly projectArguments: readonly string[];

  public constructor(projectArguments: readonly string[]) {
    super(Resources.serialTestPairRequired);

    this.projectArguments = projectArguments;
  }
}

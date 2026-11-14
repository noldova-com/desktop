/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ScriptException } from "./script.exception.ts";
import { TestOptionsProblem } from "./test-options-problem.ts";

export class TestOptionsException extends ScriptException {
  public readonly problem: TestOptionsProblem;
  public readonly argument: string | undefined;

  public constructor(problem: TestOptionsProblem, argument: string | undefined) {
    super(problem.format(argument));

    this.problem = problem;
    this.argument = argument;
  }
}

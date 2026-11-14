/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { ScriptException } from "../script.exception.ts";

export class TestFiltersException extends ScriptException {
  public readonly text: string | undefined;

  public constructor(text: string | undefined, cause?: unknown) {
    super(Resources.serialTestFiltersInvalid, new ExceptionOptions(cause));

    this.text = text;
  }
}

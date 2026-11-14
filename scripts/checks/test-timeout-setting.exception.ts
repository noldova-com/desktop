/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ScriptException } from "../script.exception.ts";

export class TestTimeoutSettingException extends ScriptException {
  public readonly text: string;

  public constructor(text: string) {
    super(Resources.serialTestTimeoutInvalid);

    this.text = text;
  }
}

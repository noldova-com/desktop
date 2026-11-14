/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ConnectionException } from "./connection.exception.js";

export class CallUnansweredException extends ConnectionException {
  public readonly method: string;

  public constructor(method: string) {
    super(Resources.formatNoAnswer(method), null);

    this.method = method;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { ConnectionException } from "./connection.exception.js";

export class RuntimeUnreachableException extends ConnectionException {
  public readonly endpoint: string;

  public constructor(endpoint: string, options?: ExceptionOptions) {
    super(Resources.formatUnreachable(endpoint), null, options);

    this.endpoint = endpoint;
  }
}

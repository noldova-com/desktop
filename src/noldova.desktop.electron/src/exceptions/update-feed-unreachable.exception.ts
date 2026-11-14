/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UpdateException } from "./update.exception.js";

export class UpdateFeedUnreachableException extends UpdateException {
  public constructor(options?: ExceptionOptions) {
    super(Resources.updateFeedUnreachable, options);
  }
}

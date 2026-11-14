/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { DeclarationsFormatException } from "./declarations-format.exception.js";

export class DeclarationNotObjectException extends DeclarationsFormatException {
  public constructor(options?: ExceptionOptions) {
    super(Resources.declarationNotObject, options);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class ArgumentRequiredException extends UsageException {
  public readonly placeholder: string;

  public constructor(placeholder: string) {
    super(Resources.formatArgumentRequired(placeholder));

    this.placeholder = placeholder;
  }
}

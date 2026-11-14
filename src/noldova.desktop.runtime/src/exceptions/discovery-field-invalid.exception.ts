/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { DiscoveryFormatException } from "./discovery-format.exception.js";

export class DiscoveryFieldInvalidException extends DiscoveryFormatException {
  public readonly field: string;

  public constructor(field: string, options?: ExceptionOptions) {
    super(Resources.formatDiscoveryField(field), options);

    this.field = field;
  }
}

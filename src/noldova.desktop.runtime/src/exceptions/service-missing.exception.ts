/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { ServiceAccessException } from "./service-access.exception.js";

export class ServiceMissingException extends ServiceAccessException {
  public readonly service: string;

  public constructor(service: string, options?: ExceptionOptions) {
    super(Resources.formatServiceMissing(service), options);

    this.service = service;
  }
}

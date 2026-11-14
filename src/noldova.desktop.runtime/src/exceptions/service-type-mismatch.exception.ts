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

export class ServiceTypeMismatchException extends ServiceAccessException {
  public readonly service: string;
  public readonly type: string;

  public constructor(service: string, type: string, options?: ExceptionOptions) {
    super(Resources.formatServiceType(service, type), options);

    this.service = service;
    this.type = type;
  }
}

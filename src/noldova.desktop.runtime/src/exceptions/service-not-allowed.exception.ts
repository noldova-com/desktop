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

export class ServiceNotAllowedException extends ServiceAccessException {
  public readonly moduleId: string;
  public readonly service: string;

  public constructor(moduleId: string, service: string, options?: ExceptionOptions) {
    super(Resources.formatServiceNotAllowed(moduleId, service), options);

    this.moduleId = moduleId;
    this.service = service;
  }
}

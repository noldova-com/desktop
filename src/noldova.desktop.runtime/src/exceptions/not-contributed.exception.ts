/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RegistrationException } from "./registration.exception.js";

export class NotContributedException extends RegistrationException {
  public readonly moduleId: string;
  public readonly kind: string;
  public readonly contribution: string;

  public constructor(moduleId: string, kind: string, contribution: string, options?: ExceptionOptions) {
    super(Resources.formatNotContributed(moduleId, kind, contribution), options);

    this.moduleId = moduleId;
    this.kind = kind;
    this.contribution = contribution;
  }
}

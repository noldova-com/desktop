/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class MigrationException extends RuntimeException {
  public readonly migrationId: string;

  public constructor(database: string, migrationId: string, options?: ExceptionOptions) {
    super(Resources.formatMigrationFailed(database, migrationId), options);

    this.migrationId = migrationId;
  }
}

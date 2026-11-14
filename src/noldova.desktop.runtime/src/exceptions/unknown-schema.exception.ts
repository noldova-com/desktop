/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UnknownSchemaFailure } from "../enums/unknown-schema-failure.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class UnknownSchemaException extends RuntimeException {
  public readonly reason: UnknownSchemaFailure;
  public readonly database: string;

  public constructor(reason: UnknownSchemaFailure, database: string) {
    super(UnknownSchemaException.describe(reason, database));

    this.reason = reason;
    this.database = database;
  }

  private static describe(reason: UnknownSchemaFailure, database: string): string {
    switch (reason) {
      case UnknownSchemaFailure.TablesWithoutHistory:
        return Resources.formatTablesWithoutHistory(database);
      case UnknownSchemaFailure.HistoryNewer:
        return Resources.formatHistoryNewer(database);
      default:
        return Resources.formatHistoryNotRecognized(database);
    }
  }
}

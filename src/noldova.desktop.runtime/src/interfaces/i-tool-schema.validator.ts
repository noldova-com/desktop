/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonObject } from "@noldova/context.json";

export interface IToolSchemaValidator {
  checkSchema(schema: JsonObject, parameterName: string): void;
  findProblem(schema: JsonObject, value: JsonObject): string | null;
}

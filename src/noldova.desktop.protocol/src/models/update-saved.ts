/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class UpdateSaved {
  private static readonly FIELDS: readonly string[] = [Resources.processIdField, Resources.problemsField];

  public readonly processId: number;
  public readonly problems: readonly string[];

  public constructor(processId: number, problems: readonly string[]) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdField);
    if (problems.length > Resources.maximumUpdateProblems)
      throw new ArgumentOutOfRangeException(Resources.problemsField, problems.length);
    for (const problem of problems) {
      ArgumentException.throwIfNullOrWhitespace(problem, Resources.problemsField);
      if (problem.length > Resources.maximumUpdateProblemLength)
        throw new ArgumentOutOfRangeException(Resources.problemsField, problem.length);
    }

    this.processId = processId;
    this.problems = [...problems];
  }

  public static fromJson(value: unknown, path?: string): UpdateSaved {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, UpdateSaved.FIELDS);
    return WireContract.create(reader, () => new UpdateSaved(reader.readInteger(Resources.processIdField), reader.readStringArray(Resources.problemsField)));
  }

  public toJson(): JsonObject {
    return { [Resources.processIdField]: this.processId, [Resources.problemsField]: [...this.problems] };
  }
}

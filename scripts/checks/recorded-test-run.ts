/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FailedTest } from "./failed-test.ts";

export class RecordedTestRun {
  public readonly isComplete: boolean;
  public readonly failed: readonly FailedTest[];
  public readonly runFailures: readonly string[];

  public constructor(isComplete: boolean, failed: readonly FailedTest[], runFailures: readonly string[]) {
    this.isComplete = isComplete;
    this.failed = failed;
    this.runFailures = runFailures;
  }

  public get isRerunnable(): boolean {
    return this.isComplete && this.failed.length > 0 && this.runFailures.length === 0;
  }

  public static parse(text: string): RecordedTestRun {
    const results = JsonReader.parse(text);
    return new RecordedTestRun(
      results.readBoolean(Resources.testResultsIsCompleteField),
      results.readObjectArray(Resources.testResultsFailedField)
        .map(t => new FailedTest(t.readString(Resources.testResultsIdentityField), t.readString(Resources.fileField), t.readString(Resources.testResultsFailureField))),
      results.readStringArray(Resources.testResultsRunFailuresField));
  }
}

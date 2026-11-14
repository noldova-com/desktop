/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import type { IRunnerSkip } from "../totals/interfaces/i-runner-skip.ts";
import { JsonFields } from "../totals/json-fields.ts";
import { RunnerResult } from "../totals/runner-result.ts";
import { TestNames } from "../totals/test-names.ts";
import { UnknownTestStatusException } from "../totals/unknown-test-status.exception.ts";

export class AngularTestReport {
  private readonly source: string;
  private readonly name: (file: string) => string;
  private readonly skips: IRunnerSkip[] = [];
  private readonly tests: TestNames = new TestNames();
  private passed: number = 0;
  private failed: number = 0;
  private unreached: number = 0;

  public constructor(source: string, name: (file: string) => string) {
    this.source = source;
    this.name = name;
  }

  public read(results: readonly JsonFields[]): RunnerResult {
    const files = results.map(t => this.readFile(t));
    return new RunnerResult(JsonFields.fromValue({ passed: this.passed, failed: this.failed, skipped: this.skips.length, unreached: this.unreached, skips: this.skips, files: files.sort(), duplicates: this.tests.duplicates }, this.source));
  }

  private readFile(result: JsonFields): string {
    const file = this.name(result.text(Resources.nameField));
    const assertions = result.objects(Resources.angularReportAssertionResultsField);
    const statuses = assertions.map(t => AngularTestReport.firstStatus(t));
    const failed = result.text(Resources.angularReportStatusField) === Resources.angularTestFailedStatus;
    this.failed += Number(failed && !statuses.includes(Resources.angularTestFailedStatus));
    assertions.forEach(t => this.count(file, [...t.texts(Resources.angularReportAncestorTitlesField), t.text(Resources.angularReportTitleField)], AngularTestReport.firstStatus(t)));
    return file;
  }

  private static firstStatus(test: JsonFields): string {
    const status = test.text(Resources.angularReportStatusField);
    return status === Resources.angularTestPassedStatus && test.has(Resources.angularReportFailureMessagesField) && test.texts(Resources.angularReportFailureMessagesField).length > 0 ? Resources.angularTestFailedStatus : status;
  }

  private count(file: string, names: readonly string[], status: string): void {
    const reason = Resources.angularTestSkipReasons.get(status);
    this.tests.add(file, names);
    if (status === Resources.angularTestPassedStatus)
      this.passed++;
    else if (status === Resources.angularTestFailedStatus)
      this.failed++;
    else if (status === Resources.angularTestPendingStatus)
      this.unreached++;
    else if (!Object.isUndefined(reason))
      this.skips.push({ file, names, reason });
    else
      throw new UnknownTestStatusException(this.source, file, status);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { appendFileSync } from "node:fs";

import "@noldova/context.core";
import { TestReportWriter, type TestRunResult } from "@noldova/context.testing";

import { Resources } from "../resources.ts";
import { TestRunSummaryResources } from "./test-run-summary.resources.ts";

export class TestRunSummary {
  private readonly path: string | undefined;
  private readonly group: string | undefined;

  public constructor(path: string | undefined, group?: string) {
    this.path = path;
    this.group = group;
  }

  public static formatTests(result: TestRunResult, unreached: number, group?: string): readonly string[] {
    const files = new Set(result.classResults.map(t => JSON.stringify([t.packageName, t.filePath])));
    const selection = result.selection.isFiltered
      ? [
          TestRunSummaryResources.formatRow(TestRunSummaryResources.filtersLabel, result.selection.filters.map(t => TestRunSummaryResources.formatFilter(t)).join(Resources.space)),
          TestRunSummaryResources.formatRow(TestRunSummaryResources.discoveredLabel, result.selection.discovered),
          TestRunSummaryResources.formatRow(TestRunSummaryResources.selectedLabel, result.selection.selected),
          TestRunSummaryResources.formatRow(TestRunSummaryResources.unselectedLabel, result.selection.unselected)
        ]
      : [];
    const lines = [
      TestRunSummaryResources.formatHeading(TestRunSummaryResources.testHeading, group),
      String.empty,
      TestRunSummaryResources.tableHeading,
      TestRunSummaryResources.tableSeparator,
      ...selection,
      TestRunSummaryResources.formatRow(TestRunSummaryResources.filesLabel, files.size),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.totalLabel, result.total),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.passedLabel, result.passed),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.failedLabel, result.failed),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.skippedLabel, result.skipped),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.unreachedLabel, unreached),
      TestRunSummaryResources.formatRow(TestRunSummaryResources.timeLabel, TestRunSummaryResources.formatSeconds(result.durationMilliseconds))
    ];
    if (result.failed > 0 || result.skipped > 0 || unreached > 0)
      lines.push(TestRunSummaryResources.formatDetails(new TestReportWriter().formatLines(result, true).join(Resources.lineEnd)));
    return lines;
  }

  public writeTests(result: TestRunResult, unreached: number): void {
    this.append(TestRunSummary.formatTests(result, unreached, this.group));
  }

  public writeFailure(message: string): void {
    this.append([TestRunSummaryResources.formatHeading(TestRunSummaryResources.failureHeading, this.group), TestRunSummaryResources.formatDetails(message)]);
  }

  private append(lines: readonly string[]): void {
    if (Object.isUndefined(this.path) || String.isNullOrWhitespace(this.path))
      return;
    try {
      appendFileSync(this.path, `${Resources.lineEnd}${lines.join(Resources.lineEnd)}${Resources.lineEnd}`, Resources.encoding);
    }
    catch {
      console.error(TestRunSummaryResources.writeFailed);
    }
  }
}

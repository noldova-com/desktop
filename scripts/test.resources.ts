/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { CheckSelection } from "./checks/check-selection.ts";
import type { ICheck } from "./checks/interfaces/i-check.ts";
import { Resources } from "./resources.ts";
import type { RunnerTotals } from "./totals/runner-totals.ts";

export class TestResources {
  public static readonly usage: string = "Usage: npm test [-- documents | [--filter <text>]... [--repeat <count>] [--rerun-failed] [--skip-test-details] [--skip-coverage-details]]\n";
  public static readonly skipTestDetailsVariable: string = "NOLDOVA_TEST_SKIP_TEST_DETAILS";
  public static readonly skipTestDetailsValue: string = "1";
  public static readonly summaryHeader: string = "| Check | Result |\n|---|---|\n";
  public static readonly filteredSummaryHeader: string = "| Check | Result | Unit | Discovered | Selected | Unselected |\n|---|---|---|---|---|---|\n";
  public static readonly documentsNotice: string = "Filtered run: documents. A filtered run is not the complete gate.\n";
  public static readonly noMatch: string = "No test matched the filters.\n";
  public static readonly passedResult: string = "passed";
  public static readonly failedResult: string = "failed";
  public static readonly passedLabel: string = "Passed";
  public static readonly failedLabel: string = "Failed";
  public static readonly notRunLabel: string = "Not run";
  public static readonly noneSelectedLabel: string = "None selected";
  public static readonly totalsHeading: string = "Test totals";

  public static formatSummaryFilter(filter: string): string {
    return `<code>${filter.replaceAll(Resources.summaryAmpersand, Resources.summaryAmpersandEntity).replaceAll(Resources.summaryLessThan, Resources.summaryLessThanEntity).replaceAll(Resources.summaryGreaterThan, Resources.summaryGreaterThanEntity).replaceAll(Resources.summaryPipe, Resources.summaryPipeEntity)}</code>`;
  }

  public static formatRunHeading(run: number, repeat: number): string {
    return `${Resources.lineEnd}Run ${run} of ${repeat}${Resources.lineEnd}`;
  }

  public static formatRepeatStopped(run: number, repeat: number): string {
    return `${Resources.lineEnd}Run ${run} of ${repeat} failed; the repeats stop there.${Resources.lineEnd}`;
  }

  public static formatAllRunsPassed(repeat: number): string {
    return `${Resources.lineEnd}All ${repeat} runs passed.${Resources.lineEnd}`;
  }

  public static formatCheckHeading(title: string): string {
    return `${Resources.lineEnd}${title}${Resources.lineEnd}`;
  }

  public static formatCheckResult(title: string, result: string): string {
    return `${title}: ${result}${Resources.lineEnd}`;
  }

  public static formatSummaryRow(title: string, result: string): string {
    return `| ${title} | ${result} |${Resources.lineEnd}`;
  }

  public static formatStopped(stopped: readonly ICheck[]): string {
    return `${Resources.lineEnd}Stopped before the ${stopped.length} checks that build, compile or run tests, because a check above failed: ${stopped.map(t => t.title).join(Resources.listSeparator)}.${Resources.lineEnd}`;
  }

  public static formatTotals(totals: readonly RunnerTotals[]): string {
    return `${Resources.lineEnd}${TestResources.totalsHeading}${Resources.lineEnd}${totals.map(t => t.formatLine()).join(String.empty)}`;
  }

  public static formatChecksPassed(passed: number, total: number): string {
    return `${Resources.lineEnd}${passed} of ${total} checks passed.${Resources.lineEnd}`;
  }

  public static formatFilteredNotice(filters: readonly string[]): string {
    return `Filtered run: ${filters.map(t => JSON.stringify(t)).join(Resources.listSeparator)}. A filtered run is not the complete gate.${Resources.lineEnd}`;
  }

  public static formatFilterSummary(filters: readonly string[]): string {
    return `Filters: ${filters.map(t => TestResources.formatSummaryFilter(t)).join(Resources.space)}${Resources.lineEnd}${Resources.lineEnd}${TestResources.filteredSummaryHeader}`;
  }

  public static formatSelectionResult(title: string, result: string, selection: CheckSelection): string {
    return `${title}: ${result.toLowerCase()}; ${selection.selected} of ${selection.discovered} ${selection.unit} selected, ${selection.unselected} not selected.${Resources.lineEnd}`;
  }

  public static formatSelectionRow(title: string, result: string, selection: CheckSelection): string {
    return `| ${title} | ${result} | ${selection.unit} | ${selection.discovered} | ${selection.selected} | ${selection.unselected} |${Resources.lineEnd}`;
  }
}

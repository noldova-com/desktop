/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stripVTControlCharacters } from "node:util";

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class TestRunSummaryResources {
  public static readonly testHeading: string = "## Noldova Package Test Report";
  public static readonly failureHeading: string = "### Package test execution failed";
  public static readonly tableHeading: string = "| Metric | Result |";
  public static readonly tableSeparator: string = "| --- | ---: |";
  public static readonly detailLimit: number = 20_000;
  public static readonly writeFailed: string = "Could not write the GitHub job summary; see the console report.";
  public static readonly omitted: string = "\nAdditional output omitted.\n";
  public static readonly filtersLabel: string = "Filters:";
  public static readonly discoveredLabel: string = "Discovered:";
  public static readonly selectedLabel: string = "Selected:";
  public static readonly unselectedLabel: string = "Unselected:";
  public static readonly filesLabel: string = "Test files";
  public static readonly totalLabel: string = "Total:";
  public static readonly passedLabel: string = "Passed:";
  public static readonly failedLabel: string = "Failed:";
  public static readonly skippedLabel: string = "Skipped:";
  public static readonly unreachedLabel: string = "Unreached:";
  public static readonly timeLabel: string = "Time:";
  public static readonly millisecondsPerSecond: number = 1000;
  public static readonly secondsDigits: number = 2;

  public static formatEscaped(text: string): string {
    return text.replaceAll(Resources.summaryAmpersand, Resources.summaryAmpersandEntity).replaceAll(Resources.summaryLessThan, Resources.summaryLessThanEntity).replaceAll(Resources.summaryGreaterThan, Resources.summaryGreaterThanEntity);
  }

  public static formatHeading(heading: string, group: string | undefined): string {
    return Object.isUndefined(group) ? heading : `${heading} (${TestRunSummaryResources.formatEscaped(group)})`;
  }

  public static formatRow(label: string, value: string | number): string {
    return `| ${label} | ${value} |`;
  }

  public static formatFilter(filter: string): string {
    return `<code>${TestRunSummaryResources.formatEscaped(filter).replaceAll(Resources.summaryPipe, Resources.summaryPipeEntity)}</code>`;
  }

  public static formatDetails(text: string): string {
    const plain = stripVTControlCharacters(text);
    const excerpt = plain.slice(0, TestRunSummaryResources.detailLimit);
    return `\n<details><summary>Details (full output in the step log)</summary>\n\n<pre>${TestRunSummaryResources.formatEscaped(excerpt)}</pre>\n${plain.length > excerpt.length ? TestRunSummaryResources.omitted : String.empty}\n</details>\n`;
  }

  public static formatSeconds(milliseconds: number): string {
    return `${(milliseconds / TestRunSummaryResources.millisecondsPerSecond).toFixed(TestRunSummaryResources.secondsDigits)} s`;
  }
}

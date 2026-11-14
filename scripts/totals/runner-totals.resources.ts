/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import type { ICoverageCount } from "./interfaces/i-coverage-count.ts";
import type { ITestSkip } from "./interfaces/i-test-skip.ts";
import type { RunnerTotals } from "./runner-totals.ts";

export class RunnerTotalsResources {
  public static readonly version: number = 3;
  public static readonly folderSegments: readonly string[] = ["_build", "totals"];
  public static readonly extension: string = ".json";
  public static readonly tableHeader: string = "| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n";
  public static readonly notMeasured: string = "Not measured";
  public static readonly rerunNote: string = "passed when run again; see the flaky record";
  public static readonly fullShare: number = 100;
  public static readonly shareDigits: number = 1;

  public static formatTable(totals: readonly RunnerTotals[]): string {
    const skips = totals.filter(t => t.skips.length > 0).map(t => RunnerTotalsResources.formatSkipDetails(t));
    return `${RunnerTotalsResources.tableHeader}${totals.map(t => RunnerTotalsResources.formatRow(t)).join(String.empty)}${skips.join(String.empty)}`;
  }

  public static formatLine(totals: RunnerTotals): string {
    return `${totals.title}: ${totals.discovered} discovered, ${totals.executed} executed, ${totals.passed} passed, ${totals.failed} failed${RunnerTotalsResources.formatRerun(totals.rerunPassed)}, ${totals.skipped} skipped, ${totals.unselected} unselected, ${totals.unreached} unreached; coverage ${RunnerTotalsResources.formatCoverage(totals.coverage)}.${Resources.lineEnd}` +
      totals.skips.map(t => RunnerTotalsResources.formatSkipLine(t)).join(String.empty);
  }

  public static formatCoverage(coverage: ICoverageCount | null): string {
    if (Object.isNull(coverage))
      return RunnerTotalsResources.notMeasured;
    const share = coverage.total === 0 ? RunnerTotalsResources.fullShare : coverage.covered / coverage.total * RunnerTotalsResources.fullShare;
    return `${share.toFixed(RunnerTotalsResources.shareDigits)}% of ${coverage.total} ${coverage.unit}`;
  }

  public static formatRerun(rerunPassed: number): string {
    return rerunPassed === 0 ? String.empty : ` (${rerunPassed} ${RunnerTotalsResources.rerunNote})`;
  }

  public static formatList(heading: string, items: readonly string[]): string {
    return `${heading}${items.map(t => `${Resources.lineEnd}${Resources.indent}${t}`).join(String.empty)}`;
  }

  public static formatEscaped(text: string): string {
    return text.replaceAll(Resources.summaryAmpersand, Resources.summaryAmpersandEntity).replaceAll(Resources.summaryLessThan, Resources.summaryLessThanEntity).replaceAll(Resources.summaryGreaterThan, Resources.summaryGreaterThanEntity).replaceAll(Resources.summaryPipe, Resources.summaryPipeEntity).replaceAll(Resources.lineEnd, Resources.space);
  }

  public static formatRow(totals: RunnerTotals): string {
    return `| ${RunnerTotalsResources.formatEscaped(totals.title)} | ${totals.discovered} | ${totals.executed} | ${totals.passed} | ${totals.failed}${RunnerTotalsResources.formatRerun(totals.rerunPassed)} | ${totals.skipped} | ${totals.unselected} | ${totals.unreached} | ${RunnerTotalsResources.formatCoverage(totals.coverage)} |${Resources.lineEnd}`;
  }

  public static formatSkipDetails(totals: RunnerTotals): string {
    return `${Resources.lineEnd}<details><summary>${RunnerTotalsResources.formatEscaped(totals.title)} skipped (${totals.skips.length})</summary>${Resources.lineEnd}${Resources.lineEnd}${totals.skips.map(t => RunnerTotalsResources.formatSkipItem(t)).join(String.empty)}${Resources.lineEnd}</details>${Resources.lineEnd}`;
  }

  public static formatSkipItem(skip: ITestSkip): string {
    return `- ${RunnerTotalsResources.formatEscaped(skip.test)}: ${RunnerTotalsResources.formatEscaped(skip.reason)}${Resources.lineEnd}`;
  }

  public static formatSkipLine(skip: ITestSkip): string {
    return `${Resources.indent}Skipped ${skip.test}: ${skip.reason}${Resources.lineEnd}`;
  }

  public static formatDuplicatesHeading(title: string): string {
    return `${title} name more than one test the same:`;
  }

  public static formatEmptyHeading(title: string): string {
    return `${title} found no tests in these files:`;
  }

  public static formatMissingHeading(title: string): string {
    return `${title} have no result for these files:`;
  }

  public static formatWrongVersion(source: string, version: number): string {
    return `${source} is version ${version} of the test totals, not ${RunnerTotalsResources.version}.`;
  }

  public static formatOverSelected(totals: RunnerTotals): string {
    return `${totals.title} selected more tests than they discovered: ${totals.discovered} discovered, but ${totals.discovered - totals.unselected} selected.`;
  }

  public static formatUnbalanced(totals: RunnerTotals): string {
    return `${totals.title} don't add up: ${totals.discovered} discovered, but ${totals.executed} executed, ${totals.skipped} skipped, ${totals.unselected} unselected and ${totals.unreached} unreached.`;
  }

  public static formatSkipMismatch(totals: RunnerTotals): string {
    return `${totals.title} name ${totals.skips.length} skipped tests but count ${totals.skipped}.`;
  }
}

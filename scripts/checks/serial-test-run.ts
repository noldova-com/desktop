/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import {
  type DiscoveredTestClass, TestConsoleReporter, TestDiscovery, TestExecutor, TestOutcome, TestProject, TestRunResult, TestRunner, TestSelection
} from "@noldova/context.testing";

import { Resources } from "../resources.ts";
import { EmptyTestPartsException } from "./empty-test-parts.exception.ts";
import { TestFiltersException } from "./test-filters.exception.ts";
import { TestInterruption } from "./test-interruption.ts";
import { TestProcessPart } from "./test-process-part.ts";
import { TestProjectsException } from "./test-projects.exception.ts";
import { TestRunSummary } from "./test-run-summary.ts";
import { TestTimeoutSettingException } from "./test-timeout-setting.exception.ts";

export class SerialTestRun {
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  public static parseFilters(text: string | undefined): string[] {
    let value: unknown;
    try {
      value = JSON.parse(text ?? String.empty);
    }
    catch (error) {
      throw new TestFiltersException(text, error);
    }
    if (!Array.isArray(value) || !value.every(t => Object.isString(t) && t.length > 0))
      throw new TestFiltersException(text);
    return value;
  }

  public static parseTimeout(text: string | undefined): number {
    if (Object.isUndefined(text))
      return Resources.serialTestDefaultTimeout;
    const value = Number(text);
    if (!Number.isInteger(value) || value <= 0 || String(value) !== text)
      throw new TestTimeoutSettingException(text);
    return value;
  }

  public static parseProjects(projectArguments: readonly string[]): TestProject[] {
    if (projectArguments.length % 2 !== 0)
      throw new TestProjectsException(projectArguments);
    return projectArguments.filter((_, i) => i % 2 === 0).map((t, i) => new TestProject(t, String(projectArguments[2 * i + 1])));
  }

  public static countMethods(testClasses: readonly DiscoveredTestClass[]): number {
    return testClasses.reduce((total, t) => total + t.methods.length, 0);
  }

  public static describe(result: TestRunResult, unreached: number): object {
    return {
      discovered: result.selection.discovered,
      selected: result.selection.selected,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      unreached,
      skips: result.classResults.flatMap(t => t.methodResults
        .filter(u => u.outcome === TestOutcome.Skipped)
        .map(u => ({ file: `${t.packageName}${Resources.pathSeparator}${t.filePath}`, names: [u.displayName], reason: String(u.skipReason) }))),
      files: [...new Set(result.classResults.map(t => `${t.packageName}${Resources.pathSeparator}${t.filePath}`))]
    };
  }

  public static describeResults(result: TestRunResult, isInterrupted: boolean, unreached: number): object {
    return {
      isComplete: !isInterrupted && unreached === 0,
      failed: result.classResults.flatMap(t => t.methodResults.filter(u => u.outcome === TestOutcome.Failed)
        .map(u => ({ identity: u.displayName, file: `${t.packageName}${Resources.pathSeparator}${t.filePath}`, failure: String(u.failure) })))
    };
  }

  public async runAsync(projectArguments: readonly string[]): Promise<void> {
    const summary = new TestRunSummary(this.environment[Resources.summaryVariable], this.environment[Resources.serialTestGroupVariable]);
    const coverage = this.environment[Resources.serialTestNodeCoverageVariable];
    if (!Object.isUndefined(coverage)) {
      this.environment[Resources.serialTestCoverageDirectoryVariable] = coverage;
      delete this.environment[Resources.serialTestNodeCoverageVariable];
    }
    const temporary = mkdtempSync(path.join(this.environment[Resources.serialTestTemporaryRootVariable] ?? tmpdir(), Resources.serialTestTemporaryPrefix));
    for (const variable of Resources.serialTestTemporaryVariables)
      this.environment[variable] = temporary;
    const interruption = new TestInterruption();

    try {
      const filters = SerialTestRun.parseFilters(this.environment[Resources.serialTestFiltersVariable]);
      const executor = new TestExecutor(SerialTestRun.parseTimeout(this.environment[Resources.serialTestTimeoutVariable]));
      const parts = TestProcessPart.parseAll(this.environment[Resources.serialTestPartsVariable]);
      const discovered = (await new TestDiscovery().discoverAsync(SerialTestRun.parseProjects(projectArguments))).filter(t => TestProcessPart.selects(parts, t.packageName, t.filePath));
      const files = (t: TestProcessPart): string[] => discovered.filter(u => u.packageName === t.name).map(u => u.filePath);
      const empty = filters.length === 0 ? parts.filter(t => t.paths.length > 0 && files(t).length === 0).map(t => t.format()) : [];
      const unmatched = filters.length === 0 ? parts.filter(t => !t.isExcept).flatMap(t => t.findUnmatched(files(t)).map(u => `${t.name}${Resources.space}${u}`)) : [];
      if (empty.length > 0 || unmatched.length > 0)
        throw new EmptyTestPartsException([...empty, ...unmatched]);
      const selected = new TestRunner(new TestDiscovery(), executor).select(discovered, filters);
      const reporter = new TestConsoleReporter(t => process.stdout.write(t), process.stdout.isTTY === true, !Object.isUndefined(this.environment[Resources.serialTestSkipDetailsVariable]));
      reporter.start();
      const completed = await executor.executeAsync(selected, {
        onMethodStarted: t => interruption.start(t),
        onMethodCompleted: t => interruption.complete(t),
        onClassCompleted: t => {
          interruption.finishClass();
          reporter.onClassCompleted(t);
        }
      }, new Set(), () => interruption.isInterrupted);
      const stopped = interruption.collectStopped();
      if (!Object.isNull(stopped))
        reporter.onClassCompleted(stopped);
      const classResults = Object.isNull(stopped) ? completed : [...completed, stopped];
      const result = new TestRunResult(classResults, new TestSelection(filters, SerialTestRun.countMethods(discovered), SerialTestRun.countMethods(selected)));
      const unreached = result.selection.selected - result.total;

      reporter.writeSummary(result, result.selection);
      summary.writeTests(result, unreached);
      const resultFile = this.environment[Resources.serialTestResultFileVariable];
      const ownsEmptySelection = Object.isUndefined(resultFile);
      if (ownsEmptySelection && result.selection.isFiltered && result.selection.selected === 0) {
        console.error(Resources.serialTestNoTestMatched.trimEnd());
        summary.writeFailure(Resources.serialTestNoTestMatched);
      }
      if (!ownsEmptySelection)
        writeFileSync(resultFile, JSON.stringify(SerialTestRun.describe(result, unreached)));
      const resultsFile = this.environment[Resources.serialTestResultsFileVariable];
      if (!Object.isUndefined(resultsFile))
        writeFileSync(resultsFile, JSON.stringify(SerialTestRun.describeResults(result, interruption.isInterrupted, unreached)));
      process.exitCode = Math.min(result.failed + unreached + Number(ownsEmptySelection && result.total === 0), Resources.failedExitCode);
    }
    catch (error) {
      console.error(String(error));
      summary.writeFailure(String(error));
      process.exitCode = Resources.failedExitCode;
    }

    const leftovers = readdirSync(temporary).sort();
    rmSync(temporary, { recursive: true, force: true, maxRetries: Resources.serialTestRemovalRetries });
    const message = interruption.message;
    if (!Object.isNull(message)) {
      writeSync(Resources.serialTestStandardErrorDescriptor, message);
      summary.writeFailure(message);
      process.exit(Resources.failedExitCode);
    }
    if (leftovers.length > 0) {
      writeSync(Resources.serialTestStandardErrorDescriptor, Resources.formatSerialTestLeftovers(leftovers));
      summary.writeFailure(Resources.formatSerialTestLeftovers(leftovers));
      process.exitCode = Resources.failedExitCode;
    }
    setTimeout(() => {
      const failure = Resources.formatSerialTestUnclosed(process.getActiveResourcesInfo());
      writeSync(Resources.serialTestStandardErrorDescriptor, failure);
      summary.writeFailure(failure);
      process.exit(Resources.failedExitCode);
    }, Resources.serialTestShutdownGrace).unref();
  }
}

if (import.meta.main)
  await new SerialTestRun(process.env).runAsync(process.argv.slice(2));

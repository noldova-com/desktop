/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { lstatSync, mkdtempSync, readdirSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { inspect } from "node:util";

import "@noldova/context.core";
import {
  type DiscoveredTestClass, type ITestProgressListener, type TestClassResult, TestConsoleReporter, TestDiscovery, TestExecutor, TestOutcome, TestProject, TestRunResult, TestRunner,
  TestSelection, TestTimeRecord, TestingException
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

  public static parseTimeout(text: string | undefined, fallback: number): number {
    if (Object.isUndefined(text))
      return fallback;
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

  public static describeResults(result: TestRunResult, isInterrupted: boolean, unreached: number, runFailures: readonly string[]): object {
    return {
      isComplete: !isInterrupted && unreached === 0,
      failed: result.classResults.flatMap(t => t.methodResults.filter(u => u.outcome === TestOutcome.Failed)
        .map(u => ({ identity: u.displayName, file: `${t.packageName}${Resources.pathSeparator}${t.filePath}`, failure: String(u.failure) }))),
      runFailures
    };
  }

  public static formatFailureDetails(results: readonly TestClassResult[]): string {
    return results.flatMap(t => t.methodResults
      .filter(u => u.outcome === TestOutcome.Failed && u.failure instanceof Error && !(u.failure instanceof TestingException))
      .map(u => Resources.formatSerialTestFailureDetails(`${t.packageName}${Resources.pathSeparator}${t.filePath}`, u.displayName, inspect(u.failure))))
      .join(String.empty);
  }

  public static formatSlowest(suite: string, limit: number, results: readonly TestClassResult[]): string {
    return Resources.formatSerialTestSlowest(suite, limit, TestTimeRecord.formatSlowest(TestTimeRecord.fromResult(new TestRunResult(results)), Resources.serialTestSlowestCount));
  }

  private static tryRemove(folder: string, kept: string[]): string | null {
    try {
      SerialTestRun.removeOnDevice(folder, lstatSync(folder).dev, kept);
      return null;
    }
    catch (error) {
      return String(error);
    }
  }

  private static removeOnDevice(folder: string, device: number, kept: string[]): boolean {
    let isKept = false;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const item = path.join(folder, entry.name);
      if (!entry.isDirectory())
        rmSync(item, { recursive: true, force: true, maxRetries: Resources.serialTestRemovalRetries });
      else if (lstatSync(item).dev !== device) {
        kept.push(item);
        isKept = true;
      }
      else
        isKept = !SerialTestRun.removeOnDevice(item, device, kept) || isKept;
    }
    if (!isKept)
      rmSync(folder, { recursive: true, force: true, maxRetries: Resources.serialTestRemovalRetries });
    return !isKept;
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
    const releases: Promise<string | null>[] = [];
    const release = (message: unknown): void => {
      releases.push(Promise.resolve(message).then(() => null, (t: unknown) => String(t)));
    };
    subscribe(Resources.serialTestReleaseChannel, release);
    const stepStarted = (message: unknown): void => {
      interruption.startStep(String(message), performance.now());
    };
    const stepEnded = (message: unknown): void => {
      interruption.endStep(String(message), performance.now());
    };
    subscribe(Resources.serialTestStepStartedChannel, stepStarted);
    subscribe(Resources.serialTestStepEndedChannel, stepEnded);
    let finished: TestRunResult | undefined;
    let unreachedCount = 0;

    try {
      const filters = SerialTestRun.parseFilters(this.environment[Resources.serialTestFiltersVariable]);
      const timeout = SerialTestRun.parseTimeout(this.environment[Resources.serialTestTimeoutVariable], Resources.serialTestDefaultTimeout);
      const packagingTimeout = SerialTestRun.parseTimeout(this.environment[Resources.serialTestPackagingTimeoutVariable], Resources.serialTestPackagingTimeout);
      const executor = new TestExecutor(timeout);
      const packagingExecutor = new TestExecutor(packagingTimeout);
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
      const listener: ITestProgressListener = {
        onMethodStarted: t => interruption.start(t),
        onMethodCompleted: t => interruption.complete(t),
        onClassCompleted: t => {
          interruption.finishClass();
          reporter.onClassCompleted(t);
        }
      };
      const isPackaging = (t: DiscoveredTestClass): boolean => t.categories.includes(Resources.serialTestPackagingCategory);
      const general = await executor.executeAsync(selected.filter(t => !isPackaging(t)), listener, new Set(), () => interruption.isInterrupted);
      const packaging = interruption.isInterrupted ? [] : await packagingExecutor.executeAsync(selected.filter(isPackaging), listener, new Set(), () => interruption.isInterrupted);
      const completed = [...general, ...packaging];
      const stopped = interruption.collectStopped();
      if (!Object.isNull(stopped))
        reporter.onClassCompleted(stopped);
      const classResults = Object.isNull(stopped) ? completed : [...completed, stopped];
      const result = new TestRunResult(classResults, new TestSelection(filters, SerialTestRun.countMethods(discovered), SerialTestRun.countMethods(selected)));
      const unreached = result.selection.selected - result.total;

      reporter.writeSummary(result, result.selection);
      process.stdout.write(SerialTestRun.formatFailureDetails(classResults));
      process.stdout.write(SerialTestRun.formatSlowest(Resources.serialTestGeneralSuite, timeout, general));
      process.stdout.write(SerialTestRun.formatSlowest(Resources.serialTestPackagingCategory, packagingTimeout, packaging));
      summary.writeTests(result, unreached);
      const resultFile = this.environment[Resources.serialTestResultFileVariable];
      const ownsEmptySelection = Object.isUndefined(resultFile);
      if (ownsEmptySelection && result.selection.isFiltered && result.selection.selected === 0) {
        console.error(Resources.serialTestNoTestMatched.trimEnd());
        summary.writeFailure(Resources.serialTestNoTestMatched);
      }
      if (!ownsEmptySelection)
        writeFileSync(resultFile, JSON.stringify(SerialTestRun.describe(result, unreached)));
      finished = result;
      unreachedCount = unreached;
      process.exitCode = Math.min(result.failed + unreached + Number(ownsEmptySelection && result.total === 0), Resources.failedExitCode);
    }
    catch (error) {
      console.error(String(error));
      summary.writeFailure(String(error));
      process.exitCode = Resources.failedExitCode;
    }

    const message = interruption.message;
    if (!Object.isNull(message)) {
      writeSync(Resources.serialTestStandardErrorDescriptor, message);
      summary.writeFailure(message);
    }
    const runFailures: string[] = [];
    for (const failure of (await Promise.all(releases)).filter(t => !Object.isNull(t))) {
      const released = Resources.formatSerialTestReleaseFailed(failure);
      writeSync(Resources.serialTestStandardErrorDescriptor, released);
      summary.writeFailure(released);
      runFailures.push(released);
      process.exitCode = Resources.failedExitCode;
    }
    unsubscribe(Resources.serialTestReleaseChannel, release);
    unsubscribe(Resources.serialTestStepStartedChannel, stepStarted);
    unsubscribe(Resources.serialTestStepEndedChannel, stepEnded);
    const leftovers = readdirSync(temporary).sort();
    const kept: string[] = [];
    const removal = SerialTestRun.tryRemove(temporary, kept);
    const unclean = leftovers.length > 0 ? Resources.formatSerialTestLeftovers(leftovers, kept) : Object.isNull(removal) ? null : Resources.formatSerialTestUnremoved(removal);
    if (!Object.isNull(unclean))
      runFailures.push(unclean);
    const resultsFile = this.environment[Resources.serialTestResultsFileVariable];
    if (!Object.isUndefined(resultsFile) && !Object.isUndefined(finished))
      writeFileSync(resultsFile, JSON.stringify(SerialTestRun.describeResults(finished, interruption.isInterrupted, unreachedCount, runFailures)));
    if (!Object.isNull(message))
      process.exit(Resources.failedExitCode);
    if (!Object.isNull(unclean)) {
      writeSync(Resources.serialTestStandardErrorDescriptor, unclean);
      summary.writeFailure(unclean);
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

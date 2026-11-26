/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { BuildLayout } from "../../src/noldova.desktop.build/src/services/packages/build-layout.ts";
import type { PackageBuild } from "../../src/noldova.desktop.build/src/services/packages/package-build.ts";
import { PackageCatalog } from "../../src/noldova.desktop.build/src/services/packages/package-catalog.ts";
import type { PackageManifest } from "../../src/noldova.desktop.build/src/models/packages/package-manifest.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";
import { RunnerResult } from "../totals/runner-result.ts";
import { TotalsException } from "../totals/totals.exception.ts";
import { CheckSelection } from "./check-selection.ts";
import type { FlakyRecord } from "./flaky-record.ts";
import { FlakyTest } from "./flaky-test.ts";
import { LoggedProcess } from "./logged-process.ts";
import type { IPackageCoverage } from "./interfaces/i-package-coverage.ts";
import type { ISelectableCheck } from "./interfaces/i-selectable-check.ts";
import { PackageCoverage } from "./package-coverage.ts";
import { PrefixedOutput } from "./prefixed-output.ts";
import { RecordedTestRun } from "./recorded-test-run.ts";
import { TestProcessPart } from "./test-process-part.ts";
import { TestedPackage } from "./tested-package.ts";

export class PackageTestCheck implements ISelectableCheck {
  private static readonly PROCESSES: readonly (readonly TestProcessPart[])[] = [
    [new TestProcessPart(Resources.packageTestRuntimePackage, Resources.packageTestRuntimeProcessPaths)],
    [new TestProcessPart(Resources.packageTestRuntimePackage, Resources.packageTestRuntimeProcessPaths, true), new TestProcessPart(Resources.packageTestElectronPackage)],
    [new TestProcessPart(Resources.packageTestCliPackage), new TestProcessPart(Resources.packageTestBuildPackage, Resources.packageTestBuildProcessPaths)],
    [new TestProcessPart(Resources.packageTestBuildPackage, Resources.packageTestBuildProcessPaths, true)]
  ];

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly flaky: FlakyRecord | null;

  public readonly title: string = Resources.packageTestCheckTitle;

  public constructor(root: string, build: PackageBuild, environment: NodeJS.ProcessEnv, flaky: FlakyRecord | null) {
    this.root = root;
    this.build = build;
    this.environment = environment;
    this.flaky = flaky;
  }

  public static group(packages: readonly PackageManifest[]): readonly (readonly TestedPackage[])[] {
    const named = new Set(PackageTestCheck.PROCESSES.flat().map(t => t.name));
    const listed = PackageTestCheck.PROCESSES.map(t => t.flatMap(part => packages.filter(u => u.name === part.name).map(u => new TestedPackage(u, part))));
    const rest = packages.filter(t => !named.has(t.name)).map(t => new TestedPackage(t, new TestProcessPart(t.name)));
    return [...listed.slice(0, -1), [...listed.at(-1) ?? [], ...rest]].filter(t => t.length > 0);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return (await this.checkAsync(output, Resources.packageTestAllFilters)).isPassing;
  }

  public runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    return this.checkAsync(output, filters);
  }

  private static flush(outputs: readonly PrefixedOutput[]): void {
    for (const output of outputs)
      output.flush();
  }

  private static locateCompiledTests(layout: BuildLayout, manifest: PackageManifest): string {
    return path.join(layout.locateTestOutput(manifest), Resources.packageTestCompiledTestsFolder);
  }

  private static async readResultsAsync(file: string): Promise<RecordedTestRun | null> {
    try {
      return RecordedTestRun.parse(await readFile(file, Resources.encoding));
    }
    catch {
      return null;
    }
  }

  private async isCurrentReportedAsync(output: Writable): Promise<boolean> {
    try {
      await this.build.requireCurrentAsync();
      return true;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return false;
    }
  }

  private async checkAsync(output: Writable, filters: readonly string[]): Promise<CheckSelection> {
    const isFiltered = filters.length > 0;
    try {
      if (!await this.isCurrentReportedAsync(output))
        return new CheckSelection(false, Resources.packageTestUnit, 0, 0);
      const layout = new BuildLayout(this.root);
      const packages = await new PackageCatalog(this.root).listPackagesAsync();
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(Resources.packageTestNoTests);
        return new CheckSelection(true, Resources.packageTestUnit, 0, 0);
      }

      const coverage = path.join(this.root, ...Resources.packageTestCoverageSegments);
      const resultFile = this.locate(Resources.packageTestResultName, null, Resources.packageTestResultExtension);
      await mkdir(path.dirname(resultFile), { recursive: true });
      await rm(resultFile, { force: true });
      let environment: NodeJS.ProcessEnv = {
        ...this.environment,
        [Resources.serialTestFiltersVariable]: JSON.stringify(filters)
      };
      if (!isFiltered) {
        await rm(coverage, { recursive: true, force: true });
        await mkdir(coverage, { recursive: true });
        environment = { ...environment, [Resources.serialTestNodeCoverageVariable]: coverage };
      }
      const entry = path.join(this.root, ...Resources.packageTestEntrySegments);
      const groups = PackageTestCheck.group(tested);
      const names = groups.map(t => t.map(u => u.part.format()));
      output.write(Resources.formatPackageTestGroups(names));
      const flaky: FlakyTest[] = [];
      const runs = await Promise.allSettled(groups.map((t, i) =>
        this.runGroupAsync(i, [Resources.packageTestSourceMapsOption, entry, ...t.flatMap(u => [u.manifest.name, PackageTestCheck.locateCompiledTests(layout, u.manifest)])],
          { ...environment, [Resources.serialTestGroupVariable]: Resources.formatPackageTestGroup(i, names), [Resources.serialTestPartsVariable]: JSON.stringify(t.map(u => u.part)) },
          isFiltered, flaky, output)));
      await this.flaky?.addAsync(flaky, output);
      const refused = runs.find(t => t.status === "rejected");
      if (!Object.isUndefined(refused))
        throw refused.reason;
      const testsPassed = runs.every(t => t.status === "fulfilled" && t.value);
      const result = await this.combineAsync(groups.map((_, i) => this.locate(Resources.packageTestResultName, i, Resources.packageTestResultExtension)), resultFile);
      if (isFiltered) {
        if (result.discovered === 0)
          output.write(Resources.packageTestNoneDiscovered);
        return new CheckSelection(testsPassed && result.discovered > 0, Resources.packageTestUnit, result.discovered, result.selected);
      }
      const projects: readonly IPackageCoverage[] = packages.map(t => ({ name: t.name, productionDirectory: layout.locateInstalled(t), sourceDirectory: layout.locateSource(t, Resources.sourceFolder), exclusions: t.coverageExclusions }));
      const coverageResult = await new PackageCoverage().measureAsync(coverage, projects, output);
      const recorded = await result.toTotals(Resources.packageTestRunner, Resources.packageTestTotalsTitle, PackageCoverage.count(coverageResult), result.files, null).recordAsync(this.root, output);
      return new CheckSelection(testsPassed && coverageResult.isComplete && recorded, Resources.packageTestUnit, 0, 0);
    }
    catch (error) {
      if (!(error instanceof BuildException || error instanceof TotalsException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return new CheckSelection(false, Resources.packageTestUnit, 0, 0);
    }
  }

  private async runGroupAsync(index: number, commandArguments: readonly string[], environment: NodeJS.ProcessEnv, isFiltered: boolean, flaky: FlakyTest[], output: Writable): Promise<boolean> {
    const resultFile = this.locate(Resources.packageTestResultName, index, Resources.packageTestResultExtension);
    await rm(resultFile, { force: true });
    const grouped = { ...environment, [Resources.serialTestResultFileVariable]: resultFile };
    const prefix = Resources.formatPackageTestPrefix(index);
    const standard = new PrefixedOutput(prefix, output);
    const errors = new PrefixedOutput(prefix, output);
    try {
      return Object.isNull(this.flaky) || isFiltered
        ? await this.runLoggedAsync(commandArguments, grouped, this.locate(Resources.packageTestLogName, index, Resources.packageTestLogExtension), standard, errors) === Resources.successExitCode
        : await this.runRerunningFailedAsync(commandArguments, grouped, flaky, index, standard, errors);
    }
    finally {
      PackageTestCheck.flush([standard, errors]);
    }
  }

  private runLoggedAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, log: string, output: Writable, errorOutput: Writable): Promise<number | null> {
    return LoggedProcess.runAsync(process.execPath, commandArguments, this.root, log, output, errorOutput, environment);
  }

  private async combineAsync(files: readonly string[], combined: string): Promise<RunnerResult> {
    const results = await Promise.all(files.map(t => RunnerResult.readAsync(this.root, t)));
    const sum = (count: (result: RunnerResult) => number): number => results.reduce((total, t) => total + count(t), 0);
    await writeFile(combined, JSON.stringify({
      discovered: sum(t => t.discovered),
      selected: sum(t => t.selected),
      passed: sum(t => t.passed),
      failed: sum(t => t.failed),
      skipped: sum(t => t.skipped),
      unreached: sum(t => t.unreached),
      skips: results.flatMap(t => t.skips),
      files: results.flatMap(t => t.files),
      duplicates: results.flatMap(t => t.duplicates),
      empty: results.flatMap(t => t.empty)
    }));
    return RunnerResult.readAsync(this.root, combined);
  }

  private locate(name: string, index: number | null, extension: string): string {
    return path.join(this.root, Resources.buildFolder, `${name}${Object.isNull(index) ? String.empty : `${Resources.dash}${index + 1}`}${extension}`);
  }

  private async runRerunningFailedAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, flaky: FlakyTest[], index: number, output: PrefixedOutput, errors: PrefixedOutput): Promise<boolean> {
    const results = this.locate(Resources.packageTestResultsName, index, Resources.packageTestResultExtension);
    const recording = { ...environment, [Resources.serialTestResultsFileVariable]: results };
    await rm(results, { force: true });
    if (await this.runLoggedAsync(commandArguments, recording, this.locate(Resources.packageTestLogName, index, Resources.packageTestLogExtension), output, errors) === Resources.successExitCode)
      return true;
    const first = await PackageTestCheck.readResultsAsync(results);
    if (Object.isNull(first) || !first.isRerunnable)
      return false;
    PackageTestCheck.flush([output, errors]);
    output.write(Resources.packageTestRerunning);
    await rm(results, { force: true });
    const rerunResult = this.locate(Resources.packageTestRerunResultName, index, Resources.packageTestResultExtension);
    const rerun = { ...recording, [Resources.serialTestFiltersVariable]: JSON.stringify(first.failed.map(t => t.identity)), [Resources.serialTestResultFileVariable]: rerunResult,
      [Resources.serialTestGroupVariable]: `${environment[Resources.serialTestGroupVariable] ?? String.empty}${Resources.packageTestRerunLabel}` };
    const isPassing = await this.runLoggedAsync(commandArguments, rerun, this.locate(Resources.packageTestRerunLogName, index, Resources.packageTestLogExtension), output, errors) === Resources.successExitCode;
    const second = await PackageTestCheck.readResultsAsync(results);
    if (Object.isNull(second) || !second.isComplete)
      return false;
    const failedAgain = new Set(second.failed.map(t => t.identity));
    flaky.push(...first.failed.filter(t => !failedAgain.has(t.identity)).map(t => new FlakyTest(Resources.packageTestTotalsTitle, t.file, t.identity, t.failure)));
    return isPassing && failedAgain.size === 0;
  }
}

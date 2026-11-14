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

import { Resources } from "../resources.ts";
import type { ICoverageCount } from "./interfaces/i-coverage-count.ts";
import type { IRunnerCounts } from "./interfaces/i-runner-counts.ts";
import type { IRunnerFindings } from "./interfaces/i-runner-findings.ts";
import type { IRunnerScope } from "./interfaces/i-runner-scope.ts";
import type { ITestSkip } from "./interfaces/i-test-skip.ts";
import { JsonFields } from "./json-fields.ts";
import { RunnerTotalsResources } from "./runner-totals.resources.ts";
import { TotalsVersionException } from "./totals-version.exception.ts";

export class RunnerTotals {
  public readonly runner: string;
  public readonly title: string;
  public readonly discovered: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly rerunPassed: number;
  public readonly skipped: number;
  public readonly unselected: number;
  public readonly unreached: number;
  public readonly skips: readonly ITestSkip[];
  public readonly files: readonly string[];
  public readonly coverage: ICoverageCount | null;
  public readonly duplicates: readonly string[];
  public readonly empty: readonly string[];
  public readonly expected: readonly string[];
  public readonly shard: string | null;

  public constructor(runner: string, title: string, counts: IRunnerCounts, skips: readonly ITestSkip[], files: readonly string[], coverage: ICoverageCount | null, findings: IRunnerFindings, scope: IRunnerScope) {
    this.runner = runner;
    this.title = title;
    this.discovered = counts.discovered;
    this.passed = counts.passed;
    this.failed = counts.failed;
    this.rerunPassed = counts.rerunPassed;
    this.skipped = counts.skipped;
    this.unselected = counts.unselected;
    this.unreached = counts.unreached;
    this.skips = [...skips];
    this.files = [...files];
    this.coverage = coverage;
    this.duplicates = [...findings.duplicates];
    this.empty = [...findings.empty];
    this.expected = [...scope.expected];
    this.shard = scope.shard;
  }

  public get executed(): number {
    return this.passed + this.failed;
  }

  public get counts(): IRunnerCounts {
    return { discovered: this.discovered, passed: this.passed, failed: this.failed, rerunPassed: this.rerunPassed, skipped: this.skipped, unselected: this.unselected, unreached: this.unreached };
  }

  public get missing(): readonly string[] {
    const files = new Set(this.files);
    return Object.isNull(this.shard) ? this.expected.filter(t => !files.has(t)) : [];
  }

  public get problems(): readonly string[] {
    return [
      this.countProblem,
      RunnerTotals.listProblem(RunnerTotalsResources.formatDuplicatesHeading(this.title), this.duplicates),
      RunnerTotals.listProblem(RunnerTotalsResources.formatEmptyHeading(this.title), this.empty),
      RunnerTotals.listProblem(RunnerTotalsResources.formatMissingHeading(this.title), this.missing)
    ].filter(t => !Object.isNull(t));
  }

  public static parse(text: string, source: string): RunnerTotals {
    const fields = JsonFields.parse(text, source);
    if (fields.count(Resources.totalsVersionField) !== RunnerTotalsResources.version)
      throw new TotalsVersionException(source, fields.count(Resources.totalsVersionField));
    const coverage = fields.has(Resources.totalsCoverageField) ? fields.object(Resources.totalsCoverageField) : null;
    return new RunnerTotals(
      fields.text(Resources.totalsRunnerField),
      fields.text(Resources.totalsTitleField),
      { discovered: fields.count(Resources.totalsDiscoveredField), passed: fields.count(Resources.totalsPassedField), failed: fields.count(Resources.totalsFailedField), rerunPassed: fields.count(Resources.totalsRerunPassedField), skipped: fields.count(Resources.totalsSkippedField), unselected: fields.count(Resources.totalsUnselectedField), unreached: fields.count(Resources.totalsUnreachedField) },
      fields.objects(Resources.totalsSkipsField).map(t => ({ test: t.text(Resources.totalsTestField), reason: t.text(Resources.totalsReasonField) })),
      fields.texts(Resources.totalsFilesField),
      Object.isNull(coverage) ? null : { unit: coverage.text(Resources.totalsUnitField), covered: coverage.count(Resources.totalsCoveredField), total: coverage.count(Resources.totalsTotalField) },
      { duplicates: fields.texts(Resources.totalsDuplicatesField), empty: fields.texts(Resources.totalsEmptyField) },
      { expected: fields.texts(Resources.totalsExpectedField), shard: fields.has(Resources.totalsShardField) ? fields.text(Resources.totalsShardField) : null });
  }

  public static async clearAsync(root: string): Promise<void> {
    await rm(path.join(root, ...RunnerTotalsResources.folderSegments), { recursive: true, force: true });
  }

  public static async readAllAsync(root: string, runners: readonly string[]): Promise<readonly RunnerTotals[]> {
    const totals: RunnerTotals[] = [];
    for (const runner of runners) {
      const file = RunnerTotals.locate(root, runner);
      if (existsSync(file))
        totals.push(RunnerTotals.parse(await readFile(file, Resources.encoding), path.relative(root, file).split(path.sep).join(path.posix.sep)));
    }
    return totals;
  }

  public static formatTable(totals: readonly RunnerTotals[]): string {
    return RunnerTotalsResources.formatTable(totals);
  }

  public formatLine(): string {
    return RunnerTotalsResources.formatLine(this);
  }

  public withRerunPassed(rerunPassed: number): RunnerTotals {
    return new RunnerTotals(this.runner, this.title, { ...this.counts, rerunPassed }, this.skips, this.files, this.coverage, this, this);
  }

  public toJson(): string {
    return JSON.stringify({
      version: RunnerTotalsResources.version,
      runner: this.runner,
      title: this.title,
      shard: this.shard,
      discovered: this.discovered,
      executed: this.executed,
      passed: this.passed,
      failed: this.failed,
      rerunPassed: this.rerunPassed,
      skipped: this.skipped,
      unselected: this.unselected,
      unreached: this.unreached,
      skips: this.skips,
      files: this.files,
      expected: this.expected,
      coverage: this.coverage,
      duplicates: this.duplicates,
      empty: this.empty
    });
  }

  public async writeAsync(root: string): Promise<void> {
    const file = RunnerTotals.locate(root, this.runner);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, this.toJson(), Resources.encoding);
  }

  public async recordAsync(root: string, output: Writable): Promise<boolean> {
    await this.writeAsync(root);
    return this.report(output);
  }

  public report(output: Writable): boolean {
    const problems = this.problems;
    output.write(problems.map(t => `${t}${Resources.lineEnd}`).join(String.empty));
    return problems.length === 0;
  }

  private get countProblem(): string | null {
    if (this.unselected < 0)
      return RunnerTotalsResources.formatOverSelected(this);
    if (this.discovered !== this.executed + this.skipped + this.unselected + this.unreached)
      return RunnerTotalsResources.formatUnbalanced(this);
    if (this.skips.length !== this.skipped)
      return RunnerTotalsResources.formatSkipMismatch(this);
    return null;
  }

  private static locate(root: string, runner: string): string {
    return path.join(root, ...RunnerTotalsResources.folderSegments, `${runner}${RunnerTotalsResources.extension}`);
  }

  private static listProblem(heading: string, items: readonly string[]): string | null {
    return items.length === 0 ? null : RunnerTotalsResources.formatList(heading, items);
  }
}
